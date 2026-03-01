"use server";

import { revalidatePath } from "next/cache";
import { ensureCanManageAppointments } from "@/lib/clinic-access";
import { BOT_SETTINGS_SINGLETON_KEY } from "@/lib/bot-settings";
import { prisma } from "@/lib/prisma";
import {
  countActiveHumanHandoffs,
  getHandoffStatus,
  listActiveHumanHandoffs,
  setHandoffMode,
  type ActiveHumanHandoffItem,
  type HandoffStatus,
} from "@/lib/human-handoff";
import {
  addOutboundHandoffMessage,
  listHandoffMessages,
  markInboundHandoffMessagesAsRead,
  type HandoffChatMessage,
} from "@/lib/handoff-chat";
import { normalizeIncomingPhone } from "@/lib/n8n-phone";
import {
  resolveMissingProviderConfigMessage,
  sendConfiguredWhatsAppMessage,
} from "@/lib/whatsapp-provider";

interface HandoffAccess {
  ok: true;
  userId: string;
  userRole: "ADMIN" | "ATENDENTE";
  userName: string | null;
  userEmail: string | null;
}

async function ensureHandoffAccess(): Promise<
  HandoffAccess | { ok: false; error: string }
> {
  const access = await ensureCanManageAppointments();
  if (!access.ok) {
    return { ok: false, error: access.error };
  }

  if (access.userRole !== "ADMIN" && access.userRole !== "ATENDENTE") {
    return {
      ok: false,
      error: "Apenas administradores e atendentes podem gerir handoff humano.",
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: access.userId },
    select: { name: true, email: true },
  });

  return {
    ok: true,
    userId: access.userId,
    userRole: access.userRole,
    userName: user?.name ?? null,
    userEmail: user?.email ?? null,
  };
}

function normalizePhoneInput(value: string) {
  const normalized = normalizeIncomingPhone(value);
  if (!normalized) {
    throw new Error("Telefone invalido. Informe em formato nacional ou com 55.");
  }
  return normalized;
}

function formatMessageForPatient(senderName: string, content: string) {
  const safeSender = senderName.replace(/\*/g, "").trim() || "Atendente";
  return `*${safeSender}*: ${content}`;
}

function normalizeComparisonText(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function isHandoffAssignedToCurrentUser(
  assignedAgent: string | null,
  access: HandoffAccess,
) {
  const assigned = normalizeComparisonText(assignedAgent);
  if (!assigned) return false;

  const name = normalizeComparisonText(access.userName);
  const email = normalizeComparisonText(access.userEmail);

  return (
    assigned === name ||
    assigned === email ||
    (!!email && assigned.includes(email)) ||
    (!!name && assigned.includes(name))
  );
}

function ensureCanAccessAssignedConversation(
  handoff: HandoffStatus,
  access: HandoffAccess,
) {
  if (access.userRole === "ADMIN") {
    return { ok: true as const };
  }

  if (isHandoffAssignedToCurrentUser(handoff.assignedAgent, access)) {
    return { ok: true as const };
  }

  const owner = handoff.assignedAgent?.trim() || "outro atendente";
  return {
    ok: false as const,
    error: handoff.assignedAgent?.trim()
      ? `Este atendimento está com ${owner}. Assuma o chat para visualizar e responder.`
      : "Este atendimento ainda não foi assumido. Assuma o chat para visualizar e responder.",
  };
}

type ListActiveHandoffsActionResult =
  | {
      success: true;
      total: number;
      items: ActiveHumanHandoffItem[];
    }
  | {
      success: false;
      error: string;
    };

type ResumeHandoffActionResult =
  | {
      success: true;
      handoff: HandoffStatus;
    }
  | {
      success: false;
      error: string;
    };

type ClaimHandoffActionResult =
  | {
      success: true;
      handoff: HandoffStatus;
      assignedAgent: string;
    }
  | {
      success: false;
      error: string;
    };

type GetHandoffMessagesActionResult =
  | {
      success: true;
      normalizedPhone: string;
      items: HandoffChatMessage[];
    }
  | {
      success: false;
      error: string;
    };

type SendHandoffMessageActionResult =
  | {
      success: true;
      message: HandoffChatMessage;
    }
  | {
      success: false;
      error: string;
    };

type MarkHandoffMessagesReadActionResult =
  | {
      success: true;
      updatedCount: number;
    }
  | {
      success: false;
      error: string;
    };

export async function listActiveHandoffsAction(
  limit = 200,
): Promise<ListActiveHandoffsActionResult> {
  try {
    const access = await ensureHandoffAccess();
    if (!access.ok) {
      return { success: false, error: access.error };
    }

    const [total, items] = await Promise.all([
      countActiveHumanHandoffs(),
      listActiveHumanHandoffs(limit),
    ]);

    return { success: true, total, items };
  } catch {
    return { success: false, error: "Falha ao listar handoffs ativos." };
  }
}

export async function resumeHandoffAction(input: {
  phone: string;
  reason?: string;
}): Promise<ResumeHandoffActionResult> {
  try {
    const access = await ensureHandoffAccess();
    if (!access.ok) {
      return { success: false, error: access.error };
    }

    const normalizedPhone = normalizePhoneInput(input.phone);
    const handoff = await getHandoffStatus(normalizedPhone);
    if (!handoff || handoff.mode !== "HUMAN") {
      return {
        success: false,
        error: "Este telefone nao esta em handoff humano ativo.",
      };
    }

    if (!handoff.assignedAgent?.trim()) {
      return {
        success: false,
        error: "Este atendimento ainda não possui responsável. Assuma o chat antes de retomar o bot.",
      };
    }

    if (!isHandoffAssignedToCurrentUser(handoff.assignedAgent, access)) {
      return {
        success: false,
        error:
          "Apenas o responsável atual pode retomar o bot. Assuma o chat para continuar.",
      };
    }

    const updatedHandoff = await setHandoffMode({
      rawPhone: normalizedPhone,
      mode: "BOT",
      reason:
        input.reason?.trim() || "Retomado manualmente pelo time de atendimento.",
      actor: `${access.userRole.toLowerCase()}:${access.userId}`,
    });

    revalidatePath("/admin/handoff");
    revalidatePath("/admin");

    return { success: true, handoff: updatedHandoff };
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Falha ao retomar bot no telefone." };
  }
}

export async function claimHandoffAction(input: {
  phone: string;
  reason?: string;
}): Promise<ClaimHandoffActionResult> {
  try {
    const access = await ensureHandoffAccess();
    if (!access.ok) {
      return { success: false, error: access.error };
    }

    const normalizedPhone = normalizePhoneInput(input.phone);
    const user = await prisma.user.findUnique({
      where: { id: access.userId },
      select: { name: true, email: true },
    });

    const assignedAgent =
      user?.name?.trim() || user?.email?.trim() || `user:${access.userId}`;

    const currentHandoff = await getHandoffStatus(normalizedPhone);
    const reason =
      input.reason?.trim() ||
      currentHandoff?.reason ||
      "Atendimento assumido manualmente no painel.";

    const handoff = await setHandoffMode({
      rawPhone: normalizedPhone,
      mode: "HUMAN",
      reason,
      actor: `${access.userRole.toLowerCase()}:${access.userId}`,
      assignedAgent,
    });

    revalidatePath("/admin/handoff");
    revalidatePath("/admin");

    return { success: true, handoff, assignedAgent };
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Falha ao assumir atendimento no handoff." };
  }
}

export async function getHandoffMessagesAction(input: {
  phone: string;
  limit?: number;
}): Promise<GetHandoffMessagesActionResult> {
  try {
    const access = await ensureHandoffAccess();
    if (!access.ok) {
      return { success: false, error: access.error };
    }

    const normalizedPhone = normalizePhoneInput(input.phone);
    const handoff = await getHandoffStatus(normalizedPhone);
    if (!handoff || handoff.mode !== "HUMAN") {
      return {
        success: false,
        error: "Este telefone nao esta em handoff humano ativo.",
      };
    }

    const conversationAccess = ensureCanAccessAssignedConversation(handoff, access);
    if (!conversationAccess.ok) {
      return { success: false, error: conversationAccess.error };
    }

    const items = await listHandoffMessages(normalizedPhone, input.limit ?? 250);
    return { success: true, normalizedPhone, items };
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Falha ao carregar mensagens do handoff." };
  }
}

export async function sendHandoffMessageAction(input: {
  phone: string;
  content: string;
}): Promise<SendHandoffMessageActionResult> {
  try {
    const access = await ensureHandoffAccess();
    if (!access.ok) {
      return { success: false, error: access.error };
    }

    const normalizedPhone = normalizePhoneInput(input.phone);
    const content = input.content.trim();
    if (!content) {
      return { success: false, error: "Mensagem vazia." };
    }

    const handoff = await getHandoffStatus(normalizedPhone);
    if (!handoff || handoff.mode !== "HUMAN") {
      return {
        success: false,
        error: "Este telefone nao esta em handoff humano ativo.",
      };
    }

    const conversationAccess = ensureCanAccessAssignedConversation(handoff, access);
    if (!conversationAccess.ok) {
      return { success: false, error: conversationAccess.error };
    }

    const settings = await prisma.clinicBotSettings.findUnique({
      where: { singletonKey: BOT_SETTINGS_SINGLETON_KEY },
      select: {
        whatsappProvider: true,
        evolutionApiUrl: true,
        evolutionInstanceName: true,
        evolutionApiToken: true,
        metaPhoneNumberId: true,
        metaAccessToken: true,
        metaApiVersion: true,
        messageTypingDelayMs: true,
        messageTypingPresence: true,
      },
    });

    const providerConfigError = resolveMissingProviderConfigMessage(settings ?? {});
    if (providerConfigError) {
      return {
        success: false,
        error: providerConfigError,
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: access.userId },
      select: { name: true, email: true },
    });
    const senderName =
      user?.name?.trim() || user?.email?.trim() || `user:${access.userId}`;
    const patientMessage = formatMessageForPatient(senderName, content);

    await sendConfiguredWhatsAppMessage({
      settings: settings ?? {},
      phone: normalizedPhone,
      content: patientMessage,
      delay: settings?.messageTypingDelayMs ?? 900,
      presence:
        settings?.messageTypingPresence === "recording" ||
        settings?.messageTypingPresence === "paused"
          ? settings.messageTypingPresence
          : "composing",
    });

    const message = await addOutboundHandoffMessage({
      rawPhone: normalizedPhone,
      content,
      senderUserId: access.userId,
      senderName,
    });

    await setHandoffMode({
      rawPhone: normalizedPhone,
      mode: "HUMAN",
      reason: handoff.reason || "Atendimento humano em andamento.",
      actor: `${access.userRole.toLowerCase()}:${access.userId}`,
      assignedAgent: senderName,
    });

    revalidatePath("/admin/handoff");
    return { success: true, message };
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Falha ao enviar mensagem no handoff." };
  }
}

export async function markHandoffMessagesReadAction(input: {
  phone: string;
}): Promise<MarkHandoffMessagesReadActionResult> {
  try {
    const access = await ensureHandoffAccess();
    if (!access.ok) {
      return { success: false, error: access.error };
    }

    const normalizedPhone = normalizePhoneInput(input.phone);
    const handoff = await getHandoffStatus(normalizedPhone);
    if (!handoff || handoff.mode !== "HUMAN") {
      return {
        success: false,
        error: "Este telefone nao esta em handoff humano ativo.",
      };
    }

    const conversationAccess = ensureCanAccessAssignedConversation(handoff, access);
    if (!conversationAccess.ok) {
      return { success: false, error: conversationAccess.error };
    }

    const updatedCount = await markInboundHandoffMessagesAsRead(normalizedPhone);

    if (updatedCount > 0) {
      revalidatePath("/admin/handoff");
      revalidatePath("/admin");
    }

    return { success: true, updatedCount };
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return {
      success: false,
      error: "Falha ao marcar mensagens de handoff como lidas.",
    };
  }
}

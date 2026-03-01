"use server";

import { sendEmail } from "@/lib/mail";
import {
  createPasswordResetToken,
  verifyPasswordResetToken,
} from "@/lib/password-reset-token";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ensureAdminAccess } from "@/lib/clinic-access";

const PLACEHOLDER_PASSWORD = "PENDING_SETUP";
const DEFAULT_RECOVERY_COOLDOWN_MINUTES = 5;

function getRecoveryCooldownMs() {
  const configured = Number(process.env.PASSWORD_RECOVERY_COOLDOWN_MINUTES);
  if (Number.isFinite(configured) && configured > 0) {
    return configured * 60 * 1000;
  }
  return DEFAULT_RECOVERY_COOLDOWN_MINUTES * 60 * 1000;
}

export async function sendPasswordSetupEmail(
  email: string,
  name: string,
  role: string,
  bio?: string,
) {
  const access = await ensureAdminAccess();
  if (!access.ok) {
    return { success: false, error: access.error };
  }

  // Check if User already exists
  let user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    return {
      success: false,
      error: "Este email já está cadastrado no sistema.",
    };
  }

  const prismaRole =
    role === "ADMIN"
      ? "ADMIN"
      : role === "PROFESSIONAL"
        ? "DOUTOR"
        : "ATENDENTE";

  try {
    const placeholderHash = await bcrypt.hash(PLACEHOLDER_PASSWORD, 10);
    user = await prisma.user.create({
      data: {
        name,
        email,
        password: placeholderHash,
        role: prismaRole,
      },
    });
  } catch (e) {
    console.error("Error creating User:", e);
    return { success: false, error: "Falha ao criar usuário no banco." };
  }

  // If role is PROFESSIONAL/DOUTOR, also create a Professional record
  if (role === "PROFESSIONAL") {
    const prof = await prisma.professional.findUnique({ where: { email } });
    if (!prof) {
      await prisma.professional.create({
        data: {
          name,
          email,
          bio: bio || "Profissional Clínico",
        },
      });
    }
  }

  if (!user) {
    return { success: false, error: "Falha ao preparar novo usuário." };
  }

  let token: string;
  try {
    token = createPasswordResetToken({
      email,
      purpose: "setup",
      userVersionMs: user.updatedAt.getTime(),
    });
  } catch (error) {
    console.error("Error creating setup token:", error);
    return { success: false, error: "Falha ao gerar link de ativação." };
  }

  const webUrl = process.env.NEXT_PUBLIC_WEBAPP_URL || "http://localhost:3000";
  const setupUrl = `${webUrl}/reset-password?token=${token}`;

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f6f6f8; border-radius: 12px;">
      <div style="background-color: white; padding: 32px; border-radius: 12px; border: 1px solid #e2e8f0; text-align: center;">
        <h2 style="color: #111827; font-size: 24px; margin-bottom: 8px;">Bem-vindo ao Clinic OS, ${name}!</h2>
        <p style="color: #475569; font-size: 16px; margin-bottom: 24px;">Você foi convidado para acessar o sistema da clínica.</p>
        
        <p style="color: #475569; font-size: 16px; margin-bottom: 32px;">Para definir sua senha e começar a utilizar a plataforma, clique no botão abaixo:</p>
        
        <a href="${setupUrl}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
          Definir Minha Senha
        </a>
        
        <p style="margin-top: 40px; font-size: 12px; color: #94a3b8; word-break: break-all;">
          Se o botão não funcionar, copie e cole este link no seu navegador:<br/>
          <a href="${setupUrl}" style="color: #4F46E5;">${setupUrl}</a>
        </p>
      </div>
    </div>
  `;

  return sendEmail({
    to: email,
    subject: "Bem-vindo ao Clinic OS - Defina sua senha",
    html,
  });
}

export async function sendPasswordRecoveryEmail(email: string) {
  const now = new Date();
  const cooldownMs = getRecoveryCooldownMs();
  const cooldownThreshold = new Date(now.getTime() - cooldownMs);

  // Atomic claim: only ACTIVE users outside cooldown can request a new email.
  // For all other cases we return neutral success to avoid user enumeration.
  const canSend = await prisma.user.updateMany({
    where: {
      email,
      status: "ACTIVE",
      OR: [
        { lastRecoveryEmailSentAt: null },
        { lastRecoveryEmailSentAt: { lte: cooldownThreshold } },
      ],
    },
    data: {
      lastRecoveryEmailSentAt: now,
    },
  });

  if (canSend.count === 0) {
    return { success: true };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { email: true, status: true, updatedAt: true },
  });

  if (!user || user.status !== "ACTIVE") {
    return { success: true };
  }

  let token: string;
  try {
    token = createPasswordResetToken({
      email,
      purpose: "recovery",
      userVersionMs: user.updatedAt.getTime(),
    });
  } catch (error) {
    console.error("Error creating recovery token:", error);
    return { success: false, error: "Falha ao gerar link de recuperação." };
  }

  const webUrl = process.env.NEXT_PUBLIC_WEBAPP_URL || "http://localhost:3000";
  const resetUrl = `${webUrl}/reset-password?token=${token}`;

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f6f6f8; border-radius: 12px;">
      <div style="background-color: white; padding: 32px; border-radius: 12px; border: 1px solid #e2e8f0; text-align: center;">
        <h2 style="color: #111827; font-size: 24px; margin-bottom: 8px;">Recuperação de Senha</h2>
        <p style="color: #475569; font-size: 16px; margin-bottom: 24px;">Recebemos uma solicitação para redefinir a senha da sua conta no Clinic OS.</p>
        
        <p style="color: #475569; font-size: 16px; margin-bottom: 32px;">Para criar uma nova senha, clique no botão abaixo:</p>
        
        <a href="${resetUrl}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
          Redefinir Minha Senha
        </a>
        
        <p style="margin-top: 40px; font-size: 12px; color: #94a3b8; word-break: break-all;">
          Se você não solicitou esta alteração, pode ignorar este e-mail tranquilamente. Sua senha continuará a mesma.
        </p>
      </div>
    </div>
  `;

  return sendEmail({
    to: email,
    subject: "Recuperação de Senha - Clinic OS",
    html,
  });
}

export async function resetPasswordAction(token: string, newPassword: string) {
  try {
    const verification = verifyPasswordResetToken(token);
    if (!verification.valid || !verification.payload) {
      return {
        success: false,
        error: "Este link de redefinição é inválido ou expirou.",
      };
    }

    const { payload } = verification;
    const email = payload.sub;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return {
        success: false,
        error: "Usuário não encontrado ou token inválido.",
      };
    }

    if (user.status === "BLOCKED") {
      return {
        success: false,
        error:
          "Este usuário está bloqueado. Entre em contato com um administrador para recuperar o acesso.",
      };
    }

    if (user.updatedAt.getTime() !== payload.uv) {
      return {
        success: false,
        error: "Este link de redefinição não é mais válido.",
      };
    }

    if (payload.purpose === "setup" && user.status !== "PENDING") {
      return {
        success: false,
        error:
          "Este link de ativação já foi utilizado. Se necessário, use a recuperação de senha.",
      };
    }

    if (payload.purpose === "recovery" && user.status !== "ACTIVE") {
      return {
        success: false,
        error: "Este link não pode ser usado para o status atual do usuário.",
      };
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const updateData =
      payload.purpose === "setup"
        ? { password: hashedPassword, status: "ACTIVE" as const }
        : { password: hashedPassword };

    await prisma.user.update({
      where: { email },
      data: updateData,
    });

    return { success: true };
  } catch (error) {
    console.error("Error resetting password:", error);
    return {
      success: false,
      error: "Ocorreu um erro ao tentar redefinir a senha.",
    };
  }
}

export async function toggleUserBlockAction(
  email: string,
  currentStatus: string,
) {
  try {
    const access = await ensureAdminAccess();
    if (!access.ok) {
      return { success: false, error: access.error };
    }
    if (access.userEmail === email) {
      return {
        success: false,
        error: "Você não pode bloquear ou desbloquear o próprio usuário.",
      };
    }

    let newStatus: "ACTIVE" | "PENDING" | "BLOCKED";

    if (currentStatus === "BLOCKED") {
      // When unblocking, check if user ever completed password setup
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return { success: false, error: "Usuário não encontrado." };
      }

      const hasPendingSetupPassword = user.password.startsWith("$2")
        ? await bcrypt
            .compare(PLACEHOLDER_PASSWORD, user.password)
            .catch(() => false)
        : false;
      newStatus = hasPendingSetupPassword ? "PENDING" : "ACTIVE";
    } else {
      newStatus = "BLOCKED";
    }

    await prisma.user.update({
      where: { email },
      data: { status: newStatus },
    });
    return { success: true, newStatus };
  } catch (error) {
    console.error("Error toggling user block status:", error);
    return {
      success: false,
      error: "Ocorreu um erro ao atualizar o status do usuário.",
    };
  }
}

export async function deleteUserAction(email: string) {
  try {
    const access = await ensureAdminAccess();
    if (!access.ok) {
      return { success: false, error: access.error };
    }
    if (access.userEmail === email) {
      return { success: false, error: "Você não pode excluir a si mesmo." };
    }

    // Also remove the Professional record (and cascading schedules/bookings)
    const prof = await prisma.professional.findUnique({ where: { email } });
    if (prof) {
      await prisma.professional.delete({ where: { email } });
    }

    await prisma.user.delete({ where: { email } });
    return { success: true };
  } catch (error) {
    console.error("Error deleting user:", error);
    return { success: false, error: "Ocorreu um erro ao excluir o usuário." };
  }
}

export async function updateUserAction(
  email: string,
  data: { name: string; role: string; bio?: string },
) {
  try {
    const access = await ensureAdminAccess();
    if (!access.ok) {
      return { success: false, error: access.error };
    }

    const prismaRole =
      data.role === "ADMIN"
        ? "ADMIN"
        : data.role === "PROFESSIONAL"
          ? "DOUTOR"
          : "ATENDENTE";

    await prisma.user.update({
      where: { email },
      data: {
        name: data.name,
        role: prismaRole,
      },
    });

    const existingProf = await prisma.professional.findUnique({
      where: { email },
    });

    if (data.role === "PROFESSIONAL") {
      // Create or update Professional record
      if (existingProf) {
        await prisma.professional.update({
          where: { email },
          data: {
            name: data.name,
            bio: data.bio || existingProf.bio,
          },
        });
      } else {
        await prisma.professional.create({
          data: {
            name: data.name,
            email,
            bio: data.bio || "Profissional Clínico",
          },
        });
      }
    } else if (existingProf) {
      // Role changed away from PROFESSIONAL — remove Professional record
      await prisma.professional.delete({ where: { email } });
    }

    return { success: true };
  } catch (error) {
    console.error("Error updating user:", error);
    return {
      success: false,
      error: "Ocorreu um erro ao atualizar o usuário.",
    };
  }
}

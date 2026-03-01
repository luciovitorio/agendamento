import { prisma } from "@/lib/prisma";
import { normalizeIncomingPhone } from "@/lib/n8n-phone";
import {
  getConversation,
  setConversation,
  clearConversation,
  type ConversationData,
} from "@/lib/bot-state";
import { BookingStatus, BookingSource } from "@prisma/client";
import { BOT_SETTINGS_SINGLETON_KEY } from "@/lib/bot-settings";
import {
  buildClinicDateTimeFromDate,
  createAppointment,
  getClinicTimezoneOffset,
  toClinicDateStr,
} from "@/lib/appointments";
import { cancelBookingRemindersForBooking } from "@/lib/booking-reminders";
import { addMinutes, format, parse, isBefore } from "date-fns";
import type { EvolutionListMessage } from "./evolution-api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BotSettings {
  whatsappProvider?: "EVOLUTION" | "META_CLOUD" | null;
  isBotEnabled: boolean;
  useInteractiveMessages: boolean;
  interactiveMenuTitle: string;
  interactiveMenuButtonText: string;
  interactiveMenuSectionTitle: string;
  interactiveBackLabel: string;
  interactiveBackDescription: string;
  greetingKeywords?: string | null;
  availabilityDaysAhead: number;
  availabilityMaxDates: number;
  availabilityPreviewTimes: number;
  upcomingBookingsLimit: number;
  messageTypingDelayMs: number;
  messageTypingPresence: "composing" | "recording" | "paused";
  whatsappPhone?: string | null;
  evolutionApiUrl?: string | null;
  evolutionInstanceName?: string | null;
  evolutionApiToken?: string | null;
  evolutionWebhookToken?: string | null;
  metaPhoneNumberId?: string | null;
  metaAccessToken?: string | null;
  metaWebhookVerifyToken?: string | null;
  metaAppSecret?: string | null;
  metaApiVersion?: string | null;
  n8nBaseUrl?: string | null;
  n8nWebhookMode?: string | null;
  n8nWebhookPath?: string | null;
  welcomeMessage: string;
  firstContactMessage: string;
  fallbackMessage: string;
  businessHoursMessage: string;
  confirmMessage: string;
  cancelMessage: string;
  rescheduleMessage: string;
  humanHandoffMessage: string;
  allowAutoCancel: boolean;
  allowAutoReschedule: boolean;
}

interface ProcessResult {
  response: string | EvolutionListMessage;
  state: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NUM_EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
const DEFAULT_GREETINGS = [
  "oi",
  "olá",
  "ola",
  "bom dia",
  "boa tarde",
  "boa noite",
  "hello",
  "hi",
  "opa",
  "eai",
  "e aí",
  "fala",
  "hey",
];

function numbered(items: string[]): string {
  return items.map((t, i) => `${NUM_EMOJIS[i] ?? `${i + 1}.`} ${t}`).join("\n");
}

function parseOption(msg: string): number | null {
  const n = parseInt(msg.trim(), 10);
  return isNaN(n) ? null : n;
}

function backHint(): string {
  return "\n\n_Digite *0* para voltar uma etapa._";
}

function buildOptions(
  settings: BotSettings,
  title: string,
  options: { label: string; desc?: string; id?: string }[],
  backHintEnabled: boolean = true,
): string | EvolutionListMessage {
  if (settings.useInteractiveMessages) {
    const menuTitle = (settings.interactiveMenuTitle || "Opções").trim();
    const menuButtonText = (settings.interactiveMenuButtonText || "Ver opções").trim();
    const menuSectionTitle = (
      settings.interactiveMenuSectionTitle || "Selecione uma opção"
    ).trim();
    const backLabel = (settings.interactiveBackLabel || "Voltar").trim();
    const backDescription = (
      settings.interactiveBackDescription || "Voltar ao menu"
    ).trim();

    const rows = options.map((o, idx) => ({
      title: o.label.substring(0, 24),
      description: o.desc ? o.desc.substring(0, 72) : undefined,
      rowId: o.id || String(idx + 1),
    }));
    if (backHintEnabled) {
      rows.push({
        title: backLabel.substring(0, 24),
        description: backDescription.substring(0, 72),
        rowId: "0",
      });
    }
    return {
      title: menuTitle.substring(0, 24),
      description: title.replace(/\*/g, ""),
      buttonText: menuButtonText.substring(0, 20),
      sections: [{ title: menuSectionTitle.substring(0, 40), rows }],
    };
  }

  const normalizedTitle =
    title.startsWith("📋") ||
    title.startsWith("👨‍⚕️") ||
    title.startsWith("🏥") ||
    title.startsWith("📅") ||
    title.startsWith("⏰") ||
    title.startsWith("✅") ||
    title.startsWith("❌") ||
    title.startsWith("⚠️")
      ? title
      : `*${title}*`;
  const shouldInsertSpacer = !/\n\s*$/.test(normalizedTitle);

  const textLines = [
    normalizedTitle,
    ...(shouldInsertSpacer ? [""] : []),
    numbered(options.map((o) => o.label + (o.desc ? ` - ${o.desc}` : ""))),
  ];
  if (backHintEnabled) {
    textLines.push(backHint());
  }
  return textLines.join("\n");
}

function getGreetingKeywords(settings: BotSettings) {
  const configured = settings.greetingKeywords
    ?.split(/[,\n;]+/g)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  if (configured && configured.length > 0) {
    return configured;
  }

  return DEFAULT_GREETINGS;
}

function isGreeting(msg: string, settings: BotSettings): boolean {
  const lower = msg.toLowerCase().trim();
  const greetings = getGreetingKeywords(settings);
  return greetings.some(
    (g) =>
      lower === g ||
      lower.startsWith(g + " ") ||
      lower.startsWith(g + "!") ||
      lower.startsWith(g + ","),
  );
}

function hasRescheduleIntent(message: string) {
  const lower = message.toLowerCase();
  return (
    lower.includes("remarcar") ||
    lower.includes("remarca") ||
    lower.includes("reagendar") ||
    lower.includes("reagenda")
  );
}

function getClinicCurrentTimeHHmm(reference: Date) {
  const clinicMidnight = buildClinicDateTimeFromDate(reference, "00:00");
  const elapsedMs = Math.max(0, reference.getTime() - clinicMidnight.getTime());
  const totalMinutes = Math.min(1439, Math.floor(elapsedMs / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function buildUpcomingBookingsFilter(patientId: string) {
  const now = new Date();
  const todayStr = toClinicDateStr(now);
  const startOfToday = new Date(
    `${todayStr}T00:00:00.000${getClinicTimezoneOffset()}`,
  );
  const currentTime = getClinicCurrentTimeHHmm(now);

  return {
    patientId,
    status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
    OR: [
      { date: { gt: startOfToday } },
      {
        date: startOfToday,
        startTime: { gte: currentTime },
      },
    ],
  };
}

export async function loadSettings(): Promise<BotSettings | null> {
  const s = await prisma.clinicBotSettings.findUnique({
    where: { singletonKey: BOT_SETTINGS_SINGLETON_KEY },
  });
  return s as BotSettings | null;
}

async function validateConversationPatient(
  phone: string,
  conv: ConversationData | null,
): Promise<ConversationData | null> {
  if (!conv?.patientId) {
    return conv;
  }

  const patient = await prisma.patient.findUnique({
    where: { id: conv.patientId },
    select: { id: true, name: true, phone: true },
  });

  if (!patient || patient.phone !== phone) {
    clearConversation(phone);
    return null;
  }

  if (conv.patientName !== patient.name) {
    return setConversation(phone, {
      state: conv.state,
      patientId: patient.id,
      patientName: patient.name,
    });
  }

  return conv;
}

function buildMenuText(settings: BotSettings): string | EvolutionListMessage {
  return buildOptions(
    settings,
    "📋 *Menu Principal*\n",
    [
      { label: "Agendar consulta" },
      { label: "Meus agendamentos" },
      { label: "Cancelar agendamento" },
      { label: "Planos aceitos" },
      { label: "Horário de atendimento" },
      { label: "Falar com atendente" },
    ],
    false, // no back hint
  );
}

async function handleBackNavigation(
  phone: string,
  conv: ConversationData,
  settings: BotSettings,
): Promise<ProcessResult> {
  switch (conv.state) {
    case "REGISTER_NAME":
      return { response: settings.firstContactMessage, state: "REGISTER_NAME" };

    case "REGISTER_PLAN_ASK":
      setConversation(phone, {
        state: "REGISTER_NAME",
        pendingName: undefined,
        serviceOptions: undefined,
      });
      return {
        response: "Sem problema. Me envie novamente seu *nome completo*.",
        state: "REGISTER_NAME",
      };

    case "REGISTER_PLAN_SELECT":
      setConversation(phone, {
        state: "REGISTER_PLAN_ASK",
        serviceOptions: undefined,
      });
      return {
        response: buildOptions(
          settings,
          "Você possui convênio?",
          [{ label: "Sim" }, { label: "Não (particular)" }],
          true,
        ),
        state: "REGISTER_PLAN_ASK",
      };

    case "REGISTER_PLAN_NOT_FOUND_ACTION": {
      const plans = conv.serviceOptions || [];
      if (plans.length > 0) {
        setConversation(phone, {
          state: "REGISTER_PLAN_SELECT",
          serviceOptions: plans,
        });
        return {
          response: buildOptions(
            settings,
            "🏥 Planos aceitos:",
            buildRegisterPlanOptions(plans),
            true,
          ),
          state: "REGISTER_PLAN_SELECT",
        };
      }

      setConversation(phone, {
        state: "REGISTER_PLAN_ASK",
        serviceOptions: undefined,
      });
      return {
        response: buildOptions(
          settings,
          "Você possui convênio?",
          [{ label: "Sim" }, { label: "Não (particular)" }],
          true,
        ),
        state: "REGISTER_PLAN_ASK",
      };
    }

    case "MENU":
      return { response: buildMenuText(settings), state: "MENU" };

    case "SELECT_SERVICE":
      setConversation(phone, {
        state: "MENU",
        selectedService: undefined,
        selectedProfessional: undefined,
        dateOptions: undefined,
        selectedDate: undefined,
        timeOptions: undefined,
        selectedTime: undefined,
      });
      return { response: buildMenuText(settings), state: "MENU" };

    case "SELECT_PROFESSIONAL": {
      const services = conv.serviceOptions;
      if (services && services.length > 0) {
        setConversation(phone, {
          state: "SELECT_SERVICE",
          selectedService: undefined,
          selectedProfessional: undefined,
          dateOptions: undefined,
          selectedDate: undefined,
          timeOptions: undefined,
          selectedTime: undefined,
        });
        return {
          response: buildOptions(
            settings,
            "📋 *Especialidades disponíveis:*",
            services.map((s) => ({
              label: s.name,
              desc: `${s.duration} min`,
            })),
            true,
          ),
          state: "SELECT_SERVICE",
        };
      }
      setConversation(phone, { state: "MENU" });
      return { response: buildMenuText(settings), state: "MENU" };
    }

    case "SELECT_DATE": {
      const profs = conv.professionalOptions;
      if (profs && profs.length > 1 && conv.selectedService) {
        setConversation(phone, {
          state: "SELECT_PROFESSIONAL",
          selectedProfessional: undefined,
          selectedDate: undefined,
          timeOptions: undefined,
          selectedTime: undefined,
        });
        return {
          response: buildOptions(
            settings,
            `👨‍⚕️ Profissionais para ${conv.selectedService.name}:`,
            profs.map((p) => ({ label: p.name })),
            true,
          ),
          state: "SELECT_PROFESSIONAL",
        };
      }

      const services = conv.serviceOptions;
      if (services && services.length > 0) {
        setConversation(phone, {
          state: "SELECT_SERVICE",
          selectedProfessional: undefined,
          selectedDate: undefined,
          timeOptions: undefined,
          selectedTime: undefined,
        });
        return {
          response: buildOptions(
            settings,
            "📋 *Especialidades disponíveis:*",
            services.map((s) => ({
              label: s.name,
              desc: `${s.duration} min`,
            })),
            true,
          ),
          state: "SELECT_SERVICE",
        };
      }

      setConversation(phone, { state: "MENU" });
      return { response: buildMenuText(settings), state: "MENU" };
    }

    case "SELECT_TIME": {
      const dates = conv.dateOptions || [];
      setConversation(phone, {
        state: "SELECT_DATE",
        selectedDate: undefined,
        timeOptions: undefined,
        selectedTime: undefined,
      });
      return {
        response: buildOptions(
          settings,
          "📅 Escolha um dia disponível:",
          dates.map((d) => {
            const [, mm, dd] = d.date.split("-");
            return {
              label: `${d.dayOfWeek} ${dd}/${mm}`,
            };
          }),
          true,
        ),
        state: "SELECT_DATE",
      };
    }

    case "CONFIRM_BOOKING": {
      const times = conv.timeOptions || [];
      const currentDate = conv.selectedDate?.date;
      const currentDay = conv.selectedDate?.dayOfWeek;
      const formattedDate = currentDate
        ? currentDate.split("-").slice(1).reverse().join("/")
        : "";

      setConversation(phone, { state: "SELECT_TIME", selectedTime: undefined });

      return {
        response: buildOptions(
          settings,
          formattedDate
            ? `⏰ Horários em ${currentDay} ${formattedDate}:`
            : "⏰ Escolha um horário:",
          times.map((t) => ({ label: t })),
          true,
        ),
        state: "SELECT_TIME",
      };
    }

    case "CANCEL_SELECT":
      setConversation(phone, { state: "MENU", bookingOptions: undefined });
      return { response: buildMenuText(settings), state: "MENU" };

    case "CANCEL_CONFIRM":
      if (conv.patientId) {
        return showCancelFlow(phone, conv, settings);
      }
      setConversation(phone, { state: "MENU", bookingOptions: undefined });
      return { response: buildMenuText(settings), state: "MENU" };

    default:
      setConversation(phone, { state: "MENU" });
      return { response: buildMenuText(settings), state: "MENU" };
  }
}

const WEEKDAY_PT: Record<number, string> = {
  0: "Dom",
  1: "Seg",
  2: "Ter",
  3: "Qua",
  4: "Qui",
  5: "Sex",
  6: "Sáb",
};

// ---------------------------------------------------------------------------
// Availability calculation (shared logic with /api/availability)
// ---------------------------------------------------------------------------

function calculateSlots(
  scheduleStart: string,
  scheduleEnd: string,
  duration: number,
  dayDate: Date,
  bookings: { startTime: string; endTime: string }[],
  timeOffs: { startDateTime: Date; endDateTime: Date }[],
  isToday: boolean,
): string[] {
  const start = parse(scheduleStart, "HH:mm", dayDate);
  const end = parse(scheduleEnd, "HH:mm", dayDate);
  const now = new Date();
  const slots: string[] = [];
  let cur = start;

  while (addMinutes(cur, duration) <= end) {
    const sTime = format(cur, "HH:mm");
    const eTime = format(addMinutes(cur, duration), "HH:mm");
    const curEnd = addMinutes(cur, duration);

    if (isToday && isBefore(cur, now)) {
      cur = addMinutes(cur, Math.min(duration, 30));
      continue;
    }

    const overlap = bookings.some(
      (b) =>
        (sTime >= b.startTime && sTime < b.endTime) ||
        (eTime > b.startTime && eTime <= b.endTime) ||
        (sTime <= b.startTime && eTime >= b.endTime),
    );
    const blocked = timeOffs.some(
      (t) => cur < t.endDateTime && curEnd > t.startDateTime,
    );

    if (!overlap && !blocked) slots.push(sTime);
    cur = addMinutes(cur, duration);
  }
  return slots;
}

// ---------------------------------------------------------------------------
// State Handlers
// ---------------------------------------------------------------------------

async function handleWelcome(
  phone: string,
  settings: BotSettings,
): Promise<ProcessResult> {
  const patient = await prisma.patient.findUnique({ where: { phone } });

  if (patient) {
    setConversation(phone, {
      state: "MENU",
      patientId: patient.id,
      patientName: patient.name,
    });
    const welcome = settings.welcomeMessage.replace(/\[NOME\]/gi, patient.name);
    const menu = buildMenuText(settings);
    if (typeof menu === "string") {
      return { response: `${welcome}\n\n${menu}`, state: "MENU" };
    } else {
      menu.description = `${welcome}\n\n${menu.description}`;
      return { response: menu, state: "MENU" };
    }
  }

  setConversation(phone, { state: "REGISTER_NAME" });
  return { response: settings.firstContactMessage, state: "REGISTER_NAME" };
}

async function handleRegisterName(
  phone: string,
  message: string,
  _conv: ConversationData, // eslint-disable-line @typescript-eslint/no-unused-vars
  settings: BotSettings,
): Promise<ProcessResult> {
  const name = message.trim();
  if (name.length < 3) {
    return {
      response: "Por favor, envie seu *nome completo* (mínimo 3 caracteres).",
      state: "REGISTER_NAME",
    };
  }

  setConversation(phone, { state: "REGISTER_PLAN_ASK", pendingName: name });

  const resp = buildOptions(
    settings,
    `Obrigado, *${name}*! 😊\n\nVocê possui convênio?`,
    [{ label: "Sim" }, { label: "Não (particular)" }],
    true,
  );

  return { response: resp, state: "REGISTER_PLAN_ASK" };
}

function buildRegisterPlanOptions(
  plans: { name: string }[],
): { label: string; desc?: string }[] {
  return [
    ...plans.map((p) => ({ label: p.name })),
    {
      label: "Meu plano não está na lista",
      desc: "Seguir particular ou validar com atendente",
    },
  ];
}

function buildPlanNotFoundActionOptions(): { label: string }[] {
  return [
    { label: "Seguir como particular" },
    { label: "Validar convênio com atendente" },
    { label: "Voltar para lista de planos" },
  ];
}

async function handleRegisterPlanAsk(
  phone: string,
  message: string,
  conv: ConversationData,
  settings: BotSettings,
): Promise<ProcessResult> {
  const opt = parseOption(message);

  if (opt === 0) {
    setConversation(phone, {
      state: "REGISTER_NAME",
      pendingName: undefined,
      serviceOptions: undefined,
    });
    return {
      response: "Sem problema. Me envie novamente seu *nome completo*.",
      state: "REGISTER_NAME",
    };
  }

  if (opt === 1) {
    const plans = await prisma.healthPlan.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    if (plans.length === 0) {
      // No plans configured, register as PARTICULAR
      return registerPatient(phone, conv.pendingName!, null, settings);
    }

    setConversation(phone, {
      state: "REGISTER_PLAN_SELECT",
      serviceOptions: plans.map((p) => ({
        id: p.id,
        name: p.name,
        duration: 0,
        price: 0,
      })),
    });

    const resp = buildOptions(
      settings,
      "🏥 Planos aceitos:",
      buildRegisterPlanOptions(plans),
      true,
    );

    return { response: resp, state: "REGISTER_PLAN_SELECT" };
  }

  if (opt === 2) {
    return registerPatient(phone, conv.pendingName!, null, settings);
  }

  return {
    response: buildOptions(
      settings,
      "Por favor, escolha:",
      [{ label: "Sim" }, { label: "Não (particular)" }],
      true,
    ),
    state: "REGISTER_PLAN_ASK",
  };
}

async function handleRegisterPlanSelect(
  phone: string,
  message: string,
  conv: ConversationData,
  settings: BotSettings,
): Promise<ProcessResult> {
  const opt = parseOption(message);
  const plans = conv.serviceOptions;
  const maxPlanOption = (plans?.length || 0) + 1;

  if (opt === 0) {
    setConversation(phone, { state: "REGISTER_PLAN_ASK", serviceOptions: undefined });
    return {
      response: buildOptions(
        settings,
        "Você possui convênio?",
        [{ label: "Sim" }, { label: "Não (particular)" }],
        true,
      ),
      state: "REGISTER_PLAN_ASK",
    };
  }

  if (plans && plans.length > 0 && opt === plans.length + 1) {
    setConversation(phone, {
      state: "REGISTER_PLAN_NOT_FOUND_ACTION",
      serviceOptions: plans,
    });

    return {
      response: buildOptions(
        settings,
        "Não encontrei seu convênio na lista. Como deseja seguir?",
        buildPlanNotFoundActionOptions(),
        true,
      ),
      state: "REGISTER_PLAN_NOT_FOUND_ACTION",
    };
  }

  if (!plans || !opt || opt < 1 || opt > maxPlanOption) {
    return {
      response: buildOptions(
        settings,
        "🏥 Planos aceitos:",
        buildRegisterPlanOptions(plans || []),
        true,
      ),
      state: "REGISTER_PLAN_SELECT",
    };
  }

  const selectedPlan = plans[opt - 1];
  return registerPatient(phone, conv.pendingName!, selectedPlan.id, settings);
}

async function handleRegisterPlanNotFoundAction(
  phone: string,
  message: string,
  conv: ConversationData,
  settings: BotSettings,
): Promise<ProcessResult> {
  const opt = parseOption(message);
  const plans = conv.serviceOptions || [];

  if (opt === 1) {
    const result = await registerPatient(phone, conv.pendingName!, null, settings);
    if (typeof result.response === "string") {
      result.response = `Perfeito. Vamos seguir como *particular*.\n\n${result.response}`;
    } else {
      result.response.description = `Perfeito. Vamos seguir como particular.\n\n${result.response.description}`;
    }
    return result;
  }

  if (opt === 2) {
    clearConversation(phone);
    return {
      response:
        "Certo. Vou te encaminhar para um atendente validar seu convênio.\nSe puder, envie o nome do plano e o número da carteirinha.\n\n" +
        settings.humanHandoffMessage,
      state: "HUMAN_HANDOFF",
    };
  }

  if (opt === 3 || opt === 0) {
    if (plans.length === 0) {
      setConversation(phone, { state: "REGISTER_PLAN_ASK", serviceOptions: undefined });
      return {
        response: buildOptions(
          settings,
          "Você possui convênio?",
          [{ label: "Sim" }, { label: "Não (particular)" }],
          true,
        ),
        state: "REGISTER_PLAN_ASK",
      };
    }

    setConversation(phone, { state: "REGISTER_PLAN_SELECT", serviceOptions: plans });
    return {
      response: buildOptions(
        settings,
        "🏥 Planos aceitos:",
        buildRegisterPlanOptions(plans),
        true,
      ),
      state: "REGISTER_PLAN_SELECT",
    };
  }

  return {
    response: buildOptions(
      settings,
      "Não encontrei seu convênio na lista. Como deseja seguir?",
      buildPlanNotFoundActionOptions(),
      true,
    ),
    state: "REGISTER_PLAN_NOT_FOUND_ACTION",
  };
}

async function registerPatient(
  phone: string,
  name: string,
  healthPlanId: string | null,
  settings: BotSettings,
): Promise<ProcessResult> {
  const patient = await prisma.patient.create({
    data: {
      name,
      phone,
      coverageType: healthPlanId ? "PLAN" : "PARTICULAR",
      healthPlanId,
    },
  });

  setConversation(phone, {
    state: "MENU",
    patientId: patient.id,
    patientName: patient.name,
    pendingName: undefined,
    serviceOptions: undefined,
  });

  const resp = buildOptions(
    settings,
    `Cadastro realizado, *${name}*! Como podemos te ajudar? Escolha uma das opções no menu abaixo (seta para baixo).\n\n📋 *Menu Principal*`,
    [
      { label: "Agendar consulta" },
      { label: "Meus agendamentos" },
      { label: "Cancelar agendamento" },
      { label: "Planos aceitos" },
      { label: "Horário de atendimento" },
      { label: "Falar com atendente" },
    ],
    false,
  );

  return { response: resp, state: "MENU" };
}

// ---------------------------------------------------------------------------
// Menu handler
// ---------------------------------------------------------------------------

async function handleMenu(
  phone: string,
  message: string,
  conv: ConversationData,
  settings: BotSettings,
): Promise<ProcessResult> {
  // Detect greetings → re-show welcome + menu
  if (isGreeting(message, settings)) {
    const name = conv.patientName || "";
    const welcome = settings.welcomeMessage.replace(/\[NOME\]/gi, name);
    const menu = buildMenuText(settings);
    if (typeof menu === "string") {
      return { response: `${welcome}\n\n${menu}`, state: "MENU" };
    } else {
      menu.description = `${welcome}\n\n${menu.description}`;
      return { response: menu, state: "MENU" };
    }
  }

  const opt = parseOption(message);
  if (!opt && hasRescheduleIntent(message)) {
    const menu = buildMenuText(settings);
    if (settings.allowAutoReschedule) {
      if (typeof menu === "string") {
        return {
          response: `${settings.rescheduleMessage}\n\n${menu}`,
          state: "MENU",
        };
      }
      menu.description = `${settings.rescheduleMessage}\n\n${menu.description}`;
      return { response: menu, state: "MENU" };
    }

    if (typeof menu === "string") {
      return {
        response: `${settings.humanHandoffMessage}\n\n${menu}`,
        state: "MENU",
      };
    }
    menu.description = `${settings.humanHandoffMessage}\n\n${menu.description}`;
    return { response: menu, state: "MENU" };
  }

  switch (opt) {
    case 1:
      return showServices(phone, settings);
    case 2:
      return showBookings(conv, settings);
    case 3:
      if (!settings.allowAutoCancel) {
        const menu = buildMenuText(settings);
        if (typeof menu === "string") {
          return {
            response: `${settings.humanHandoffMessage}\n\n${menu}`,
            state: "MENU",
          };
        }
        menu.description = `${settings.humanHandoffMessage}\n\n${menu.description}`;
        return { response: menu, state: "MENU" };
      }
      return showCancelFlow(phone, conv, settings);
    case 4:
      return showPlans(phone, settings);
    case 5: {
      const menu = buildMenuText(settings);
      if (typeof menu === "string") {
        return {
          response: `🕐 ${settings.businessHoursMessage}\n\n${menu}`,
          state: "MENU",
        };
      } else {
        menu.description = `🕐 ${settings.businessHoursMessage}\n\n${menu.description}`;
        return { response: menu, state: "MENU" };
      }
    }
    case 6: {
      clearConversation(phone);
      return {
        response: settings.humanHandoffMessage,
        state: "HUMAN_HANDOFF",
      };
    }
    default: {
      const menu = buildMenuText(settings);
      if (typeof menu === "string") {
        return {
          response: `${settings.fallbackMessage}\n\n${menu}`,
          state: "MENU",
        };
      } else {
        menu.description = `${settings.fallbackMessage}\n\n${menu.description}`;
        return { response: menu, state: "MENU" };
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Option 1: Booking flow
// ---------------------------------------------------------------------------

async function showServices(
  phone: string,
  settings: BotSettings,
): Promise<ProcessResult> {
  const services = await prisma.service.findMany({
    where: { professionals: { some: {} } },
    select: { id: true, name: true, duration: true, price: true },
    orderBy: { name: "asc" },
  });

  if (services.length === 0) {
    const menu = buildMenuText(settings);
    if (typeof menu === "string") {
      return {
        response: "Nenhum serviço disponível no momento.\n\n" + menu,
        state: "MENU",
      };
    } else {
      menu.description =
        "Nenhum serviço disponível no momento.\n\n" + menu.description;
      return { response: menu, state: "MENU" };
    }
  }

  setConversation(phone, {
    state: "SELECT_SERVICE",
    serviceOptions: services.map((s) => ({
      id: s.id,
      name: s.name,
      duration: s.duration,
      price: s.price ?? 0,
    })),
  });

  const resp = buildOptions(
    settings,
    "📋 *Especialidades disponíveis:*",
    services.map((s) => ({
      label: s.name,
      desc: `${s.duration} min`,
    })),
    true,
  );

  return { response: resp, state: "SELECT_SERVICE" };
}

async function handleSelectService(
  phone: string,
  message: string,
  conv: ConversationData,
  settings: BotSettings,
): Promise<ProcessResult> {
  const opt = parseOption(message);
  const services = conv.serviceOptions;

  if (!services || !opt || opt < 1 || opt > services.length) {
    return {
      response: buildOptions(
        settings,
        "📋 *Especialidades disponíveis:*",
        (services || []).map((s) => ({
          label: s.name,
          desc: `${s.duration} min`,
        })),
        true,
      ),
      state: "SELECT_SERVICE",
    };
  }

  const svc = services[opt - 1];
  const professionals = await prisma.professionalService.findMany({
    where: { serviceId: svc.id },
    select: { professional: { select: { id: true, name: true } } },
  });

  const profs = professionals.map((p) => p.professional);

  if (profs.length === 1) {
    // Auto-select if only one professional
    setConversation(phone, {
      state: "SELECT_DATE",
      selectedService: { id: svc.id, name: svc.name, duration: svc.duration },
      selectedProfessional: profs[0],
    });
    return showAvailability(
      phone,
      profs[0].id,
      svc.duration,
      profs[0].name,
      settings,
    );
  }

  setConversation(phone, {
    state: "SELECT_PROFESSIONAL",
    selectedService: { id: svc.id, name: svc.name, duration: svc.duration },
    professionalOptions: profs,
  });

  const resp = buildOptions(
    settings,
    `👨‍⚕️ Profissionais para ${svc.name}:`,
    profs.map((p) => ({ label: p.name })),
    true,
  );

  return { response: resp, state: "SELECT_PROFESSIONAL" };
}

async function handleSelectProfessional(
  phone: string,
  message: string,
  conv: ConversationData,
  settings: BotSettings,
): Promise<ProcessResult> {
  const opt = parseOption(message);
  const profs = conv.professionalOptions;

  if (!profs || !opt || opt < 1 || opt > profs.length) {
    return {
      response: buildOptions(
        settings,
        `👨‍⚕️ Profissionais para ${conv.selectedService?.name || "o serviço"}:`,
        (profs || []).map((p) => ({ label: p.name })),
        true,
      ),
      state: "SELECT_PROFESSIONAL",
    };
  }

  const prof = profs[opt - 1];
  const svc = conv.selectedService!;

  setConversation(phone, {
    state: "SELECT_DATE",
    selectedProfessional: prof,
  });

  return showAvailability(
    phone,
    prof.id,
    svc.duration,
    prof.name,
    settings,
  );
}

async function showAvailability(
  phone: string,
  professionalId: string,
  duration: number,
  professionalName: string,
  settings: BotSettings,
): Promise<ProcessResult> {
  const tzOffset = getClinicTimezoneOffset();
  const now = new Date();
  const todayStr = toClinicDateStr(now);
  const availabilityDaysAhead = Math.max(
    1,
    Math.min(60, settings.availabilityDaysAhead || 14),
  );
  const availabilityMaxDates = Math.max(
    1,
    Math.min(10, settings.availabilityMaxDates || 3),
  );

  const schedules = await prisma.schedule.findMany({
    where: { professionalId },
    select: { dayOfWeek: true, startTime: true, endTime: true },
  });

  const scheduleMap = new Map(schedules.map((s) => [s.dayOfWeek, s]));

  const datesToCheck: { dateStr: string; dayOfWeek: number; dayDate: Date }[] =
    [];
  for (let i = 0; i < availabilityDaysAhead; i++) {
    const d = new Date(now.getTime() + i * 86400000);
    const dateStr = toClinicDateStr(d);
    const dayDate = new Date(`${dateStr}T00:00:00.000${tzOffset}`);
    const dow = dayDate.getDay();
    if (scheduleMap.has(dow)) {
      datesToCheck.push({ dateStr, dayOfWeek: dow, dayDate });
    }
  }

  if (datesToCheck.length === 0) {
    setConversation(phone, { state: "MENU" });
    const menu = buildMenuText(settings);
    if (typeof menu === "string") {
      return {
        response: `${professionalName} não tem horários configurados nos próximos dias.\n\n${menu}`,
        state: "MENU",
      };
    } else {
      menu.description = `${professionalName} não tem horários configurados nos próximos dias.\n\n${menu.description}`;
      return { response: menu, state: "MENU" };
    }
  }

  const firstDate = new Date(
    `${datesToCheck[0].dateStr}T00:00:00.000${tzOffset}`,
  );
  const lastDate = new Date(
    `${datesToCheck[datesToCheck.length - 1].dateStr}T23:59:59.999${tzOffset}`,
  );

  const [bookings, timeOffs] = await Promise.all([
    prisma.booking.findMany({
      where: {
        professionalId,
        date: { gte: firstDate, lte: lastDate },
        status: { not: BookingStatus.CANCELLED },
      },
      select: { date: true, startTime: true, endTime: true },
    }),
    prisma.professionalTimeOff.findMany({
      where: {
        professionalId,
        startDateTime: { lte: lastDate },
        endDateTime: { gte: firstDate },
      },
      select: { startDateTime: true, endDateTime: true },
    }),
  ]);

  const bookingsByDate = new Map<
    string,
    { startTime: string; endTime: string }[]
  >();
  for (const b of bookings) {
    const bDate = toClinicDateStr(b.date);
    const arr = bookingsByDate.get(bDate) || [];
    arr.push({ startTime: b.startTime, endTime: b.endTime });
    bookingsByDate.set(bDate, arr);
  }

  const availableDays: { date: string; dayOfWeek: string; times: string[] }[] =
    [];

  for (const { dateStr, dayOfWeek, dayDate } of datesToCheck) {
    if (availableDays.length >= availabilityMaxDates) break;

    const sched = scheduleMap.get(dayOfWeek)!;
    const dayBookings = bookingsByDate.get(dateStr) || [];
    const sod = new Date(`${dateStr}T00:00:00.000${tzOffset}`);
    const eod = new Date(`${dateStr}T23:59:59.999${tzOffset}`);
    const dayTO = timeOffs.filter(
      (t) => t.startDateTime < eod && t.endDateTime > sod,
    );

    const times = calculateSlots(
      sched.startTime,
      sched.endTime,
      duration,
      dayDate,
      dayBookings,
      dayTO,
      dateStr === todayStr,
    );

    if (times.length > 0) {
      availableDays.push({
        date: dateStr,
        dayOfWeek: WEEKDAY_PT[dayOfWeek],
        times,
      });
    }
  }

  if (availableDays.length === 0) {
    setConversation(phone, { state: "MENU" });
    const menu = buildMenuText(settings);
    if (typeof menu === "string") {
      return {
        response: `Sem horários disponíveis para ${professionalName} nos próximos dias.\n\n${menu}`,
        state: "MENU",
      };
    } else {
      menu.description = `Sem horários disponíveis para ${professionalName} nos próximos dias.\n\n${menu.description}`;
      return { response: menu, state: "MENU" };
    }
  }

  setConversation(phone, { state: "SELECT_DATE", dateOptions: availableDays });

  const resp = buildOptions(
    settings,
    `📅 Datas disponíveis com ${professionalName}:\n_Primeiro escolha o dia, depois você escolherá o horário._`,
    availableDays.map((d) => {
      const [, mm, dd] = d.date.split("-");
      return { label: `${d.dayOfWeek} ${dd}/${mm}` };
    }),
    true,
  );

  return { response: resp, state: "SELECT_DATE" };
}

async function handleSelectDate(
  phone: string,
  message: string,
  conv: ConversationData,
  settings: BotSettings,
): Promise<ProcessResult> {
  const opt = parseOption(message);
  if (opt === 0) {
    const profs = conv.professionalOptions;
    if (profs && profs.length > 1 && conv.selectedService) {
      setConversation(phone, {
        state: "SELECT_PROFESSIONAL",
        selectedProfessional: undefined,
        selectedDate: undefined,
        timeOptions: undefined,
        selectedTime: undefined,
      });
      return {
        response: buildOptions(
          settings,
          `👨‍⚕️ Profissionais para ${conv.selectedService.name}:`,
          profs.map((p) => ({ label: p.name })),
          true,
        ),
        state: "SELECT_PROFESSIONAL",
      };
    }

    const services = conv.serviceOptions;
    if (services && services.length > 0) {
      setConversation(phone, {
        state: "SELECT_SERVICE",
        selectedProfessional: undefined,
        selectedDate: undefined,
        timeOptions: undefined,
        selectedTime: undefined,
      });
      return {
        response: buildOptions(
          settings,
          "📋 *Especialidades disponíveis:*",
          services.map((s) => ({
            label: s.name,
            desc: `${s.duration} min`,
          })),
          true,
        ),
        state: "SELECT_SERVICE",
      };
    }

    setConversation(phone, { state: "MENU" });
    const menu = buildMenuText(settings);
    return { response: menu, state: "MENU" };
  }

  const dates = conv.dateOptions;

  if (!dates || !opt || opt < 1 || opt > dates.length) {
    return {
      response: buildOptions(
        settings,
        "📅 Escolha um dia disponível:",
        (dates || []).map((d) => {
          const [, mm, dd] = d.date.split("-");
          return {
            label: `${d.dayOfWeek} ${dd}/${mm}`,
          };
        }),
        true,
      ),
      state: "SELECT_DATE",
    };
  }

  const day = dates[opt - 1];
  setConversation(phone, {
    state: "SELECT_TIME",
    selectedDate: { date: day.date, dayOfWeek: day.dayOfWeek },
    timeOptions: day.times,
  });

  const [, mm, dd] = day.date.split("-");

  const resp = buildOptions(
    settings,
    `⏰ Horários em ${day.dayOfWeek} ${dd}/${mm}:`,
    day.times.map((t) => ({ label: t })),
    true,
  );

  return { response: resp, state: "SELECT_TIME" };
}

async function handleSelectTime(
  phone: string,
  message: string,
  conv: ConversationData,
  settings: BotSettings,
): Promise<ProcessResult> {
  const opt = parseOption(message);
  if (opt === 0) {
    const dates = conv.dateOptions || [];
    setConversation(phone, {
      state: "SELECT_DATE",
      selectedDate: undefined,
      timeOptions: undefined,
      selectedTime: undefined,
    });
    return {
      response: buildOptions(
        settings,
        "📅 Escolha um dia disponível:",
        dates.map((d) => {
          const [, mm, dd] = d.date.split("-");
          return {
            label: `${d.dayOfWeek} ${dd}/${mm}`,
          };
        }),
        true,
      ),
      state: "SELECT_DATE",
    };
  }

  const times = conv.timeOptions;

  if (!times || !opt || opt < 1 || opt > times.length) {
    const currentDate = conv.selectedDate?.date;
    const currentDay = conv.selectedDate?.dayOfWeek;
    const formattedDate = currentDate ? currentDate.split("-").slice(1).reverse().join("/") : "";
    return {
      response: buildOptions(
        settings,
        formattedDate
          ? `⏰ Horários em ${currentDay} ${formattedDate}:`
          : "⏰ Escolha um horário:",
        (times || []).map((t) => ({ label: t })),
        true,
      ),
      state: "SELECT_TIME",
    };
  }

  const time = times[opt - 1];
  const svc = conv.selectedService!;
  const prof = conv.selectedProfessional!;
  const dt = conv.selectedDate!;
  const [, mm, dd] = dt.date.split("-");

  setConversation(phone, { state: "CONFIRM_BOOKING", selectedTime: time });

  const resp = buildOptions(
    settings,
    `✅ *Confirme seu agendamento:*\n📋 Serviço: *${svc.name}*\n👨‍⚕️ Profissional: *${prof.name}*\n📅 Data: *${dt.dayOfWeek} ${dd}/${mm}*\n⏰ Horário: *${time}*`,
    [{ label: "Confirmar ✅" }, { label: "Cancelar ❌" }],
    true,
  );

  return { response: resp, state: "CONFIRM_BOOKING" };
}

async function handleConfirmBooking(
  phone: string,
  message: string,
  conv: ConversationData,
  settings: BotSettings,
): Promise<ProcessResult> {
  const opt = parseOption(message);

  if (opt === 2) {
    setConversation(phone, { state: "MENU" });
    const menu = buildMenuText(settings);
    if (typeof menu === "string") {
      return { response: `Agendamento cancelado.\n\n${menu}`, state: "MENU" };
    } else {
      menu.description = `Agendamento cancelado.\n\n${menu.description}`;
      return { response: menu, state: "MENU" };
    }
  }

  if (opt !== 1) {
    return {
      response: buildOptions(
        settings,
        "Por favor, escolha:",
        [{ label: "Confirmar ✅" }, { label: "Cancelar ❌" }],
        true,
      ),
      state: "CONFIRM_BOOKING",
    };
  }

  const result = await createAppointment({
    professionalId: conv.selectedProfessional!.id,
    serviceId: conv.selectedService!.id,
    dateStr: conv.selectedDate!.date,
    startTime: conv.selectedTime!,
    patientName: conv.patientName!,
    patientPhone: phone,
    status: BookingStatus.PENDING,
    source: BookingSource.BOT_N8N,
    externalRequestId: `bot-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  });

  if (!result.success) {
    setConversation(phone, { state: "MENU" });
    const menu = buildMenuText(settings);
    if (typeof menu === "string") {
      return {
        response: `❌ Não foi possível agendar: ${result.message}\n\n${menu}`,
        state: "MENU",
      };
    } else {
      menu.description = `❌ Não foi possível agendar: ${result.message}\n\n${menu.description}`;
      return { response: menu, state: "MENU" };
    }
  }

  clearConversation(phone);

  return {
    response: settings.confirmMessage,
    state: "DONE",
  };
}

// ---------------------------------------------------------------------------
// Option 2: View bookings
// ---------------------------------------------------------------------------

async function showBookings(
  conv: ConversationData,
  settings: BotSettings,
): Promise<ProcessResult> {
  const listLimit = Math.max(1, Math.min(20, settings.upcomingBookingsLimit || 5));
  const bookings = await prisma.booking.findMany({
    where: buildUpcomingBookingsFilter(conv.patientId!),
    include: {
      service: { select: { name: true } },
      professional: { select: { name: true } },
    },
    orderBy: { date: "asc" },
    take: listLimit,
  });

  if (bookings.length === 0) {
    const menu = buildMenuText(settings);
    if (typeof menu === "string") {
      return {
        response: `📭 Você não tem agendamentos futuros.\n\n${menu}`,
        state: "MENU",
      };
    } else {
      menu.description = `📭 Você não tem agendamentos futuros.\n\n${menu.description}`;
      return { response: menu, state: "MENU" };
    }
  }

  const lines = bookings.map((b) => {
    const d = toClinicDateStr(b.date);
    const [, mm, dd] = d.split("-");
    return `• ${dd}/${mm} às ${b.startTime} — ${b.service.name} com ${b.professional.name} (${b.status === "CONFIRMED" ? "✅" : "⏳"})`;
  });

  const respStr = `📋 *Seus agendamentos:*\n\n${lines.join("\n")}`;

  const menu = buildMenuText(settings);
  if (typeof menu === "string") {
    return { response: `${respStr}\n\n${menu}`, state: "MENU" };
  } else {
    menu.description = `${respStr}\n\n${menu.description}`;
    return { response: menu, state: "MENU" };
  }
}

// ---------------------------------------------------------------------------
// Option 3: Cancel flow
// ---------------------------------------------------------------------------

async function showCancelFlow(
  phone: string,
  conv: ConversationData,
  settings: BotSettings,
): Promise<ProcessResult> {
  const listLimit = Math.max(1, Math.min(20, settings.upcomingBookingsLimit || 5));
  const bookings = await prisma.booking.findMany({
    where: buildUpcomingBookingsFilter(conv.patientId!),
    include: {
      service: { select: { name: true } },
      professional: { select: { name: true } },
    },
    orderBy: { date: "asc" },
    take: listLimit,
  });

  if (bookings.length === 0) {
    const menu = buildMenuText(settings);
    if (typeof menu === "string") {
      return {
        response: `📭 Você não tem agendamentos para cancelar.\n\n${menu}`,
        state: "MENU",
      };
    } else {
      menu.description = `📭 Você não tem agendamentos para cancelar.\n\n${menu.description}`;
      return { response: menu, state: "MENU" };
    }
  }

  const opts = bookings.map((b) => {
    const d = toClinicDateStr(b.date);
    const [, mm, dd] = d.split("-");
    return {
      id: b.id,
      date: `${dd}/${mm}`,
      startTime: b.startTime,
      service: b.service.name,
      professional: b.professional.name,
    };
  });

  setConversation(phone, { state: "CANCEL_SELECT", bookingOptions: opts });

  const resp = buildOptions(
    settings,
    "❌ *Qual agendamento deseja cancelar?*",
    opts.map((o) => ({
      label: `${o.date} às ${o.startTime} — ${o.service} (${o.professional})`,
    })),
    true,
  );

  return { response: resp, state: "CANCEL_SELECT" };
}

async function handleCancelSelect(
  phone: string,
  message: string,
  conv: ConversationData,
  settings: BotSettings,
): Promise<ProcessResult> {
  const opt = parseOption(message);
  const opts = conv.bookingOptions;

  if (!opts || !opt || opt < 1 || opt > opts.length) {
    return {
      response: buildOptions(
        settings,
        "❌ *Qual agendamento deseja cancelar?*",
        (opts || []).map((o) => ({
          label: `${o.date} às ${o.startTime} — ${o.service} (${o.professional})`,
        })),
        true,
      ),
      state: "CANCEL_SELECT",
    };
  }

  const selected = opts[opt - 1];
  setConversation(phone, {
    state: "CANCEL_CONFIRM",
    bookingOptions: [selected],
  });

  const resp = buildOptions(
    settings,
    `⚠️ Confirma o cancelamento?\n📋 ${selected.service}\n👨‍⚕️ ${selected.professional}\n📅 ${selected.date} às ${selected.startTime}`,
    [{ label: "Sim, cancelar" }, { label: "Não, voltar" }],
    true,
  );

  return { response: resp, state: "CANCEL_CONFIRM" };
}

async function handleCancelConfirm(
  phone: string,
  message: string,
  conv: ConversationData,
  settings: BotSettings,
): Promise<ProcessResult> {
  const opt = parseOption(message);

  if (opt === 2) {
    setConversation(phone, { state: "MENU" });
    const menu = buildMenuText(settings);
    if (typeof menu === "string") {
      return { response: `${menu}`, state: "MENU" };
    } else {
      return { response: menu, state: "MENU" };
    }
  }

  if (opt !== 1) {
    return {
      response: buildOptions(
        settings,
        "Por favor, escolha:",
        [{ label: "Sim, cancelar" }, { label: "Não, voltar" }],
        true,
      ),
      state: "CANCEL_CONFIRM",
    };
  }

  const bookingId = conv.bookingOptions?.[0]?.id;
  if (!bookingId) {
    setConversation(phone, { state: "MENU" });
    const menu = buildMenuText(settings);
    if (typeof menu === "string") {
      return { response: `Erro interno.\n\n${menu}`, state: "MENU" };
    } else {
      menu.description = `Erro interno.\n\n${menu.description}`;
      return { response: menu, state: "MENU" };
    }
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data: { status: BookingStatus.CANCELLED },
  });

  await cancelBookingRemindersForBooking(
    bookingId,
    "Cancelado pelo paciente via bot.",
  );

  setConversation(phone, {
    state: "MENU",
    bookingOptions: undefined,
  });

  const menu = buildMenuText(settings);
  if (typeof menu === "string") {
    return { response: `${settings.cancelMessage}\n\n${menu}`, state: "MENU" };
  } else {
    menu.description = `${settings.cancelMessage}\n\n${menu.description}`;
    return { response: menu, state: "MENU" };
  }
}

// ---------------------------------------------------------------------------
// Option 4: List plans
// ---------------------------------------------------------------------------

async function showPlans(
  _phone: string,
  settings: BotSettings,
): Promise<ProcessResult> {
  const plans = await prisma.healthPlan.findMany({
    select: { name: true },
    orderBy: { name: "asc" },
  });

  const list =
    plans.length > 0
      ? plans.map((p) => `• ${p.name}`).join("\n")
      : "Nenhum plano cadastrado no momento.";

  const menu = buildMenuText(settings);
  if (typeof menu === "string") {
    return {
      response: `🏥 *Planos aceitos:*\n\n${list}\n\n${menu}`,
      state: "MENU",
    };
  } else {
    menu.description = `🏥 Planos aceitos:\n\n${list}\n\n${menu.description}`;
    return { response: menu, state: "MENU" };
  }
}

// ---------------------------------------------------------------------------
// Main processor
// ---------------------------------------------------------------------------

export async function processMessage(
  rawPhone: string,
  message: string,
): Promise<ProcessResult> {
  const phone = normalizeIncomingPhone(rawPhone);
  if (!phone) {
    return { response: "Erro: telefone inválido.", state: "ERROR" };
  }

  const settings = await loadSettings();
  if (!settings) {
    return { response: "Configuração do bot não encontrada.", state: "ERROR" };
  }

  if (!settings.isBotEnabled) {
    return { response: "", state: "DISABLED" };
  }

  // Handle empty messages (audio, stickers, images)
  if (!message) {
    return {
      response:
        "Desculpe, só consigo responder mensagens de *texto*. 😊\nPor favor, digite o *número* da opção desejada.",
      state: "WAITING_TEXT",
    };
  }

  const initialConv = getConversation(phone);
  const conv = await validateConversationPatient(phone, initialConv);

  // Handle "0" → back one step from the current state
  const opt = parseOption(message);
  if (opt === 0 && conv) {
    return handleBackNavigation(phone, conv, settings);
  }

  // No conversation → welcome flow
  if (!conv || conv.state === "IDLE") {
    return handleWelcome(phone, settings);
  }

  // Route to state handler
  switch (conv.state) {
    case "REGISTER_NAME":
      return handleRegisterName(phone, message, conv, settings); // Ensure this gets settings
    case "REGISTER_PLAN_ASK":
      return handleRegisterPlanAsk(phone, message, conv, settings);
    case "REGISTER_PLAN_SELECT":
      return handleRegisterPlanSelect(phone, message, conv, settings);
    case "REGISTER_PLAN_NOT_FOUND_ACTION":
      return handleRegisterPlanNotFoundAction(phone, message, conv, settings);
    case "MENU":
      return handleMenu(phone, message, conv, settings);
    case "SELECT_SERVICE":
      return handleSelectService(phone, message, conv, settings); // Needs settings
    case "SELECT_PROFESSIONAL":
      return handleSelectProfessional(phone, message, conv, settings);
    case "SELECT_DATE":
      return handleSelectDate(phone, message, conv, settings);
    case "SELECT_TIME":
      return handleSelectTime(phone, message, conv, settings);
    case "CONFIRM_BOOKING":
      return handleConfirmBooking(phone, message, conv, settings);
    case "CANCEL_SELECT":
      return handleCancelSelect(phone, message, conv, settings); // Needs settings
    case "CANCEL_CONFIRM":
      return handleCancelConfirm(phone, message, conv, settings);
    default:
      return handleWelcome(phone, settings);
  }
}

export const BOT_SETTINGS_SINGLETON_KEY = "default";

import {
  DEFAULT_BOOKING_REMINDER_RULES,
  serializeBookingReminderRules,
} from "@/lib/booking-reminder-rules";

export const DEFAULT_BOT_SETTINGS_VALUES = {
  whatsappProvider: "EVOLUTION",
  isBotEnabled: true,
  useInteractiveMessages: false,
  interactiveMenuTitle: "Opções",
  interactiveMenuButtonText: "Ver opções",
  interactiveMenuSectionTitle: "Selecione uma opção",
  interactiveBackLabel: "Voltar",
  interactiveBackDescription: "Voltar ao menu",
  greetingKeywords:
    "oi,olá,ola,bom dia,boa tarde,boa noite,hello,hi,opa,eai,e aí,fala,hey",
  availabilityDaysAhead: 14,
  availabilityMaxDates: 3,
  availabilityPreviewTimes: 5,
  upcomingBookingsLimit: 5,
  messageTypingDelayMs: 1200,
  messageTypingPresence: "composing",
  whatsappPhone: "",
  evolutionApiUrl: "",
  evolutionInstanceName: "",
  evolutionApiToken: "",
  evolutionWebhookToken: "",
  metaPhoneNumberId: "",
  metaAccessToken: "",
  metaWebhookVerifyToken: "",
  metaAppSecret: "",
  metaApiVersion: "v23.0",
  webhookTargetMode: "system",
  systemWebhookBaseUrl:
    process.env.NEXT_PUBLIC_WEBAPP_URL || "http://localhost:3000",
  n8nBaseUrl: "http://n8n:5678",
  n8nWebhookMode: "production",
  n8nWebhookPath: "evolution",
  welcomeMessage:
    "Oi! Eu sou o assistente da clinica. Posso ajudar com agendamentos, cancelamentos e horarios.",
  firstContactMessage:
    "Que bom falar com voce. Para criar seu cadastro e seguir com o agendamento, me envie: nome completo, data de nascimento e CPF.",
  fallbackMessage:
    "Desculpe, nao entendi sua mensagem. Posso ajudar com agendar, remarcar, cancelar e consultar horarios.",
  businessHoursMessage:
    "Nosso atendimento funciona de segunda a sexta, das 08:00 as 18:00.",
  confirmMessage:
    "Agendamento confirmado com sucesso. Se precisar, posso ajudar com remarcacao ou cancelamento.",
  cancelMessage: "Agendamento cancelado com sucesso.",
  rescheduleMessage: "Agendamento remarcado com sucesso.",
  humanHandoffMessage:
    "Vou encaminhar voce para nosso atendimento humano. Aguarde um momento.",
  bookingReminderRulesJson: serializeBookingReminderRules(
    DEFAULT_BOOKING_REMINDER_RULES,
  ),
  allowAutoCancel: true,
  allowAutoReschedule: true,
} as const;

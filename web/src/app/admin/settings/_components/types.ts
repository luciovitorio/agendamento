export interface ServiceData {
  id: string;
  name: string;
  description: string | null;
  duration: number;
  price: number | null;
  professionalsCount: number;
  bookingsCount: number;
  createdAt: string;
}

export interface BookingReminderRuleData {
  id: string;
  offsetHours: number;
  messageTemplate: string;
  requireConfirmation: boolean;
}

export interface BotSettingsData {
  whatsappProvider: "EVOLUTION" | "META_CLOUD";
  isBotEnabled: boolean;
  useInteractiveMessages: boolean;
  interactiveMenuTitle: string;
  interactiveMenuButtonText: string;
  interactiveMenuSectionTitle: string;
  interactiveBackLabel: string;
  interactiveBackDescription: string;
  greetingKeywords: string;
  availabilityDaysAhead: number;
  availabilityMaxDates: number;
  availabilityPreviewTimes: number;
  upcomingBookingsLimit: number;
  messageTypingDelayMs: number;
  messageTypingPresence: "composing" | "recording" | "paused";
  whatsappPhone: string;
  evolutionApiUrl: string;
  evolutionInstanceName: string;
  evolutionApiToken: string;
  evolutionWebhookToken: string;
  metaPhoneNumberId: string;
  metaAccessToken: string;
  metaWebhookVerifyToken: string;
  metaAppSecret: string;
  metaApiVersion: string;
  webhookTargetMode: "system" | "n8n";
  systemWebhookBaseUrl: string;
  n8nBaseUrl: string;
  n8nWebhookMode: "test" | "production";
  n8nWebhookPath: string;
  welcomeMessage: string;
  firstContactMessage: string;
  fallbackMessage: string;
  businessHoursMessage: string;
  confirmMessage: string;
  cancelMessage: string;
  rescheduleMessage: string;
  humanHandoffMessage: string;
  bookingReminderRules: BookingReminderRuleData[];
  allowAutoCancel: boolean;
  allowAutoReschedule: boolean;
  updatedAt?: string | null;
  updatedByUserName?: string | null;
}

export type BotState =
  | "IDLE"
  | "REGISTER_NAME"
  | "REGISTER_PLAN_ASK"
  | "REGISTER_PLAN_SELECT"
  | "REGISTER_PLAN_NOT_FOUND_ACTION"
  | "MENU"
  | "SELECT_SERVICE"
  | "SELECT_PROFESSIONAL"
  | "SELECT_DATE"
  | "SELECT_TIME"
  | "CONFIRM_BOOKING"
  | "VIEW_BOOKINGS"
  | "CANCEL_SELECT"
  | "CANCEL_CONFIRM";

export interface ConversationData {
  state: BotState;
  patientId?: string;
  patientName?: string;
  pendingName?: string;
  serviceOptions?: {
    id: string;
    name: string;
    duration: number;
    price: number;
  }[];
  selectedService?: { id: string; name: string; duration: number };
  professionalOptions?: { id: string; name: string }[];
  selectedProfessional?: { id: string; name: string };
  dateOptions?: { date: string; dayOfWeek: string; times: string[] }[];
  selectedDate?: { date: string; dayOfWeek: string };
  timeOptions?: string[];
  selectedTime?: string;
  bookingOptions?: {
    id: string;
    date: string;
    startTime: string;
    service: string;
    professional: string;
  }[];
  updatedAt: number;
}

const conversations = new Map<string, ConversationData>();
const TTL_MS = 30 * 60 * 1000;

export function getConversation(phone: string): ConversationData | null {
  const conv = conversations.get(phone);
  if (!conv) return null;
  if (Date.now() - conv.updatedAt > TTL_MS) {
    conversations.delete(phone);
    return null;
  }
  return conv;
}

export function setConversation(
  phone: string,
  data: Partial<ConversationData> & { state: BotState },
): ConversationData {
  const existing = getConversation(phone);
  const merged: ConversationData = {
    ...(existing || ({} as ConversationData)),
    ...data,
    updatedAt: Date.now(),
  };
  conversations.set(phone, merged);
  return merged;
}

export function clearConversation(phone: string): void {
  conversations.delete(phone);
}

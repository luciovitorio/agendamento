export type AppointmentWorkflowStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CANCELLED"
  | "COMPLETED"
  | "NO_SHOW";

export const DEFAULT_APPOINTMENT_STATUS: AppointmentWorkflowStatus = "PENDING";

const ALLOWED_STATUS_TRANSITIONS: Record<
  AppointmentWorkflowStatus,
  AppointmentWorkflowStatus[]
> = {
  PENDING: ["CONFIRMED", "COMPLETED", "NO_SHOW", "CANCELLED"],
  CONFIRMED: ["PENDING", "COMPLETED", "NO_SHOW", "CANCELLED"],
  COMPLETED: [],
  NO_SHOW: [],
  CANCELLED: [],
};

export function canTransitionAppointmentStatus(
  current: AppointmentWorkflowStatus,
  next: AppointmentWorkflowStatus,
) {
  if (current === next) {
    return true;
  }

  return ALLOWED_STATUS_TRANSITIONS[current].includes(next);
}

export function getAllowedNextAppointmentStatuses(
  current: AppointmentWorkflowStatus,
) {
  return ALLOWED_STATUS_TRANSITIONS[current];
}

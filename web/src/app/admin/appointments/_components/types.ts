export type AppointmentStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CANCELLED"
  | "COMPLETED"
  | "NO_SHOW";

export type AppointmentSource = "WEB" | "MANUAL" | "BOT_N8N";

export interface AppointmentData {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  source: AppointmentSource;
  patientName: string;
  patientPhone: string;
  patientEmail: string | null;
  professionalId: string;
  professionalName: string;
  serviceId: string;
  serviceName: string;
  createdAt: string;
  createdByUserName: string | null;
}

export type AppointmentStatusFilter = AppointmentStatus | "ALL";
export type AppointmentSourceFilter = AppointmentSource | "ALL";
export type AppointmentPeriodFilter = "ALL" | "TODAY" | "UPCOMING" | "PAST";

export interface AppointmentFilters {
  q: string;
  status: AppointmentStatusFilter;
  source: AppointmentSourceFilter;
  professionalId: string | "ALL";
  period: AppointmentPeriodFilter;
}

export interface AppointmentPagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface ProfessionalServiceOption {
  id: string;
  name: string;
  duration: number;
}

export interface ProfessionalOption {
  id: string;
  name: string;
  services: ProfessionalServiceOption[];
}

export interface AppointmentTimeOffData {
  id: string;
  professionalId: string;
  professionalName: string;
  startDateTime: string;
  endDateTime: string;
  reason: string | null;
  createdAt: string;
  createdByUserName: string | null;
}

export interface PatientOption {
  id: string;
  name: string;
  phone: string;
  email: string | null;
}

export interface HealthPlanOption {
  id: string;
  name: string;
}

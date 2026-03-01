export interface HealthPlanOption {
  id: string;
  name: string;
}

export interface PatientData {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  coverageType: "PARTICULAR" | "PLAN";
  healthPlanId: string | null;
  healthPlanName: string | null;
  bookingsCount: number;
  createdAt: string;
}

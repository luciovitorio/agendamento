import { BookingStatus, type Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type DashboardRole = "ADMIN" | "ATENDENTE" | "DOUTOR";

export interface ReportsSearchParams {
  startDate?: string | string[];
  endDate?: string | string[];
  day?: string | string[];
  professionalId?: string | string[];
  patientId?: string | string[];
}

interface StatusCounter {
  PENDING: number;
  CONFIRMED: number;
  CANCELLED: number;
  COMPLETED: number;
  NO_SHOW: number;
}

interface ProfessionalOption {
  id: string;
  name: string;
}

interface PatientOption {
  id: string;
  name: string;
  phone: string;
  coverageType: string;
  healthPlanName: string | null;
}

interface DailyRow {
  id: string;
  startTime: string;
  patientName: string;
  professionalName: string;
  status: BookingStatus;
}

interface ProductivityRow {
  professionalId: string;
  name: string;
  total: number;
  completed: number;
  noShow: number;
  cancelled: number;
  revenue: number;
}

interface ServiceRow {
  serviceId: string;
  name: string;
  total: number;
  completed: number;
  noShow: number;
  cancelled: number;
  revenue: number;
}

interface NoShowCancelRow extends ProductivityRow {
  noShowRate: number;
  cancelRate: number;
}

interface RiskRow {
  name: string;
  phone: string;
  noShow: number;
  cancelled: number;
  score: number;
}

interface OccupancyRow {
  name: string;
  available: number;
  occupied: number;
  utilization: number;
}

export interface ReportsData {
  userRole: DashboardRole;
  startDateValue: string;
  endDateValue: string;
  dayValue: string;
  dayStart: Date;
  scopeProfessionalId: string | null;
  selectedPatientId: string | null;
  professionals: ProfessionalOption[];
  patients: PatientOption[];
  selectedPatient: PatientOption | null;
  isDoctorWithoutProfessional: boolean;
  showFinancial: boolean;
  bookingsCount: number;
  statusRange: StatusCounter;
  statusDaily: StatusCounter;
  statusPatient: StatusCounter;
  revenueRange: number;
  revenueDaily: number;
  avgLeadDays: number;
  dailyRows: DailyRow[];
  patientHistoryCount: number;
  productivityRows: ProductivityRow[];
  serviceRows: ServiceRow[];
  noShowCancelRows: NoShowCancelRow[];
  newCount: number;
  recurringCount: number;
  possibleReschedules: number;
  riskRows: RiskRow[];
  demandDays: Array<[string, number]>;
  demandHours: Array<[string, number]>;
  occupancyRows: OccupancyRow[];
  dateRangeNotice: string | null;
}

export interface ReportsLoaderResult {
  redirectTo?: string;
  data?: ReportsData;
}

const MAX_REPORT_RANGE_DAYS = 90;

function getQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDateInput(value: string | undefined, fallback: string) {
  if (!value) return fallback;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

function parseDateStart(value: string) {
  return new Date(`${value}T00:00:00.000`);
}

function parseDateEnd(value: string) {
  return new Date(`${value}T23:59:59.999`);
}

function createStatusCounter(): StatusCounter {
  return {
    PENDING: 0,
    CONFIRMED: 0,
    CANCELLED: 0,
    COMPLETED: 0,
    NO_SHOW: 0,
  };
}

function countStatuses(bookings: { status: BookingStatus }[]) {
  const counter = createStatusCounter();
  for (const booking of bookings) counter[booking.status] += 1;
  return counter;
}

function safePercent(value: number, total: number) {
  return total ? (value / total) * 100 : 0;
}

export async function getReportsData(
  searchParamsPromise: Promise<ReportsSearchParams>,
): Promise<ReportsLoaderResult> {
  const session = await auth();
  const userRole = session?.user?.role as DashboardRole | undefined;
  const userEmail = session?.user?.email;

  if (!userRole || !["ADMIN", "ATENDENTE", "DOUTOR"].includes(userRole)) {
    return { redirectTo: "/admin" };
  }

  const params = await searchParamsPromise;
  const today = new Date();
  const todayValue = formatDateInput(today);
  const defaultStart = new Date(today);
  defaultStart.setDate(defaultStart.getDate() - 30);

  let startDateValue = normalizeDateInput(
    getQueryValue(params.startDate),
    formatDateInput(defaultStart),
  );
  let endDateValue = normalizeDateInput(getQueryValue(params.endDate), todayValue);
  const dayValue = normalizeDateInput(getQueryValue(params.day), todayValue);

  let startDate = parseDateStart(startDateValue);
  let endDate = parseDateEnd(endDateValue);
  if (startDate > endDate) {
    [startDateValue, endDateValue] = [endDateValue, startDateValue];
    startDate = parseDateStart(startDateValue);
    endDate = parseDateEnd(endDateValue);
  }

  let dateRangeNotice: string | null = null;
  const requestedRangeDays =
    Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  if (requestedRangeDays > MAX_REPORT_RANGE_DAYS) {
    const adjustedStart = new Date(endDate);
    adjustedStart.setDate(adjustedStart.getDate() - (MAX_REPORT_RANGE_DAYS - 1));
    startDate = parseDateStart(formatDateInput(adjustedStart));
    startDateValue = formatDateInput(startDate);
    dateRangeNotice = `Intervalo ajustado automaticamente para os últimos ${MAX_REPORT_RANGE_DAYS} dias.`;
  }

  const dayStart = parseDateStart(dayValue);
  const dayEnd = parseDateEnd(dayValue);

  const doctorProfessional =
    userRole === "DOUTOR" && userEmail
      ? await prisma.professional.findUnique({
          where: { email: userEmail },
          select: { id: true, name: true },
        })
      : null;

  const professionals =
    userRole === "DOUTOR"
      ? doctorProfessional
        ? [doctorProfessional]
        : []
      : await prisma.professional.findMany({
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        });

  const scopeProfessionalId =
    userRole === "DOUTOR"
      ? doctorProfessional?.id || "__NO_PROFESSIONAL__"
      : (() => {
          const requested = getQueryValue(params.professionalId);
          if (!requested || requested === "ALL") return null;
          return professionals.some((p) => p.id === requested) ? requested : null;
        })();

  const patientsRaw =
    userRole === "DOUTOR" && scopeProfessionalId === "__NO_PROFESSIONAL__"
      ? []
      : await prisma.patient.findMany({
          where:
            userRole === "DOUTOR"
              ? { bookings: { some: { professionalId: scopeProfessionalId! } } }
              : undefined,
          select: {
            id: true,
            name: true,
            phone: true,
            coverageType: true,
            healthPlan: { select: { name: true } },
          },
          orderBy: { name: "asc" },
        });

  const patients: PatientOption[] = patientsRaw.map((patient) => ({
    id: patient.id,
    name: patient.name,
    phone: patient.phone,
    coverageType: patient.coverageType,
    healthPlanName: patient.healthPlan?.name || null,
  }));

  const selectedPatientId = (() => {
    const requested = getQueryValue(params.patientId);
    if (!requested || requested === "ALL") return null;
    return patients.some((patient) => patient.id === requested) ? requested : null;
  })();

  const baseWhere: Prisma.BookingWhereInput = {
    date: { gte: startDate, lte: endDate },
    ...(scopeProfessionalId ? { professionalId: scopeProfessionalId } : {}),
    ...(selectedPatientId ? { patientId: selectedPatientId } : {}),
  };

  const dayWhere: Prisma.BookingWhereInput = {
    date: { gte: dayStart, lte: dayEnd },
    ...(scopeProfessionalId ? { professionalId: scopeProfessionalId } : {}),
    ...(selectedPatientId ? { patientId: selectedPatientId } : {}),
  };

  const [bookings, dailyBookings] = await Promise.all([
    prisma.booking.findMany({
      where: baseWhere,
      include: {
        patient: true,
        professional: true,
        service: true,
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
    prisma.booking.findMany({
      where: dayWhere,
      include: {
        patient: true,
        professional: true,
        service: true,
      },
      orderBy: [{ startTime: "asc" }],
    }),
  ]);

  const selectedPatient =
    selectedPatientId !== null
      ? patients.find((patient) => patient.id === selectedPatientId) || null
      : null;

  const patientHistory =
    selectedPatientId !== null
      ? await prisma.booking.findMany({
          where: {
            patientId: selectedPatientId,
            ...(scopeProfessionalId ? { professionalId: scopeProfessionalId } : {}),
          },
          orderBy: [{ date: "desc" }, { startTime: "desc" }],
        })
      : [];

  const statusRange = countStatuses(bookings);
  const statusDaily = countStatuses(dailyBookings);
  const statusPatient = countStatuses(patientHistory);

  const revenueRange = bookings.reduce((acc, item) => {
    if (item.status !== "COMPLETED") return acc;
    return acc + (item.service.price || 0);
  }, 0);
  const revenueDaily = dailyBookings.reduce((acc, item) => {
    if (item.status !== "COMPLETED") return acc;
    return acc + (item.service.price || 0);
  }, 0);

  const leadDaysList = bookings
    .map((item) => (item.date.getTime() - item.createdAt.getTime()) / (1000 * 60 * 60 * 24))
    .filter((value) => value >= 0);
  const avgLeadDays =
    leadDaysList.length > 0
      ? leadDaysList.reduce((a, b) => a + b, 0) / leadDaysList.length
      : 0;

  const productivityMap = new Map<string, ProductivityRow>();
  for (const item of bookings) {
    const existing = productivityMap.get(item.professionalId) || {
      professionalId: item.professionalId,
      name: item.professional.name,
      total: 0,
      completed: 0,
      noShow: 0,
      cancelled: 0,
      revenue: 0,
    };
    existing.total += 1;
    if (item.status === "COMPLETED") existing.completed += 1;
    if (item.status === "NO_SHOW") existing.noShow += 1;
    if (item.status === "CANCELLED") existing.cancelled += 1;
    if (item.status === "COMPLETED") existing.revenue += item.service.price || 0;
    productivityMap.set(item.professionalId, existing);
  }
  const productivityRows = Array.from(productivityMap.values()).sort(
    (a, b) => b.total - a.total,
  );

  const serviceMap = new Map<string, ServiceRow>();
  for (const item of bookings) {
    const existing = serviceMap.get(item.serviceId) || {
      serviceId: item.serviceId,
      name: item.service.name,
      total: 0,
      completed: 0,
      noShow: 0,
      cancelled: 0,
      revenue: 0,
    };
    existing.total += 1;
    if (item.status === "COMPLETED") existing.completed += 1;
    if (item.status === "NO_SHOW") existing.noShow += 1;
    if (item.status === "CANCELLED") existing.cancelled += 1;
    if (item.status === "COMPLETED") existing.revenue += item.service.price || 0;
    serviceMap.set(item.serviceId, existing);
  }
  const serviceRows = Array.from(serviceMap.values()).sort((a, b) => b.total - a.total);

  const patientIds = Array.from(new Set(bookings.map((item) => item.patientId)));
  const priorPatients =
    patientIds.length > 0
      ? await prisma.booking.findMany({
          where: {
            patientId: { in: patientIds },
            date: { lt: startDate },
            ...(scopeProfessionalId ? { professionalId: scopeProfessionalId } : {}),
          },
          select: { patientId: true },
          distinct: ["patientId"],
        })
      : [];
  const priorSet = new Set(priorPatients.map((item) => item.patientId));
  const recurringCount = patientIds.filter((patientId) => priorSet.has(patientId)).length;
  const newCount = patientIds.length - recurringCount;

  const noShowCancelRows: NoShowCancelRow[] = productivityRows.map((row) => ({
    ...row,
    noShowRate: safePercent(row.noShow, row.total),
    cancelRate: safePercent(row.cancelled, row.total),
  }));

  const remarcacaoMap = new Map<string, number>();
  for (const booking of bookings) {
    const key = `${booking.patientId}:${booking.professionalId}:${booking.serviceId}`;
    remarcacaoMap.set(key, (remarcacaoMap.get(key) || 0) + 1);
  }
  let possibleReschedules = 0;
  for (const count of remarcacaoMap.values()) {
    if (count > 1) possibleReschedules += count - 1;
  }

  const riskMap = new Map<string, { name: string; phone: string; noShow: number; cancelled: number }>();
  for (const booking of bookings) {
    const row = riskMap.get(booking.patientId) || {
      name: booking.patient.name,
      phone: booking.patient.phone,
      noShow: 0,
      cancelled: 0,
    };
    if (booking.status === "NO_SHOW") row.noShow += 1;
    if (booking.status === "CANCELLED") row.cancelled += 1;
    riskMap.set(booking.patientId, row);
  }
  const riskRows: RiskRow[] = Array.from(riskMap.values())
    .map((row) => ({ ...row, score: row.noShow * 2 + row.cancelled }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  const demandByDay = new Map<string, number>();
  const demandByHour = new Map<string, number>();
  for (const booking of bookings) {
    if (booking.status === "CANCELLED") continue;
    const dayName = booking.date.toLocaleDateString("pt-BR", { weekday: "long" });
    demandByDay.set(dayName, (demandByDay.get(dayName) || 0) + 1);
    const hour = `${booking.startTime.slice(0, 2)}:00`;
    demandByHour.set(hour, (demandByHour.get(hour) || 0) + 1);
  }
  const demandDays = Array.from(demandByDay.entries()).sort((a, b) => b[1] - a[1]);
  const demandHours = Array.from(demandByHour.entries()).sort((a, b) => b[1] - a[1]);

  const occupancyProfessionals =
    scopeProfessionalId && scopeProfessionalId !== "__NO_PROFESSIONAL__"
      ? [scopeProfessionalId]
      : professionals.map((professional) => professional.id);
  const [schedules, occupancyBookings] =
    occupancyProfessionals.length === 0
      ? [[], []]
      : await Promise.all([
          prisma.schedule.findMany({
            where: { professionalId: { in: occupancyProfessionals } },
            select: { professionalId: true, dayOfWeek: true, startTime: true, endTime: true },
          }),
          prisma.booking.findMany({
            where: {
              date: { gte: startDate, lte: endDate },
              ...(scopeProfessionalId ? { professionalId: scopeProfessionalId } : {}),
              status: { not: BookingStatus.CANCELLED },
            },
            select: { professionalId: true, startTime: true, endTime: true },
          }),
        ]);
  const totalDays = Math.max(
    1,
    Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1,
  );
  const availableByProfessional = new Map<string, number>();
  for (const schedule of schedules) {
    const shiftMinutes =
      Number(schedule.endTime.slice(0, 2)) * 60 +
      Number(schedule.endTime.slice(3, 5)) -
      (Number(schedule.startTime.slice(0, 2)) * 60 + Number(schedule.startTime.slice(3, 5)));
    const weekdaysInRange = Math.floor(totalDays / 7) + 1;
    availableByProfessional.set(
      schedule.professionalId,
      (availableByProfessional.get(schedule.professionalId) || 0) +
        Math.max(0, shiftMinutes) * weekdaysInRange,
    );
  }
  const occupiedByProfessional = new Map<string, number>();
  for (const booking of occupancyBookings) {
    const minutes =
      Number(booking.endTime.slice(0, 2)) * 60 +
      Number(booking.endTime.slice(3, 5)) -
      (Number(booking.startTime.slice(0, 2)) * 60 + Number(booking.startTime.slice(3, 5)));
    occupiedByProfessional.set(
      booking.professionalId,
      (occupiedByProfessional.get(booking.professionalId) || 0) + Math.max(0, minutes),
    );
  }
  const occupancyRows: OccupancyRow[] = professionals
    .map((professional) => {
      const available = availableByProfessional.get(professional.id) || 0;
      const occupied = occupiedByProfessional.get(professional.id) || 0;
      return {
        name: professional.name,
        available,
        occupied,
        utilization: safePercent(occupied, available),
      };
    })
    .filter((row) => row.available > 0 || row.occupied > 0)
    .sort((a, b) => b.utilization - a.utilization);

  const dailyRows: DailyRow[] = dailyBookings.map((item) => ({
    id: item.id,
    startTime: item.startTime,
    patientName: item.patient.name,
    professionalName: item.professional.name,
    status: item.status,
  }));

  const isDoctorWithoutProfessional =
    userRole === "DOUTOR" && scopeProfessionalId === "__NO_PROFESSIONAL__";
  const showFinancial = userRole === "ADMIN";

  return {
    data: {
      userRole,
      startDateValue,
      endDateValue,
      dayValue,
      dayStart,
      scopeProfessionalId,
      selectedPatientId,
      professionals,
      patients,
      selectedPatient,
      isDoctorWithoutProfessional,
      showFinancial,
      bookingsCount: bookings.length,
      statusRange,
      statusDaily,
      statusPatient,
      revenueRange,
      revenueDaily,
      avgLeadDays,
      dailyRows,
      patientHistoryCount: patientHistory.length,
      productivityRows,
      serviceRows,
      noShowCancelRows,
      newCount,
      recurringCount,
      possibleReschedules,
      riskRows,
      demandDays,
      demandHours,
      occupancyRows,
      dateRangeNotice,
    },
  };
}

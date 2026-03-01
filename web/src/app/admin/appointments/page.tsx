import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppointmentsClientPage } from "./client-page";
import type {
  AppointmentData,
  AppointmentFilters,
  AppointmentPagination,
  AppointmentPeriodFilter,
  AppointmentSourceFilter,
  AppointmentStatusFilter,
} from "./_components/types";
import { prisma } from "@/lib/prisma";
import { BookingSource, BookingStatus, type Prisma } from "@prisma/client";

interface AdminAppointmentsPageProps {
  searchParams: Promise<{
    q?: string | string[];
    status?: string | string[];
    source?: string | string[];
    professionalId?: string | string[];
    period?: string | string[];
    page?: string | string[];
    pageSize?: string | string[];
  }>;
}

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50] as const;
const ALLOWED_PERIODS: AppointmentPeriodFilter[] = [
  "ALL",
  "TODAY",
  "UPCOMING",
  "PAST",
];
const ALLOWED_STATUS_FILTERS: AppointmentStatusFilter[] = [
  "ALL",
  ...Object.values(BookingStatus),
];
const ALLOWED_SOURCE_FILTERS: AppointmentSourceFilter[] = [
  "ALL",
  ...Object.values(BookingSource),
];

function getQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const int = Math.floor(parsed);
  return int >= 1 ? int : fallback;
}

function formatNowTime(date: Date) {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function buildPeriodWhere(period: AppointmentPeriodFilter, now: Date) {
  if (period === "ALL") return undefined;

  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setHours(23, 59, 59, 999);
  const nowTime = formatNowTime(now);

  if (period === "TODAY") {
    return {
      date: {
        gte: dayStart,
        lte: dayEnd,
      },
    } satisfies Prisma.BookingWhereInput;
  }

  if (period === "UPCOMING") {
    return {
      OR: [
        { date: { gt: dayEnd } },
        {
          AND: [{ date: dayStart }, { startTime: { gte: nowTime } }],
        },
      ],
    } satisfies Prisma.BookingWhereInput;
  }

  return {
    OR: [
      { date: { lt: dayStart } },
      {
        AND: [{ date: dayStart }, { startTime: { lt: nowTime } }],
      },
    ],
  } satisfies Prisma.BookingWhereInput;
}

export default async function AdminAppointmentsPage({
  searchParams,
}: AdminAppointmentsPageProps) {
  const session = await auth();
  const userRole = session?.user?.role;
  const userEmail = session?.user?.email;

  if (!userRole || !["ADMIN", "ATENDENTE", "DOUTOR"].includes(userRole)) {
    redirect("/admin");
  }

  const query = await searchParams;
  const q = getQueryValue(query.q)?.trim() || "";
  const requestedStatus = getQueryValue(query.status)?.toUpperCase();
  const requestedSource = getQueryValue(query.source)?.toUpperCase();
  const requestedPeriod = getQueryValue(query.period)?.toUpperCase();
  const requestedProfessionalId = getQueryValue(query.professionalId)?.trim();

  const status: AppointmentStatusFilter = ALLOWED_STATUS_FILTERS.includes(
    requestedStatus as AppointmentStatusFilter,
  )
    ? (requestedStatus as AppointmentStatusFilter)
    : "ALL";
  const source: AppointmentSourceFilter = ALLOWED_SOURCE_FILTERS.includes(
    requestedSource as AppointmentSourceFilter,
  )
    ? (requestedSource as AppointmentSourceFilter)
    : "ALL";
  const period: AppointmentPeriodFilter = ALLOWED_PERIODS.includes(
    requestedPeriod as AppointmentPeriodFilter,
  )
    ? (requestedPeriod as AppointmentPeriodFilter)
    : "ALL";

  const requestedPage = parsePositiveInt(getQueryValue(query.page), 1);
  const rawPageSize = parsePositiveInt(getQueryValue(query.pageSize), 10);
  const pageSize = PAGE_SIZE_OPTIONS.includes(rawPageSize as (typeof PAGE_SIZE_OPTIONS)[number])
    ? rawPageSize
    : 10;

  const professionals = await prisma.professional.findMany({
    where: userRole === "DOUTOR" && userEmail ? { email: userEmail } : undefined,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const professionalIds = new Set(professionals.map((item) => item.id));

  const professionalId =
    requestedProfessionalId &&
    requestedProfessionalId !== "ALL" &&
    professionalIds.has(requestedProfessionalId)
      ? requestedProfessionalId
      : "ALL";

  const now = new Date();
  const whereClauses: Prisma.BookingWhereInput[] = [];

  if (userRole === "DOUTOR") {
    const scopedProfessionalId = professionals[0]?.id;
    if (!scopedProfessionalId) {
      const emptyFilters: AppointmentFilters = {
        q,
        status,
        source,
        period,
        professionalId: "ALL",
      };
      const emptyPagination: AppointmentPagination = {
        page: 1,
        pageSize,
        totalItems: 0,
        totalPages: 1,
      };
      return (
        <AppointmentsClientPage
          appointments={[]}
          userRole={userRole}
          professionals={[]}
          filters={emptyFilters}
          pagination={emptyPagination}
        />
      );
    }
    whereClauses.push({ professionalId: scopedProfessionalId });
  } else if (professionalId !== "ALL") {
    whereClauses.push({ professionalId });
  }

  if (status !== "ALL") {
    whereClauses.push({ status });
  }

  if (source !== "ALL") {
    whereClauses.push({ source });
  }

  const periodWhere = buildPeriodWhere(period, now);
  if (periodWhere) {
    whereClauses.push(periodWhere);
  }

  if (q) {
    whereClauses.push({
      OR: [
        { patient: { name: { contains: q, mode: "insensitive" } } },
        { patient: { phone: { contains: q, mode: "insensitive" } } },
        { patient: { email: { contains: q, mode: "insensitive" } } },
        { professional: { name: { contains: q, mode: "insensitive" } } },
        { service: { name: { contains: q, mode: "insensitive" } } },
      ],
    });
  }

  const where: Prisma.BookingWhereInput =
    whereClauses.length > 0 ? { AND: whereClauses } : {};

  const totalItems = await prisma.booking.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const page = Math.min(requestedPage, totalPages);

  const bookings = await prisma.booking.findMany({
    where,
    include: {
      patient: true,
      professional: true,
      service: true,
      createdByUser: {
        select: { name: true },
      },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  const formattedAppointments: AppointmentData[] = bookings.map((booking) => ({
    id: booking.id,
    date: booking.date.toISOString(),
    startTime: booking.startTime,
    endTime: booking.endTime,
    status: booking.status,
    source: booking.source,
    patientName: booking.patient.name,
    patientPhone: booking.patient.phone,
    patientEmail: booking.patient.email,
    professionalId: booking.professionalId,
    professionalName: booking.professional.name,
    serviceId: booking.serviceId,
    serviceName: booking.service.name,
    createdAt: booking.createdAt.toISOString(),
    createdByUserName: booking.createdByUser?.name || null,
  }));

  const filters: AppointmentFilters = {
    q,
    status,
    source,
    professionalId,
    period,
  };
  const pagination: AppointmentPagination = {
    page,
    pageSize,
    totalItems,
    totalPages,
  };

  return (
    <AppointmentsClientPage
      appointments={formattedAppointments}
      userRole={userRole}
      professionals={professionals}
      filters={filters}
      pagination={pagination}
    />
  );
}

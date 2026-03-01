import {
  BookingSource,
  BookingStatus,
  PatientCoverageType,
  PrismaClient,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

type Rng = () => number;

type SeedService = {
  id: string;
  name: string;
  duration: number;
  price: number | null;
};

type SeedProfessional = {
  id: string;
  name: string;
  email: string;
};

type SeedPatient = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  coverageType: PatientCoverageType;
  healthPlanId: string | null;
};

type ScheduleTemplate = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

function createRng(seed = 20260222): Rng {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function randomInt(rng: Rng, min: number, max: number) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pickOne<T>(rng: Rng, items: T[]) {
  return items[randomInt(rng, 0, items.length - 1)];
}

function chance(rng: Rng, probability: number) {
  return rng() < probability;
}

function minutesFromTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function timeFromMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function dateWithDayOffset(dayOffset: number) {
  const date = startOfDay(new Date());
  date.setDate(date.getDate() + dayOffset);
  return date;
}

function buildPatientName(index: number) {
  const firstNames = [
    "Ana",
    "Bruno",
    "Carla",
    "Diego",
    "Eduarda",
    "Felipe",
    "Gabriela",
    "Helena",
    "Igor",
    "Juliana",
    "Karen",
    "Lucas",
    "Mariana",
    "Nicolas",
    "Olivia",
    "Patricia",
    "Rafael",
    "Sabrina",
    "Thiago",
    "Valeria",
  ];
  const lastNames = [
    "Silva",
    "Souza",
    "Oliveira",
    "Santos",
    "Pereira",
    "Costa",
    "Rodrigues",
    "Almeida",
    "Nunes",
    "Lima",
    "Araujo",
    "Melo",
    "Barbosa",
    "Machado",
    "Teixeira",
  ];

  const first = firstNames[index % firstNames.length];
  const last = lastNames[Math.floor(index / firstNames.length) % lastNames.length];
  return `${first} ${last}`;
}

function buildPatientPhone(index: number) {
  const number = (910000000 + index).toString().padStart(9, "0");
  return `11${number}`;
}

function buildPatientEmail(name: string, index: number) {
  const normalized = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, ".");
  return `${normalized}.${index}@exemplo.com`;
}

function resolveStatusForDayOffset(rng: Rng, dayOffset: number): BookingStatus {
  const roll = rng();

  if (dayOffset > 0) {
    if (roll < 0.58) return BookingStatus.PENDING;
    if (roll < 0.93) return BookingStatus.CONFIRMED;
    return BookingStatus.CANCELLED;
  }

  if (dayOffset === 0) {
    if (roll < 0.24) return BookingStatus.PENDING;
    if (roll < 0.62) return BookingStatus.CONFIRMED;
    if (roll < 0.8) return BookingStatus.COMPLETED;
    if (roll < 0.93) return BookingStatus.NO_SHOW;
    return BookingStatus.CANCELLED;
  }

  if (roll < 0.72) return BookingStatus.COMPLETED;
  if (roll < 0.88) return BookingStatus.NO_SHOW;
  return BookingStatus.CANCELLED;
}

function resolveSource(rng: Rng): BookingSource {
  const roll = rng();
  if (roll < 0.45) return BookingSource.WEB;
  if (roll < 0.82) return BookingSource.MANUAL;
  return BookingSource.BOT_N8N;
}

async function main() {
  const rng = createRng();

  console.log("Clearing database...");
  await prisma.booking.deleteMany();
  await prisma.professionalTimeOff.deleteMany();
  await prisma.professionalService.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.service.deleteMany();
  await prisma.professional.deleteMany();
  await prisma.user.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.healthPlan.deleteMany();

  console.log("Seeding users...");
  const [
    adminPassword,
    attendantPassword,
    anaPassword,
    josePassword,
    mariaPassword,
    claudioPassword,
  ] = await Promise.all([
    bcrypt.hash("admin", 10),
    bcrypt.hash("123", 10),
    bcrypt.hash("ana123", 10),
    bcrypt.hash("jose123", 10),
    bcrypt.hash("maria123", 10),
    bcrypt.hash("claudio123", 10),
  ]);

  const adminUser = await prisma.user.create({
    data: {
      name: "Admin Geral",
      email: "admin@clinica.com",
      password: adminPassword,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  const attendantUser = await prisma.user.create({
    data: {
      name: "Recepcao Central",
      email: "atendimento@clinica.com",
      password: attendantPassword,
      role: "ATENDENTE",
      status: "ACTIVE",
    },
  });

  await prisma.user.create({
    data: {
      name: "Acesso Pendente",
      email: "pendente@clinica.com",
      password: await bcrypt.hash("PENDING_SETUP", 10),
      role: "ATENDENTE",
      status: "PENDING",
    },
  });

  console.log("Seeding doctors and professionals...");
  const doctorUsers = await Promise.all([
    prisma.user.create({
      data: {
        name: "Dra. Ana",
        email: "ana@clinica.com",
        password: anaPassword,
        role: "DOUTOR",
        status: "ACTIVE",
      },
    }),
    prisma.user.create({
      data: {
        name: "Dr. Jose",
        email: "jose@clinica.com",
        password: josePassword,
        role: "DOUTOR",
        status: "ACTIVE",
      },
    }),
    prisma.user.create({
      data: {
        name: "Dra. Maria",
        email: "maria@clinica.com",
        password: mariaPassword,
        role: "DOUTOR",
        status: "ACTIVE",
      },
    }),
    prisma.user.create({
      data: {
        name: "Dr. Claudio",
        email: "claudio@clinica.com",
        password: claudioPassword,
        role: "DOUTOR",
        status: "ACTIVE",
      },
    }),
  ]);

  const professionals: SeedProfessional[] = await Promise.all([
    prisma.professional.create({
      data: {
        name: "Dra. Ana",
        email: "ana@clinica.com",
        bio: "Especialista em harmonizacao facial.",
        avatarUrl: "https://ui-avatars.com/api/?name=Dra.+Ana&background=0D8ABC&color=fff",
      },
    }),
    prisma.professional.create({
      data: {
        name: "Dr. Jose",
        email: "jose@clinica.com",
        bio: "Procedimentos corporais e acompanhamento clinico.",
        avatarUrl: "https://ui-avatars.com/api/?name=Dr.+Jose&background=5A67D8&color=fff",
      },
    }),
    prisma.professional.create({
      data: {
        name: "Dra. Maria",
        email: "maria@clinica.com",
        bio: "Nutricao e medicina preventiva.",
        avatarUrl: "https://ui-avatars.com/api/?name=Dra.+Maria&background=16A34A&color=fff",
      },
    }),
    prisma.professional.create({
      data: {
        name: "Dr. Claudio",
        email: "claudio@clinica.com",
        bio: "Dermatologia clinica e estetica.",
        avatarUrl: "https://ui-avatars.com/api/?name=Dr.+Claudio&background=EA580C&color=fff",
      },
    }),
  ]);

  console.log("Seeding health plans...");
  const healthPlans = await Promise.all([
    prisma.healthPlan.create({ data: { name: "Unimed" } }),
    prisma.healthPlan.create({ data: { name: "Bradesco Saude" } }),
    prisma.healthPlan.create({ data: { name: "SulAmerica" } }),
    prisma.healthPlan.create({ data: { name: "Amil" } }),
  ]);

  console.log("Seeding services...");
  const services: SeedService[] = await Promise.all([
    prisma.service.create({
      data: {
        name: "Consulta Estética",
        description: "Avaliação inicial facial e corporal.",
        duration: 30,
        price: 180,
      },
    }),
    prisma.service.create({
      data: {
        name: "Retorno",
        description: "Consulta de retorno e acompanhamento.",
        duration: 30,
        price: 0,
      },
    }),
    prisma.service.create({
      data: {
        name: "Aplicação de Botox",
        description: "Procedimento estético facial.",
        duration: 45,
        price: 850,
      },
    }),
    prisma.service.create({
      data: {
        name: "Peeling Químico",
        description: "Tratamento de renovacao da pele.",
        duration: 60,
        price: 420,
      },
    }),
    prisma.service.create({
      data: {
        name: "Consulta Nutricional",
        description: "Plano alimentar personalizado.",
        duration: 50,
        price: 260,
      },
    }),
    prisma.service.create({
      data: {
        name: "Limpeza de Pele Premium",
        description: "Procedimento completo com hidratacao.",
        duration: 60,
        price: 320,
      },
    }),
  ]);

  const serviceByName = new Map(services.map((service) => [service.name, service]));

  console.log("Linking professionals to services...");
  const doctorServiceMatrix: Record<string, string[]> = {
    "Dra. Ana": [
      "Consulta Estética",
      "Retorno",
      "Aplicação de Botox",
      "Peeling Químico",
      "Limpeza de Pele Premium",
    ],
    "Dr. Jose": [
      "Consulta Estética",
      "Retorno",
      "Peeling Químico",
      "Limpeza de Pele Premium",
    ],
    "Dra. Maria": ["Consulta Nutricional", "Retorno", "Consulta Estética"],
    "Dr. Claudio": [
      "Consulta Estética",
      "Retorno",
      "Aplicação de Botox",
      "Peeling Químico",
    ],
  };

  const professionalServices = new Map<string, SeedService[]>();

  for (const professional of professionals) {
    const serviceNames = doctorServiceMatrix[professional.name] || ["Retorno"];
    const linkedServices = serviceNames
      .map((name) => serviceByName.get(name))
      .filter((service): service is SeedService => !!service);

    professionalServices.set(professional.id, linkedServices);

    await prisma.professionalService.createMany({
      data: linkedServices.map((service) => ({
        professionalId: professional.id,
        serviceId: service.id,
      })),
    });
  }

  console.log("Seeding schedules...");
  const scheduleTemplates: Record<string, ScheduleTemplate[]> = {
    "Dra. Ana": [
      { dayOfWeek: 1, startTime: "08:00", endTime: "17:00" },
      { dayOfWeek: 2, startTime: "08:00", endTime: "17:00" },
      { dayOfWeek: 3, startTime: "09:00", endTime: "18:00" },
      { dayOfWeek: 4, startTime: "09:00", endTime: "18:00" },
      { dayOfWeek: 5, startTime: "08:00", endTime: "16:00" },
    ],
    "Dr. Jose": [
      { dayOfWeek: 1, startTime: "10:00", endTime: "19:00" },
      { dayOfWeek: 2, startTime: "10:00", endTime: "19:00" },
      { dayOfWeek: 4, startTime: "10:00", endTime: "19:00" },
      { dayOfWeek: 5, startTime: "09:00", endTime: "17:00" },
      { dayOfWeek: 6, startTime: "08:00", endTime: "13:00" },
    ],
    "Dra. Maria": [
      { dayOfWeek: 1, startTime: "07:30", endTime: "15:30" },
      { dayOfWeek: 2, startTime: "07:30", endTime: "15:30" },
      { dayOfWeek: 3, startTime: "07:30", endTime: "15:30" },
      { dayOfWeek: 4, startTime: "07:30", endTime: "15:30" },
      { dayOfWeek: 5, startTime: "07:30", endTime: "13:30" },
    ],
    "Dr. Claudio": [
      { dayOfWeek: 2, startTime: "12:00", endTime: "20:00" },
      { dayOfWeek: 3, startTime: "12:00", endTime: "20:00" },
      { dayOfWeek: 4, startTime: "12:00", endTime: "20:00" },
      { dayOfWeek: 5, startTime: "12:00", endTime: "20:00" },
      { dayOfWeek: 6, startTime: "09:00", endTime: "14:00" },
    ],
  };

  const scheduleMap = new Map<string, ScheduleTemplate[]>();
  for (const professional of professionals) {
    const templates = scheduleTemplates[professional.name] || [];
    scheduleMap.set(professional.id, templates);
    for (const template of templates) {
      await prisma.schedule.create({
        data: {
          professionalId: professional.id,
          dayOfWeek: template.dayOfWeek,
          startTime: template.startTime,
          endTime: template.endTime,
        },
      });
    }
  }

  console.log("Seeding patients...");
  const patientData: Array<{
    name: string;
    phone: string;
    email: string | null;
    coverageType: PatientCoverageType;
    healthPlanId: string | null;
  }> = [];

  for (let index = 0; index < 72; index++) {
    const name = buildPatientName(index);
    const hasEmail = chance(rng, 0.86);
    const hasPlan = chance(rng, 0.42);
    const plan = hasPlan ? pickOne(rng, healthPlans) : null;

    patientData.push({
      name,
      phone: buildPatientPhone(index),
      email: hasEmail ? buildPatientEmail(name, index) : null,
      coverageType: hasPlan ? PatientCoverageType.PLAN : PatientCoverageType.PARTICULAR,
      healthPlanId: plan?.id || null,
    });
  }

  await prisma.patient.createMany({ data: patientData });
  const patients: SeedPatient[] = await prisma.patient.findMany({
    orderBy: { createdAt: "asc" },
  });

  console.log("Seeding bookings...");
  const allUserIdsForManualCreation = [
    adminUser.id,
    attendantUser.id,
    ...doctorUsers.map((doctor) => doctor.id),
  ];

  let externalRequestCounter = 1;
  const createdSlots = new Set<string>();

  for (let dayOffset = -35; dayOffset <= 35; dayOffset++) {
    const day = dateWithDayOffset(dayOffset);
    const dayOfWeek = day.getDay();

    for (const professional of professionals) {
      const schedules = scheduleMap.get(professional.id) || [];
      const dailySchedule = schedules.find(
        (schedule) => schedule.dayOfWeek === dayOfWeek,
      );
      if (!dailySchedule) continue;

      const linkedServices = professionalServices.get(professional.id) || [];
      if (linkedServices.length === 0) continue;

      const minBookings = dayOffset === 0 ? 3 : dayOffset > 0 ? 1 : 2;
      const maxBookings = dayOffset === 0 ? 7 : dayOffset > 0 ? 6 : 5;
      const bookingsToCreate = randomInt(rng, minBookings, maxBookings);

      const scheduleStart = minutesFromTime(dailySchedule.startTime);
      const scheduleEnd = minutesFromTime(dailySchedule.endTime);

      let attempts = 0;
      let generated = 0;

      while (generated < bookingsToCreate && attempts < bookingsToCreate * 20) {
        attempts++;

        const service = pickOne(rng, linkedServices);
        const latestStart = scheduleEnd - service.duration;
        if (latestStart <= scheduleStart) {
          continue;
        }

        const slotStep = 30;
        const slotCount = Math.floor((latestStart - scheduleStart) / slotStep);
        const slotIndex = randomInt(rng, 0, Math.max(0, slotCount));
        const startMinutes = scheduleStart + slotIndex * slotStep;
        const endMinutes = startMinutes + service.duration;

        const startTime = timeFromMinutes(startMinutes);
        const endTime = timeFromMinutes(endMinutes);

        const uniqueKey = `${professional.id}|${day.toISOString()}|${startTime}`;
        if (createdSlots.has(uniqueKey)) {
          continue;
        }

        createdSlots.add(uniqueKey);

        const patient = pickOne(rng, patients);
        const status = resolveStatusForDayOffset(rng, dayOffset);
        const source = resolveSource(rng);
        const createdByUserId =
          source === BookingSource.MANUAL
            ? pickOne(rng, allUserIdsForManualCreation)
            : null;
        const externalRequestId =
          source === BookingSource.BOT_N8N
            ? `seed-bot-${externalRequestCounter++}`
            : null;

        await prisma.booking.create({
          data: {
            date: day,
            startTime,
            endTime,
            status,
            source,
            createdByUserId,
            externalRequestId,
            patientId: patient.id,
            professionalId: professional.id,
            serviceId: service.id,
          },
        });

        generated++;
      }
    }
  }

  console.log("Seeding schedule time-off blocks...");
  const timeOffReasons = [
    "Congresso medico",
    "Treinamento interno",
    "Compromisso pessoal",
    "Plantao externo",
    "Atendimento corporativo",
  ];

  for (const professional of professionals) {
    for (let index = 0; index < 3; index++) {
      const dayOffset = randomInt(rng, -10, 20);
      const date = dateWithDayOffset(dayOffset);
      const startHour = randomInt(rng, 8, 15);
      const startDateTime = new Date(date);
      startDateTime.setHours(startHour, 0, 0, 0);
      const endDateTime = new Date(startDateTime);
      endDateTime.setHours(startHour + randomInt(rng, 1, 3), 0, 0, 0);

      await prisma.professionalTimeOff.create({
        data: {
          professionalId: professional.id,
          startDateTime,
          endDateTime,
          reason: pickOne(rng, timeOffReasons),
          createdByUserId: adminUser.id,
        },
      });
    }
  }

  const totalBookings = await prisma.booking.count();
  const totalPatients = await prisma.patient.count();
  const totalTimeOffs = await prisma.professionalTimeOff.count();

  console.log("Seed complete!");
  console.log(`Users: ${2 + doctorUsers.length + 1}`);
  console.log(`Professionals: ${professionals.length}`);
  console.log(`Services: ${services.length}`);
  console.log(`Health plans: ${healthPlans.length}`);
  console.log(`Patients: ${totalPatients}`);
  console.log(`Bookings: ${totalBookings}`);
  console.log(`Time-off blocks: ${totalTimeOffs}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

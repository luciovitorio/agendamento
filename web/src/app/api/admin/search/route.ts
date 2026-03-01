import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type AllowedRole = "ADMIN" | "ATENDENTE" | "DOUTOR";

interface SearchItem {
  id: string;
  type: "PATIENT" | "PROFESSIONAL";
  name: string;
  subtitle: string;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  const role = session?.user?.role as AllowedRole | undefined;
  const userEmail = session?.user?.email;

  if (!session || !role || !["ADMIN", "ATENDENTE", "DOUTOR"].includes(role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() || "";
  if (q.length < 2) {
    return NextResponse.json({ items: [] });
  }

  const doctorProfessional =
    role === "DOUTOR" && userEmail
      ? await prisma.professional.findUnique({
          where: { email: userEmail },
          select: { id: true, name: true, email: true },
        })
      : null;

  const patients = await prisma.patient.findMany({
    where: {
      ...(role === "DOUTOR"
        ? doctorProfessional
          ? { bookings: { some: { professionalId: doctorProfessional.id } } }
          : { id: "__NO_PATIENT__" }
        : {}),
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      phone: true,
    },
    orderBy: { name: "asc" },
    take: 8,
  });

  const professionals =
    role === "DOUTOR"
      ? doctorProfessional &&
        (doctorProfessional.name.toLowerCase().includes(q.toLowerCase()) ||
          doctorProfessional.email.toLowerCase().includes(q.toLowerCase()))
        ? [doctorProfessional]
        : []
      : await prisma.professional.findMany({
          where: {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          },
          select: {
            id: true,
            name: true,
            email: true,
          },
          orderBy: { name: "asc" },
          take: 8,
        });

  const patientItems: SearchItem[] = patients.map((patient) => ({
    id: patient.id,
    type: "PATIENT",
    name: patient.name,
    subtitle: `Paciente • ${patient.phone}`,
  }));

  const professionalItems: SearchItem[] = professionals.map((professional) => ({
    id: professional.id,
    type: "PROFESSIONAL",
    name: professional.name,
    subtitle: `Médico(a) • ${professional.email}`,
  }));

  const items = [...patientItems, ...professionalItems].slice(0, 12);
  return NextResponse.json({ items });
}

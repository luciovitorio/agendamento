import { auth } from "@/auth";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth();
  const role = session?.user?.role;

  if (!session || !role || !["ADMIN", "ATENDENTE", "DOUTOR"].includes(role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() || "";

  const patients = await prisma.patient.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
    },
    orderBy: { name: "asc" },
    take: 20,
  });

  return NextResponse.json(patients);
}

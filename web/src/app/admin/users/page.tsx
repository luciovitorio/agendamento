import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { UsersClientPage } from "./client-page";
import type { UserData } from "./_components/users-table";
import { prisma } from "@/lib/prisma";

export default async function AdminUsersPage() {
  const session = await auth();
  const userRole = (session?.user as any)?.role;

  if (userRole !== "ADMIN") {
    redirect("/admin");
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
  });

  const lastLoginRows = await prisma.$queryRaw<
    Array<{ email: string; lastLoginAt: Date | null }>
  >`
    SELECT "email", "lastLoginAt"
    FROM "User"
  `;
  const lastLoginByEmail = new Map(
    lastLoginRows.map((row) => [row.email, row.lastLoginAt]),
  );

  const formattedUsers: UserData[] = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role:
      user.role === "ADMIN"
        ? "ADMIN"
        : user.role === "DOUTOR"
          ? "PROFESSIONAL"
          : "RECEPTIONIST",
    status: user.status as "ACTIVE" | "INACTIVE" | "PENDING" | "BLOCKED",
    designation:
      user.role === "ADMIN"
        ? "Administrador"
        : user.role === "DOUTOR"
          ? "Profissional Clínico"
          : "Recepcionista",
    lastLogin: lastLoginByEmail.get(user.email) || null,
  }));

  return <UsersClientPage users={formattedUsers} />;
}

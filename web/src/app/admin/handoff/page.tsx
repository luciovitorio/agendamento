import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listActiveHumanHandoffs } from "@/lib/human-handoff";
import { HandoffTable } from "./_components/handoff-table";

type AllowedRole = "ADMIN" | "ATENDENTE";

export const runtime = "nodejs";

export default async function AdminHandoffPage() {
  const session = await auth();
  const userRole = session?.user?.role as AllowedRole | undefined;
  const userName = session?.user?.name || null;
  const userEmail = session?.user?.email || null;

  if (!userRole || !["ADMIN", "ATENDENTE"].includes(userRole)) {
    redirect("/admin");
  }

  const items = await listActiveHumanHandoffs(300);

  return (
    <HandoffTable
      initialItems={items}
      currentUserRole={userRole}
      currentAgentName={userName}
      currentAgentEmail={userEmail}
    />
  );
}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { countActiveHumanHandoffs } from "@/lib/human-handoff";

type AllowedRole = "ADMIN" | "ATENDENTE";

export async function GET() {
  const session = await auth();
  const role = session?.user?.role as AllowedRole | undefined;

  if (!session || !role || !["ADMIN", "ATENDENTE"].includes(role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const count = await countActiveHumanHandoffs();
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}

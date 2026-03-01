import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AdminSidebar } from "./_components/admin-sidebar";
import { AdminHeader } from "./_components/admin-header";
import { AuthSessionProvider } from "./_components/session-provider";

export const runtime = "nodejs";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return (
    <AuthSessionProvider>
      <div className="flex h-screen overflow-hidden bg-[#f6f6f8] dark:bg-[#09090b] text-slate-900 dark:text-slate-100 antialiased font-sans">
        <AdminSidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <AdminHeader />
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            {children}
          </div>
        </main>
      </div>
    </AuthSessionProvider>
  );
}

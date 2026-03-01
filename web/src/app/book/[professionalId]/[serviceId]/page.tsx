import BookingFlow from "./BookingFlow";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function BookingPage({
  params,
}: {
  params: Promise<{ professionalId: string; serviceId: string }>;
}) {
  const { professionalId, serviceId } = await params;

  const doctor = await prisma.professional.findUnique({
    where: { id: professionalId },
  });

  const service = await prisma.service.findUnique({
    where: { id: serviceId },
  });

  if (!doctor || !service) {
    return notFound();
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center py-12 px-4 sm:px-6">
      <div className="w-full max-w-5xl">
        <BookingFlow doctor={doctor} service={service} />
      </div>
    </div>
  );
}

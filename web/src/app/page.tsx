import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { prisma } from "@/lib/prisma";

// Prevent static generation caching constraints for demo
export const dynamic = "force-dynamic";

export default async function Home() {
  const professionals = await prisma.professional.findMany({
    include: {
      services: { include: { service: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <main className="max-w-4xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl mb-4">
            Agende sua consulta
          </h1>
          <p className="text-lg text-zinc-500 dark:text-zinc-400">
            Selecione um profissional abaixo para visualizar os serviços e
            horários disponíveis.
          </p>
        </div>

        <div className="space-y-8">
          {professionals.map((prof) => (
            <Card key={prof.id} className="overflow-hidden">
              <CardHeader className="flex flex-row items-center gap-4 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={prof.avatarUrl || ""} alt={prof.name} />
                  <AvatarFallback>
                    {prof.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-xl">{prof.name}</CardTitle>
                  <CardDescription className="text-sm mt-1">
                    {prof.bio || "Especialista"}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {prof.services.map(({ service }) => (
                    <li key={service.id}>
                      <Link
                        href={`/book/${prof.id}/${service.id}`}
                        className="block px-6 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-zinc-900 dark:text-zinc-100">
                              {service.name}
                            </p>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                              {service.duration} min •{" "}
                              {service.price
                                ? `R$ ${service.price}`
                                : "Gratuito"}
                            </p>
                          </div>
                          <div className="text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200 transition-colors">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="20"
                              height="20"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="m9 18 6-6-6-6" />
                            </svg>
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                  {prof.services.length === 0 && (
                    <li className="px-6 py-4 text-sm text-zinc-500">
                      Nenhum serviço disponível no momento.
                    </li>
                  )}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}

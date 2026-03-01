"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type Doctor = {
  id: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
};
type Service = {
  id: string;
  name: string;
  duration: number;
  price: number | null;
};

export default function BookingFlow({
  doctor,
  service,
}: {
  doctor: Doctor;
  service: Service;
}) {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [isFetchingSlots, setIsFetchingSlots] = useState(false);

  // Form State
  const [step, setStep] = useState<1 | 2>(1); // 1 = Calendar/Time, 2 = Form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (!date) return;

    setIsFetchingSlots(true);
    setSelectedTime(null);
    const dateStr = format(date, "yyyy-MM-dd");

    fetch(
      `/api/availability?professionalId=${doctor.id}&serviceId=${service.id}&date=${dateStr}`,
    )
      .then((res) => res.json())
      .then((data) => {
        if (data.slots) {
          setTimeSlots(data.slots);
        } else {
          setTimeSlots([]);
        }
      })
      .catch(console.error)
      .finally(() => setIsFetchingSlots(false));
  }, [date, doctor.id, service.id]);

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !selectedTime) return;

    setIsSubmitting(true);
    const dateStr = format(date, "yyyy-MM-dd");

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          professionalId: doctor.id,
          serviceId: service.id,
          dateStr,
          startTime: selectedTime,
          name,
          email,
          phone,
        }),
      });

      if (res.ok) {
        setIsSuccess(true);
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Erro ao agendar.");
      }
    } catch (err) {
      alert("Falha na comunicação.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <Card className="w-full max-w-md mx-auto mt-16 text-center border-emerald-100 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-900">
        <CardHeader>
          <div className="mx-auto w-12 h-12 bg-emerald-100 dark:bg-emerald-900 rounded-full flex items-center justify-center mb-4 text-emerald-600 dark:text-emerald-400">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <CardTitle className="text-2xl text-emerald-800 dark:text-emerald-300">
            Reunião Confirmada
          </CardTitle>
          <CardDescription className="text-emerald-700 dark:text-emerald-400">
            Um convite foi enviado para o seu e-mail e WhatsApp.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-left border-t border-emerald-100 dark:border-emerald-900 pt-6">
          <div className="flex gap-4">
            <div className="text-zinc-500">O que</div>
            <div className="font-medium text-emerald-900 dark:text-emerald-100">
              {service.name} entre você e {doctor.name}
            </div>
          </div>
          <div className="flex gap-4">
            <div className="text-zinc-500">Quando</div>
            <div className="font-medium text-emerald-900 dark:text-emerald-100">
              {date && format(date, "EEEE, d 'de' MMMM", { locale: ptBR })}{" "}
              <br /> {selectedTime} - {service.duration} Minutos
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-950 min-h-[600px] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm flex flex-col md:flex-row overflow-hidden w-full max-w-5xl mx-auto">
      {/* Sidebar Info */}
      <div className="w-full md:w-1/3 bg-zinc-50 dark:bg-zinc-900 p-8 border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800">
        <Avatar className="h-16 w-16 mb-6">
          <AvatarImage src={doctor.avatarUrl || ""} />
          <AvatarFallback>
            {doctor.name.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <h2 className="text-zinc-500 dark:text-zinc-400 font-medium mb-1">
          {doctor.name}
        </h2>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
          {service.name}
        </h1>

        <div className="space-y-4 text-zinc-600 dark:text-zinc-300">
          <div className="flex items-center gap-3">
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
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>{service.duration} min</span>
          </div>
          {service.price !== null && (
            <div className="flex items-center gap-3">
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
                <path d="M12 2v20" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              <span>R$ {service.price}</span>
            </div>
          )}
          {step === 2 && date && selectedTime && (
            <div className="flex items-start gap-3 text-emerald-600 dark:text-emerald-400 font-medium mt-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
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
                className="mt-1 flex-shrink-0"
              >
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                <line x1="16" x2="16" y1="2" y2="6" />
                <line x1="8" x2="8" y1="2" y2="6" />
                <line x1="3" x2="21" y1="10" y2="10" />
                <path d="M8 14h.01" />
                <path d="M12 14h.01" />
                <path d="M16 14h.01" />
                <path d="M8 18h.01" />
                <path d="M12 18h.01" />
                <path d="M16 18h.01" />
              </svg>
              <div>
                <span className="block">
                  {format(date, "EEEE, d 'de' MMMM", { locale: ptBR })}
                </span>
                <span className="block mt-1">{selectedTime}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-8">
        {step === 1 ? (
          <div className="flex flex-col xl:flex-row gap-8">
            <div className="flex-1">
              <h2 className="text-xl font-semibold mb-6">
                Selecione uma Data e Horário
              </h2>
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                locale={ptBR}
                className="rounded-md border-0 pointer-events-auto mx-auto xl:mx-0 w-full max-w-sm"
                disabled={(dt) =>
                  dt < new Date(new Date().setHours(0, 0, 0, 0))
                }
              />
            </div>

            {date && (
              <div className="w-full xl:w-64">
                <p className="text-zinc-600 dark:text-zinc-400 mb-4 font-medium h-6">
                  {format(date, "EEEE, MMMM d", { locale: ptBR })}
                </p>
                <div className="grid grid-cols-2 xl:grid-cols-1 gap-2 max-h-[400px] overflow-y-auto pr-2 pb-4 slim-scrollbar">
                  {isFetchingSlots ? (
                    <p className="text-sm text-zinc-500 col-span-2 xl:col-span-1">
                      Carregando horários...
                    </p>
                  ) : timeSlots.length > 0 ? (
                    timeSlots.map((time) => (
                      <div key={time} className="flex gap-2">
                        <Button
                          variant={
                            selectedTime === time ? "default" : "outline"
                          }
                          className={`flex-1 font-normal ${selectedTime === time ? "bg-zinc-900" : "text-emerald-600 border-emerald-200 hover:border-emerald-300 dark:border-zinc-800 dark:text-zinc-300"}`}
                          onClick={() => setSelectedTime(time)}
                        >
                          {time}
                        </Button>
                        {selectedTime === time && (
                          <Button
                            className="w-1/2 animate-in fade-in slide-in-from-left-2 transition-all"
                            onClick={() => setStep(2)}
                          >
                            Avançar
                          </Button>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-zinc-500 col-span-2 xl:col-span-1">
                      Nenhum horário disponível para esta data.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-md animate-in fade-in slide-in-from-right-4">
            <h2 className="text-xl font-semibold mb-6">
              Informações do Contato
            </h2>
            <form onSubmit={handleBooking} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome completo *</Label>
                <Input
                  id="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="João Silva"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail *</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="joao@exemplo.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">WhatsApp *</Label>
                <Input
                  id="phone"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t mt-8">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                  disabled={isSubmitting}
                >
                  Voltar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  {isSubmitting ? "Confirmando..." : "Confirmar Evento"}
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import * as z from "zod";
import {
  ArrowLeft,
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Dot,
  Info,
  Loader2,
  Mail,
  Phone,
  Search,
  SearchX,
  Stethoscope,
  UserPlus,
  UserRound,
  UserRoundCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createManualAppointmentAction } from "@/app/actions/appointment-actions";
import { CreatePatientModal } from "@/app/admin/patients/_components/create-patient-modal";
import { toast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { addMonths, format, startOfDay, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import type {
  ProfessionalOption,
  PatientOption,
  HealthPlanOption,
} from "./types";

const optionalEmailSchema = z
  .string()
  .trim()
  .optional()
  .refine(
    (value) => {
      if (!value) return true;
      return z.string().email().safeParse(value).success;
    },
    { message: "Endereço de e-mail inválido" },
  );

const appointmentSchema = z.object({
  professionalId: z.string().min(1, "Selecione o profissional"),
  serviceId: z.string().min(1, "Selecione o serviço"),
  dateStr: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Selecione a data"),
  startTime: z.string().min(1, "Selecione o horário"),
  patientName: z
    .string()
    .trim()
    .min(3, "Nome do paciente deve ter pelo menos 3 caracteres"),
  patientPhone: z
    .string()
    .trim()
    .refine(
      (value) => {
        const digits = value.replace(/\D/g, "");
        return digits.length === 10 || digits.length === 11;
      },
      { message: "Telefone deve ter 10 ou 11 dígitos" },
    ),
  patientEmail: optionalEmailSchema,
});

type AppointmentFormValues = z.infer<typeof appointmentSchema>;

type BookingStep = "slot" | "patient";

interface CreateAppointmentModalProps {
  professionals: ProfessionalOption[];
  healthPlans?: HealthPlanOption[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  mode?: "modal" | "page";
  backHref?: string;
}

function formatPhoneMask(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);

  if (digits.length <= 2) {
    return digits;
  }

  const areaCode = digits.slice(0, 2);
  const localNumber = digits.slice(2);

  if (localNumber.length <= 4) {
    return `(${areaCode}) ${localNumber}`;
  }

  const splitIndex = localNumber.length <= 8 ? 4 : 5;
  return `(${areaCode}) ${localNumber.slice(0, splitIndex)}-${localNumber.slice(splitIndex)}`;
}

function toInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function CreateAppointmentModal({
  professionals,
  healthPlans = [],
  open,
  onOpenChange,
  mode = "modal",
  backHref = "/admin/appointments",
}: CreateAppointmentModalProps) {
  const isPageMode = mode === "page";
  const isOpen = isPageMode ? true : !!open;
  const [step, setStep] = useState<BookingStep>("slot");
  const [selectedDate, setSelectedDate] = useState<Date>(
    startOfDay(new Date()),
  );
  const [visibleMonth, setVisibleMonth] = useState<Date>(
    startOfDay(new Date()),
  );
  const [isPending, startTransition] = useTransition();
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const availabilityCacheRef = useRef<Map<string, string[]>>(new Map());
  const router = useRouter();

  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(
    null,
  );
  const [isManualPatientEdit, setIsManualPatientEdit] = useState(false);
  const [isCreatePatientModalOpen, setIsCreatePatientModalOpen] =
    useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [patientResults, setPatientResults] = useState<PatientOption[]>([]);
  const [isSearchingPatients, setIsSearchingPatients] = useState(false);
  const [isPatientDropdownOpen, setIsPatientDropdownOpen] = useState(false);

  const form = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      professionalId: professionals[0]?.id ?? "",
      serviceId: "",
      dateStr: toInputDate(new Date()),
      startTime: "",
      patientName: "",
      patientPhone: "",
      patientEmail: "",
    },
  });

  const professionalId = form.watch("professionalId");
  const serviceId = form.watch("serviceId");
  const dateStr = useMemo(() => toInputDate(selectedDate), [selectedDate]);
  const selectedStartTime = form.watch("startTime");

  const selectedProfessional = useMemo(
    () =>
      professionals.find((professional) => professional.id === professionalId),
    [professionals, professionalId],
  );

  const professionalServices = selectedProfessional?.services ?? [];
  const selectedService = professionalServices.find(
    (service) => service.id === serviceId,
  );
  const isPatientFieldsLocked = !!selectedPatient && !isManualPatientEdit;

  const slotSections = useMemo(() => {
    const morning = availableSlots.filter((slot) => {
      const hour = Number(slot.split(":")[0] || "0");
      return hour < 12;
    });
    const afternoon = availableSlots.filter((slot) => {
      const hour = Number(slot.split(":")[0] || "0");
      return hour >= 12 && hour < 18;
    });
    const evening = availableSlots.filter((slot) => {
      const hour = Number(slot.split(":")[0] || "0");
      return hour >= 18;
    });

    return [
      { id: "morning", label: "Manhã", slots: morning },
      { id: "afternoon", label: "Tarde", slots: afternoon },
      { id: "evening", label: "Noite", slots: evening },
    ];
  }, [availableSlots]);

  const searchPatients = useCallback(async (query: string) => {
    setIsSearchingPatients(true);
    try {
      const response = await fetch(
        `/api/patients?q=${encodeURIComponent(query.trim())}`,
      );
      const data = await response.json();

      if (!response.ok || !Array.isArray(data)) {
        setPatientResults([]);
        return [];
      }

      const patients = data as PatientOption[];
      setPatientResults(patients);
      return patients;
    } catch {
      setPatientResults([]);
      return [];
    } finally {
      setIsSearchingPatients(false);
    }
  }, []);

  const applyPatientSelection = useCallback(
    (patient: PatientOption) => {
      setSelectedPatient(patient);
      setIsManualPatientEdit(false);
      setPatientSearch(patient.name);
      setIsPatientDropdownOpen(false);
      form.setValue("patientName", patient.name, { shouldValidate: true });
      form.setValue("patientPhone", formatPhoneMask(patient.phone), {
        shouldValidate: true,
      });
      form.setValue("patientEmail", patient.email ?? "", {
        shouldValidate: true,
      });
    },
    [form],
  );

  const handlePatientCreated = useCallback(
    async (patient: { name: string; phone: string; email: string | null }) => {
      const query = patient.phone.trim() || patient.name.trim();
      if (!query) {
        return;
      }

      const patients = await searchPatients(query);
      const targetDigits = patient.phone.replace(/\D/g, "");
      const foundPatient =
        patients.find(
          (candidate) => candidate.phone.replace(/\D/g, "") === targetDigits,
        ) ||
        patients.find(
          (candidate) =>
            candidate.name.trim().toLowerCase() ===
            patient.name.trim().toLowerCase(),
        );

      if (foundPatient) {
        applyPatientSelection(foundPatient);
        return;
      }

      setSelectedPatient(null);
      setIsManualPatientEdit(false);
      setPatientSearch(patient.name);
      setIsPatientDropdownOpen(false);
      form.setValue("patientName", patient.name, { shouldValidate: true });
      form.setValue("patientPhone", formatPhoneMask(patient.phone), {
        shouldValidate: true,
      });
      form.setValue("patientEmail", patient.email ?? "", {
        shouldValidate: true,
      });
    },
    [applyPatientSelection, form, searchPatients],
  );

  useEffect(() => {
    form.setValue("dateStr", dateStr);
  }, [dateStr, form]);

  useEffect(() => {
    if (!selectedProfessional) {
      form.setValue("serviceId", "");
      return;
    }

    const currentlySelectedServiceId = form.getValues("serviceId");
    const stillAvailable = professionalServices.some(
      (service) => service.id === currentlySelectedServiceId,
    );

    if (!stillAvailable) {
      form.setValue("serviceId", "");
      form.setValue("startTime", "");
      setStep("slot");
    }
  }, [selectedProfessional, professionalServices, form]);

  useEffect(() => {
    if (!isOpen) {
      setStep("slot");
      setSelectedPatient(null);
      setIsManualPatientEdit(false);
      setPatientSearch("");
      setPatientResults([]);
      setIsPatientDropdownOpen(false);
      setIsCreatePatientModalOpen(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || step !== "patient" || !isPatientDropdownOpen) {
      return;
    }

    const searchValue = patientSearch.trim();
    if (searchValue.length === 1) {
      setPatientResults([]);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      searchPatients(searchValue);
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isOpen, isPatientDropdownOpen, patientSearch, searchPatients, step]);

  useEffect(() => {
    let cancelled = false;

    async function fetchSlots() {
      if (!isOpen || !professionalId || !serviceId || !dateStr) {
        setAvailableSlots([]);
        setSlotsError(null);
        form.setValue("startTime", "");
        return;
      }

      const cacheKey = `${professionalId}|${serviceId}|${dateStr}`;
      const cachedSlots = availabilityCacheRef.current.get(cacheKey);

      if (cachedSlots) {
        setSlotsError(null);
        setAvailableSlots(cachedSlots);

        if (selectedStartTime && !cachedSlots.includes(selectedStartTime)) {
          form.setValue("startTime", "");
          setStep("slot");
        }
        return;
      }

      setIsLoadingSlots(true);
      setSlotsError(null);

      try {
        const response = await fetch(
          `/api/availability?professionalId=${professionalId}&serviceId=${serviceId}&date=${dateStr}`,
        );
        const data = await response.json();

        if (cancelled) return;

        if (!response.ok) {
          setAvailableSlots([]);
          setSlotsError(data?.error || "Falha ao carregar horários.");
          form.setValue("startTime", "");
          setStep("slot");
          return;
        }

        const slots = Array.isArray(data?.slots) ? data.slots : [];
        availabilityCacheRef.current.set(cacheKey, slots);
        setAvailableSlots(slots);

        if (selectedStartTime && !slots.includes(selectedStartTime)) {
          form.setValue("startTime", "");
          setStep("slot");
        }
      } catch {
        if (cancelled) return;
        setAvailableSlots([]);
        setSlotsError("Falha ao carregar horários.");
        form.setValue("startTime", "");
        setStep("slot");
      } finally {
        if (!cancelled) {
          setIsLoadingSlots(false);
        }
      }
    }

    fetchSlots();

    return () => {
      cancelled = true;
    };
  }, [isOpen, professionalId, serviceId, dateStr, form, selectedStartTime]);

  const onSubmit = (values: AppointmentFormValues) => {
    startTransition(async () => {
      const response = await createManualAppointmentAction(values);

      if (response.success) {
        toast({
          title: "Agendamento criado",
          description: "O agendamento manual foi registrado com sucesso.",
        });
        form.reset({
          professionalId: professionals[0]?.id ?? "",
          serviceId: "",
          dateStr: toInputDate(new Date()),
          startTime: "",
          patientName: "",
          patientPhone: "",
          patientEmail: "",
        });
        setSelectedDate(startOfDay(new Date()));
        setVisibleMonth(startOfDay(new Date()));
        setStep("slot");
        setAvailableSlots([]);
        setSelectedPatient(null);
        setIsManualPatientEdit(false);
        setPatientSearch("");
        setPatientResults([]);
        setIsPatientDropdownOpen(false);
        if (isPageMode) {
          router.push(backHref);
          router.refresh();
        } else {
          onOpenChange?.(false);
          router.refresh();
        }
        return;
      }

      toast({
        title: "Erro ao agendar",
        description: response.error,
        variant: "destructive",
      });
    });
  };

  const handleContinueToPatient = async () => {
    const valid = await form.trigger([
      "professionalId",
      "serviceId",
      "dateStr",
      "startTime",
    ]);
    if (!valid) return;
    setStep("patient");
  };

  const selectedSlotLabel = selectedStartTime
    ? `${format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })} às ${selectedStartTime}`
    : "Nenhum horário selecionado";

  const todayStart = startOfDay(new Date());
  const todayMonthStart = startOfMonth(todayStart);
  const visibleMonthStart = startOfMonth(visibleMonth);
  const canGoPrevMonth = visibleMonthStart > todayMonthStart;
  const monthLabel = format(visibleMonth, "MMMM yyyy", { locale: ptBR });
  const monthLabelTitle =
    monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  const handleClose = () => {
    if (isPageMode) {
      router.push(backHref);
      return;
    }
    onOpenChange?.(false);
  };

  const formBlock = (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <div
        className={
          isPageMode
            ? "p-8 space-y-6"
            : "p-8 space-y-6 max-h-[80vh] overflow-y-auto"
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldLabel
            label="Profissional"
            error={form.formState.errors.professionalId?.message}
          >
            <Select
              value={professionalId}
              onValueChange={(value) => {
                form.setValue("professionalId", value);
                form.setValue("startTime", "");
                setStep("slot");
              }}
            >
              <SelectTrigger className="w-full bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-6 text-sm focus:ring-indigo-600 focus:border-indigo-600 outline-none transition-all cursor-pointer dark:text-white border shadow-none">
                <div className="flex items-center gap-2">
                  <UserRoundCheck className="size-4 text-slate-400" />
                  <SelectValue placeholder="Selecione o profissional" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-200 dark:border-zinc-700">
                {professionals.map((professional) => (
                  <SelectItem key={professional.id} value={professional.id}>
                    {professional.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldLabel>

          <FieldLabel
            label="Serviço"
            error={form.formState.errors.serviceId?.message}
          >
            <Select
              value={serviceId}
              onValueChange={(value) => {
                form.setValue("serviceId", value);
                form.setValue("startTime", "");
                setStep("slot");
              }}
              disabled={professionalServices.length === 0}
            >
              <SelectTrigger className="w-full bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-6 text-sm focus:ring-indigo-600 focus:border-indigo-600 outline-none transition-all cursor-pointer dark:text-white border shadow-none disabled:opacity-60">
                <div className="flex items-center gap-2">
                  <Stethoscope className="size-4 text-slate-400" />
                  <SelectValue
                    placeholder={
                      professionalServices.length === 0
                        ? "Sem serviços disponíveis"
                        : "Selecione o serviço"
                    }
                  />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-200 dark:border-zinc-700">
                {professionalServices.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    {service.name} ({service.duration} min)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldLabel>
        </div>

        {step === "slot" ? (
          <div className="space-y-5">
            <div className="flex flex-col lg:flex-row gap-5">
              <div className="lg:w-80 shrink-0 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 flex flex-col">
                <div className="flex items-center gap-4 mb-5">
                  <div className="size-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center text-2xl font-black shrink-0 shadow-lg shadow-indigo-500/20">
                    {selectedProfessional?.name?.charAt(0)?.toUpperCase() ||
                      "?"}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-extrabold text-slate-900 dark:text-white truncate">
                      {selectedProfessional?.name || "Selecione"}
                    </h3>
                    <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">
                      Profissional Clínico
                    </p>
                  </div>
                </div>

                <div className="border-t border-slate-100 dark:border-zinc-800 pt-4 mb-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">
                    Sobre
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                    {selectedProfessional
                      ? "Profissional disponível para agendamentos na clínica."
                      : "Selecione um profissional para ver os detalhes."}
                  </p>
                </div>

                <div className="space-y-3 mt-auto">
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-zinc-800/60 px-4 py-3 border border-slate-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2.5">
                      <Clock3 className="size-4 text-indigo-500" />
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        Duração
                      </span>
                    </div>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {selectedService
                        ? `${selectedService.duration} min`
                        : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-zinc-800/60 px-4 py-3 border border-slate-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2.5">
                      <Stethoscope className="size-4 text-indigo-500" />
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        Serviço
                      </span>
                    </div>
                    <span className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[140px]">
                      {selectedService?.name || "—"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex-1 min-w-0 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6">
                <div className="flex items-center justify-between gap-4 mb-5">
                  <div>
                    <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                      Selecione Data e Horário
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Fuso da clínica (UTC-03:00)
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 px-2 py-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setVisibleMonth((month) => addMonths(month, -1))
                      }
                      disabled={!canGoPrevMonth}
                      className="size-8 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center transition-colors"
                    >
                      <ChevronLeft className="size-4" />
                    </button>
                    <span className="min-w-[150px] text-center text-sm font-bold text-slate-900 dark:text-white">
                      {monthLabelTitle}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setVisibleMonth((month) => addMonths(month, 1))
                      }
                      className="size-8 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-zinc-700 inline-flex items-center justify-center transition-colors"
                    >
                      <ChevronRight className="size-4" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col xl:flex-row gap-5">
                  <div className="flex-1 min-w-0 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 bg-slate-50/60 dark:bg-zinc-900/70">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      month={visibleMonth}
                      onMonthChange={(month) =>
                        setVisibleMonth(startOfDay(month))
                      }
                      onSelect={(date) => {
                        if (!date) return;
                        setSelectedDate(startOfDay(date));
                        setVisibleMonth(startOfDay(date));
                        setStep("slot");
                      }}
                      locale={ptBR}
                      className="mx-auto [&_.rdp-nav]:hidden [&_.rdp-month_caption]:hidden"
                      disabled={(date) => date < todayStart}
                    />
                  </div>

                  <div className="xl:w-72 shrink-0 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 bg-slate-50/60 dark:bg-zinc-900/70">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Disponibilidade
                      </p>
                      <Clock3 className="size-4 text-indigo-500" />
                    </div>
                    <p className="text-xs text-slate-500 mb-3">
                      {format(selectedDate, "EEEE, dd/MM", { locale: ptBR })}
                    </p>
                    <div className="min-h-5 mb-2">
                      {isLoadingSlots && availableSlots.length > 0 ? (
                        <p className="text-xs text-slate-500 inline-flex items-center gap-2">
                          <Loader2 className="size-3.5 animate-spin" />
                          Atualizando horários...
                        </p>
                      ) : null}
                    </div>
                    <div
                      className={`space-y-4 max-h-[22rem] overflow-y-auto pr-1 transition-opacity duration-200 ${
                        isLoadingSlots ? "opacity-80" : "opacity-100"
                      }`}
                    >
                      {slotsError ? (
                        <p className="text-sm text-red-500">{slotsError}</p>
                      ) : availableSlots.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-300 dark:border-zinc-700 p-5 text-center">
                          {isLoadingSlots ? (
                            <>
                              <Loader2 className="size-6 text-slate-400 mx-auto mb-2 animate-spin" />
                              <p className="text-sm text-slate-500">
                                Carregando horários...
                              </p>
                            </>
                          ) : (
                            <>
                              <SearchX className="size-6 text-slate-400 mx-auto mb-2" />
                              <p className="text-sm text-slate-500">
                                Sem horários para esta data.
                              </p>
                            </>
                          )}
                        </div>
                      ) : (
                        <>
                          {slotSections.map((section) => (
                            <div key={section.id}>
                              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                                {section.label}
                              </p>
                              {section.slots.length === 0 ? (
                                <p className="text-xs text-slate-400 mb-2">
                                  Sem horários.
                                </p>
                              ) : (
                                <div className="space-y-2">
                                  {section.slots.map((slot) => {
                                    const selected = selectedStartTime === slot;
                                    return (
                                      <button
                                        key={slot}
                                        type="button"
                                        onClick={() =>
                                          form.setValue("startTime", slot)
                                        }
                                        className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm font-bold transition-colors ${selected ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-slate-300 hover:border-indigo-300"}`}
                                      >
                                        {slot}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                    {form.formState.errors.startTime?.message ? (
                      <span className="text-xs text-red-500 font-medium mt-2 block">
                        {form.formState.errors.startTime.message}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 flex flex-col md:flex-row md:items-center gap-4 md:justify-between">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <CalendarCheck2 className="size-5" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">
                    Slot selecionado
                  </p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {selectedSlotLabel}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {selectedProfessional?.name || "Selecione profissional"} •{" "}
                    {selectedService
                      ? `${selectedService.name}`
                      : "Selecione um serviço"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleContinueToPatient}
                  className="px-7 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-600/20"
                >
                  Continuar para dados do paciente
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-4 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/70 p-5">
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">
                Resumo do Agendamento
              </p>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white mb-4">
                Confirmação Manual
              </h3>

              <div className="space-y-3 text-sm">
                <SummaryItem
                  label="Profissional"
                  value={selectedProfessional?.name || "-"}
                />
                <SummaryItem
                  label="Serviço"
                  value={selectedService?.name || "-"}
                />
                <SummaryItem
                  label="Data"
                  value={format(selectedDate, "dd/MM/yyyy")}
                />
                <SummaryItem label="Horário" value={selectedStartTime || "-"} />
              </div>

              <div className="bg-indigo-600/5 p-4 rounded-xl border border-indigo-600/10 flex items-start gap-3 mt-5">
                <Info className="text-indigo-600 size-5 shrink-0 mt-0.5" />
                <p className="text-xs text-indigo-700 dark:text-indigo-400 leading-relaxed font-medium">
                  Este agendamento será salvo com origem <strong>MANUAL</strong>{" "}
                  e seguirá as mesmas regras de conflito da API de bot.
                </p>
              </div>
            </div>

            <div className="xl:col-span-8 space-y-5">
              <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/70 p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Buscar paciente na base
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsCreatePatientModalOpen(true)}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-zinc-700 transition-colors"
                  >
                    <UserPlus className="size-4" />
                    Cadastrar novo paciente
                  </button>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-5" />
                  <input
                    value={patientSearch}
                    onFocus={() => setIsPatientDropdownOpen(true)}
                    onBlur={() => {
                      window.setTimeout(() => {
                        setIsPatientDropdownOpen(false);
                      }, 120);
                    }}
                    onChange={(event) => {
                      setPatientSearch(event.target.value);
                      setSelectedPatient(null);
                      setIsManualPatientEdit(false);
                      setIsPatientDropdownOpen(true);
                    }}
                    className="w-full bg-white dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-indigo-600 focus:border-indigo-600 outline-none transition-all placeholder:text-slate-400 dark:text-white border"
                    placeholder="Digite nome ou WhatsApp do paciente"
                    type="text"
                  />
                  {isPatientDropdownOpen ? (
                    <div className="absolute z-20 top-full mt-2 w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden">
                      <div className="max-h-64 overflow-y-auto">
                        {isSearchingPatients ? (
                          <div className="px-4 py-4 text-sm text-slate-500 inline-flex items-center gap-2">
                            <Loader2 className="size-4 animate-spin" />
                            Buscando pacientes...
                          </div>
                        ) : patientResults.length > 0 ? (
                          patientResults.map((patient) => (
                            <button
                              key={patient.id}
                              type="button"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => applyPatientSelection(patient)}
                              className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors border-b last:border-b-0 border-slate-100 dark:border-zinc-800"
                            >
                              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                {patient.name}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {formatPhoneMask(patient.phone)}
                                {patient.email ? ` • ${patient.email}` : ""}
                              </p>
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-4 space-y-3">
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              Nenhum paciente encontrado com este termo.
                            </p>
                            <button
                              type="button"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => setIsCreatePatientModalOpen(true)}
                              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                            >
                              <UserPlus className="size-4" />
                              Cadastrar paciente
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>

                <p className="text-xs text-slate-500 mt-3">
                  Dica: ao selecionar um paciente, os campos abaixo serão
                  preenchidos automaticamente.
                </p>

                {selectedPatient ? (
                  <div className="mt-3 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2.5 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      Paciente selecionado: {selectedPatient.name}
                      {isManualPatientEdit
                        ? " (edição manual ativa)"
                        : " (dados bloqueados)"}
                    </p>
                    <div className="flex items-center gap-3">
                      {isManualPatientEdit ? (
                        <button
                          type="button"
                          onClick={() => applyPatientSelection(selectedPatient)}
                          className="text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:underline"
                        >
                          Usar dados do cadastro
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsManualPatientEdit(true)}
                          className="text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:underline"
                        >
                          Editar manualmente
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPatient(null);
                          setIsManualPatientEdit(false);
                        }}
                        className="text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:underline"
                      >
                        Limpar seleção
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              <FieldLabel
                label="Nome do Paciente"
                error={form.formState.errors.patientName?.message}
              >
                <div className="relative">
                  <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-5" />
                  <input
                    {...form.register("patientName")}
                    className="w-full bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-indigo-600 focus:border-indigo-600 outline-none transition-all placeholder:text-slate-400 dark:text-white border"
                    placeholder="ex: Maria Souza"
                    type="text"
                    disabled={isPatientFieldsLocked}
                  />
                </div>
              </FieldLabel>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FieldLabel
                  label="WhatsApp"
                  error={form.formState.errors.patientPhone?.message}
                >
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-5" />
                    <input
                      value={form.watch("patientPhone") ?? ""}
                      onChange={(event) => {
                        form.setValue(
                          "patientPhone",
                          formatPhoneMask(event.target.value),
                        );
                      }}
                      className="w-full bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-indigo-600 focus:border-indigo-600 outline-none transition-all placeholder:text-slate-400 dark:text-white border"
                      placeholder="(11) 99999-9999"
                      type="text"
                      inputMode="numeric"
                      maxLength={15}
                      disabled={isPatientFieldsLocked}
                    />
                  </div>
                </FieldLabel>

                <FieldLabel
                  label="E-mail (opcional)"
                  error={form.formState.errors.patientEmail?.message}
                >
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-5" />
                    <input
                      {...form.register("patientEmail")}
                      className="w-full bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-indigo-600 focus:border-indigo-600 outline-none transition-all placeholder:text-slate-400 dark:text-white border"
                      placeholder="email@dominio.com"
                      type="email"
                      disabled={isPatientFieldsLocked}
                    />
                  </div>
                </FieldLabel>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="px-8 py-6 bg-slate-50 dark:bg-zinc-800/50 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => {
            if (step === "patient") {
              setStep("slot");
              return;
            }
            handleClose();
          }}
          className="px-6 py-2.5 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
        >
          {step === "patient" ? (
            <span className="inline-flex items-center gap-2">
              <ArrowLeft className="size-4" />
              Voltar
            </span>
          ) : (
            "Fechar"
          )}
        </button>
        {step === "patient" ? (
          <button
            type="submit"
            disabled={isPending}
            className="bg-indigo-600 text-white px-8 py-2.5 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isPending ? "Salvando..." : "Confirmar Agendamento"}
          </button>
        ) : null}
      </div>
    </form>
  );

  if (isPageMode) {
    return (
      <>
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-8 py-6 border-b border-slate-100 dark:border-zinc-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Agendamento Assistido
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Fluxo guiado para atendimento direto no balcão, telefone ou
              WhatsApp.
            </p>
          </div>
          {formBlock}
        </div>
        <CreatePatientModal
          open={isCreatePatientModalOpen}
          onOpenChange={setIsCreatePatientModalOpen}
          healthPlans={healthPlans}
          onCreated={handlePatientCreated}
        />
      </>
    );
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(value) => onOpenChange?.(value)}>
        <DialogContent className="sm:max-w-6xl p-0 gap-0 overflow-hidden bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800">
          <DialogHeader className="px-8 py-6 border-b border-slate-100 dark:border-zinc-800 flex flex-row items-center justify-between space-y-0">
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white">
                Agendamento Assistido
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-500 mt-1">
                Fluxo guiado para atendimento direto no balcão, telefone ou
                WhatsApp.
              </DialogDescription>
            </div>
          </DialogHeader>
          {formBlock}
        </DialogContent>
      </Dialog>
      <CreatePatientModal
        open={isCreatePatientModalOpen}
        onOpenChange={setIsCreatePatientModalOpen}
        healthPlans={healthPlans}
        onCreated={handlePatientCreated}
      />
    </>
  );
}

function FieldLabel({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
        {label}
      </label>
      {children}
      {error ? (
        <span className="text-xs text-red-500 font-medium">{error}</span>
      ) : null}
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 inline-flex items-center">
        <Dot className="size-4 text-indigo-500 -ml-1" />
        {value}
      </p>
    </div>
  );
}

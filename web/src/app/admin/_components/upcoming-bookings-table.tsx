import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";

interface Booking {
  id: string;
  date: Date;
  startTime: string;
  status: BookingStatus;
  patient: { name: string };
  professional: { name: string };
  service: { name: string };
}

interface UpcomingBookingsTableProps {
  bookings: Booking[];
  showProfessionalColumn?: boolean;
}

function getStatusLabel(status: BookingStatus) {
  if (status === "PENDING") return "Pendente";
  if (status === "CONFIRMED") return "Confirmado";
  if (status === "COMPLETED") return "Realizado";
  if (status === "NO_SHOW") return "Não compareceu";
  return "Cancelado";
}

function getStatusBadge(status: BookingStatus) {
  if (status === "PENDING") {
    return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
  }
  if (status === "CONFIRMED") {
    return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  }
  if (status === "COMPLETED") {
    return "bg-sky-500/10 text-sky-600 dark:text-sky-400";
  }
  if (status === "NO_SHOW") {
    return "bg-violet-500/10 text-violet-600 dark:text-violet-400";
  }
  return "bg-rose-500/10 text-rose-600 dark:text-rose-400";
}

export function UpcomingBookingsTable({
  bookings,
  showProfessionalColumn = true,
}: UpcomingBookingsTableProps) {
  const emptyColSpan = showProfessionalColumn ? 5 : 4;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
        <h2 className="font-bold text-lg text-slate-900 dark:text-white">
          Próximos Agendamentos
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 dark:bg-zinc-800/50">
            <tr>
              <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Paciente
              </th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Horário
              </th>
              {showProfessionalColumn ? (
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Profissional
                </th>
              ) : null}
              <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Serviço
              </th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
            {bookings.length === 0 ? (
              <tr>
                <td colSpan={emptyColSpan} className="px-6 py-8 text-center text-slate-500">
                  Nenhum agendamento futuro encontrado.
                </td>
              </tr>
            ) : (
              bookings.map((booking) => (
                <tr
                  key={booking.id}
                  className="hover:bg-slate-50 dark:hover:bg-zinc-800/30 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                      {booking.patient.name}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                    {format(booking.date, "dd/MM", { locale: ptBR })} às {booking.startTime}
                  </td>
                  {showProfessionalColumn ? (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-white">
                      {booking.professional.name}
                    </td>
                  ) : null}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2.5 py-1 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 rounded text-xs">
                      {booking.service.name}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadge(
                        booking.status,
                      )}`}
                    >
                      {getStatusLabel(booking.status)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

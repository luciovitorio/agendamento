"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Loader2,
  MoreHorizontal,
  MessageCircle,
  Search,
  Send,
  UserCheck,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  claimHandoffAction,
  getHandoffMessagesAction,
  listActiveHandoffsAction,
  markHandoffMessagesReadAction,
  resumeHandoffAction,
  sendHandoffMessageAction,
} from "@/app/actions/handoff-actions";
import type { ActiveHumanHandoffItem } from "@/lib/human-handoff";
import type { HandoffChatMessage } from "@/lib/handoff-chat";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface HandoffTableProps {
  initialItems: ActiveHumanHandoffItem[];
  currentUserRole?: "ADMIN" | "ATENDENTE" | null;
  currentAgentName?: string | null;
  currentAgentEmail?: string | null;
}

type OwnershipFilter = "all" | "unassigned" | "mine";
type SortFilter = "newest" | "oldest";

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return value;

  const normalized =
    digits.length > 11 && digits.startsWith("55") ? digits.slice(2) : digits;

  const ddd = normalized.slice(0, 2);
  const rest = normalized.slice(2);
  const splitIndex = rest.length > 8 ? 5 : 4;
  if (!ddd || !rest) return value;

  return `+55 (${ddd}) ${rest.slice(0, splitIndex)}-${rest.slice(splitIndex)}`;
}

function normalizeText(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function isMine(
  item: ActiveHumanHandoffItem,
  currentAgentName?: string | null,
  currentAgentEmail?: string | null,
) {
  const assigned = normalizeText(item.assignedAgent);
  if (!assigned) return false;

  const name = normalizeText(currentAgentName);
  const email = normalizeText(currentAgentEmail);
  if (!name && !email) return false;

  return (
    assigned === name ||
    assigned === email ||
    (!!email && assigned.includes(email)) ||
    (!!name && assigned.includes(name))
  );
}

export function HandoffTable({
  initialItems,
  currentUserRole,
  currentAgentName,
  currentAgentEmail,
}: HandoffTableProps) {
  const [items, setItems] = useState(initialItems);
  const [searchTerm, setSearchTerm] = useState("");
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilter>("all");
  const [sortFilter, setSortFilter] = useState<SortFilter>("newest");
  const [pendingAction, setPendingAction] = useState<{
    phone: string;
    type: "claim" | "resume";
  } | null>(null);

  const [selectedPhone, setSelectedPhone] = useState<string | null>(
    initialItems[0]?.phone || null,
  );
  const [messages, setMessages] = useState<HandoffChatMessage[]>([]);
  const [chatBlockedReason, setChatBlockedReason] = useState<string | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);

  const currentAgentLabel =
    (currentAgentName || currentAgentEmail || "Atendente").trim();
  const isMessageInputDisabled = !!chatBlockedReason || isSendingMessage;

  const filteredItems = useMemo(() => {
    const q = normalizeText(searchTerm);
    const filtered = items.filter((item) => {
      const mine = isMine(item, currentAgentName, currentAgentEmail);

      if (ownershipFilter === "mine" && !mine) return false;
      if (ownershipFilter === "unassigned" && item.assignedAgent) return false;

      if (!q) return true;
      const haystack = [
        item.patient?.name || "",
        item.patient?.phone || "",
        item.phone,
        item.assignedAgent || "",
        item.reason || "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });

    return filtered.sort((a, b) => {
      const aTime = new Date(a.openedAt || a.updatedAt).getTime();
      const bTime = new Date(b.openedAt || b.updatedAt).getTime();
      return sortFilter === "oldest" ? aTime - bTime : bTime - aTime;
    });
  }, [items, searchTerm, ownershipFilter, sortFilter, currentAgentEmail, currentAgentName]);

  const selectedItem = useMemo(
    () => items.find((item) => item.phone === selectedPhone) || null,
    [items, selectedPhone],
  );

  const selectedItemIsMine = useMemo(
    () =>
      selectedItem
        ? isMine(selectedItem, currentAgentName, currentAgentEmail)
        : false,
    [selectedItem, currentAgentEmail, currentAgentName],
  );

  const canAccessSelectedConversation =
    !!selectedItem &&
    (currentUserRole !== "ATENDENTE" ||
      selectedItemIsMine);

  function isUserNearConversationBottom() {
    const container = messagesContainerRef.current;
    if (!container) return true;

    const distanceToBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;

    return distanceToBottom <= 120;
  }

  async function loadMessages(phone: string, silent = false) {
    const wasNearBottom = isUserNearConversationBottom();
    setChatBlockedReason(null);
    if (!silent) setIsLoadingMessages(true);
    const result = await getHandoffMessagesAction({ phone, limit: 300 });

    if (!result.success) {
      setMessages([]);
      setChatBlockedReason(result.error);
      const ownershipBlocked =
        result.error.toLowerCase().includes("assuma o chat") ||
        result.error.toLowerCase().includes("este atendimento está com") ||
        result.error.toLowerCase().includes("este atendimento esta com");
      if (!silent) {
        if (!ownershipBlocked) {
          toast({
            title: "Erro ao carregar conversa",
            description: result.error,
            variant: "destructive",
          });
        }
      }
      setIsLoadingMessages(false);
      return;
    }

    setChatBlockedReason(null);
    shouldAutoScrollRef.current = !silent || wasNearBottom;
    setMessages(result.items);
    setIsLoadingMessages(false);

    const hasUnreadInbound = result.items.some(
      (message) => message.direction === "INBOUND" && !message.readAt,
    );

    if (hasUnreadInbound) {
      void markMessagesAsRead(phone, true);
    }
  }

  async function markMessagesAsRead(phone: string, silent = true) {
    const result = await markHandoffMessagesReadAction({ phone });
    if (!result.success) {
      if (!silent) {
        toast({
          title: "Erro ao marcar como lida",
          description: result.error,
          variant: "destructive",
        });
      }
      return;
    }

    if (result.updatedCount > 0) {
      setItems((prev) =>
        prev.map((item) =>
          item.phone === phone ? { ...item, unreadCount: 0 } : item,
        ),
      );
      const readAtIso = new Date().toISOString();
      setMessages((prev) =>
        prev.map((message) =>
          message.direction === "INBOUND"
            ? { ...message, readAt: message.readAt || readAtIso }
            : message,
        ),
      );
    }
  }

  async function refreshQueue(silent = true) {
    const result = await listActiveHandoffsAction(300);
    if (!result.success) {
      if (!silent) {
        toast({
          title: "Erro ao atualizar fila",
          description: result.error,
          variant: "destructive",
        });
      }
      return;
    }

    setItems(result.items);
    setSelectedPhone((current) => {
      if (!current) return result.items[0]?.phone || null;
      const stillExists = result.items.some((item) => item.phone === current);
      return stillExists ? current : result.items[0]?.phone || null;
    });
  }

  useEffect(() => {
    if (!selectedPhone) {
      setChatBlockedReason(null);
      setMessages([]);
      return;
    }

    if (!canAccessSelectedConversation) {
      const owner = selectedItem?.assignedAgent?.trim();
      if (owner) {
        setChatBlockedReason(
          `Este atendimento está com ${owner}. Assuma o chat para visualizar a conversa.`,
        );
      } else {
        setChatBlockedReason(
          "Este atendimento ainda não foi assumido. Assuma o chat para visualizar a conversa.",
        );
      }
      setMessages([]);
      setIsLoadingMessages(false);
      return;
    }

    shouldAutoScrollRef.current = true;
    void loadMessages(selectedPhone);
  }, [selectedPhone, canAccessSelectedConversation, selectedItem?.assignedAgent]);

  useEffect(() => {
    const timer = setInterval(() => {
      void refreshQueue(true);
    }, 7000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selectedPhone) return;
    if (!canAccessSelectedConversation) return;
    const timer = setInterval(() => {
      void loadMessages(selectedPhone, true);
    }, 5000);
    return () => clearInterval(timer);
  }, [selectedPhone, canAccessSelectedConversation]);

  useEffect(() => {
    if (!messagesEndRef.current) return;
    if (!shouldAutoScrollRef.current) return;
    shouldAutoScrollRef.current = false;
    messagesEndRef.current.scrollIntoView({ behavior: "auto" });
  }, [messages]);

  async function handleResume(phone: string) {
    setPendingAction({ phone, type: "resume" });
    const result = await resumeHandoffAction({ phone });

    if (!result.success) {
      toast({
        title: "Erro ao retomar bot",
        description: result.error,
        variant: "destructive",
      });
      setPendingAction(null);
      return;
    }

    setItems((prev) => prev.filter((item) => item.phone !== phone));
    if (selectedPhone === phone) {
      setSelectedPhone(null);
      setMessages([]);
    }
    toast({
      title: "Bot retomado",
      description: "Contato removido da fila de atendimento humano.",
    });
    setPendingAction(null);
  }

  async function handleClaim(phone: string) {
    setPendingAction({ phone, type: "claim" });
    const result = await claimHandoffAction({ phone });

    if (!result.success) {
      toast({
        title: "Erro ao assumir atendimento",
        description: result.error,
        variant: "destructive",
      });
      setPendingAction(null);
      return;
    }

    setItems((prev) =>
      prev.map((item) =>
        item.phone === phone
          ? {
              ...item,
              assignedAgent: result.handoff.assignedAgent,
              reason: result.handoff.reason,
              updatedAt: result.handoff.updatedAt,
            }
          : item,
      ),
    );
    toast({
      title: "Atendimento assumido",
      description: `Responsável definido para ${result.assignedAgent}.`,
    });
    setPendingAction(null);
  }

  async function handleSendMessage() {
    if (!selectedPhone) return;
    const content = messageInput.trim();
    if (!content) return;

    setIsSendingMessage(true);
    const result = await sendHandoffMessageAction({
      phone: selectedPhone,
      content,
    });

    if (!result.success) {
      toast({
        title: "Erro ao enviar mensagem",
        description: result.error,
        variant: "destructive",
      });
      setIsSendingMessage(false);
      return;
    }

    setMessageInput("");
    shouldAutoScrollRef.current = true;
    setMessages((prev) => [...prev, result.message]);
    setChatBlockedReason(null);
    setItems((prev) =>
      prev.map((item) =>
        item.phone === selectedPhone
          ? {
              ...item,
              assignedAgent: currentAgentLabel,
              unreadCount: 0,
              updatedAt: result.message.createdAt,
            }
          : item,
      ),
    );
    setIsSendingMessage(false);
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
          Handoff Humano
        </h1>
        <span className="inline-flex items-center rounded-full bg-indigo-600/10 text-indigo-700 dark:text-indigo-300 px-3 py-1 text-sm font-bold">
          {items.length} em atendimento
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden xl:h-[72vh] xl:max-h-[820px] xl:min-h-[620px] flex flex-col">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-zinc-800 space-y-4">
            <p className="text-sm text-slate-500">
              Use a fila para priorizar os atendimentos. Você pode assumir o
              contato, responder no chat interno e finalizar com "Retomar bot".
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="relative">
                <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar paciente, telefone, motivo..."
                  className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm pl-9 pr-3 py-2.5 outline-none focus:border-indigo-500"
                />
              </label>

              <Select
                value={ownershipFilter}
                onValueChange={(value) => setOwnershipFilter(value as OwnershipFilter)}
              >
                <SelectTrigger className="w-full h-10 rounded-xl border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm shadow-none cursor-pointer">
                  <SelectValue placeholder="Todos os atendimentos" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  className="w-[--radix-select-trigger-width] rounded-xl border-slate-200 dark:border-zinc-700"
                >
                  <SelectItem value="all">Todos os atendimentos</SelectItem>
                  <SelectItem value="unassigned">Somente não assumidos</SelectItem>
                  <SelectItem value="mine">Somente meus atendimentos</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={sortFilter}
                onValueChange={(value) => setSortFilter(value as SortFilter)}
              >
                <SelectTrigger className="w-full h-10 rounded-xl border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm shadow-none cursor-pointer">
                  <SelectValue placeholder="Mais recentes primeiro" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  className="w-[--radix-select-trigger-width] rounded-xl border-slate-200 dark:border-zinc-700"
                >
                  <SelectItem value="newest">Mais recentes primeiro</SelectItem>
                  <SelectItem value="oldest">Mais antigos primeiro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-auto flex-1">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 dark:bg-zinc-800">
                <tr>
                  <th className="text-left px-4 py-3 font-bold">Paciente</th>
                  <th className="text-left px-4 py-3 font-bold">Telefone</th>
                  <th className="text-left px-4 py-3 font-bold">Responsável</th>
                  <th className="text-left px-4 py-3 font-bold">Solicitado em</th>
                  <th className="text-left px-4 py-3 font-bold">Não lidas</th>
                  <th className="text-right px-4 py-3 font-bold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      Nenhum paciente correspondente ao filtro.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const requestedAt = item.openedAt || item.updatedAt;
                    const mine = isMine(item, currentAgentName, currentAgentEmail);
                    const claiming =
                      pendingAction?.phone === item.phone &&
                      pendingAction.type === "claim";
                    const resuming =
                      pendingAction?.phone === item.phone &&
                      pendingAction.type === "resume";
                    const canResume = !!item.assignedAgent && mine;

                    return (
                      <tr
                        key={item.phone}
                        onClick={() => setSelectedPhone(item.phone)}
                        className={`border-t border-slate-200 dark:border-zinc-800 ${
                          selectedPhone === item.phone
                            ? "bg-indigo-50/60 dark:bg-indigo-500/10"
                            : "hover:bg-slate-50/70 dark:hover:bg-zinc-800/40"
                        } cursor-pointer`}
                      >
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            {item.patient?.name || "Paciente não identificado"}
                          </p>
                          {item.reason ? (
                            <p className="text-xs text-slate-500 line-clamp-1">
                              {item.reason}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                          {formatPhone(item.phone)}
                        </td>
                        <td className="px-4 py-3">
                          {item.assignedAgent ? (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                                mine
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                                  : "bg-slate-200 text-slate-700 dark:bg-zinc-700 dark:text-zinc-200"
                              }`}
                            >
                              <UserCheck className="size-3.5" />
                              {mine ? "Você" : item.assignedAgent}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500">
                              Não assumido
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                          {requestedAt
                            ? new Date(requestedAt).toLocaleString("pt-BR")
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {item.unreadCount > 0 ? (
                            <span className="inline-flex min-w-7 justify-center rounded-full bg-rose-600 px-2 py-1 text-xs font-bold text-white">
                              {item.unreadCount > 99 ? "99+" : item.unreadCount}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  onClick={(event) => event.stopPropagation()}
                                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-zinc-700 p-2 text-slate-600 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800"
                                  aria-label="Abrir ações"
                                >
                                  <MoreHorizontal className="size-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                onClick={(event) => event.stopPropagation()}
                                className="w-44"
                              >
                                <DropdownMenuItem
                                  onSelect={() => setSelectedPhone(item.phone)}
                                >
                                  <MessageCircle className="size-4" />
                                  Abrir chat
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={claiming}
                                  onSelect={() => {
                                    void handleClaim(item.phone);
                                  }}
                                >
                                  {claiming ? (
                                    <Loader2 className="size-4 animate-spin" />
                                  ) : (
                                    <UserCheck className="size-4" />
                                  )}
                                  {mine ? "Reassumir" : "Assumir"}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={resuming || !canResume}
                                  onSelect={() => {
                                    if (!canResume) return;
                                    void handleResume(item.phone);
                                  }}
                                >
                                  {resuming ? (
                                    <Loader2 className="size-4 animate-spin" />
                                  ) : (
                                    <Bot className="size-4" />
                                  )}
                                  Retomar bot
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="xl:col-span-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden flex flex-col xl:h-[72vh] xl:max-h-[820px] xl:min-h-[620px]">
          {selectedItem ? (
            <>
              <div className="px-4 py-3 border-b border-slate-200 dark:border-zinc-800">
                <h2 className="font-bold text-slate-900 dark:text-white">
                  {selectedItem.patient?.name || "Paciente não identificado"}
                </h2>
                <p className="text-xs text-slate-500">
                  {formatPhone(selectedItem.phone)}
                </p>
              </div>

              <div
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-slate-50/70 dark:bg-zinc-900/30"
              >
                {chatBlockedReason ? (
                  <div className="flex h-full items-center justify-center text-center px-6">
                    <div className="max-w-sm space-y-3">
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        {chatBlockedReason}
                      </p>
                      <button
                        type="button"
                        onClick={() => void handleClaim(selectedItem.phone)}
                        disabled={
                          pendingAction?.phone === selectedItem.phone &&
                          pendingAction.type === "claim"
                        }
                        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {pendingAction?.phone === selectedItem.phone &&
                        pendingAction.type === "claim" ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <UserCheck className="size-4" />
                        )}
                        Assumir chat
                      </button>
                    </div>
                  </div>
                ) : isLoadingMessages ? (
                  <div className="flex items-center justify-center py-10 text-slate-500">
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Carregando conversa...
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-10">
                    Ainda não há mensagens para este contato.
                  </p>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.direction === "OUTBOUND"
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                          message.direction === "OUTBOUND"
                            ? "bg-emerald-600 text-white"
                            : "bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 border border-slate-200 dark:border-zinc-700"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {message.content}
                        </p>
                        <p
                          className={`text-[11px] mt-1 ${
                            message.direction === "OUTBOUND"
                              ? "text-emerald-100"
                              : "text-slate-500"
                          }`}
                        >
                          {message.direction === "OUTBOUND"
                            ? message.senderName || "Atendente"
                            : "Paciente"}{" "}
                          • {new Date(message.createdAt).toLocaleTimeString("pt-BR")}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-3 border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-2">
                <textarea
                  value={messageInput}
                  onChange={(event) => setMessageInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" || event.shiftKey) return;
                    event.preventDefault();
                    if (isMessageInputDisabled || !messageInput.trim()) return;
                    void handleSendMessage();
                  }}
                  placeholder={
                    isSendingMessage
                      ? "Enviando mensagem..."
                      : "Digite sua mensagem para o paciente..."
                  }
                  rows={3}
                  disabled={isMessageInputDisabled}
                  className={`w-full rounded-xl border text-sm px-3 py-2 outline-none resize-none transition-colors ${
                    isMessageInputDisabled
                      ? "border-slate-300 dark:border-zinc-600 bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 cursor-not-allowed"
                      : "border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:border-indigo-500"
                  }`}
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={isSendingMessage || !messageInput.trim() || !!chatBlockedReason}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSendingMessage ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    Enviar
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center px-6">
              <div>
                <MessageCircle className="size-8 text-slate-400 mx-auto mb-3" />
                <p className="text-sm text-slate-500">
                  Selecione um contato na tabela para abrir o chat interno.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Bot,
  Eye,
  EyeOff,
  Loader2,
  MessageSquare,
  QrCode,
  RefreshCw,
  Save,
  Smartphone,
  Trash2,
  Unplug,
  Wifi,
  WifiOff,
  Workflow,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "@/hooks/use-toast";
import {
  applyEvolutionWebhookAction,
  findEvolutionWebhookAction,
  getEvolutionConnectionStateAction,
  disconnectEvolutionInstanceAction,
  deleteEvolutionInstanceAction,
  saveClinicBotSettingsAction,
  syncEvolutionInstanceAction,
} from "@/app/actions/bot-settings-actions";
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
import type { BotSettingsData } from "./types";

interface BotSettingsPanelProps {
  settings: BotSettingsData;
  canManageBotSettings: boolean;
}

interface WebhookStatusState {
  enabled: boolean;
  url: string | null;
  events: string[];
  webhookByEvents: boolean;
  webhookBase64: boolean;
}

function extractBrazilNationalDigits(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.length > 11 && digits.startsWith("55")) {
    digits = digits.slice(2);
  }
  return digits.slice(0, 11);
}

function formatBrazilNationalMask(digits: string) {
  if (!digits) return "";

  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (ddd.length < 2) return `(${ddd}`;
  if (!rest) return `(${ddd})`;

  const splitIndex = rest.length > 8 ? 5 : 4;
  if (rest.length <= splitIndex) {
    return `(${ddd}) ${rest}`;
  }

  return `(${ddd}) ${rest.slice(0, splitIndex)}-${rest.slice(splitIndex)}`;
}

function formatBrazilWhatsAppValue(digits: string) {
  if (!digits) return "";
  return `+55 ${formatBrazilNationalMask(digits)}`;
}

export function BotSettingsPanel({
  settings,
  canManageBotSettings,
}: BotSettingsPanelProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isApplyingWebhook, setIsApplyingWebhook] = useState(false);
  const [isCheckingWebhook, setIsCheckingWebhook] = useState(false);
  const [isLoadingConnectionState, setIsLoadingConnectionState] =
    useState(false);
  const [formState, setFormState] = useState<BotSettingsData>(settings);
  const [webhookStatus, setWebhookStatus] = useState<WebhookStatusState | null>(
    null,
  );
  const [connectionState, setConnectionState] = useState<
    "unknown" | "open" | "close" | "connecting"
  >("unknown");
  const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null);
  const [disconnectModalOpen, setDisconnectModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [showMetaAccessToken, setShowMetaAccessToken] = useState(false);
  const [showMetaWebhookVerifyToken, setShowMetaWebhookVerifyToken] =
    useState(false);
  const [showMetaAppSecret, setShowMetaAppSecret] = useState(false);
  const [showEvolutionApiToken, setShowEvolutionApiToken] = useState(false);
  const [showEvolutionWebhookToken, setShowEvolutionWebhookToken] =
    useState(false);
  const router = useRouter();

  useEffect(() => {
    setFormState(settings);
  }, [settings]);

  useEffect(() => {
    if (!canManageBotSettings) return;
    if (settings.whatsappProvider !== "EVOLUTION") {
      setConnectionState("unknown");
      return;
    }

    const evolutionApiUrl = settings.evolutionApiUrl.trim();
    const evolutionInstanceName = settings.evolutionInstanceName.trim();
    const evolutionApiToken = settings.evolutionApiToken.trim();

    if (!evolutionApiUrl || !evolutionInstanceName || !evolutionApiToken) {
      setConnectionState("unknown");
      return;
    }

    let isActive = true;
    setIsLoadingConnectionState(true);
    (async () => {
      const result = await getEvolutionConnectionStateAction({
        evolutionApiUrl,
        evolutionInstanceName,
        evolutionApiToken,
      });

      if (!isActive) return;

      if (result.success) {
        setConnectionState(result.connectionState);
        return;
      }

      setConnectionState("unknown");
    })().finally(() => {
      if (isActive) {
        setIsLoadingConnectionState(false);
      }
    });

    return () => {
      isActive = false;
    };
  }, [
    canManageBotSettings,
    settings.whatsappProvider,
    settings.evolutionApiUrl,
    settings.evolutionInstanceName,
    settings.evolutionApiToken,
  ]);

  function updateField<K extends keyof BotSettingsData>(
    key: K,
    value: BotSettingsData[K],
  ) {
    setFormState((prev) => ({ ...prev, [key]: value }));
  }

  function updateReminderRule(
    index: number,
    patch: Partial<BotSettingsData["bookingReminderRules"][number]>,
  ) {
    setFormState((prev) => {
      const nextRules = [...prev.bookingReminderRules];
      const current = nextRules[index];
      if (!current) return prev;
      nextRules[index] = { ...current, ...patch };
      return { ...prev, bookingReminderRules: nextRules };
    });
  }

  function addReminderRule() {
    setFormState((prev) => {
      const nextIndex = prev.bookingReminderRules.length + 1;
      return {
        ...prev,
        bookingReminderRules: [
          ...prev.bookingReminderRules,
          {
            id: `reminder-${Date.now()}-${nextIndex}`,
            offsetHours: 24,
            messageTemplate:
              "Ola, [nome]!\n\nSua consulta esta marcada para [data] as [hora].\n\nMedico(a): [profissional]\nEspecialidade: [servico]",
            requireConfirmation: false,
          },
        ],
      };
    });
  }

  function removeReminderRule(index: number) {
    setFormState((prev) => ({
      ...prev,
      bookingReminderRules: prev.bookingReminderRules.filter(
        (_rule, ruleIndex) => ruleIndex !== index,
      ),
    }));
  }

  function handleSyncWhatsApp() {
    setIsSyncing(true);
    (async () => {
      const result = await syncEvolutionInstanceAction({
        evolutionApiUrl: formState.evolutionApiUrl,
        evolutionInstanceName: formState.evolutionInstanceName,
        evolutionApiToken: formState.evolutionApiToken,
      });

      if (!result.success) {
        toast({
          title: "Erro ao sincronizar WhatsApp",
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      setConnectionState(result.connectionState);
      setQrCodeBase64(result.qrCodeBase64);

      if (result.connectionState === "open") {
        toast({
          title: "WhatsApp conectado",
          description: "A instancia ja esta conectada na Evolution API.",
        });
        return;
      }

      if (result.connectionState === "connecting" && !result.qrCodeBase64) {
        toast({
          title: "Conexao em andamento",
          description:
            "O WhatsApp esta conectando. Aguarde alguns segundos e clique em sincronizar novamente.",
        });
        return;
      }

      if (result.qrCodeBase64) {
        toast({
          title: "QR Code atualizado",
          description: "Escaneie o QR Code abaixo no WhatsApp da clinica.",
        });
      }
    })().finally(() => setIsSyncing(false));
  }

  function handleDeleteEvolutionInstance() {
    const instanceName = formState.evolutionInstanceName.trim();
    if (!instanceName) {
      toast({
        title: "Instancia nao informada",
        description: "Preencha o nome da instancia antes de excluir.",
        variant: "destructive",
      });
      return;
    }

    setIsDeleting(true);
    (async () => {
      const result = await deleteEvolutionInstanceAction({
        evolutionApiUrl: formState.evolutionApiUrl,
        evolutionInstanceName: instanceName,
        evolutionApiToken: formState.evolutionApiToken,
      });

      if (!result.success) {
        toast({
          title: "Erro ao excluir instancia",
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      setDeleteModalOpen(false);
      setConnectionState("unknown");
      setQrCodeBase64(null);
      toast({
        title: "Instancia removida",
        description: result.alreadyMissing
          ? "A instancia ja nao existia na Evolution."
          : "A instancia foi excluida com sucesso.",
      });
    })().finally(() => setIsDeleting(false));
  }

  function handleDisconnectEvolutionInstance() {
    const instanceName = formState.evolutionInstanceName.trim();
    if (!instanceName) {
      toast({
        title: "Instancia nao informada",
        description: "Preencha o nome da instancia antes de desconectar.",
        variant: "destructive",
      });
      return;
    }

    setIsDisconnecting(true);
    (async () => {
      const result = await disconnectEvolutionInstanceAction({
        evolutionApiUrl: formState.evolutionApiUrl,
        evolutionInstanceName: instanceName,
        evolutionApiToken: formState.evolutionApiToken,
      });

      if (!result.success) {
        toast({
          title: "Erro ao desconectar instancia",
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      setDisconnectModalOpen(false);
      setConnectionState("close");
      setQrCodeBase64(null);
      toast({
        title: "Instancia desconectada",
        description: result.alreadyMissing
          ? "A instancia informada nao existe mais na Evolution."
          : "WhatsApp desconectado com sucesso da instancia.",
      });
    })().finally(() => setIsDisconnecting(false));
  }

  function handleSave() {
    setIsSaving(true);
    (async () => {
      const result = await saveClinicBotSettingsAction({
        whatsappProvider: formState.whatsappProvider,
        isBotEnabled: formState.isBotEnabled,
        useInteractiveMessages: formState.useInteractiveMessages,
        interactiveMenuTitle: formState.interactiveMenuTitle,
        interactiveMenuButtonText: formState.interactiveMenuButtonText,
        interactiveMenuSectionTitle: formState.interactiveMenuSectionTitle,
        interactiveBackLabel: formState.interactiveBackLabel,
        interactiveBackDescription: formState.interactiveBackDescription,
        greetingKeywords: formState.greetingKeywords,
        availabilityDaysAhead: formState.availabilityDaysAhead,
        availabilityMaxDates: formState.availabilityMaxDates,
        availabilityPreviewTimes: formState.availabilityPreviewTimes,
        upcomingBookingsLimit: formState.upcomingBookingsLimit,
        messageTypingDelayMs: formState.messageTypingDelayMs,
        messageTypingPresence: formState.messageTypingPresence,
        whatsappPhone: formState.whatsappPhone,
        evolutionApiUrl: formState.evolutionApiUrl,
        evolutionInstanceName: formState.evolutionInstanceName,
        evolutionApiToken: formState.evolutionApiToken,
        evolutionWebhookToken: formState.evolutionWebhookToken,
        metaPhoneNumberId: formState.metaPhoneNumberId,
        metaAccessToken: formState.metaAccessToken,
        metaWebhookVerifyToken: formState.metaWebhookVerifyToken,
        metaAppSecret: formState.metaAppSecret,
        metaApiVersion: formState.metaApiVersion,
        webhookTargetMode: formState.webhookTargetMode,
        systemWebhookBaseUrl: formState.systemWebhookBaseUrl,
        n8nBaseUrl: formState.n8nBaseUrl,
        n8nWebhookMode: formState.n8nWebhookMode,
        n8nWebhookPath: formState.n8nWebhookPath,
        welcomeMessage: formState.welcomeMessage,
        firstContactMessage: formState.firstContactMessage,
        fallbackMessage: formState.fallbackMessage,
        businessHoursMessage: formState.businessHoursMessage,
        confirmMessage: formState.confirmMessage,
        cancelMessage: formState.cancelMessage,
        rescheduleMessage: formState.rescheduleMessage,
        humanHandoffMessage: formState.humanHandoffMessage,
        bookingReminderRules: formState.bookingReminderRules,
        allowAutoCancel: formState.allowAutoCancel,
        allowAutoReschedule: formState.allowAutoReschedule,
      });

      if (!result.success) {
        toast({
          title: "Erro ao salvar",
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Configuracoes salvas",
        description: "As configuracoes do bot foram atualizadas.",
      });
      router.refresh();
    })().finally(() => setIsSaving(false));
  }

  function handleApplyWebhook() {
    setIsApplyingWebhook(true);
    (async () => {
      const result = await applyEvolutionWebhookAction({
        evolutionApiUrl: formState.evolutionApiUrl,
        evolutionInstanceName: formState.evolutionInstanceName,
        evolutionApiToken: formState.evolutionApiToken,
        evolutionWebhookToken: formState.evolutionWebhookToken,
        webhookTargetMode: formState.webhookTargetMode,
        systemWebhookBaseUrl: formState.systemWebhookBaseUrl,
        n8nBaseUrl: formState.n8nBaseUrl,
        webhookMode: formState.n8nWebhookMode,
        webhookPath: formState.n8nWebhookPath,
      });

      if (!result.success) {
        toast({
          title: "Erro ao aplicar webhook",
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      setWebhookStatus(result.webhook);
      toast({
        title: "Webhook aplicado",
        description: (() => {
          if (formState.webhookTargetMode === "n8n") {
            return formState.n8nWebhookMode === "test"
              ? "Webhook de teste aplicado. No n8n, clique em 'Listen for test event'."
              : "Webhook de producao aplicado com sucesso.";
          }
          return "Webhook do sistema aplicado com sucesso.";
        })(),
      });
    })().finally(() => setIsApplyingWebhook(false));
  }

  function handleCheckWebhook() {
    setIsCheckingWebhook(true);
    (async () => {
      const result = await findEvolutionWebhookAction({
        evolutionApiUrl: formState.evolutionApiUrl,
        evolutionInstanceName: formState.evolutionInstanceName,
        evolutionApiToken: formState.evolutionApiToken,
      });

      if (!result.success) {
        toast({
          title: "Erro ao verificar webhook",
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      setWebhookStatus(result.webhook);
      toast({
        title: "Webhook verificado",
        description: result.webhook.url
          ? "A configuracao atual da Evolution foi atualizada na tela."
          : "Nenhum webhook configurado para essa instancia.",
      });
    })().finally(() => setIsCheckingWebhook(false));
  }

  const formDisabled = !canManageBotSettings || isSaving;
  const isEvolutionProvider = formState.whatsappProvider === "EVOLUTION";
  const isMetaProvider = formState.whatsappProvider === "META_CLOUD";
  const isEvolutionConnected = connectionState === "open";
  const evolutionConfigDisabled =
    formDisabled ||
    !isEvolutionProvider ||
    isEvolutionConnected ||
    isLoadingConnectionState ||
    isSyncing ||
    isDisconnecting ||
    isDeleting;
  const webhookConfigDisabled =
    formDisabled ||
    !isEvolutionProvider ||
    isSyncing ||
    isDisconnecting ||
    isDeleting ||
    isApplyingWebhook ||
    isCheckingWebhook;
  const hasEvolutionConnectionInput =
    isEvolutionProvider &&
    !!formState.evolutionApiUrl.trim() &&
    !!formState.evolutionInstanceName.trim() &&
    !!formState.evolutionApiToken.trim();
  const hasEvolutionSecureWebhookInput =
    hasEvolutionConnectionInput && !!formState.evolutionWebhookToken.trim();

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
      <div className="px-6 py-5 border-b border-slate-200 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white inline-flex items-center gap-2">
              <Bot className="size-5 text-indigo-600 dark:text-indigo-400" />
              WhatsApp e Bot
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Configure numero da clinica, provider WhatsApp (Evolution ou Meta)
              e textos padrao do atendimento automatico.
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={!canManageBotSettings || isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {isSaving ? "Salvando..." : "Salvar configuracoes"}
          </button>
        </div>
      </div>

      <div className="px-6 py-5 space-y-8">
        <section className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500 inline-flex items-center gap-2">
            <Smartphone className="size-4" />
            Integracao WhatsApp
          </h3>
          <div className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900/40 px-3 py-2.5 space-y-1">
            <p className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
              Provider ativo:{" "}
              <span className="inline-flex items-center rounded-md bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5">
                {isEvolutionProvider ? "Evolution API" : "Meta Cloud API"}
              </span>
            </p>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              {isEvolutionProvider
                ? "Exibindo configuracoes de conexao da instancia Evolution, webhook e sincronizacao por QR Code."
                : "Exibindo credenciais oficiais da Meta Cloud API e configuracao do webhook /api/meta/webhook."}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-600 dark:text-zinc-300">
                Provider WhatsApp
              </span>
              <Select
                value={formState.whatsappProvider}
                onValueChange={(value) => {
                  const nextProvider =
                    value === "META_CLOUD" ? "META_CLOUD" : "EVOLUTION";
                  updateField("whatsappProvider", nextProvider);
                  if (nextProvider === "EVOLUTION") {
                    updateField("useInteractiveMessages", false);
                  }
                }}
                disabled={formDisabled}
              >
                <SelectTrigger className="w-full rounded-xl border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 h-10 px-3 text-sm shadow-none disabled:bg-slate-200 dark:disabled:bg-zinc-800 disabled:text-slate-600 dark:disabled:text-zinc-400">
                  <SelectValue placeholder="Selecione o provider" />
                </SelectTrigger>
                <SelectContent className="rounded-lg border-slate-300 dark:border-zinc-600">
                  <SelectItem value="EVOLUTION">Evolution API</SelectItem>
                  <SelectItem value="META_CLOUD">Meta Cloud API</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <LabeledInput
              label="Numero WhatsApp da clinica"
              value={formState.whatsappPhone}
              disabled={formDisabled}
              type="tel"
              renderInput={({ value, onChange, disabled }) => (
                <div
                  className={`flex items-center rounded-xl border text-sm outline-none overflow-hidden ${
                    disabled
                      ? "border-slate-300 dark:border-zinc-700 bg-slate-200 dark:bg-zinc-800"
                      : "border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus-within:border-indigo-500"
                  }`}
                >
                  <span
                    className={`px-3 py-2.5 font-bold border-r ${
                      disabled
                        ? "text-slate-700 dark:text-zinc-300 bg-slate-300 dark:bg-zinc-700 border-slate-400 dark:border-zinc-600"
                        : "text-slate-600 dark:text-zinc-300 bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700"
                    }`}
                  >
                    +55
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={formatBrazilNationalMask(
                      extractBrazilNationalDigits(value),
                    )}
                    onChange={(event) => {
                      const digits = extractBrazilNationalDigits(
                        event.target.value,
                      );
                      onChange(formatBrazilWhatsAppValue(digits));
                    }}
                    placeholder="(11) 99999-9999"
                    disabled={disabled}
                    className="w-full bg-transparent px-3 py-2.5 text-sm outline-none dark:text-white disabled:text-slate-600 dark:disabled:text-zinc-400 disabled:cursor-not-allowed"
                  />
                </div>
              )}
              onChange={(value) => updateField("whatsappPhone", value)}
            />
            {isMetaProvider ? (
              <>
                <LabeledInput
                  label="Phone Number ID (Meta)"
                  placeholder="123456789012345"
                  value={formState.metaPhoneNumberId}
                  disabled={formDisabled}
                  onChange={(value) => updateField("metaPhoneNumberId", value)}
                />
                <LabeledInput
                  label="Access Token (Meta)"
                  placeholder="EAAG..."
                  value={formState.metaAccessToken}
                  disabled={formDisabled}
                  renderInput={({ value, onChange, disabled }) => (
                    <div className="relative">
                      <input
                        type={showMetaAccessToken ? "text" : "password"}
                        value={value}
                        onChange={(event) => onChange(event.target.value)}
                        placeholder="EAAG..."
                        disabled={disabled}
                        className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm px-3 py-2.5 pr-10 outline-none focus:border-indigo-500 dark:text-white disabled:bg-slate-200 dark:disabled:bg-zinc-800 disabled:border-slate-300 dark:disabled:border-zinc-700 disabled:text-slate-600 dark:disabled:text-zinc-400 disabled:cursor-not-allowed"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowMetaAccessToken((prevValue) => !prevValue)
                        }
                        disabled={!canManageBotSettings}
                        className="absolute inset-y-0 right-0 inline-flex items-center justify-center px-3 text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label={
                          showMetaAccessToken
                            ? "Ocultar access token da Meta"
                            : "Exibir access token da Meta"
                        }
                        title={
                          showMetaAccessToken
                            ? "Ocultar access token"
                            : "Exibir access token"
                        }
                      >
                        {showMetaAccessToken ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    </div>
                  )}
                  onChange={(value) => updateField("metaAccessToken", value)}
                />
                <LabeledInput
                  label="Verify Token (Meta Webhook)"
                  placeholder="token-para-validar-webhook-meta"
                  value={formState.metaWebhookVerifyToken}
                  disabled={formDisabled}
                  renderInput={({ value, onChange, disabled }) => (
                    <div className="relative">
                      <input
                        type={
                          showMetaWebhookVerifyToken ? "text" : "password"
                        }
                        value={value}
                        onChange={(event) => onChange(event.target.value)}
                        placeholder="token-para-validar-webhook-meta"
                        disabled={disabled}
                        className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm px-3 py-2.5 pr-10 outline-none focus:border-indigo-500 dark:text-white disabled:bg-slate-200 dark:disabled:bg-zinc-800 disabled:border-slate-300 dark:disabled:border-zinc-700 disabled:text-slate-600 dark:disabled:text-zinc-400 disabled:cursor-not-allowed"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowMetaWebhookVerifyToken(
                            (prevValue) => !prevValue,
                          )
                        }
                        disabled={!canManageBotSettings}
                        className="absolute inset-y-0 right-0 inline-flex items-center justify-center px-3 text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label={
                          showMetaWebhookVerifyToken
                            ? "Ocultar verify token da Meta"
                            : "Exibir verify token da Meta"
                        }
                        title={
                          showMetaWebhookVerifyToken
                            ? "Ocultar verify token"
                            : "Exibir verify token"
                        }
                      >
                        {showMetaWebhookVerifyToken ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    </div>
                  )}
                  onChange={(value) =>
                    updateField("metaWebhookVerifyToken", value)
                  }
                />
                <LabeledInput
                  label="App Secret (Meta, opcional)"
                  placeholder="app-secret"
                  value={formState.metaAppSecret}
                  disabled={formDisabled}
                  renderInput={({ value, onChange, disabled }) => (
                    <div className="relative">
                      <input
                        type={showMetaAppSecret ? "text" : "password"}
                        value={value}
                        onChange={(event) => onChange(event.target.value)}
                        placeholder="app-secret"
                        disabled={disabled}
                        className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm px-3 py-2.5 pr-10 outline-none focus:border-indigo-500 dark:text-white disabled:bg-slate-200 dark:disabled:bg-zinc-800 disabled:border-slate-300 dark:disabled:border-zinc-700 disabled:text-slate-600 dark:disabled:text-zinc-400 disabled:cursor-not-allowed"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowMetaAppSecret((prevValue) => !prevValue)
                        }
                        disabled={!canManageBotSettings}
                        className="absolute inset-y-0 right-0 inline-flex items-center justify-center px-3 text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label={
                          showMetaAppSecret
                            ? "Ocultar app secret da Meta"
                            : "Exibir app secret da Meta"
                        }
                        title={
                          showMetaAppSecret
                            ? "Ocultar app secret"
                            : "Exibir app secret"
                        }
                      >
                        {showMetaAppSecret ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    </div>
                  )}
                  onChange={(value) => updateField("metaAppSecret", value)}
                />
                <LabeledInput
                  label="Versao da API Meta"
                  placeholder="v23.0"
                  value={formState.metaApiVersion}
                  disabled={formDisabled}
                  onChange={(value) => updateField("metaApiVersion", value)}
                />
              </>
            ) : null}
            {isEvolutionProvider ? (
              <>
                <LabeledInput
                  label="URL da Evolution API"
                  placeholder="http://localhost:8080"
                  value={formState.evolutionApiUrl}
                  disabled={evolutionConfigDisabled}
                  onChange={(value) => updateField("evolutionApiUrl", value)}
                />
                <LabeledInput
                  label="Nome da instancia"
                  placeholder="clinica-main"
                  value={formState.evolutionInstanceName}
                  disabled={evolutionConfigDisabled}
                  onChange={(value) =>
                    updateField("evolutionInstanceName", value)
                  }
                />
                <LabeledInput
                  label="Token da Evolution API"
                  placeholder="token-da-evolution"
                  value={formState.evolutionApiToken}
                  disabled={evolutionConfigDisabled}
                  renderInput={({ value, onChange, disabled }) => (
                    <div className="relative">
                      <input
                        type={showEvolutionApiToken ? "text" : "password"}
                        value={value}
                        onChange={(event) => onChange(event.target.value)}
                        placeholder="token-da-evolution"
                        disabled={disabled}
                        className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm px-3 py-2.5 pr-10 outline-none focus:border-indigo-500 dark:text-white disabled:bg-slate-200 dark:disabled:bg-zinc-800 disabled:border-slate-300 dark:disabled:border-zinc-700 disabled:text-slate-600 dark:disabled:text-zinc-400 disabled:cursor-not-allowed"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowEvolutionApiToken((prevValue) => !prevValue)
                        }
                        disabled={!canManageBotSettings}
                        className="absolute inset-y-0 right-0 inline-flex items-center justify-center px-3 text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label={
                          showEvolutionApiToken
                            ? "Ocultar token da Evolution API"
                            : "Exibir token da Evolution API"
                        }
                        title={
                          showEvolutionApiToken ? "Ocultar token" : "Exibir token"
                        }
                      >
                        {showEvolutionApiToken ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    </div>
                  )}
                  onChange={(value) => updateField("evolutionApiToken", value)}
                />
                <LabeledInput
                  label="Token do webhook (obrigatorio)"
                  placeholder="token-forte-para-validar-webhook"
                  value={formState.evolutionWebhookToken}
                  disabled={formDisabled}
                  renderInput={({ value, onChange, disabled }) => (
                    <div className="relative">
                      <input
                        type={showEvolutionWebhookToken ? "text" : "password"}
                        value={value}
                        onChange={(event) => onChange(event.target.value)}
                        placeholder="token-forte-para-validar-webhook"
                        disabled={disabled}
                        className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm px-3 py-2.5 pr-10 outline-none focus:border-indigo-500 dark:text-white disabled:bg-slate-200 dark:disabled:bg-zinc-800 disabled:border-slate-300 dark:disabled:border-zinc-700 disabled:text-slate-600 dark:disabled:text-zinc-400 disabled:cursor-not-allowed"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowEvolutionWebhookToken((prevValue) => !prevValue)
                        }
                        disabled={!canManageBotSettings}
                        className="absolute inset-y-0 right-0 inline-flex items-center justify-center px-3 text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label={
                          showEvolutionWebhookToken
                            ? "Ocultar token do webhook"
                            : "Exibir token do webhook"
                        }
                        title={
                          showEvolutionWebhookToken
                            ? "Ocultar token do webhook"
                            : "Exibir token do webhook"
                        }
                      >
                        {showEvolutionWebhookToken ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    </div>
                  )}
                  onChange={(value) =>
                    updateField("evolutionWebhookToken", value)
                  }
                />
              </>
            ) : null}
          </div>
          {isMetaProvider ? (
            <div className="rounded-lg border border-sky-200 dark:border-sky-900/40 bg-sky-50/70 dark:bg-sky-950/20 p-3 text-xs text-sky-800 dark:text-sky-200 space-y-1">
              <p className="font-semibold">
                Webhook Meta: <code>/api/meta/webhook</code>
              </p>
              <p>
                Configure o callback na Meta para apontar para a URL acima e use
                o mesmo Verify Token salvo neste painel.
              </p>
            </div>
          ) : null}
          {isEvolutionProvider ? (
            <>
              {isEvolutionConnected ? (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  A instancia esta conectada. Para alterar numero, URL, nome ou
                  token, use primeiro &quot;Desconectar instancia&quot; ou
                  &quot;Excluir instancia&quot;.
                </p>
              ) : null}
              <div className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/40 p-4 space-y-4">
                <div className="space-y-4">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-zinc-200">
                {isLoadingConnectionState ? (
                  <>
                    <Loader2 className="size-4 animate-spin text-slate-500" />
                    Verificando status do WhatsApp
                  </>
                ) : connectionState === "open" ? (
                  <>
                    <Wifi className="size-4 text-emerald-600" />
                    WhatsApp conectado
                  </>
                ) : (
                  <>
                    <WifiOff className="size-4 text-amber-600" />
                    WhatsApp nao conectado
                  </>
                )}
              </div>

              <div className="rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Acoes de sincronizacao
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleSyncWhatsApp}
                    disabled={
                      !isEvolutionProvider ||
                      !canManageBotSettings ||
                      isSyncing ||
                      isLoadingConnectionState
                    }
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-zinc-600 px-3 py-2 text-xs font-bold text-slate-700 dark:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSyncing ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="size-3.5" />
                    )}
                    Sincronizar WhatsApp
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/60 dark:bg-indigo-950/20 p-3 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
                  Destino do webhook
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <label className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-zinc-300">
                      Encaminhar para
                    </span>
                    <Select
                      value={formState.webhookTargetMode}
                      onValueChange={(value) =>
                        updateField(
                          "webhookTargetMode",
                          value === "n8n" ? "n8n" : "system",
                        )
                      }
                      disabled={webhookConfigDisabled}
                    >
                      <SelectTrigger className="w-full rounded-lg border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 h-8 px-2.5 text-xs shadow-none disabled:bg-slate-200 dark:disabled:bg-zinc-800 disabled:text-slate-600 dark:disabled:text-zinc-400">
                        <SelectValue placeholder="Selecione o destino" />
                      </SelectTrigger>
                      <SelectContent className="rounded-lg border-slate-300 dark:border-zinc-600">
                        <SelectItem value="system">
                          Sistema (sem n8n)
                        </SelectItem>
                        <SelectItem value="n8n">n8n</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>

                  {formState.webhookTargetMode === "n8n" ? (
                    <>
                      <label className="space-y-1">
                        <span className="text-[11px] font-semibold text-slate-600 dark:text-zinc-300">
                          Modo de webhook
                        </span>
                        <Select
                          value={formState.n8nWebhookMode}
                          onValueChange={(value) =>
                            updateField(
                              "n8nWebhookMode",
                              value === "test" ? "test" : "production",
                            )
                          }
                          disabled={webhookConfigDisabled}
                        >
                          <SelectTrigger className="w-full rounded-lg border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 h-8 px-2.5 text-xs shadow-none disabled:bg-slate-200 dark:disabled:bg-zinc-800 disabled:text-slate-600 dark:disabled:text-zinc-400">
                            <SelectValue placeholder="Selecione o modo" />
                          </SelectTrigger>
                          <SelectContent className="rounded-lg border-slate-300 dark:border-zinc-600">
                            <SelectItem value="production">
                              Producao (/webhook)
                            </SelectItem>
                            <SelectItem value="test">
                              Teste (/webhook-test)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </label>
                      <label className="space-y-1 md:col-span-1">
                        <span className="text-[11px] font-semibold text-slate-600 dark:text-zinc-300">
                          URL base do n8n
                        </span>
                        <input
                          value={formState.n8nBaseUrl}
                          onChange={(event) =>
                            updateField("n8nBaseUrl", event.target.value)
                          }
                          placeholder="http://n8n:5678"
                          disabled={webhookConfigDisabled}
                          className="w-full rounded-lg border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2.5 py-2 text-xs outline-none focus:border-indigo-500 disabled:bg-slate-200 dark:disabled:bg-zinc-800 disabled:text-slate-600 dark:disabled:text-zinc-400"
                        />
                      </label>
                      <label className="space-y-1 md:col-span-3">
                        <span className="text-[11px] font-semibold text-slate-600 dark:text-zinc-300">
                          Path do webhook no n8n
                        </span>
                        <input
                          value={formState.n8nWebhookPath}
                          onChange={(event) =>
                            updateField("n8nWebhookPath", event.target.value)
                          }
                          placeholder="evolution"
                          disabled={webhookConfigDisabled}
                          className="w-full rounded-lg border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2.5 py-2 text-xs outline-none focus:border-indigo-500 disabled:bg-slate-200 dark:disabled:bg-zinc-800 disabled:text-slate-600 dark:disabled:text-zinc-400"
                        />
                      </label>
                    </>
                  ) : (
                    <label className="space-y-1 md:col-span-2">
                      <span className="text-[11px] font-semibold text-slate-600 dark:text-zinc-300">
                        URL base do sistema
                      </span>
                      <input
                        value={formState.systemWebhookBaseUrl}
                        onChange={(event) =>
                          updateField(
                            "systemWebhookBaseUrl",
                            event.target.value,
                          )
                        }
                        placeholder="https://seu-dominio.com"
                        disabled={webhookConfigDisabled}
                        className="w-full rounded-lg border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2.5 py-2 text-xs outline-none focus:border-indigo-500 disabled:bg-slate-200 dark:disabled:bg-zinc-800 disabled:text-slate-600 dark:disabled:text-zinc-400"
                      />
                    </label>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleApplyWebhook}
                    disabled={
                      !canManageBotSettings ||
                      !hasEvolutionSecureWebhookInput ||
                      webhookConfigDisabled
                    }
                    className="inline-flex items-center gap-2 rounded-lg border border-indigo-300 dark:border-indigo-700 px-3 py-2 text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isApplyingWebhook ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Save className="size-3.5" />
                    )}
                    Aplicar webhook no Evolution
                  </button>
                  <button
                    onClick={handleCheckWebhook}
                    disabled={
                      !canManageBotSettings ||
                      !hasEvolutionSecureWebhookInput ||
                      webhookConfigDisabled
                    }
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-zinc-600 px-3 py-2 text-xs font-bold text-slate-700 dark:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isCheckingWebhook ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="size-3.5" />
                    )}
                    Verificar webhook atual
                  </button>
                </div>
                <p className="text-[11px] text-indigo-700/90 dark:text-indigo-300/90">
                  {isEvolutionProvider && formState.webhookTargetMode === "n8n"
                    ? 'Em modo teste, o n8n exige "Listen for test event". Em producao, o workflow deve estar publicado.'
                    : isEvolutionProvider
                      ? "A Evolution sera apontada para /api/evolution/webhook e enviara o token de seguranca nos headers automaticamente."
                      : "Esse bloco de webhook/sincronizacao se aplica apenas ao provider Evolution."}
                </p>
                {webhookStatus ? (
                  <div className="rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white/80 dark:bg-zinc-900/60 p-2.5 text-[11px] space-y-1">
                    <p>
                      <span className="font-semibold">Status:</span>{" "}
                      {webhookStatus.enabled ? "habilitado" : "desabilitado"}
                    </p>
                    <p>
                      <span className="font-semibold">URL:</span>{" "}
                      {webhookStatus.url || "(nao configurada)"}
                    </p>
                    <p>
                      <span className="font-semibold">Eventos:</span>{" "}
                      {webhookStatus.events.length > 0
                        ? webhookStatus.events.join(", ")
                        : "(nenhum)"}
                    </p>
                    <p>
                      <span className="font-semibold">Por evento:</span>{" "}
                      {webhookStatus.webhookByEvents ? "sim" : "nao"}
                    </p>
                  </div>
                ) : null}
              </div>

                <div className="rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50/70 dark:bg-red-950/20 p-3 space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-red-700 dark:text-red-300">
                    Acoes de manutencao
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setDisconnectModalOpen(true)}
                      disabled={!canManageBotSettings || isDisconnecting}
                      className="inline-flex items-center gap-2 rounded-lg border border-amber-300 dark:border-amber-700 px-3 py-2 text-xs font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <Unplug className="size-3.5" />
                      Desconectar instancia
                    </button>
                    <button
                      onClick={() => setDeleteModalOpen(true)}
                      disabled={!canManageBotSettings || isDeleting}
                      className="inline-flex items-center gap-2 rounded-lg border border-rose-300 dark:border-rose-700 px-3 py-2 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="size-3.5" />
                      Excluir instancia
                    </button>
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Salve as configuracoes da Evolution e depois clique em
                sincronizar para buscar o QR Code dessa instancia.
              </p>
              {qrCodeBase64 ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                    <QrCode className="size-3.5" />
                    QR Code da instancia
                  </div>
                  <img
                    src={qrCodeBase64}
                    alt="QR Code do WhatsApp"
                    className="size-64 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white p-3"
                  />
                  <p className="text-xs text-slate-500 text-center">
                    No celular da clinica: WhatsApp {"->"} Dispositivos
                    conectados {"->"} Conectar dispositivo.
                  </p>
                </div>
              ) : null}
              </div>
            </>
          ) : null}
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500 inline-flex items-center gap-2">
            <Workflow className="size-4" />
            Regras operacionais
          </h3>
          <div
            className={`grid grid-cols-1 md:grid-cols-2 ${
              isMetaProvider ? "lg:grid-cols-4" : "lg:grid-cols-3"
            } gap-3`}
          >
            <ToggleCard
              title="Bot habilitado"
              description="Ativa respostas automaticas no WhatsApp."
              checked={formState.isBotEnabled}
              disabled={formDisabled}
              onChange={(checked) => updateField("isBotEnabled", checked)}
            />
            <ToggleCard
              title="Cancelar automaticamente"
              description="Permite cancelamento direto pelo bot."
              checked={formState.allowAutoCancel}
              disabled={formDisabled}
              onChange={(checked) => updateField("allowAutoCancel", checked)}
            />
            <ToggleCard
              title="Remarcar automaticamente"
              description="Permite remarcacao direta pelo bot."
              checked={formState.allowAutoReschedule}
              disabled={formDisabled}
              onChange={(checked) =>
                updateField("allowAutoReschedule", checked)
              }
            />
            {isMetaProvider ? (
              <ToggleCard
                title="Menus Interativos"
                description="Envia opcoes como botoes/listas nativas do WhatsApp em vez de texto."
                checked={formState.useInteractiveMessages}
                disabled={formDisabled}
                onChange={(checked) =>
                  updateField("useInteractiveMessages", checked)
                }
              />
            ) : null}
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500 inline-flex items-center gap-2">
            <Workflow className="size-4" />
            Comportamento do Bot
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <LabeledTextarea
              label="Saudacoes reconhecidas (separadas por virgula)"
              value={formState.greetingKeywords}
              disabled={formDisabled}
              onChange={(value) => updateField("greetingKeywords", value)}
            />
            <div className="space-y-4">
              <LabeledInput
                label="Dias para buscar disponibilidade"
                type="number"
                value={String(formState.availabilityDaysAhead)}
                disabled={formDisabled}
                onChange={(value) =>
                  updateField(
                    "availabilityDaysAhead",
                    Number.parseInt(value || "0", 10) || 0,
                  )
                }
              />
              <LabeledInput
                label="Maximo de dias mostrados ao paciente"
                type="number"
                value={String(formState.availabilityMaxDates)}
                disabled={formDisabled}
                onChange={(value) =>
                  updateField(
                    "availabilityMaxDates",
                    Number.parseInt(value || "0", 10) || 0,
                  )
                }
              />
              <LabeledInput
                label="Horarios no resumo por dia"
                type="number"
                value={String(formState.availabilityPreviewTimes)}
                disabled={formDisabled}
                onChange={(value) =>
                  updateField(
                    "availabilityPreviewTimes",
                    Number.parseInt(value || "0", 10) || 0,
                  )
                }
              />
              <LabeledInput
                label="Limite de agendamentos listados"
                type="number"
                value={String(formState.upcomingBookingsLimit)}
                disabled={formDisabled}
                onChange={(value) =>
                  updateField(
                    "upcomingBookingsLimit",
                    Number.parseInt(value || "0", 10) || 0,
                  )
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <LabeledInput
              label="Delay de digitacao (ms)"
              type="number"
              value={String(formState.messageTypingDelayMs)}
              disabled={formDisabled}
              onChange={(value) =>
                updateField(
                  "messageTypingDelayMs",
                  Number.parseInt(value || "0", 10) || 0,
                )
              }
            />
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300">
                Presenca de digitacao
              </span>
              <Select
                value={formState.messageTypingPresence}
                onValueChange={(value) =>
                  updateField(
                    "messageTypingPresence",
                    value === "recording"
                      ? "recording"
                      : value === "paused"
                        ? "paused"
                        : "composing",
                  )
                }
                disabled={formDisabled}
              >
                <SelectTrigger className="w-full rounded-xl border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 h-10 px-3 text-sm shadow-none disabled:bg-slate-200 dark:disabled:bg-zinc-800 disabled:text-slate-600 dark:disabled:text-zinc-400">
                  <SelectValue placeholder="Selecione a presenca" />
                </SelectTrigger>
                <SelectContent className="rounded-lg border-slate-300 dark:border-zinc-600">
                  <SelectItem value="composing">composing</SelectItem>
                  <SelectItem value="recording">recording</SelectItem>
                  <SelectItem value="paused">paused</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </div>
        </section>

        {isMetaProvider ? (
          <section className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500 inline-flex items-center gap-2">
              <MessageSquare className="size-4" />
              Menus Interativos
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <LabeledInput
                label="Titulo do menu interativo"
                value={formState.interactiveMenuTitle}
                disabled={formDisabled}
                onChange={(value) => updateField("interactiveMenuTitle", value)}
              />
              <LabeledInput
                label="Texto do botao do menu"
                value={formState.interactiveMenuButtonText}
                disabled={formDisabled}
                onChange={(value) =>
                  updateField("interactiveMenuButtonText", value)
                }
              />
              <LabeledInput
                label="Titulo da secao"
                value={formState.interactiveMenuSectionTitle}
                disabled={formDisabled}
                onChange={(value) =>
                  updateField("interactiveMenuSectionTitle", value)
                }
              />
              <LabeledInput
                label='Rotulo do botao "voltar"'
                value={formState.interactiveBackLabel}
                disabled={formDisabled}
                onChange={(value) => updateField("interactiveBackLabel", value)}
              />
              <div className="md:col-span-2">
                <LabeledInput
                  label='Descricao do botao "voltar"'
                  value={formState.interactiveBackDescription}
                  disabled={formDisabled}
                  onChange={(value) =>
                    updateField("interactiveBackDescription", value)
                  }
                />
              </div>
            </div>
          </section>
        ) : null}

        <section className="space-y-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500 inline-flex items-center gap-2">
              <MessageSquare className="size-4" />
              Lembretes de Consulta
            </h3>
            <button
              type="button"
              onClick={addReminderRule}
              disabled={
                formDisabled || formState.bookingReminderRules.length >= 8
              }
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Adicionar lembrete
            </button>
          </div>

          <p className="text-xs text-slate-500">
            Variaveis disponiveis nas mensagens: [nome], [servico],
            [profissional], [data], [hora] e [confirmacao].
          </p>

          {formState.bookingReminderRules.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900/40 p-4 text-sm text-slate-600 dark:text-zinc-300">
              Nenhum lembrete ativo. Clique em &quot;Adicionar lembrete&quot; para criar.
            </div>
          ) : (
            <div className="space-y-3">
              {formState.bookingReminderRules.map((rule, index) => (
                <div
                  key={rule.id}
                  className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900/40 p-4 space-y-3"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-end">
                    <div className="w-full md:w-44">
                      <LabeledInput
                        label={`Lembrete ${index + 1} (horas antes)`}
                        type="number"
                        value={String(rule.offsetHours)}
                        disabled={formDisabled}
                        onChange={(value) =>
                          updateReminderRule(index, {
                            offsetHours: Number.parseInt(value || "0", 10) || 0,
                          })
                        }
                      />
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-zinc-200 md:mb-2">
                      <input
                        type="checkbox"
                        checked={rule.requireConfirmation}
                        onChange={(event) =>
                          updateReminderRule(index, {
                            requireConfirmation: event.target.checked,
                          })
                        }
                        disabled={formDisabled}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-60"
                      />
                      Exigir confirmacao do paciente
                    </label>
                    <button
                      type="button"
                      onClick={() => removeReminderRule(index)}
                      disabled={formDisabled}
                      className="md:ml-auto inline-flex items-center justify-center rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      Remover
                    </button>
                  </div>

                  <LabeledTextarea
                    label="Mensagem do lembrete"
                    value={rule.messageTemplate}
                    disabled={formDisabled}
                    onChange={(value) =>
                      updateReminderRule(index, { messageTemplate: value })
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500 inline-flex items-center gap-2">
            <MessageSquare className="size-4" />
            Mensagens do bot
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <LabeledTextarea
              label="Mensagem de boas-vindas"
              value={formState.welcomeMessage}
              disabled={formDisabled}
              onChange={(value) => updateField("welcomeMessage", value)}
            />
            <LabeledTextarea
              label="Mensagem de primeiro contato"
              value={formState.firstContactMessage}
              disabled={formDisabled}
              onChange={(value) => updateField("firstContactMessage", value)}
            />
            <LabeledTextarea
              label="Mensagem fallback"
              value={formState.fallbackMessage}
              disabled={formDisabled}
              onChange={(value) => updateField("fallbackMessage", value)}
            />
            <LabeledTextarea
              label="Mensagem de horario de atendimento"
              value={formState.businessHoursMessage}
              disabled={formDisabled}
              onChange={(value) => updateField("businessHoursMessage", value)}
            />
            <LabeledTextarea
              label="Mensagem de confirmacao"
              value={formState.confirmMessage}
              disabled={formDisabled}
              onChange={(value) => updateField("confirmMessage", value)}
            />
            <LabeledTextarea
              label="Mensagem de cancelamento"
              value={formState.cancelMessage}
              disabled={formDisabled}
              onChange={(value) => updateField("cancelMessage", value)}
            />
            <LabeledTextarea
              label="Mensagem de remarcacao"
              value={formState.rescheduleMessage}
              disabled={formDisabled}
              onChange={(value) => updateField("rescheduleMessage", value)}
            />
            <div className="md:col-span-2">
              <LabeledTextarea
                label="Mensagem de encaminhamento humano"
                value={formState.humanHandoffMessage}
                disabled={formDisabled}
                onChange={(value) => updateField("humanHandoffMessage", value)}
              />
            </div>
          </div>
        </section>

        {formState.updatedAt ? (
          <div className="text-xs text-slate-500">
            Ultima atualizacao:{" "}
            {new Date(formState.updatedAt).toLocaleString("pt-BR")}
            {formState.updatedByUserName
              ? ` por ${formState.updatedByUserName}`
              : ""}
          </div>
        ) : null}
      </div>

      {!canManageBotSettings ? (
        <div className="px-6 py-4 bg-amber-50 border-t border-amber-200 text-amber-700 text-sm font-medium">
          Apenas administradores podem alterar as configuracoes de bot e
          integracao WhatsApp.
        </div>
      ) : null}

      <Dialog open={disconnectModalOpen} onOpenChange={setDisconnectModalOpen}>
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800">
          <DialogHeader className="px-8 pt-8 pb-0 space-y-0">
            <div className="mx-auto size-14 rounded-full bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center mb-4">
              <Unplug className="size-7 text-amber-600 dark:text-amber-400" />
            </div>
            <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white text-center">
              Desconectar Instancia
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500 mt-2 text-center">
              Tem certeza que deseja desconectar a instancia{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {formState.evolutionInstanceName || "(nao informada)"}
              </span>
              ? O WhatsApp sera despareado, mas a instancia permanecera salva.
            </DialogDescription>
          </DialogHeader>

          <div className="p-8 pt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setDisconnectModalOpen(false)}
              disabled={isDisconnecting}
              className="px-6 py-2.5 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDisconnectEvolutionInstance}
              disabled={isDisconnecting}
              className="bg-amber-600 text-white px-6 py-2.5 rounded-lg text-sm font-bold hover:bg-amber-700 transition-all shadow-md shadow-amber-600/20 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isDisconnecting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Desconectando...
                </>
              ) : (
                "Desconectar"
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800">
          <DialogHeader className="px-8 pt-8 pb-0 space-y-0">
            <div className="mx-auto size-14 rounded-full bg-red-100 dark:bg-red-500/10 flex items-center justify-center mb-4">
              <AlertTriangle className="size-7 text-red-600 dark:text-red-400" />
            </div>
            <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white text-center">
              Excluir Instancia
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500 mt-2 text-center">
              Confirma a exclusao da instancia{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {formState.evolutionInstanceName || "(nao informada)"}
              </span>
              ? Esta acao nao pode ser desfeita.
            </DialogDescription>
          </DialogHeader>

          <div className="p-8 pt-6 flex flex-col gap-3">
            <div className="bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20 rounded-xl p-4">
              <p className="text-xs text-red-700 dark:text-red-400 font-medium leading-relaxed">
                Depois da exclusao, sera necessario sincronizar novamente para
                criar uma nova instancia e gerar outro QR Code.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                disabled={isDeleting}
                className="px-6 py-2.5 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteEvolutionInstance}
                disabled={isDeleting}
                className="bg-red-600 text-white px-6 py-2.5 rounded-lg text-sm font-bold hover:bg-red-700 transition-all shadow-md shadow-red-600/20 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  "Excluir Instancia"
                )}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  disabled,
  renderInput,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  renderInput?: (props: {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
  }) => ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      {renderInput ? (
        renderInput({ value, onChange, disabled })
      ) : (
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm px-3 py-2.5 outline-none focus:border-indigo-500 dark:text-white disabled:bg-slate-200 dark:disabled:bg-zinc-800 disabled:border-slate-300 dark:disabled:border-zinc-700 disabled:text-slate-600 dark:disabled:text-zinc-400 disabled:cursor-not-allowed"
        />
      )}
    </div>
  );
}

function LabeledTextarea({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        rows={4}
        maxLength={1000}
        className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm px-3 py-2.5 outline-none focus:border-indigo-500 dark:text-white resize-y disabled:opacity-60"
      />
    </div>
  );
}

function ToggleCard({
  title,
  description,
  checked,
  onChange,
  disabled,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/40 p-4 flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
        className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-60"
      />
      <div className="space-y-1">
        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
          {title}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {description}
        </p>
      </div>
    </label>
  );
}

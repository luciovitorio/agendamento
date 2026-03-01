import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type {
  AppointmentTimeOffData,
  ProfessionalOption,
} from "@/app/admin/appointments/_components/types";
import { SettingsClientPage } from "./client-page";
import type { BotSettingsData, ServiceData } from "./_components/types";
import {
  BOT_SETTINGS_SINGLETON_KEY,
  DEFAULT_BOT_SETTINGS_VALUES,
} from "@/lib/bot-settings";
import { parseBookingReminderRules } from "@/lib/booking-reminder-rules";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type SettingsTab = "services" | "bot" | "timeoff";

interface AdminSettingsPageProps {
  searchParams: Promise<{
    tab?: string | string[];
  }>;
}

function getQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseTab(tab: string | undefined): SettingsTab | null {
  if (tab === "services" || tab === "bot" || tab === "timeoff") {
    return tab;
  }
  return null;
}

export default async function AdminSettingsPage({
  searchParams,
}: AdminSettingsPageProps) {
  const session = await auth();
  const userRole = session?.user?.role;
  const userEmail = session?.user?.email;
  const canAccessSettings =
    !!userRole && ["ADMIN", "DOUTOR"].includes(userRole);
  const canManageServices = userRole === "ADMIN";
  const canManageBotSettings = userRole === "ADMIN";

  if (!canAccessSettings) {
    redirect("/admin");
  }

  const query = await searchParams;
  const requestedTab = parseTab(getQueryValue(query.tab)?.toLowerCase());
  const allowedTabs: SettingsTab[] = canManageServices
    ? ["services", "bot", "timeoff"]
    : ["timeoff"];
  const activeTab =
    requestedTab && allowedTabs.includes(requestedTab)
      ? requestedTab
      : allowedTabs[0];

  const professionalWhere =
    userRole === "DOUTOR" && userEmail ? { email: userEmail } : undefined;

  const botSettingsPromise = !canManageBotSettings
    ? Promise.resolve(null)
    : (async () => {
        const model = (
          prisma as unknown as {
            clinicBotSettings?: {
              findUnique: (args: {
                where: { singletonKey: string };
                include: { updatedByUser: { select: { name: true } } };
              }) => Promise<{
                whatsappProvider: "EVOLUTION" | "META_CLOUD" | null;
                isBotEnabled: boolean;
                useInteractiveMessages: boolean;
                interactiveMenuTitle: string;
                interactiveMenuButtonText: string;
                interactiveMenuSectionTitle: string;
                interactiveBackLabel: string;
                interactiveBackDescription: string;
                greetingKeywords: string | null;
                availabilityDaysAhead: number;
                availabilityMaxDates: number;
                availabilityPreviewTimes: number;
                upcomingBookingsLimit: number;
                messageTypingDelayMs: number;
                messageTypingPresence: string;
                whatsappPhone: string | null;
                evolutionApiUrl: string | null;
                evolutionInstanceName: string | null;
                evolutionApiToken: string | null;
                evolutionWebhookToken: string | null;
                metaPhoneNumberId: string | null;
                metaAccessToken: string | null;
                metaWebhookVerifyToken: string | null;
                metaAppSecret: string | null;
                metaApiVersion: string | null;
                webhookTargetMode: string;
                systemWebhookBaseUrl: string | null;
                n8nBaseUrl: string | null;
                n8nWebhookMode: string;
                n8nWebhookPath: string;
                welcomeMessage: string;
                firstContactMessage: string;
                fallbackMessage: string;
                businessHoursMessage: string;
                confirmMessage: string;
                cancelMessage: string;
                rescheduleMessage: string;
                humanHandoffMessage: string;
                bookingReminderRulesJson: string | null;
                allowAutoCancel: boolean;
                allowAutoReschedule: boolean;
                updatedAt: Date;
                updatedByUser?: { name: string } | null;
              } | null>;
            };
          }
        ).clinicBotSettings;

        if (!model?.findUnique) {
          return null;
        }

        try {
          return await model.findUnique({
            where: { singletonKey: BOT_SETTINGS_SINGLETON_KEY },
            include: {
              updatedByUser: {
                select: { name: true },
              },
            },
          });
        } catch (error) {
          // Keep settings page available even if Prisma client/runtime is stale.
          return null;
        }
      })();

  const [services, professionals, timeOffs, botSettings] = await Promise.all([
    canManageServices
      ? prisma.service.findMany({
          include: {
            _count: {
              select: {
                professionals: true,
                bookings: true,
              },
            },
          },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    prisma.professional.findMany({
      where: professionalWhere,
      include: {
        services: {
          include: {
            service: true,
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.professionalTimeOff.findMany({
      where:
        userRole === "DOUTOR" && userEmail
          ? {
              professional: { email: userEmail },
            }
          : undefined,
      include: {
        professional: true,
        createdByUser: {
          select: { name: true },
        },
      },
      orderBy: [{ startDateTime: "asc" }],
    }),
    botSettingsPromise,
  ]);

  const formattedServices: ServiceData[] = services.map((service) => ({
    id: service.id,
    name: service.name,
    description: service.description,
    duration: service.duration,
    price: service.price,
    professionalsCount: service._count.professionals,
    bookingsCount: service._count.bookings,
    createdAt: service.createdAt.toISOString(),
  }));

  const formattedProfessionals: ProfessionalOption[] = professionals.map(
    (professional) => ({
      id: professional.id,
      name: professional.name,
      services: professional.services
        .map((entry) => ({
          id: entry.service.id,
          name: entry.service.name,
          duration: entry.service.duration,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }),
  );

  const formattedTimeOffs: AppointmentTimeOffData[] = timeOffs.map(
    (timeOff) => ({
      id: timeOff.id,
      professionalId: timeOff.professionalId,
      professionalName: timeOff.professional.name,
      startDateTime: timeOff.startDateTime.toISOString(),
      endDateTime: timeOff.endDateTime.toISOString(),
      reason: timeOff.reason,
      createdAt: timeOff.createdAt.toISOString(),
      createdByUserName: timeOff.createdByUser?.name || null,
    }),
  );

  const formattedBotSettings: BotSettingsData | null = canManageBotSettings
    ? {
        whatsappProvider:
          botSettings?.whatsappProvider === "META_CLOUD"
            ? "META_CLOUD"
            : "EVOLUTION",
        isBotEnabled:
          botSettings?.isBotEnabled ?? DEFAULT_BOT_SETTINGS_VALUES.isBotEnabled,
        useInteractiveMessages:
          botSettings?.useInteractiveMessages ??
          DEFAULT_BOT_SETTINGS_VALUES.useInteractiveMessages,
        interactiveMenuTitle:
          botSettings?.interactiveMenuTitle ??
          DEFAULT_BOT_SETTINGS_VALUES.interactiveMenuTitle,
        interactiveMenuButtonText:
          botSettings?.interactiveMenuButtonText ??
          DEFAULT_BOT_SETTINGS_VALUES.interactiveMenuButtonText,
        interactiveMenuSectionTitle:
          botSettings?.interactiveMenuSectionTitle ??
          DEFAULT_BOT_SETTINGS_VALUES.interactiveMenuSectionTitle,
        interactiveBackLabel:
          botSettings?.interactiveBackLabel ??
          DEFAULT_BOT_SETTINGS_VALUES.interactiveBackLabel,
        interactiveBackDescription:
          botSettings?.interactiveBackDescription ??
          DEFAULT_BOT_SETTINGS_VALUES.interactiveBackDescription,
        greetingKeywords:
          botSettings?.greetingKeywords ??
          DEFAULT_BOT_SETTINGS_VALUES.greetingKeywords,
        availabilityDaysAhead:
          botSettings?.availabilityDaysAhead ??
          DEFAULT_BOT_SETTINGS_VALUES.availabilityDaysAhead,
        availabilityMaxDates:
          botSettings?.availabilityMaxDates ??
          DEFAULT_BOT_SETTINGS_VALUES.availabilityMaxDates,
        availabilityPreviewTimes:
          botSettings?.availabilityPreviewTimes ??
          DEFAULT_BOT_SETTINGS_VALUES.availabilityPreviewTimes,
        upcomingBookingsLimit:
          botSettings?.upcomingBookingsLimit ??
          DEFAULT_BOT_SETTINGS_VALUES.upcomingBookingsLimit,
        messageTypingDelayMs:
          botSettings?.messageTypingDelayMs ??
          DEFAULT_BOT_SETTINGS_VALUES.messageTypingDelayMs,
        messageTypingPresence:
          (botSettings?.messageTypingPresence as
            | "composing"
            | "recording"
            | "paused"
            | undefined) ??
          DEFAULT_BOT_SETTINGS_VALUES.messageTypingPresence,
        whatsappPhone:
          botSettings?.whatsappPhone ??
          DEFAULT_BOT_SETTINGS_VALUES.whatsappPhone,
        evolutionApiUrl:
          botSettings?.evolutionApiUrl ??
          DEFAULT_BOT_SETTINGS_VALUES.evolutionApiUrl,
        evolutionInstanceName:
          botSettings?.evolutionInstanceName ??
          DEFAULT_BOT_SETTINGS_VALUES.evolutionInstanceName,
        evolutionApiToken:
          botSettings?.evolutionApiToken ??
          DEFAULT_BOT_SETTINGS_VALUES.evolutionApiToken,
        evolutionWebhookToken:
          botSettings?.evolutionWebhookToken ??
          DEFAULT_BOT_SETTINGS_VALUES.evolutionWebhookToken,
        metaPhoneNumberId:
          botSettings?.metaPhoneNumberId ??
          DEFAULT_BOT_SETTINGS_VALUES.metaPhoneNumberId,
        metaAccessToken:
          botSettings?.metaAccessToken ??
          DEFAULT_BOT_SETTINGS_VALUES.metaAccessToken,
        metaWebhookVerifyToken:
          botSettings?.metaWebhookVerifyToken ??
          DEFAULT_BOT_SETTINGS_VALUES.metaWebhookVerifyToken,
        metaAppSecret:
          botSettings?.metaAppSecret ?? DEFAULT_BOT_SETTINGS_VALUES.metaAppSecret,
        metaApiVersion:
          botSettings?.metaApiVersion ??
          DEFAULT_BOT_SETTINGS_VALUES.metaApiVersion,
        webhookTargetMode:
          (botSettings?.webhookTargetMode as "system" | "n8n" | undefined) ??
          DEFAULT_BOT_SETTINGS_VALUES.webhookTargetMode,
        systemWebhookBaseUrl:
          botSettings?.systemWebhookBaseUrl ??
          DEFAULT_BOT_SETTINGS_VALUES.systemWebhookBaseUrl,
        n8nBaseUrl:
          botSettings?.n8nBaseUrl ?? DEFAULT_BOT_SETTINGS_VALUES.n8nBaseUrl,
        n8nWebhookMode:
          (botSettings?.n8nWebhookMode as "test" | "production" | undefined) ??
          DEFAULT_BOT_SETTINGS_VALUES.n8nWebhookMode,
        n8nWebhookPath:
          botSettings?.n8nWebhookPath ??
          DEFAULT_BOT_SETTINGS_VALUES.n8nWebhookPath,
        welcomeMessage:
          botSettings?.welcomeMessage ??
          DEFAULT_BOT_SETTINGS_VALUES.welcomeMessage,
        firstContactMessage:
          botSettings?.firstContactMessage ??
          DEFAULT_BOT_SETTINGS_VALUES.firstContactMessage,
        fallbackMessage:
          botSettings?.fallbackMessage ??
          DEFAULT_BOT_SETTINGS_VALUES.fallbackMessage,
        businessHoursMessage:
          botSettings?.businessHoursMessage ??
          DEFAULT_BOT_SETTINGS_VALUES.businessHoursMessage,
        confirmMessage:
          botSettings?.confirmMessage ??
          DEFAULT_BOT_SETTINGS_VALUES.confirmMessage,
        cancelMessage:
          botSettings?.cancelMessage ??
          DEFAULT_BOT_SETTINGS_VALUES.cancelMessage,
        rescheduleMessage:
          botSettings?.rescheduleMessage ??
          DEFAULT_BOT_SETTINGS_VALUES.rescheduleMessage,
        humanHandoffMessage:
          botSettings?.humanHandoffMessage ??
          DEFAULT_BOT_SETTINGS_VALUES.humanHandoffMessage,
        bookingReminderRules: parseBookingReminderRules(
          botSettings?.bookingReminderRulesJson ??
            DEFAULT_BOT_SETTINGS_VALUES.bookingReminderRulesJson,
        ),
        allowAutoCancel:
          botSettings?.allowAutoCancel ??
          DEFAULT_BOT_SETTINGS_VALUES.allowAutoCancel,
        allowAutoReschedule:
          botSettings?.allowAutoReschedule ??
          DEFAULT_BOT_SETTINGS_VALUES.allowAutoReschedule,
        updatedAt: botSettings?.updatedAt.toISOString() || null,
        updatedByUserName: botSettings?.updatedByUser?.name || null,
      }
    : null;

  return (
    <SettingsClientPage
      services={formattedServices}
      professionals={formattedProfessionals}
      timeOffs={formattedTimeOffs}
      botSettings={formattedBotSettings}
      userRole={userRole}
      activeTab={activeTab}
    />
  );
}

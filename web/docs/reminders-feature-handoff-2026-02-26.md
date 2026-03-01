# Handoff da feature de lembretes (26/02/2026)

## Objetivo
Implementar lembretes automáticos de consulta com:
- configuração no painel
- envio por WhatsApp
- confirmação do paciente
- fluxo de cancelar/remarcar via bot
- execução em modo produção Linux (worker/cron)

## O que foi implementado

### 1) Banco e Prisma
- Novo campo em `ClinicBotSettings`:
  - `bookingReminderRulesJson`
- Nova tabela/fila:
  - `booking_reminders`
- Migration criada/aplicada:
  - `prisma/migrations/20260226170000_add_booking_reminders/migration.sql`

Arquivos:
- `prisma/schema.prisma`
- `prisma/migrations/20260226170000_add_booking_reminders/migration.sql`

### 2) Regras e motor de lembretes
- Regras, placeholders e parsing:
  - `src/lib/booking-reminder-rules.ts`
- Motor de fila/envio/confirmação:
  - `src/lib/booking-reminders.ts`

Funções principais:
- `syncBookingRemindersForBooking`
- `cancelBookingRemindersForBooking`
- `processDueBookingReminders`
- `tryConfirmBookingFromReminderReply`

### 3) Integração no ciclo de agendamento
- Ao criar agendamento: gera lembretes
- Ao cancelar/remover/status final: cancela lembretes pendentes

Arquivos:
- `src/lib/appointments.ts`
- `src/app/actions/appointment-actions.ts`
- `src/app/api/bookings/[id]/route.ts`
- `src/lib/bot-processor.ts`

### 4) Confirmação via WhatsApp (webhook)
- Intercepta resposta do paciente para lembrete:
  - confirmação -> confirma consulta
  - cancelar/remarcar -> cai no fluxo do bot (não handoff)

Arquivo:
- `src/app/api/evolution/webhook/route.ts`

### 5) Configuração no painel
- Bloco de lembretes em Settings:
  - quantidade dinâmica
  - horas antes
  - mensagem por lembrete
  - checkbox “Exigir confirmação do paciente”
- Persistência no save do bot settings

Arquivos:
- `src/app/admin/settings/_components/types.ts`
- `src/app/admin/settings/page.tsx`
- `src/app/admin/settings/_components/bot-settings-panel.tsx`
- `src/app/actions/bot-settings-actions.ts`
- `src/lib/bot-settings.ts`

### 6) Mensagens interativas x numéricas
- Quando `Menus interativos` estiver **ativado** e o lembrete exigir confirmação:
  - envia menu interativo com:
    - `Confirmar`
    - `Cancelar/Remarcar`
- Quando `Menus interativos` estiver **desativado**:
  - envia texto com opções:
    - `1 - Confirmar`
    - `2 - Cancelar/Remarcar`

Regra validada com cliente:
- `Cancelar/Remarcar` **não** entra em handoff automaticamente.
- Handoff fica somente para intenção explícita de falar com atendente.

### 7) Padronização de variáveis
- Padrão novo em lembretes: `[]`
  - `[nome]`, `[servico]`, `[profissional]`, `[data]`, `[hora]`, `[confirmacao]`
- Compatibilidade mantida com o formato antigo `{}`.

### 8) Execução estilo produção Linux
- Endpoint neutro de processamento:
  - `POST /api/reminders/process`
- Endpoint legado também mantido:
  - `POST /api/integrations/n8n/reminders/process`
- Worker dedicado para rodar contínuo:
  - `npm run reminders:worker`

Arquivos:
- `src/app/api/reminders/process/route.ts`
- `src/app/api/integrations/n8n/reminders/process/route.ts`
- `scripts/reminders-worker.ts`
- `package.json` (script `reminders:worker`)
- `README.md` (documentação Linux/produção)

## Tokens e env usados
- `REMINDERS_PROCESS_TOKEN` (novo, preferencial)
- fallbacks aceitos:
  - `N8N_REMINDERS_TOKEN`
  - `N8N_APPOINTMENTS_TOKEN`

## Comportamento esperado (resumo)
- Consulta às `18:00` + lembrete `1h` => envio alvo `17:00`.
- Se o agendamento for criado após o horário alvo, o lembrete envia na próxima rodada do processador.
- Sem worker/cron processando, lembrete fica na fila.

## Validações técnicas já executadas
- `npx prisma migrate deploy` (migration de lembretes aplicada)
- `npx prisma generate`
- `npx tsc --noEmit --incremental false`

## Pendências para amanhã (teste funcional)
1. Teste E2E com paciente real no WhatsApp:
   - criação de agendamento
   - disparo automático
   - confirmar/cancelar-remarcar
2. Validar texto final dos templates no painel (tom e copy).
3. Validar logs do worker em execução contínua.
4. (Opcional) adicionar card/admin view para monitorar fila de lembretes.

## Comandos rápidos de retomada
```bash
# web
npm run dev

# worker de lembretes (terminal separado)
npm run reminders:worker

# checagem TS
npx tsc --noEmit --incremental false
```

## Observação importante
- O repositório está com várias mudanças pré-existentes em paralelo; este handoff cobre somente o eixo da feature de lembretes trabalhado em 26/02/2026.

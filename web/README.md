# Clinic OS - README Técnico

Aplicação web para gestão de clínica com:
- agendamento público e interno
- controle de pacientes, serviços, profissionais e horários
- bloqueios de agenda
- dashboard e relatórios por perfil
- integração com bot n8n para agendamentos automatizados

Stack principal:
- Next.js 16 (App Router)
- React 19
- Prisma + PostgreSQL
- NextAuth v5 (credentials/JWT)
- Tailwind + shadcn/radix

## 1. Estrutura do projeto

Principais diretórios:
- `src/app`: páginas, rotas e APIs (App Router)
- `src/app/admin`: painel administrativo
- `src/app/api`: endpoints HTTP
- `src/app/actions`: server actions usadas no painel
- `src/lib`: regras de negócio centrais (`appointments`, status, e-mail, token)
- `prisma/schema.prisma`: modelo de dados
- `prisma/seed.ts`: seed completo para ambiente local/demo

## 2. Requisitos

- Node.js 20+
- npm 10+
- PostgreSQL acessível pela aplicação

## 3. Configuração local

### 3.1 Instalação

```bash
npm install
```

### 3.2 Variáveis de ambiente

Crie/ajuste `.env.local` (ou `.env`) com:

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/clinic_os?schema=public"
AUTH_SECRET="troque-por-um-segredo-forte"
PASSWORD_RESET_TOKEN_SECRET="troque-por-um-segredo-forte"

EMAIL_SERVER_HOST="smtp.seudominio.com"
EMAIL_SERVER_PORT="587"
EMAIL_SERVER_USER="usuario_smtp"
EMAIL_SERVER_PASSWORD="senha_smtp"
EMAIL_FROM='"Clinic OS" <noreply@seudominio.com>'

NEXT_PUBLIC_WEBAPP_URL="http://localhost:3000"
PASSWORD_RECOVERY_COOLDOWN_MINUTES="5"
NEXT_PUBLIC_PASSWORD_RECOVERY_COOLDOWN_MINUTES="5"

CLINIC_TIMEZONE_OFFSET="-03:00"
N8N_APPOINTMENTS_TOKEN="token-compartilhado-com-o-n8n"
REMINDERS_PROCESS_TOKEN="token-do-processador-de-lembretes"
META_WEBHOOK_VERIFY_TOKEN="token-opcional-fallback-para-validacao-do-webhook-meta"
META_APP_SECRET="app-secret-opcional-para-validacao-da-assinatura-meta"
```

Observações:
- `AUTH_SECRET` é usado pelo NextAuth.
- `PASSWORD_RESET_TOKEN_SECRET` é recomendado para token de recuperação/ativação. Se ausente, o sistema tenta `NEXTAUTH_SECRET`/`AUTH_SECRET`.
- `CLINIC_TIMEZONE_OFFSET` aceita formato `±HH:mm` e padrão `-03:00`.
- `REMINDERS_PROCESS_TOKEN` protege o endpoint de processamento de lembretes (`/api/reminders/process`).
- `META_WEBHOOK_VERIFY_TOKEN` e `META_APP_SECRET` são opcionais e usados como fallback se não estiverem preenchidos no painel em `/admin/settings`.

### 3.3 Banco e Prisma

```bash
npx prisma generate
npx prisma db push
```

Quando quiser aplicar o histórico versionado de migrations (recomendado para homologação/produção):

```bash
npx prisma migrate deploy
```

Se o banco já existia e foi criado com `db push` (sem histórico), faça baseline uma única vez:

```bash
npx prisma migrate resolve --applied 20260226090000_baseline
npx prisma migrate deploy
```

### 3.4 Seed (dados fake)

```bash
npx tsx prisma/seed.ts
```

O seed limpa as tabelas e recria:
- usuários, profissionais, serviços, planos, pacientes
- agendas, bloqueios e histórico de agendamentos

## 4. Executando

```bash
npm run dev
```

Aplicação:
- `http://localhost:3000`

Build de produção:

```bash
npm run build
npm run start
```

## 5. Usuários de seed

Credenciais padrão criadas no seed:
- `admin@clinica.com` / `admin` (`ADMIN`)
- `atendimento@clinica.com` / `123` (`ATENDENTE`)
- `ana@clinica.com` / `ana123` (`DOUTOR`)
- `jose@clinica.com` / `jose123` (`DOUTOR`)
- `maria@clinica.com` / `maria123` (`DOUTOR`)
- `claudio@clinica.com` / `claudio123` (`DOUTOR`)
- `pendente@clinica.com` (`PENDING`, sem acesso até ativação)

## 6. Perfis e permissões

Perfis do sistema:
- `ADMIN`
- `ATENDENTE`
- `DOUTOR`

Regras de escopo importantes:
- Dashboard:
  - `ADMIN` e `ATENDENTE`: visão global (atendente sem dados financeiros)
  - `DOUTOR`: visão do próprio profissional
- Configurações (`/admin/settings`):
  - acesso: `ADMIN`, `DOUTOR`
  - gestão de serviços/vínculos: apenas `ADMIN`
  - bloqueio de agenda:
    - `ADMIN`: pode bloquear todos
    - `DOUTOR`: apenas a própria agenda
- Horários (`/admin/schedules`):
  - `ADMIN`: todos os profissionais
  - `DOUTOR`: somente sua agenda
  - `ATENDENTE`: sem acesso
- Usuários e Planos:
  - apenas `ADMIN`

## 7. Fluxo de autenticação

- Provider: credentials (`next-auth`).
- Estratégia de sessão: JWT.
- Login permitido apenas para usuário com status `ACTIVE`.
- Usuário `PENDING` precisa concluir setup/redefinição de senha.
- `lastLoginAt` é atualizado no login bem-sucedido.
- Middleware protege `/admin` e redireciona:
  - não autenticado -> `/login`
  - autenticado em `/login` -> `/admin`

## 8. Regras de agendamento (núcleo)

Lógica central em `src/lib/appointments.ts`:
- valida profissional e serviço
- valida vínculo profissional-serviço
- valida jornada (`Schedule`) no dia da semana
- valida conflitos de horário (booking overlap)
- valida bloqueio (`ProfessionalTimeOff`)
- impede agendamento no passado (salvo `allowPast`)
- usa transação serializável para evitar corrida
- idempotência por `externalRequestId` (quando fornecido)

Status:
- `PENDING`, `CONFIRMED`, `CANCELLED`, `COMPLETED`, `NO_SHOW`

Transições permitidas:
- `PENDING` -> `CONFIRMED`, `COMPLETED`, `NO_SHOW`, `CANCELLED`
- `CONFIRMED` -> `PENDING`, `COMPLETED`, `NO_SHOW`, `CANCELLED`
- `CANCELLED`, `COMPLETED`, `NO_SHOW` são terminais

Regra adicional:
- `COMPLETED` e `NO_SHOW` só podem ser definidos após o horário de início.

Origens:
- `WEB` (agendamento público)
- `MANUAL` (painel interno)
- `BOT_N8N` (integração)

## 9. Rotas de UI principais

- Público:
  - `/`: vitrine de profissionais/serviços
  - `/book/[professionalId]/[serviceId]`: fluxo público de agendamento
  - `/login`
  - `/forgot-password`
  - `/reset-password`
- Admin:
  - `/admin`
  - `/admin/appointments`
  - `/admin/appointments/new`
  - `/admin/patients`
  - `/admin/reports` e subrotas
  - `/admin/schedules`
  - `/admin/settings`
  - `/admin/users`
  - `/admin/plans`
  - `/admin/search`

## 10. API HTTP (resumo)

### Agendamentos

- `GET /api/bookings`
  - requer sessão
  - retorna lista completa de bookings
- `POST /api/bookings`
  - público
  - cria agendamento com regras de negócio
  - origem automática: `MANUAL` para staff logado, `WEB` para anônimo
- `PUT /api/bookings/:id`
  - requer sessão
  - atualiza status com validação de transição
- `DELETE /api/bookings/:id`
  - requer sessão
  - remove booking fisicamente

### Disponibilidade e busca

- `GET /api/availability?professionalId=...&serviceId=...&date=YYYY-MM-DD`
  - público
  - retorna slots disponíveis
- `GET /api/patients?q=...`
  - requer sessão (`ADMIN`, `ATENDENTE`, `DOUTOR`)
  - busca pacientes
- `GET /api/admin/search?q=...`
  - requer sessão (`ADMIN`, `ATENDENTE`, `DOUTOR`)
  - busca consolidada de paciente/médico para o header

### Cadastros principais

- `GET /api/professionals`
  - público
- `POST /api/professionals`
  - `ADMIN`
- `GET /api/professionals/:id`
  - público
- `PUT/DELETE /api/professionals/:id`
  - `ADMIN`

- `GET /api/services`
  - público
- `POST /api/services`
  - `ADMIN`
- `GET /api/services/:id`
  - público
- `PUT/DELETE /api/services/:id`
  - `ADMIN`

- `GET /api/users`
  - `ADMIN`
- `POST /api/users`
  - `ADMIN`
- `PUT/DELETE /api/users/:id`
  - `ADMIN`

### Auth e integração

- `GET/POST /api/auth/[...nextauth]`
  - handlers do NextAuth
- `POST /api/integrations/n8n/appointments`
  - autenticação por token (`Authorization: Bearer` ou `x-n8n-token`)
  - exige idempotência (`x-idempotency-key` ou `externalRequestId`)
- `POST /api/integrations/n8n/patients/by-phone`
  - autenticação por token (`Authorization: Bearer` ou `x-n8n-token`)
  - consulta paciente por WhatsApp (`number`, `phone`, `remoteJid` ou `to`)
  - retorna `FOUND`/`NOT_FOUND` para controlar o fluxo no n8n
- `POST /api/integrations/n8n/messages/primeiro-contato`
  - autenticação por token (`Authorization: Bearer` ou `x-n8n-token`)
  - envia mensagem de primeiro contato configurada no painel
- `GET/POST /api/integrations/n8n/handoff`
  - autenticação por token (`Authorization: Bearer` ou `x-n8n-token`)
  - `POST`: abre/fecha handoff humano por telefone (`mode/action/state`: `human|humano|open` ou `bot|resume|retomar`)
  - `GET`: consulta estado atual do handoff por telefone (`number/phone/remoteJid/to`)
  - quando o telefone está em `HUMAN`, os webhooks (`/api/evolution/webhook` e `/api/meta/webhook`) não respondem com bot automático
- `GET/POST /api/meta/webhook`
  - webhook oficial da Meta Cloud API (verificação `hub.challenge` no GET e mensagens no POST)

Exemplo mínimo do body n8n:

```json
{
  "professionalId": "prof_id",
  "serviceId": "service_id",
  "dateStr": "2026-03-01",
  "startTime": "14:00",
  "patientName": "Maria Souza",
  "patientPhone": "11999999999",
  "patientEmail": "maria@email.com",
  "status": "PENDING",
  "externalRequestId": "n8n-req-123"
}
```

### Swagger / OpenAPI (integrações n8n)

Após subir a aplicação (`npm run dev`), acesse:
- `http://localhost:3000/api-docs/n8n` (Swagger UI)
- `http://localhost:3000/api/openapi/n8n` (spec OpenAPI em JSON)

Autenticação para os endpoints n8n:
- `Authorization: Bearer <N8N_APPOINTMENTS_TOKEN>`
- `x-n8n-token: <N8N_APPOINTMENTS_TOKEN>`

Observação:
- No endpoint de agendamentos, envie também `x-idempotency-key` ou `externalRequestId` no body.
- Nos endpoints de mensagens (`/messages/saudacao`, `/messages/fallback`, `/messages/primeiro-contato`, `/messages/humano`) é possível humanizar envio com:
  - `typingDelayMs` (ex.: `1800`)
  - `typingPresence` (`composing`, `recording`, `paused`)
  - `typingEnabled: false` (desliga presença/delay)

## 11. Server Actions (admin)

A UI administrativa usa actions para operações com revalidação:
- agendamentos: criar manual, remarcar, status, excluir, bloqueio de agenda
- pacientes: criar, editar, excluir
- serviços: criar, editar, excluir, vincular/desvincular profissional
- horários: salvar em lote, upsert, exclusão
- planos: CRUD
- autenticação/usuários: setup, recovery, reset, bloqueio, edição, exclusão

## 12. Qualidade e validações

Comandos recomendados antes de merge/deploy:

```bash
npm run lint
npx tsc --noEmit --incremental false
npm run build
```

## 13. Troubleshooting rápido

### Erro Prisma `query_engine_bg.js` / engine

Se ocorrer falha de engine em build/dev:

```bash
npx prisma generate
```

Se persistir:
- pare processos Node em execução
- regenere client novamente

### Sem envio de e-mail

Verifique variáveis SMTP:
- `EMAIL_SERVER_HOST`
- `EMAIL_SERVER_PORT`
- `EMAIL_SERVER_USER`
- `EMAIL_SERVER_PASSWORD`
- `EMAIL_FROM`

### Horários divergentes

Confirme `CLINIC_TIMEZONE_OFFSET` no `.env.local` (ex.: `-03:00`).

## 14. Lembretes em produção (Linux)

Para os lembretes saírem automaticamente, o sistema precisa processar a fila periodicamente.
Você pode usar dois modos (sem n8n):

### 14.1 Worker dedicado (recomendado)

Rode um processo separado no servidor Linux:

```bash
npm run reminders:worker
```

Variáveis opcionais:
- `REMINDERS_WORKER_INTERVAL_MS` (padrão: `60000`)
- `REMINDERS_WORKER_BATCH_SIZE` (padrão: `50`, máximo `200`)

Esse modo é ideal para rodar via `systemd`, `pm2` ou `supervisor`.

### 14.2 Cron chamando endpoint HTTP

Endpoint dedicado:
- `POST /api/reminders/process`
- Headers: `Authorization: Bearer <REMINDERS_PROCESS_TOKEN>` ou `x-reminders-token`

Exemplo `crontab` Linux (a cada minuto):

```bash
* * * * * curl -sS -X POST "http://localhost:3000/api/reminders/process" \
  -H "x-reminders-token: SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit":50}' >/dev/null 2>&1
```

### 14.3 Simulação local igual produção

No ambiente de testes local, use o mesmo comando do Linux:

```bash
npm run reminders:worker
```

Assim você valida o fluxo exatamente como ficará na VM Linux, sem depender de Agendador do Windows.

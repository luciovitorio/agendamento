# Bot Test Plan

Este documento separa os testes em:
- Automatizados por API (PowerShell).
- Manuais no sistema (UI + WhatsApp real).

## 1. Testes Automatizados (PowerShell)

### 1.1 Webhook (A01-A07)
```powershell
.\scripts\tests\webhook-tests.ps1 -WebhookToken "SEU_TOKEN_WEBHOOK"
```

Com bot desabilitado (A07):
```powershell
.\scripts\tests\webhook-tests.ps1 -WebhookToken "SEU_TOKEN_WEBHOOK" -RunDisabledBotTest
```

### 1.2 Webhook Meta (M01-M06)
```powershell
.\scripts\tests\meta-webhook-tests.ps1 -VerifyToken "SEU_META_VERIFY_TOKEN" -AppSecret "SEU_META_APP_SECRET"
```

### 1.3 Integracoes n8n (I01-I08)
```powershell
.\scripts\tests\n8n-tests.ps1 -N8nToken "SEU_N8N_APPOINTMENTS_TOKEN"
```

Sem endpoints de mensagem:
```powershell
.\scripts\tests\n8n-tests.ps1 -N8nToken "SEU_N8N_APPOINTMENTS_TOKEN" -SkipMessageEndpoints
```

## 2. Testes Manuais no Sistema

Use esta tabela para validar comportamento fim a fim (painel + WhatsApp).

| ID | Cenario | Passos | Resultado esperado | Status | Evidencia |
| --- | --- | --- | --- | --- | --- |
| M01 | Cadastro de novo paciente | Numero novo envia "oi" | Bot pede cadastro inicial | TODO | |
| M02 | Validacao de nome | Enviar nome com menos de 3 caracteres | Bot pede nome valido | TODO | |
| M03 | Cadastro com convenio | Escolher "Sim" no convenio e selecionar plano | Paciente criado com cobertura PLAN | TODO | |
| M04 | Cadastro particular | Escolher "Nao (particular)" | Paciente criado com cobertura PARTICULAR | TODO | |
| M05 | Plano nao encontrado -> particular | Escolher "Meu plano nao esta na lista" e seguir particular | Cadastro concluido como particular | TODO | |
| M06 | Plano nao encontrado -> humano | Escolher "Validar convenio com atendente" | Estado HUMAN_HANDOFF | TODO | |
| M07 | Saudacao em paciente existente | Paciente cadastrado envia "bom dia" | Saudacao + menu principal | TODO | |
| M08 | Fallback de opcao invalida | Enviar texto/numero fora do menu | fallbackMessage + menu | TODO | |
| M09 | Voltar com opcao 0 | Em tela de selecao enviar "0" | Retorno ao estado anterior/menu | TODO | |
| M10 | Intencao de remarcar (auto on) | Enviar "remarcar" com allowAutoReschedule=true | rescheduleMessage + menu | TODO | |
| M11 | Intencao de remarcar (auto off) | Enviar "remarcar" com allowAutoReschedule=false | handoff humano | TODO | |
| M12 | Agendar: lista de servicos | Menu opcao 1 | Lista de especialidades | TODO | |
| M13 | Agendar: auto selecao profissional | Escolher servico com 1 profissional | Pula para selecao de data | TODO | |
| M14 | Agendar: multiplos profissionais | Escolher servico com >1 profissional | Exibe lista de profissionais | TODO | |
| M15 | Agendar: sem horarios | Profissional sem slots | Mensagem sem horarios + menu | TODO | |
| M16 | Agendar completo | Escolher servico, profissional, data, hora e confirmar | Booking criado (PENDING, BOT_N8N) | TODO | |
| M17 | Cancelar na confirmacao do agendamento | Na tela final escolher "Cancelar" | Fluxo volta ao menu | TODO | |
| M18 | Meus agendamentos vazio | Menu opcao 2 sem bookings futuros | Mensagem de lista vazia | TODO | |
| M19 | Meus agendamentos com dados | Menu opcao 2 com bookings futuros | Lista com data/hora/servico/profissional | TODO | |
| M20 | Cancelamento automatico off | allowAutoCancel=false e menu opcao 3 | Encaminha para humano | TODO | |
| M21 | Cancelamento automatico on | allowAutoCancel=true e menu opcao 3 | Lista de agendamentos cancelaveis | TODO | |
| M22 | Confirmar cancelamento | Selecionar booking e confirmar "Sim, cancelar" | Status booking = CANCELLED | TODO | |
| M23 | Planos aceitos | Menu opcao 4 | Lista de planos cadastrados | TODO | |
| M24 | Horario de atendimento | Menu opcao 5 | businessHoursMessage + menu | TODO | |
| M25 | Solicitar humano pelo menu | Menu opcao 6 | Estado HUMAN_HANDOFF e mensagem de encaminhamento | TODO | |
| M26 | Handoff na fila do painel | Abrir /admin/handoff | Paciente aparece na tabela | TODO | |
| M27 | Nao lidas no handoff | Paciente envia msg em handoff | Contador de nao lidas incrementa | TODO | |
| M28 | Abrir chat marca leitura | Atendente abre chat do paciente | Nao lidas zeram | TODO | |
| M29 | Atendente envia msg pelo chat interno | Enviar resposta no painel | Paciente recebe no WhatsApp | TODO | |
| M30 | Assumir atendimento | Clicar "Assumir" | Responsavel atualizado | TODO | |
| M31 | Filtros da fila | Testar busca, mine, unassigned, ordenacao | Filtros funcionam corretamente | TODO | |
| M32 | Retomar bot | Clicar "Retomar bot" | Sai da fila e volta para BOT | TODO | |
| M33 | Bot volta a responder | Após retomar, paciente envia msg | Fluxo automatico do bot reativado | TODO | |
| M34 | Mensagem nao textual | Paciente envia audio/sticker/imagem | Bot responde orientando texto | TODO | |
| M35 | Conversa expirada | Aguardar >30 min sem interacao | Fluxo reinicia no welcome/cadastro | TODO | |

## 3. Evidencias sugeridas

- Print da conversa no WhatsApp (entrada e resposta).
- Print do painel `/admin/handoff` (fila, nao lidas, responsavel).
- Print do booking no painel `/admin/appointments`.
- Export/print do resultado dos scripts PowerShell.

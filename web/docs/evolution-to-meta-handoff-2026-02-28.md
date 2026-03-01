# Handoff - Evolution -> Meta Cloud API (2026-02-28)

## Resumo rapido
- O webhook do sistema esta funcional (`POST /api/evolution/webhook 200`).
- A instancia Evolution esta conectada (`connectionStatus: open`).
- O principal problema e de renderizacao/entrega de mensagens interativas da Evolution/Baileys:
  - `sendList` quebra com `TypeError: this.isZero is not a function`.
  - `sendButtons` envia `viewOnce/nativeFlow`, mas comportamento no cliente WhatsApp esta inconsistente (Web mostra placeholder e no celular pode nao mostrar).
- Para estabilidade, o sistema foi ajustado para cair em menu numerico em texto por padrao.

## O que foi alterado

### Infra / versao
- `demo-environment/docker-compose.yml`
  - Evolution alterada para `evoapicloud/evolution-api:v2.3.6`.

### Backend (webhook Evolution)
- `src/app/api/evolution/webhook/route.ts`
  - Aceita eventos com ponto e underscore (`messages.upsert` e `messages_upsert`).
  - Melhorou leitura de respostas de interacao:
    - `listResponseMessage.singleSelectReply.selectedRowId`
    - `buttonsResponseMessage.selectedButtonId`
    - `templateButtonReplyMessage.selectedId`
    - `interactiveResponseMessage.nativeFlowResponseMessage.paramsJson`
  - Adicionada logica para desembrulhar mensagens dentro de wrappers:
    - `viewOnceMessage`, `viewOnceMessageV2`, `viewOnceMessageV2Extension`, `ephemeralMessage`.

### Backend (envio Evolution)
- `src/lib/evolution-api.ts`
  - Tentativa de `sendList` com candidatos de payload (v2 e compatibilidade).
  - Sanitizacao de descricao de rows para evitar erro de validacao quando vazio.
  - Fallback para `sendButtons` implementado (schema v2: `type: "reply", displayText, id`) e parser de erro melhorado.
  - **Ajuste final de estabilidade**:
    - fallback de botoes desativado por padrao;
    - so ativa com `EVOLUTION_ENABLE_BUTTONS_FALLBACK=true`;
    - sem essa flag, ao falhar `sendList` o sistema envia texto numerico diretamente.

## Evidencias coletadas
- Evolution `sendList` retorna erro interno:
  - `TypeError: this.isZero is not a function`.
- Mesmo apos downgrade para `v2.3.6`, o erro persiste para `sendList`.
- Webhook da Evolution configurado para:
  - `http://host.docker.internal:3000/api/evolution/webhook`
  - evento `MESSAGES_UPSERT`.
- Porta ativa do app observada: `3000`.

## Estado atual esperado
- Com `useInteractiveMessages=true` no sistema:
  - o bot tenta interativo;
  - ao falhar no provider, cai para texto numerico.
- Resultado funcional e estavel para operacao:
  - resposta por texto numerico no WhatsApp.

## Pendencias para amanha (migracao Meta Cloud API)

### No projeto
1. Criar novo provider de envio/recebimento para Meta Cloud API (sem quebrar o fluxo atual do bot).
2. Adicionar selecao de provider nas configuracoes (`Evolution` x `Meta`).
3. Criar webhook dedicado da Meta (`/api/meta/webhook`) com verificacao GET (challenge) e POST (messages/status).
4. Mapear respostas interativas da Meta:
   - `button_reply.id`
   - `list_reply.id`
5. Implementar envio com Graph API:
   - texto;
   - interactive `button`;
   - interactive `list`.
6. Atualizar `.env.example` com variaveis da Meta.
7. Ajustar painel Admin para salvar credenciais Meta.

### Testes minimos
1. Mensagem de saudacao.
2. Menu principal interativo (button/list).
3. Clique em opcao e continuidade do estado.
4. Fallback para texto em caso de erro API.

## Checklist Meta (site) - preparar antes de codar
1. Criar/usar Business Portfolio (Business Manager) na Meta.
2. Criar app no Meta for Developers e adicionar produto **WhatsApp**.
3. Criar/associar uma **WhatsApp Business Account (WABA)**.
4. Adicionar numero de telefone para Cloud API (numero dedicado da WABA).
5. Configurar webhook da app:
   - Callback URL (sera endpoint do nosso sistema).
   - Verify Token (string definida por nos).
   - Assinar evento de mensagens.
6. Gerar token de acesso (inicialmente temporario; ideal usar token de longa duracao via System User).
7. Conceder permissoes necessarias:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
8. Definir e validar display name do numero (se exigido pelo fluxo da conta).
9. Se for usar templates, criar/aprovar templates no WhatsApp Manager.
10. (Quando sair de teste) concluir verificacao de negocio e ajustar limites/qualidade.

## Comandos uteis de diagnostico
- Status da instancia:
  - `curl -X GET "http://localhost:8080/instance/fetchInstances" -H "apikey: <KEY>"`
- Webhook configurado na Evolution:
  - `curl -X GET "http://localhost:8080/webhook/find/<INSTANCE>" -H "apikey: <KEY>"`
- Logs Evolution:
  - `docker logs evolution-api --tail 200`
- Testar webhook local:
  - `Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/evolution/webhook" ...`

## Observacao final
- Nao ha bloqueio no fluxo do bot em si; o bloqueio e de confiabilidade do canal interativo na Evolution/Baileys.
- Migrar para Meta Cloud API e o caminho recomendado para interativos estaveis.

const sharedErrorSchema = {
  type: "object",
  properties: {
    error: { type: "string" },
  },
  required: ["error"],
} as const;

const n8nMessageRequestSchema = {
  type: "object",
  description:
    "Informe pelo menos um dos campos number, phone, remoteJid ou to.",
  properties: {
    number: {
      type: "string",
      example: "5511999999999",
      description: "Número no formato internacional com DDI.",
    },
    phone: {
      type: "string",
      example: "5511999999999",
    },
    remoteJid: {
      type: "string",
      example: "5511999999999@s.whatsapp.net",
    },
    to: {
      type: "string",
      example: "5511999999999",
    },
    typingDelayMs: {
      type: "integer",
      example: 1800,
      description:
        "Delay em milissegundos para simular digitando antes do envio.",
    },
    typingPresence: {
      type: "string",
      enum: ["composing", "recording", "paused"],
      default: "composing",
      description:
        "Presença enviada para humanização. Padrão: composing.",
    },
    typingEnabled: {
      type: "boolean",
      default: true,
      description:
        "Se false, não envia presença/delay para a Evolution.",
    },
    disableTyping: {
      type: "boolean",
      default: false,
      description:
        "Atalho equivalente a typingEnabled=false.",
    },
    options: {
      type: "object",
      properties: {
        delay: { type: "integer", example: 1800 },
        presence: {
          type: "string",
          enum: ["composing", "recording", "paused"],
        },
      },
      description:
        "Compatível com payload nativo da Evolution; delay/presence também podem vir aqui.",
    },
  },
  additionalProperties: true,
} as const;

const n8nMessageSuccessSchema = {
  type: "object",
  properties: {
    result: { type: "string", example: "SENT" },
    number: { type: "string", example: "5511999999999" },
    message: { type: "string" },
    details: {
      type: "object",
      additionalProperties: true,
      nullable: true,
    },
  },
  required: ["result", "number", "message"],
} as const;

const n8nPatientLookupSuccessSchema = {
  type: "object",
  properties: {
    result: {
      type: "string",
      enum: ["FOUND", "NOT_FOUND"],
    },
    knownPatient: { type: "boolean" },
    normalizedPhone: { type: "string", example: "5511999999999" },
    patient: {
      type: "object",
      nullable: true,
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        phone: { type: "string" },
        email: { type: "string", nullable: true },
        coverageType: {
          type: "string",
          enum: ["PARTICULAR", "PLAN"],
        },
        healthPlan: {
          type: "object",
          nullable: true,
          properties: {
            id: { type: "string" },
            name: { type: "string" },
          },
        },
      },
    },
    lastBooking: {
      type: "object",
      nullable: true,
      properties: {
        id: { type: "string" },
        date: { type: "string", format: "date-time" },
        startTime: { type: "string", example: "14:00" },
        status: {
          type: "string",
          enum: ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW"],
        },
        professional: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
          },
        },
        service: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
          },
        },
      },
    },
  },
  required: ["result", "knownPatient", "normalizedPhone"],
} as const;

const n8nAppointmentRequestSchema = {
  type: "object",
  properties: {
    professionalId: { type: "string" },
    serviceId: { type: "string" },
    dateStr: { type: "string", example: "2026-03-01" },
    startTime: { type: "string", example: "14:00" },
    patientName: { type: "string", example: "Maria Souza" },
    patientPhone: { type: "string", example: "11999999999" },
    patientEmail: { type: "string", example: "maria@email.com" },
    status: {
      type: "string",
      enum: ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW"],
      default: "PENDING",
    },
    externalRequestId: {
      type: "string",
      description:
        "Alternativa ao header x-idempotency-key para idempotência obrigatória.",
      example: "n8n-req-123",
    },
    name: { type: "string" },
    phone: { type: "string" },
    email: { type: "string" },
    patient: {
      type: "object",
      properties: {
        name: { type: "string" },
        phone: { type: "string" },
        email: { type: "string" },
      },
    },
  },
  required: ["professionalId", "serviceId", "dateStr", "startTime"],
  additionalProperties: true,
} as const;

const n8nAppointmentSuccessSchema = {
  type: "object",
  properties: {
    result: { type: "string", example: "BOOKED" },
    idempotent: { type: "boolean" },
    booking: {
      type: "object",
      additionalProperties: true,
    },
  },
  required: ["result", "idempotent", "booking"],
} as const;

const n8nAppointmentErrorSchema = {
  type: "object",
  properties: {
    result: {
      type: "string",
      enum: ["CONFLICT", "NOT_FOUND", "INVALID_DATA", "ERROR"],
    },
    error: { type: "string" },
    code: { type: "string" },
  },
  required: ["result", "error"],
} as const;

const authSecurity = [{ bearerAuth: [] }, { n8nTokenHeader: [] }] as const;

const unauthorizedResponse = {
  description: "Token inválido ou ausente.",
  content: {
    "application/json": {
      schema: sharedErrorSchema,
      example: { error: "Token inválido." },
    },
  },
} as const;

const misconfiguredResponse = {
  description: "Token da integração não foi configurado no servidor.",
  content: {
    "application/json": {
      schema: sharedErrorSchema,
    },
  },
} as const;

export const n8nOpenApiSpecBase = {
  openapi: "3.0.3",
  info: {
    title: "Clinic OS - Integrações n8n",
    version: "1.0.0",
    description:
      "Documentação dos endpoints usados pelos fluxos n8n para agendamento e envio de mensagens via Evolution.",
  },
  tags: [
    { name: "N8N Appointments", description: "Criação de agendamentos via bot" },
    { name: "N8N Messages", description: "Respostas automáticas via Evolution" },
    { name: "N8N Patients", description: "Consulta de paciente por telefone" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "N8N_APPOINTMENTS_TOKEN",
        description: "Authorization: Bearer <N8N_APPOINTMENTS_TOKEN>",
      },
      n8nTokenHeader: {
        type: "apiKey",
        in: "header",
        name: "x-n8n-token",
        description: "Header alternativo: x-n8n-token: <N8N_APPOINTMENTS_TOKEN>",
      },
    },
    schemas: {
      N8nMessageRequest: n8nMessageRequestSchema,
      N8nMessageSuccess: n8nMessageSuccessSchema,
      N8nPatientLookupSuccess: n8nPatientLookupSuccessSchema,
      N8nAppointmentRequest: n8nAppointmentRequestSchema,
      N8nAppointmentSuccess: n8nAppointmentSuccessSchema,
      N8nAppointmentError: n8nAppointmentErrorSchema,
      ErrorMessage: sharedErrorSchema,
    },
  },
  paths: {
    "/api/integrations/n8n/appointments": {
      post: {
        tags: ["N8N Appointments"],
        summary: "Cria um agendamento com idempotência",
        security: authSecurity,
        parameters: [
          {
            in: "header",
            name: "x-idempotency-key",
            required: false,
            schema: { type: "string" },
            description:
              "Opcional se externalRequestId estiver no body. Um dos dois é obrigatório.",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/N8nAppointmentRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Agendamento criado.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/N8nAppointmentSuccess" },
              },
            },
          },
          "200": {
            description: "Requisição idempotente retornando agendamento existente.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/N8nAppointmentSuccess" },
              },
            },
          },
          "400": {
            description: "Body inválido, status inválido ou idempotência ausente.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorMessage" },
              },
            },
          },
          "401": unauthorizedResponse,
          "404": {
            description: "Entidade relacionada não encontrada.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/N8nAppointmentError" },
              },
            },
          },
          "409": {
            description: "Conflito de agenda/regra de negócio.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/N8nAppointmentError" },
              },
            },
          },
          "500": misconfiguredResponse,
        },
      },
    },
    "/api/integrations/n8n/patients/by-phone": {
      post: {
        tags: ["N8N Patients"],
        summary: "Consulta paciente existente por número de WhatsApp",
        security: authSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                description:
                  "Informe pelo menos um dos campos number, phone, remoteJid ou to.",
                properties: {
                  number: { type: "string", example: "5511999999999" },
                  phone: { type: "string", example: "5511999999999" },
                  remoteJid: {
                    type: "string",
                    example: "5511999999999@s.whatsapp.net",
                  },
                  to: { type: "string", example: "5511999999999" },
                },
                additionalProperties: true,
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Paciente encontrado ou não encontrado.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/N8nPatientLookupSuccess" },
              },
            },
          },
          "400": {
            description: "Número inválido.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorMessage" },
              },
            },
          },
          "401": unauthorizedResponse,
          "500": misconfiguredResponse,
        },
      },
    },
    "/api/integrations/n8n/messages/fallback": {
      post: {
        tags: ["N8N Messages"],
        summary: "Envia mensagem de fallback configurada no painel",
        security: authSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/N8nMessageRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Mensagem enviada.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/N8nMessageSuccess" },
              },
            },
          },
          "400": {
            description: "Número inválido.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorMessage" },
              },
            },
          },
          "401": unauthorizedResponse,
          "409": {
            description: "Bot desabilitado ou configuração Evolution incompleta.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorMessage" },
              },
            },
          },
          "500": misconfiguredResponse,
          "502": {
            description: "Falha ao enviar mensagem para Evolution API.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                    details: {
                      type: "object",
                      nullable: true,
                      additionalProperties: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/integrations/n8n/messages/saudacao": {
      post: {
        tags: ["N8N Messages"],
        summary: "Envia mensagem de saudação configurada no painel",
        security: authSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/N8nMessageRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Mensagem enviada.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/N8nMessageSuccess" },
              },
            },
          },
          "400": {
            description: "Número inválido.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorMessage" },
              },
            },
          },
          "401": unauthorizedResponse,
          "409": {
            description: "Bot desabilitado ou configuração Evolution incompleta.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorMessage" },
              },
            },
          },
          "500": misconfiguredResponse,
          "502": {
            description: "Falha ao enviar mensagem para Evolution API.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                    details: {
                      type: "object",
                      nullable: true,
                      additionalProperties: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/integrations/n8n/messages/primeiro-contato": {
      post: {
        tags: ["N8N Messages"],
        summary: "Envia mensagem de primeiro contato configurada no painel",
        security: authSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/N8nMessageRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Mensagem enviada.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/N8nMessageSuccess" },
              },
            },
          },
          "400": {
            description: "Número inválido.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorMessage" },
              },
            },
          },
          "401": unauthorizedResponse,
          "409": {
            description: "Bot desabilitado ou configuração Evolution incompleta.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorMessage" },
              },
            },
          },
          "500": misconfiguredResponse,
          "502": {
            description: "Falha ao enviar mensagem para Evolution API.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                    details: {
                      type: "object",
                      nullable: true,
                      additionalProperties: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/integrations/n8n/messages/humano": {
      post: {
        tags: ["N8N Messages"],
        summary: "Envia mensagem de encaminhamento para humano configurada no painel",
        security: authSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/N8nMessageRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Mensagem enviada.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/N8nMessageSuccess" },
              },
            },
          },
          "400": {
            description: "Número inválido.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorMessage" },
              },
            },
          },
          "401": unauthorizedResponse,
          "409": {
            description: "Bot desabilitado ou configuração Evolution incompleta.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorMessage" },
              },
            },
          },
          "500": misconfiguredResponse,
          "502": {
            description: "Falha ao enviar mensagem para Evolution API.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                    details: {
                      type: "object",
                      nullable: true,
                      additionalProperties: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

export function buildN8nOpenApiSpec(serverUrl?: string) {
  const normalizedServer =
    serverUrl?.trim() || process.env.NEXT_PUBLIC_WEBAPP_URL?.trim() || "http://localhost:3000";

  return {
    ...n8nOpenApiSpecBase,
    servers: [{ url: normalizedServer, description: "Ambiente atual" }],
  };
}

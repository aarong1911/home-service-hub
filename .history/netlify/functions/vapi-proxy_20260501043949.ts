/**
 * vapiClient.ts
 * Thin client that routes all Vapi calls through Netlify functions.
 *
 * IMPORTANT:
 * - Assistants and phone-number listing still go through vapi-proxy.ts
 * - Inbound phone-number assignment now goes through assign-voice-number.ts
 *   so the CRM mapping (voice_phone_numbers.agent_id) is persisted reliably.
 */

import { supabase } from '@/lib/supabase';

const PROXY = '/.netlify/functions/vapi-proxy';
const ASSIGN_NUMBER_ENDPOINT = '/.netlify/functions/assign-voice-number';
const WEBHOOK_URL = 'https://connect.renometa.com/.netlify/functions/vapi-webhook';

async function getAuthHeader(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  return `Bearer ${session.access_token}`;
}

async function vapiRequest<T = unknown>(
  path: string,
  method = 'GET',
  body?: Record<string, unknown>,
  query?: Record<string, string>
): Promise<T> {
  const res = await fetch(PROXY, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: await getAuthHeader(),
    },
    body: JSON.stringify({ path, method, body, query }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `Vapi error ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface VapiAssistant {
  id: string;
  name: string;
  firstMessage: string;
  model: {
    provider: string;
    model: string;
    systemPrompt: string;
  };
  voice: {
    provider: string;
    voiceId: string;
  };
  transcriber: {
    provider: string;
    model: string;
  };
  endCallPhrases: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateAssistantPayload {
  name: string;
  firstMessage: string;
  systemPrompt: string;
  voiceProvider?: string;
  voiceId?: string;
  llmModel?: string;
  endCallPhrases?: string[];
  tools?: VapiTool[];
}

export interface VapiTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, { type: string; description: string }>;
      required?: string[];
    };
  };
  server?: { url: string };
}

export interface VapiPhoneNumber {
  id: string;
  number: string;
  name?: string;
  assistantId?: string;
  serverUrl?: string;
  createdAt: string;
}

export interface VapiCall {
  id: string;
  status: string;
  type: string;
  cost?: number;
  startedAt?: string;
  endedAt?: string;
  customer?: { number: string };
  assistantId: string;
}

export interface AssignVoiceNumberResponse {
  success: boolean;
  phoneNumberId: string;
  agentId: string; // CRM voice_agents.id
  vapiAssistantId: string;
  routingMode: 'serverUrl';
}

// ─────────────────────────────────────────────
// Standard tool definitions for RenoMeta agents
// ─────────────────────────────────────────────

export const RENOMETA_TOOLS: Record<string, VapiTool> = {
  save_lead: {
    type: 'function',
    function: {
      name: 'save_lead',
      description:
        'Save the caller contact information, project details, budget and timeline to the CRM. Call this as soon as you have the caller name and phone number, and again if you collect more details.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Full name of the caller' },
          phone: { type: 'string', description: 'Phone number of the caller' },
          email: { type: 'string', description: 'Email address' },
          address: { type: 'string', description: 'Property address' },
          service: {
            type: 'string',
            description:
              'Type of service or renovation needed (e.g. roofing, kitchen remodel)',
          },
          budget: {
            type: 'string',
            description: 'Caller budget range for the project (e.g. $10,000-$20,000)',
          },
          timeline: {
            type: 'string',
            description: 'When they want to start the project (e.g. within 1 month, this summer)',
          },
          notes: {
            type: 'string',
            description: 'Any additional notes about the caller needs',
          },
        },
        required: ['name'],
      },
    },
    server: { url: WEBHOOK_URL },
  },

  check_availability: {
    type: 'function',
    function: {
      name: 'check_availability',
      description:
        'Check available appointment slots for a given date. If the caller requests a specific time, pass it as the "time" argument — the system will confirm if it is free or suggest the closest alternative. Always call this before booking.',
      parameters: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: 'Date to check (e.g. Monday April 14th, tomorrow, next Tuesday)',
          },
          time: {
            type: 'string',
            description:
              'Optional specific time the caller wants (e.g. 2pm, 10am, 14:00). If provided, the system checks that exact slot first.',
          },
        },
        required: ['date'],
      },
    },
    server: { url: WEBHOOK_URL },
  },

  book_appointment: {
    type: 'function',
    function: {
      name: 'book_appointment',
      description:
        'Book a confirmed appointment. Only call this after check_availability confirms the slot is free and the caller has agreed to the date and time. Include all collected caller details.',
      parameters: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: 'Confirmed appointment date (e.g. Monday April 14th)',
          },
          time: {
            type: 'string',
            description: 'Confirmed appointment time (e.g. 10am, 2:30pm)',
          },
          name: { type: 'string', description: 'Full name of the caller' },
          phone: { type: 'string', description: 'Phone number of the caller' },
          email: { type: 'string', description: 'Email address' },
          address: {
            type: 'string',
            description: 'Property address for the visit',
          },
          service: {
            type: 'string',
            description: 'Type of service or visit (e.g. Roof estimate, Kitchen consultation)',
          },
          budget: { type: 'string', description: 'Budget range if provided' },
          timeline: { type: 'string', description: 'Project start timeline if provided' },
          notes: { type: 'string', description: 'Any additional notes' },
        },
        required: ['date', 'time', 'name'],
      },
    },
    server: { url: WEBHOOK_URL },
  },

  get_service_info: {
    type: 'function',
    function: {
      name: 'get_service_info',
      description: 'Get information about a specific service offering.',
      parameters: {
        type: 'object',
        properties: {
          service: {
            type: 'string',
            description: 'The service to get information about',
          },
        },
        required: ['service'],
      },
    },
    server: { url: WEBHOOK_URL },
  },
};

// ─────────────────────────────────────────────
// API methods
// ─────────────────────────────────────────────

export const vapiClient = {
  // Assistants
  listAssistants: () => vapiRequest<VapiAssistant[]>('/assistant'),

  getAssistant: (id: string) => vapiRequest<VapiAssistant>(`/assistant/${id}`),

  createAssistant: ({
    name,
    firstMessage,
    systemPrompt,
    voiceProvider = '11labs',
    voiceId = '21m00Tcm4TlvDq8ikWAM',
    llmModel = 'claude-sonnet-4-20250514',
    endCallPhrases = ['goodbye', 'bye', 'thank you bye'],
    tools = [
      RENOMETA_TOOLS.save_lead,
      RENOMETA_TOOLS.book_appointment,
      RENOMETA_TOOLS.check_availability,
    ],
  }: CreateAssistantPayload) =>
    vapiRequest<VapiAssistant>('/assistant', 'POST', {
      name,
      firstMessage,
      model: {
        provider: 'anthropic',
        model: llmModel,
        systemPrompt,
        tools,
      },
      voice: { provider: voiceProvider, voiceId },
      transcriber: { provider: 'deepgram', model: 'nova-2' },
      endCallPhrases,
    }),

  updateAssistant: (id: string, updates: Partial<CreateAssistantPayload>) => {
    const body: Record<string, unknown> = {};

    if (updates.name) body.name = updates.name;
    if (updates.firstMessage) body.firstMessage = updates.firstMessage;

    if (updates.systemPrompt || updates.tools) {
      body.model = {
        provider: 'anthropic',
        model: updates.llmModel ?? 'claude-sonnet-4-20250514',
        ...(updates.systemPrompt && { systemPrompt: updates.systemPrompt }),
        ...(updates.tools && { tools: updates.tools }),
      };
    }

    if (updates.voiceId) {
      body.voice = {
        provider: updates.voiceProvider ?? 'elevenlabs',
        voiceId: updates.voiceId,
      };
    }

    return vapiRequest<VapiAssistant>(`/assistant/${id}`, 'PATCH', body);
  },

  deleteAssistant: (id: string) => vapiRequest(`/assistant/${id}`, 'DELETE'),

  // Phone numbers
  listPhoneNumbers: () => vapiRequest<VapiPhoneNumber[]>('/phone-number'),

  buyPhoneNumber: (areaCode: string, name?: string) =>
    vapiRequest<VapiPhoneNumber>('/phone-number', 'POST', {
      provider: 'twilio',
      numberDesiredAreaCode: areaCode,
      ...(name && { name }),
    }),

  /**
   * Assign an inbound phone number to a CRM voice agent.
   *
   * IMPORTANT:
   * - numberId = Vapi phone number ID
   * - agentId  = CRM voice_agents.id (NOT the raw Vapi assistant ID)
   *
   * The backend will:
   * 1) put the number into serverUrl routing mode in Vapi
   * 2) persist voice_phone_numbers.agent_id in Supabase
   * 3) optionally mark the selected agent active
   */
  assignAssistantToNumber: async (
    numberId: string,
    agentId: string
  ): Promise<AssignVoiceNumberResponse> => {
    const res = await fetch(ASSIGN_NUMBER_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: await getAuthHeader(),
      },
      body: JSON.stringify({
        phoneNumberId: numberId,
        agentId,
        setActive: true,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? 'Failed to assign assistant to phone number');
    }

    return res.json() as Promise<AssignVoiceNumberResponse>;
  },

  /**
   * Outbound calls still use assistantId directly because Vapi's
   * assistant-request webhook flow is for phone-number serverUrl routing.
   */
  triggerOutboundCall: (
    assistantId: string,
    phoneNumberId: string,
    customerNumber: string,
    customerName?: string
  ) =>
    vapiRequest<VapiCall>('/call', 'POST', {
      assistantId,
      phoneNumberId,
      customer: {
        number: customerNumber,
        ...(customerName && { name: customerName }),
      },
    }),
};
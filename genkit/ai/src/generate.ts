import zodToJsonSchema from 'zod-to-json-schema';
import {
  CandidateData,
  GenerationConfig,
  GenerationRequest,
  GenerationResponseData,
  GenerationUsage,
  MessageData,
  ModelAction,
  Part,
  ToolDefinition,
} from './model';
import { extractJson } from './extract';
import { Action } from '@google-genkit/common';
import { z } from 'zod';
import { lookup } from '@google-genkit/common/registry';

export class Message<T = unknown> implements MessageData {
  role: MessageData['role'];
  content: Part[];

  constructor(message: MessageData) {
    this.role = message.role;
    this.content = message.content;
  }

  output(): T | null {
    return extractJson<T>(this.text());
  }

  text(): string {
    return this.content.map((part) => part.text || '').join('');
  }
}

export class Candidate<O = unknown> implements CandidateData {
  message: Message<O>;
  index: number;
  usage: GenerationUsage;
  finishReason: CandidateData['finishReason'];
  finishMessage: string;
  custom: unknown;

  output(): O | null {
    return this.message.output();
  }

  text(): string {
    return this.message.text();
  }

  constructor(candidate: CandidateData) {
    this.message = new Message(candidate.message);
    this.index = candidate.index;
    this.usage = candidate.usage || {};
    this.finishReason = candidate.finishReason;
    this.finishMessage = candidate.finishMessage || '';
    this.custom = candidate.custom;
  }
}

export class GenerationResponse<O = unknown> implements GenerationResponseData {
  candidates: Candidate<O>[];
  usage: GenerationUsage;
  custom: unknown;

  output(): O | null {
    return this.candidates[0]?.output() || null;
  }

  text(): string {
    return this.candidates[0]?.text() || '';
  }

  constructor(response: GenerationResponseData) {
    this.candidates = (response.candidates || []).map(
      (candidate) => new Candidate(candidate)
    );
    this.usage = response.usage || {};
    this.custom = response.custom || {};
  }
}

function toToolDefinition(
  tool: Action<z.ZodTypeAny, z.ZodTypeAny>
): ToolDefinition {
  return {
    name: tool.__action.name,
    outputSchema: tool.__action.outputSchema
      ? zodToJsonSchema(tool.__action.outputSchema!)
      : {}, // JSON schema matching anything
    inputSchema: zodToJsonSchema(tool.__action.inputSchema!),
  };
}

function toGenerateRequest(prompt: ModelPrompt): GenerationRequest {
  const promptMessage: MessageData = { role: 'user', content: [] };
  if (typeof prompt.prompt === 'string') {
    promptMessage.content.push({ text: prompt.prompt });
  } else if (Array.isArray(prompt.prompt)) {
    promptMessage.content.push(...prompt.prompt);
  } else {
    promptMessage.content.push(prompt.prompt);
  }

  if (prompt.output?.schema) {
    const outputSchema = zodToJsonSchema(prompt.output.schema);
    promptMessage.content.push({
      text: `
    
Output should be JSON formatted and conform to the following schema:

\`\`\`
${JSON.stringify(outputSchema)}
\`\`\``,
    });
  }

  const messages: MessageData[] = [...(prompt.history || []), promptMessage];

  return {
    messages,
    candidates: prompt.candidates,
    config: prompt.config,
    tools: prompt.tools?.map((tool) => toToolDefinition(tool)) || [],
    output: {
      format:
        prompt.output?.format || (prompt.output?.schema ? 'json' : 'text'),
      schema: prompt.output?.schema
        ? zodToJsonSchema(prompt.output.schema)
        : undefined,
    },
  };
}

export interface ModelPrompt<
  O extends z.ZodTypeAny = z.ZodTypeAny,
  CustomOptions extends z.ZodTypeAny = z.ZodTypeAny
> {
  model: ModelAction<CustomOptions> | string;
  prompt: string | Part | Part[];
  history?: MessageData[];
  tools?: Action<z.ZodTypeAny, z.ZodTypeAny>[];
  candidates?: number;
  config?: GenerationConfig<z.infer<CustomOptions>>;
  output?: { format?: 'text' | 'json'; schema?: O };
}

export async function generate<
  O extends z.ZodTypeAny = z.ZodTypeAny,
  CustomOptions extends z.ZodTypeAny = z.ZodTypeAny
>(
  prompt: ModelPrompt<O, CustomOptions>
): Promise<GenerationResponse<z.infer<O>>> {
  let model: ModelAction<CustomOptions>;
  if (typeof prompt.model === 'string') {
    model = lookup(`models/${prompt.model}`);
  } else {
    model = prompt.model;
  }

  const request = toGenerateRequest(prompt);
  const response = new GenerationResponse<z.infer<O>>(await model(request));
  if (prompt.output?.schema) {
    const outputData = response.output();
    prompt.output.schema.parse(outputData);
  }
  return response;
}
/**
 * OpenAI GPT-5.1 nano — streaming inference
 * Key loaded from OPENAI_API_KEY in .env.local
 */

import OpenAI from "openai";

export interface BedrockMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AgentInvokeOptions {
  systemPrompt: string;
  messages: BedrockMessage[];
  maxTokens?: number;
}

export interface AgentResponse {
  content: string;
}

function agentModels() {
  const candidates = [
    process.env.OPENAI_AGENT_MODEL,
    process.env.OPENAI_MODEL,
    "gpt-5.1-nano",
    "gpt-4.1-nano",
  ].filter(Boolean) as string[]

  return [...new Set(candidates)]
}

function client() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function invokeAgent(opts: AgentInvokeOptions): Promise<AgentResponse> {
  let lastError: unknown

  for (const model of agentModels()) {
    try {
      const res = await client().chat.completions.create({
        model,
        max_tokens: opts.maxTokens ?? 4096,
        messages: [
          { role: "system", content: opts.systemPrompt },
          ...opts.messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      });
      return { content: res.choices[0]?.message?.content ?? "" };
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error("No configured OpenAI agent model is available.")
}

export async function invokeAgentStream(
  opts: AgentInvokeOptions,
  onChunk: (delta: string) => void
): Promise<string> {
  let lastError: unknown

  for (const model of agentModels()) {
    try {
      const stream = await client().chat.completions.create({
        model,
        max_tokens: opts.maxTokens ?? 4096,
        stream: true,
        messages: [
          { role: "system", content: opts.systemPrompt },
          ...opts.messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      });

      let full = "";
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? "";
        if (text) { full += text; onChunk(text); }
      }
      return full;
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error("No configured OpenAI agent model is available.")
}

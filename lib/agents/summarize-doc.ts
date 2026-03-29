/**
 * Document summarization using direct OpenAI completions.
 * Called after each agent response to extract structured documentation
 * from the full conversation history.
 */

import OpenAI from "openai";

function client() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const MODEL = "gpt-5.1";

export type SummarizationResult = {
  doc: Record<string, unknown>;
  completedFields: string[];
  allQuestionsAnswered: boolean;
};

const PRODUCT_SUMMARIZE_PROMPT = `You are a document extraction engine for a product discovery conversation.

Analyze the FULL conversation between the user and the Product Discovery AI agent. Extract and structure the following fields:

- title (string): The product or project name
- objective (string): Core value proposition and what the product does
- audience (string[]): Target user personas/segments
- scope (string[]): Key features and capabilities for MVP
- outOfScope (string[]): What is explicitly excluded from this version
- deliverables (string[]): Concrete outputs the project will produce
- risks (string[]): Business or technical risks identified

RULES:
- Merge with the existing document — do NOT erase fields that already have values unless the conversation explicitly contradicts them
- For list fields (audience, scope, outOfScope, deliverables, risks), accumulate items across the conversation
- Only mark a field as completed if it has MEANINGFUL, specific content (not just a generic placeholder)
- Be thorough — extract implicit information too (e.g., if the user describes features, that's scope even if they didn't label it as such)
- Write in Romanian language for all field values

You MUST respond with ONLY a valid JSON object (no markdown fences, no explanation) in this exact shape:
{
  "doc": {
    "title": "...",
    "objective": "...",
    "audience": ["...", "..."],
    "scope": ["...", "..."],
    "outOfScope": ["...", "..."],
    "deliverables": ["...", "..."],
    "risks": ["...", "..."]
  },
  "completedFields": ["title", "objective"],
  "allQuestionsAnswered": false
}

completedFields should list ONLY field keys that now have meaningful content.
allQuestionsAnswered should be true ONLY when ALL 7 fields have meaningful content.`;

const TECHNICAL_SUMMARIZE_PROMPT = `You are a document extraction engine for a technical architecture conversation.

Analyze the FULL conversation between the user and the Solutions Architect AI agent. Extract and structure the following fields:

- techStack (string[]): Technologies, frameworks, libraries chosen
- architecture (string): System architecture description (monolith, microservices, etc.) — can be multi-paragraph, rich detail
- database (string): Database design, schema description, tables, relationships — rich detail
- apis (string): API design, endpoints, patterns (REST, GraphQL, etc.) — rich detail
- authStrategy (string): Authentication and authorization approach — rich detail
- deployment (string): CI/CD, hosting, deployment strategy — rich detail
- infrastructure (string): Cloud services, infrastructure setup — rich detail

RULES:
- Merge with the existing document — do NOT erase fields that already have values unless the conversation explicitly contradicts them
- For techStack (list field), accumulate items across the conversation
- For text fields, write rich, detailed content suitable for a technical document
- Only mark a field as completed if it has MEANINGFUL, specific content
- Write in Romanian language for all field values

You MUST respond with ONLY a valid JSON object (no markdown fences, no explanation) in this exact shape:
{
  "doc": {
    "techStack": ["...", "..."],
    "architecture": "...",
    "database": "...",
    "apis": "...",
    "authStrategy": "...",
    "deployment": "...",
    "infrastructure": "..."
  },
  "completedFields": ["techStack", "architecture"],
  "allQuestionsAnswered": false
}

completedFields should list ONLY field keys that now have meaningful content.
allQuestionsAnswered should be true ONLY when ALL 7 fields have meaningful content.`;

export async function summarizeProductDoc(
  conversationHistory: Array<{ role: string; text: string }>,
  currentDoc: Record<string, unknown>
): Promise<SummarizationResult> {
  const conversationText = conversationHistory
    .map((m) => `${m.role === "human" ? "User" : "AI"}: ${m.text}`)
    .join("\n\n");

  const userMessage = `Current document state:\n${JSON.stringify(currentDoc, null, 2)}\n\nFull conversation:\n${conversationText}`;

  const res = await client().chat.completions.create({
    model: MODEL,
    max_completion_tokens: 2048,
    messages: [
      { role: "system", content: PRODUCT_SUMMARIZE_PROMPT },
      { role: "user", content: userMessage },
    ],
  });

  const content = res.choices[0]?.message?.content ?? "{}";

  try {
    // Strip markdown fences if present
    const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned) as SummarizationResult;
    return {
      doc: parsed.doc ?? {},
      completedFields: parsed.completedFields ?? [],
      allQuestionsAnswered: parsed.allQuestionsAnswered ?? false,
    };
  } catch {
    return { doc: currentDoc, completedFields: [], allQuestionsAnswered: false };
  }
}

export async function summarizeTechnicalDoc(
  conversationHistory: Array<{ role: string; text: string }>,
  currentDoc: Record<string, unknown>,
  productDoc: Record<string, unknown>
): Promise<SummarizationResult> {
  const conversationText = conversationHistory
    .map((m) => `${m.role === "human" ? "User" : "AI"}: ${m.text}`)
    .join("\n\n");

  const userMessage = `Product documentation (for context):\n${JSON.stringify(productDoc, null, 2)}\n\nCurrent technical document state:\n${JSON.stringify(currentDoc, null, 2)}\n\nFull conversation:\n${conversationText}`;

  const res = await client().chat.completions.create({
    model: MODEL,
    max_completion_tokens: 3072,
    messages: [
      { role: "system", content: TECHNICAL_SUMMARIZE_PROMPT },
      { role: "user", content: userMessage },
    ],
  });

  const content = res.choices[0]?.message?.content ?? "{}";

  try {
    const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned) as SummarizationResult;
    return {
      doc: parsed.doc ?? {},
      completedFields: parsed.completedFields ?? [],
      allQuestionsAnswered: parsed.allQuestionsAnswered ?? false,
    };
  } catch {
    return { doc: currentDoc, completedFields: [], allQuestionsAnswered: false };
  }
}

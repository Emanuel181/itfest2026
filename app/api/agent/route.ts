import { NextRequest } from "next/server";
import { invokeAgentStream } from "@/lib/agents/bedrock";
import {
  ORCHESTRATOR_PROMPT,
  BACKEND_PROMPT,
  FRONTEND_PROMPT,
  SECURITY_PROMPT,
  GLOBAL_EVALUATOR_PROMPT,
} from "@/lib/agents/prompts";

export const runtime = "nodejs";
export const maxDuration = 120;

const PROMPTS: Record<string, string> = {
  orchestrator: ORCHESTRATOR_PROMPT,
  backend: BACKEND_PROMPT,
  frontend: FRONTEND_PROMPT,
  security: SECURITY_PROMPT,
  evaluator: GLOBAL_EVALUATOR_PROMPT,
};

export async function POST(req: NextRequest) {
  const { role, storyId, storyTitle, storyDescription, variantId, context } =
    await req.json();

  const systemPrompt = PROMPTS[role];
  if (!systemPrompt) {
    return new Response(JSON.stringify({ error: "Unknown role" }), { status: 400 });
  }

  const userMessage = buildUserMessage(role, {
    storyId,
    storyTitle,
    storyDescription,
    variantId,
    context,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        await invokeAgentStream(
          { systemPrompt, messages: [{ role: "user", content: userMessage }], maxTokens: 4096 },
          (delta) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
          }
        );
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
      } catch (err) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: String(err) })}\n\n`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

function buildUserMessage(
  role: string,
  opts: {
    storyId: string;
    storyTitle: string;
    storyDescription: string;
    variantId?: string;
    context?: string;
  }
): string {
  const base = `User Story: ${opts.storyId} — ${opts.storyTitle}\nDescription: ${opts.storyDescription}`;

  switch (role) {
    case "orchestrator":
      return `${base}\nVariant: ${opts.variantId}\n\nProduce a concise execution plan for this variant. Use the format:\nStatus: <status>\nMapping: <what backend maps to what frontend>\nCompleted:\n- <step>\nPending:\n- <step>`;
    case "backend":
      return `${base}\nVariant: ${opts.variantId}\n\nImplement the server-side TypeScript code for this user story. Output only the code, no explanations.`;
    case "frontend":
      return `${base}\nVariant: ${opts.variantId}\n\nImplement the React/Next.js TypeScript component for this user story. Output only the code, no explanations.`;
    case "security":
      return `${base}\nVariant: ${opts.variantId}\nCode context:\n${opts.context ?? ""}\n\nAudit this implementation. Output JSON only:\n{"vulnerabilities": <n>, "complianceScore": <0-100>, "issues": [{"id": "SEC-XXX", "severity": "high|medium|low", "title": "...", "description": "...", "agentAction": "what the agent changed and where", "agentResult": "outcome after fix"}]}`;
    case "evaluator":
      return `${opts.context ?? ""}\n\nEvaluate the 3 variants. Output JSON only:\n{"A": {"pros": [...], "cons": [...], "complexityScore": <1-10>, "recommended": <bool>}, "B": {...}, "C": {...}}`;
    default:
      return base;
  }
}

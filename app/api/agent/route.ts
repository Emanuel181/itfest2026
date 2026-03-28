import { NextRequest } from "next/server";
import { invokeAgentStream } from "@/lib/agents/bedrock";
import {
  ORCHESTRATOR_PROMPT,
  REASONING_PROMPT,
  BACKEND_PROMPT,
  FRONTEND_PROMPT,
  SECURITY_PROMPT,
  GLOBAL_EVALUATOR_PROMPT,
  MERGE_PROMPT,
  POKER_ESTIMATE_PROMPT,
  POKER_DEBATE_PROMPT,
} from "@/lib/agents/prompts";

export const runtime = "nodejs";
export const maxDuration = 120;

const PROMPTS: Record<string, string> = {
  orchestrator: ORCHESTRATOR_PROMPT,
  reasoning: REASONING_PROMPT,
  backend: BACKEND_PROMPT,
  frontend: FRONTEND_PROMPT,
  security: SECURITY_PROMPT,
  evaluator: GLOBAL_EVALUATOR_PROMPT,
  merge: MERGE_PROMPT,
  poker_estimate: POKER_ESTIMATE_PROMPT,
  poker_debate: POKER_DEBATE_PROMPT,
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
    case "reasoning":
      return `${base}\nVariant: ${opts.variantId}\n\nAnalyze this user story and produce the reasoning document. Extract concrete implementation tasks and agent directives.`;
    case "orchestrator":
      return opts.context
        ? `${base}\nVariant: ${opts.variantId}\n\nReasoning analysis:\n${opts.context}\n\nBased on the reasoning above, produce a specific execution plan for this story. Include only the agents and steps relevant to this story — if "Needs Frontend: no" appears in the reasoning, do not reference frontend at all.`
        : `${base}\nVariant: ${opts.variantId}\n\nProduce a specific execution plan for this story variant. Base all steps on the actual technical requirements of this story only.`;
    case "backend":
      return `${base}\nVariant: ${opts.variantId}\n\nImplement the server-side TypeScript code for this user story. Output only the code, no explanations.`;
    case "frontend":
      return `${base}\nVariant: ${opts.variantId}\n\nImplement the React/Next.js TypeScript component for this user story. Output only the code, no explanations.`;
    case "security":
      return `${base}\nVariant: ${opts.variantId}\nCode to audit and patch:\n${opts.context ?? ""}\n\nAudit this implementation, fix all vulnerabilities in the code, and output the patched code plus audit report using the exact format specified in your system prompt.`;
    case "evaluator":
      return `${opts.context ?? ""}\n\nEvaluate the 3 variants. Output JSON only:\n{"A": {"pros": [...], "cons": [...], "complexityScore": <1-10>, "recommended": <bool>}, "B": {...}, "C": {...}}`;
    case "merge":
      return `Selected implementations for merge:\n${opts.context ?? ""}\n\nGenerate the merge agent terminal log for this integration. Be specific and technical.`;
    case "poker_estimate":
      return `User Story: ${opts.storyId} — ${opts.storyTitle}\nDescription: ${opts.storyDescription}\n\nYou are the ${opts.context ?? "team member"}.\nIndependently estimate the implementation effort. Do not guess or reference other agents' estimates.`;
    case "poker_debate":
      return `User Story: ${opts.storyId} — ${opts.storyTitle}\nDescription: ${opts.storyDescription}\n\n${opts.context ?? ""}\n\nYou are the ${opts.variantId ?? "team member"}. Argue for your position and work toward consensus.`;
    default:
      return base;
  }
}

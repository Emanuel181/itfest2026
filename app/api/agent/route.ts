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
  PRODUCT_CHAT_PROMPT,
  TECHNICAL_CHAT_PROMPT,
  REQUIREMENTS_AGENT_PROMPT,
  BACKLOG_AGENT_PROMPT,
  SECURITY_AUDIT_PROMPT,
} from "@/lib/agents/prompts";

export const runtime = "nodejs";
export const maxDuration = 120;

const TOKEN_LIMITS: Record<string, number> = {
  reasoning: 1024,
  orchestrator: 1024,
  backend: 8192,
  frontend: 8192,
  security: 8192,
  evaluator: 4096,
  merge: 4096,
  poker_estimate: 2048,
  poker_debate: 2048,
  product_chat: 4096,
  technical_chat: 4096,
  requirements_writer: 8192,
  backlog_writer: 16384,
  security_audit: 8192,
};

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
  product_chat: PRODUCT_CHAT_PROMPT,
  technical_chat: TECHNICAL_CHAT_PROMPT,
  requirements_writer: REQUIREMENTS_AGENT_PROMPT,
  backlog_writer: BACKLOG_AGENT_PROMPT,
  security_audit: SECURITY_AUDIT_PROMPT,
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
          { systemPrompt, messages: [{ role: "user", content: userMessage }], maxTokens: TOKEN_LIMITS[role] ?? 4096 },
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
    case "product_chat":
      return `${opts.context ?? ""}\n\nUser message: ${opts.storyDescription}`;
    case "technical_chat":
      return `${opts.context ?? ""}\n\nUser message: ${opts.storyDescription}`;
    case "requirements_writer":
      return `Product Documentation:\n${opts.context ?? ""}\n\nBased on the product and technical documentation above, generate a comprehensive list of software requirements as a JSON array.`;
    case "backlog_writer":
      return `Requirements:\n${opts.context ?? ""}\n\nBased on the requirements above, generate user stories for the product backlog as a JSON array.`;
    case "security_audit":
      return `Project Code:\n${opts.context ?? ""}\n\nPerform a comprehensive security audit of the above project code.`;
    default:
      return base;
  }
}

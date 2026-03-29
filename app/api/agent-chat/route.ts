import { NextRequest } from "next/server";
import { runProductAgent } from "@/lib/agents/product-agent";
import { runTechnicalAgent } from "@/lib/agents/technical-agent";
import type { AgentInputItem } from "@openai/agents";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const { agent, message, conversationHistory } = await req.json() as {
    agent: "product" | "technical";
    message: string;
    conversationHistory?: AgentInputItem[];
  };

  if (!agent || !message) {
    return new Response(JSON.stringify({ error: "Missing agent or message" }), { status: 400 });
  }

  const runFn = agent === "product" ? runProductAgent : runTechnicalAgent;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const result = await runFn(message, conversationHistory ?? []);
        const output = result.output_text;

        // Stream the response in chunks to simulate streaming UX
        const chunkSize = 12;
        for (let i = 0; i < output.length; i += chunkSize) {
          const chunk = output.slice(i, i + chunkSize);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: chunk })}\n\n`));
        }

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

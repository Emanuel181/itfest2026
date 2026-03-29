import { NextRequest } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 120;

const MODEL = "gpt-5.1";

const SYSTEM_PROMPT = `You are a Requirements Engineering Agent in an AI-Native IDE.
Your role is to analyze product documentation and technical documentation to produce a comprehensive list of software requirements.

You must output a JSON array of requirement objects. Each requirement has:
- id: unique identifier (REQ-001, REQ-002, etc.)
- title: short requirement name
- detail: detailed description of what the system must do
- kind: "functional" or "non-functional"
- priority: "must-have", "should-have", or "nice-to-have"

Rules:
- Extract ALL implicit and explicit requirements from both documents
- Cover: user-facing features, data management, authentication, performance, security, accessibility, error handling
- Be specific and testable — each requirement should be verifiable
- Non-functional requirements should include measurable criteria where possible
- Output ONLY the JSON array, no markdown fences, no explanations
- Aim for 10-15 requirements depending on project complexity
- Use Romanian language for requirement titles and details`;

export async function POST(req: NextRequest) {
  const { productDoc, technicalDoc } = await req.json() as {
    productDoc: Record<string, unknown>;
    technicalDoc: Record<string, unknown>;
  };

  if (!productDoc && !technicalDoc) {
    return new Response(JSON.stringify({ error: "No documentation provided" }), { status: 400 });
  }

  const userMessage = `Product Documentation:\n${JSON.stringify(productDoc, null, 2)}\n\nTechnical Documentation:\n${JSON.stringify(technicalDoc, null, 2)}\n\nBased on the product and technical documentation above, generate a comprehensive list of software requirements as a JSON array.`;

  const encoder = new TextEncoder();
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const completion = await openai.chat.completions.create({
          model: MODEL,
          max_completion_tokens: 8192,
          stream: true,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userMessage },
          ],
        });

        for await (const chunk of completion) {
          const text = chunk.choices[0]?.delta?.content ?? "";
          if (text) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: text })}\n\n`));
          }
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
      } catch (err) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(err) })}\n\n`));
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

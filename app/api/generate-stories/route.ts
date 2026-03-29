import { NextRequest } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 120;

const MODEL = "gpt-5.1";

const SYSTEM_PROMPT = `You are a Product Backlog Agent in an AI-Native IDE.
Your role is to transform software requirements into well-structured user stories for the product backlog.

For each requirement, generate one or more user stories. Each user story must follow this JSON format:
{
  "id": "STORY-001",
  "reqId": "REQ-001",
  "title": "Short story title",
  "description": "As a [user type], I want [goal] so that [benefit]",
  "acceptanceCriteria": ["Given..., When..., Then...", "..."],
  "type": "feature" | "bug" | "tech-debt" | "spike",
  "priority": "critical" | "high" | "medium" | "low",
  "labels": ["frontend", "backend", "database", "auth", "api", etc.]
}

Rules:
- Each user story must be independently implementable
- Acceptance criteria must be specific and testable
- Group related functionality into single stories when it makes sense
- Include technical stories (API setup, DB migration, auth setup) alongside feature stories
- Output ONLY a JSON array of user story objects
- No markdown fences, no explanations
- Use Romanian language for titles and descriptions
- Aim for 8-15 stories depending on project scope`;

export async function POST(req: NextRequest) {
  const { requirements } = await req.json() as {
    requirements: Array<{ id: string; title: string; detail: string; kind: string; priority: string }>;
  };

  if (!requirements?.length) {
    return new Response(JSON.stringify({ error: "No requirements provided" }), { status: 400 });
  }

  const userMessage = `Requirements:\n${JSON.stringify(requirements, null, 2)}\n\nBased on the requirements above, generate user stories for the product backlog as a JSON array.`;

  const encoder = new TextEncoder();
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const completion = await openai.chat.completions.create({
          model: MODEL,
          max_completion_tokens: 16384,
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

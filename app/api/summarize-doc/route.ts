import { NextRequest } from "next/server";
import { summarizeProductDoc, summarizeTechnicalDoc } from "@/lib/agents/summarize-doc";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { type, messages, currentDoc, productDoc } = await req.json() as {
    type: "product" | "technical";
    messages: Array<{ role: string; text: string }>;
    currentDoc: Record<string, unknown>;
    productDoc?: Record<string, unknown>;
  };

  if (!type || !messages?.length) {
    return new Response(JSON.stringify({ error: "Missing type or messages" }), { status: 400 });
  }

  try {
    const result =
      type === "product"
        ? await summarizeProductDoc(messages, currentDoc ?? {})
        : await summarizeTechnicalDoc(messages, currentDoc ?? {}, productDoc ?? {});

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}

import { NextRequest } from "next/server"
import OpenAI from "openai"

export const runtime = "nodejs"
export const maxDuration = 120

const MODEL = "gpt-5.1"

const SYSTEM_PROMPT = `You are a senior code editing assistant embedded inside an AI-native IDE.

You receive:
- a file path
- the current full contents of that file
- a user instruction describing the desired change

Your job is to return the FULL updated file contents only.

Rules:
- Output only the final file contents
- Do not wrap the file in markdown fences
- Preserve unrelated code and formatting where possible
- Keep the code valid for the file type implied by the path
- If the instruction cannot be completed safely, return the original file with a short comment at the top explaining the limitation`

export async function POST(request: NextRequest) {
  const { path, content, instruction } = (await request.json()) as {
    path?: string
    content?: string
    instruction?: string
  }

  if (!path || typeof path !== "string") {
    return new Response(JSON.stringify({ error: "A valid file path is required." }), { status: 400 })
  }

  if (typeof content !== "string") {
    return new Response(JSON.stringify({ error: "A valid file content string is required." }), { status: 400 })
  }

  if (!instruction || typeof instruction !== "string" || !instruction.trim()) {
    return new Response(JSON.stringify({ error: "An edit instruction is required." }), { status: 400 })
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const completion = await openai.chat.completions.create({
      model: MODEL,
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            `File path: ${path}`,
            "",
            "Instruction:",
            instruction.trim(),
            "",
            "Current file contents:",
            content,
          ].join("\n"),
        },
      ],
    })

    const nextContent = (completion.choices[0]?.message?.content ?? content)
      .replace(/^```[\w-]*\n?/g, "")
      .replace(/\n?```\s*$/g, "")

    return new Response(JSON.stringify({ content: nextContent }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 })
  }
}

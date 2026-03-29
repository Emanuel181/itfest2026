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
- general product and technical context for the project
- a workspace file map so you understand surrounding code

Your job is to return the FULL updated file contents only.

Rules:
- Output only the final file contents
- Do not wrap the file in markdown fences
- Preserve unrelated code and formatting where possible
- Keep the code valid for the file type implied by the path
- When editing CSS, produce real CSS that can style the current previewed experience
- When editing React/TSX, respect any nearby CSS files or global styling conventions provided in context
- If the instruction cannot be completed safely, return the original file with a short comment at the top explaining the limitation`

export async function POST(request: NextRequest) {
  const { path, content, instruction, workspaceFiles, projectContext } = (await request.json()) as {
    path?: string
    content?: string
    instruction?: string
    workspaceFiles?: Array<{ path: string; content: string }>
    projectContext?: {
      productDocumentation?: unknown
      technicalDocumentation?: unknown
      requirements?: unknown[]
      stories?: unknown[]
    }
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

  const relatedWorkspace = Array.isArray(workspaceFiles)
    ? workspaceFiles
        .filter((file) => file && typeof file.path === "string" && typeof file.content === "string")
        .slice(0, 24)
    : []

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
            "Project context:",
            JSON.stringify(projectContext ?? {}, null, 2),
            "",
            "Workspace files:",
            JSON.stringify(
              relatedWorkspace.map((file) => ({
                path: file.path,
                content: file.path === path ? "[CURRENT FILE BELOW]" : file.content,
              })),
              null,
              2
            ),
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

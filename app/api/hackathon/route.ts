import { NextResponse } from "next/server"
import OpenAI from "openai"

import {
  buildGeneratedApp,
  createBaseBlueprint,
  extractBlueprintFromHtml,
  normalizeBlueprint,
  type DesignOption,
  type HackathonDoc,
  type SiteBlueprint,
} from "@/lib/backend/hackathon-generator"

export const runtime = "nodejs"
export const maxDuration = 180

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

function extractJsonObject(content: string) {
  const firstBrace = content.indexOf("{")
  const lastBrace = content.lastIndexOf("}")

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null
  }

  try {
    return JSON.parse(content.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>
  } catch {
    return null
  }
}

async function requestBlueprint(options: {
  currentDoc: HackathonDoc
  selectedDesign?: DesignOption
  existingBlueprint?: SiteBlueprint
  prompt?: string
}) {
  const fallback = createBaseBlueprint(options.currentDoc, options.selectedDesign)

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: options.prompt
            ? `You are a senior website systems designer. Update the existing compact blueprint for a complex multi-page single-page application.

Return ONLY valid JSON. Do not output code. Keep the shape compact and production-oriented:
- appName, tagline, description, audience, styleDirection
- theme with primary, secondary, accent, background, surface, panel, text, muted
- stats array
- collections array with reusable items
- pages array with 4 to 6 pages
- each page must have 2 to 4 sections
- allowed section types: hero, cards, list, timeline, spotlight, form

The result must stay richly styled, multi-view, and dynamic. Preserve the existing structure where possible, but apply the user's refinement request concretely.`
            : `You are a senior website systems designer. Create a compact blueprint for a complex multi-page single-page application.

Return ONLY valid JSON. Do not output HTML, CSS, or JavaScript.

The blueprint must describe:
- appName, tagline, description, audience, styleDirection
- theme with primary, secondary, accent, background, surface, panel, text, muted
- stats array with realistic values
- collections array with reusable content items
- pages array with 4 to 6 pages
- each page must have 2 to 4 sections
- allowed section types: hero, cards, list, timeline, spotlight, form

The output should support a premium-looking, dynamic site with search, saved items, modal details, a dashboard-style page, and a contact/conversion page. Avoid placeholders and generic lorem ipsum.`,
        },
        {
          role: "user",
          content: JSON.stringify({
            currentDoc: options.currentDoc,
            selectedDesign: options.selectedDesign,
            startingBlueprint: options.existingBlueprint ?? fallback,
            refinementRequest: options.prompt ?? null,
          }),
        },
      ],
    })

    const parsed = JSON.parse(response.choices[0].message.content || "{}") as unknown
    return normalizeBlueprint(parsed, options.existingBlueprint ?? fallback)
  } catch {
    return options.existingBlueprint ?? fallback
  }
}

export async function POST(req: Request) {
  try {
    const { action, payload } = await req.json()

    if (action === "chat") {
      const { messages, currentDoc } = payload as {
        messages: Array<{ role: "user" | "ai"; content: string }>
        currentDoc: HackathonDoc
      }

      const systemPrompt = `You are an AI product manager helping a user define their web application idea for a hackathon.
Your goal is to extract enough information to build a clear spec document.
The doc needs: Title, Description, Target Audience, Core Features, and Visual Style.
Respond in Romanian. Keep it short, 1-2 sentences. Ask one question at a time.

IMPORTANT: Always start with a natural conversational reply. Only after that, if you learned something new, include a JSON block that updates the spec.
The JSON format must be EXACTLY: { "title": "...", "description": "...", "audience": "...", "features": ["..."], "style": "..." }
Current doc: ${JSON.stringify(currentDoc)}`

      const chatMessages = messages.map((message) => ({
        role: (message.role === "ai" ? "assistant" : "user") as "assistant" | "user",
        content: message.content,
      }))

      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL ?? "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          ...chatMessages,
        ],
      })

      const replyContent = response.choices[0].message.content || ""
      const newDoc = extractJsonObject(replyContent)
      const cleanReply = replyContent
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .replace(newDoc ? JSON.stringify(newDoc) : "", "")
        .trim() || "Am extras notițele de bază. Ce altă pagină sau funcționalitate vrei să includem?"

      return NextResponse.json({ reply: cleanReply, newDoc })
    }

    if (action === "generate_designs") {
      const { currentDoc } = payload as { currentDoc: HackathonDoc }

      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL ?? "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are an expert UI/UX designer.
Generate 6 distinct visual directions for the described web application.
Each option must include: name, description, colors (hex array), vibe.
Return ONLY a JSON object with a "designs" array.`,
          },
          {
            role: "user",
            content: JSON.stringify({ currentDoc }),
          },
        ],
      })

      const parsed = JSON.parse(response.choices[0].message.content || '{"designs": []}') as {
        designs?: DesignOption[]
      }

      const designs =
        Array.isArray(parsed.designs) && parsed.designs.length > 0
          ? parsed.designs
          : [
              { name: "Editorial Flux", description: "A bold magazine-like interface with dramatic type and layered surfaces.", colors: ["#14b8a6", "#f97316", "#38bdf8"], vibe: "Editorial" },
              { name: "Glass Signal", description: "Glassmorphism with strong operational panels and luminous accents.", colors: ["#0f172a", "#22c55e", "#f59e0b"], vibe: "Futuristic" },
              { name: "Warm Studio", description: "A cinematic warm palette for service-heavy websites and product storytelling.", colors: ["#7c2d12", "#f97316", "#facc15"], vibe: "Premium" },
              { name: "Ocean Control", description: "A cool data-rich experience with dashboard energy and layered depth.", colors: ["#0f766e", "#2563eb", "#38bdf8"], vibe: "High-tech" },
              { name: "Soft Contrast", description: "A refined, airy system with soft neutrals and sharp interaction points.", colors: ["#111827", "#ec4899", "#f59e0b"], vibe: "Elegant" },
              { name: "Studio Night", description: "Dark immersive product staging with vivid gradients and motion cues.", colors: ["#111827", "#8b5cf6", "#22d3ee"], vibe: "Cinematic" },
            ]

      return NextResponse.json({ designs: designs.slice(0, 6) })
    }

    if (action === "generate_code") {
      const { currentDoc, selectedDesign } = payload as {
        currentDoc: HackathonDoc
        selectedDesign?: DesignOption
      }

      const blueprint = await requestBlueprint({ currentDoc, selectedDesign })
      return NextResponse.json({
        ...buildGeneratedApp(blueprint),
      })
    }

    if (action === "refine_code") {
      const { currentDoc, selectedDesign, generatedCode, prompt } = payload as {
        currentDoc: HackathonDoc
        selectedDesign?: DesignOption
        generatedCode: { html: string; css: string; js: string }
        prompt: string
      }

      const existingBlueprint =
        extractBlueprintFromHtml(generatedCode?.html || "") ?? createBaseBlueprint(currentDoc, selectedDesign)

      const blueprint = await requestBlueprint({
        currentDoc,
        selectedDesign,
        existingBlueprint,
        prompt,
      })

      return NextResponse.json({
        ...buildGeneratedApp(blueprint),
      })
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

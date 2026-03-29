import { NextRequest, NextResponse } from "next/server"

import {
  isMessageChannel,
  readJsonBody,
} from "@/lib/backend/http"
import { appendConversationMessage } from "@/lib/backend/service"
import { requireProjectAccess } from "@/lib/server/project-auth"
import type { MessageChannel } from "@/lib/backend/types"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const access = await requireProjectAccess(request)
  if (!access.ok) return access.response

  const payload = await readJsonBody(request)
  if (!payload.ok) return payload.response

  const body = payload.data as {
    channel: MessageChannel
    author: string
    text: string
  }

  if (!isMessageChannel(body.channel)) {
    return NextResponse.json({ error: "A valid message channel is required." }, { status: 400 })
  }

  if (typeof body.author !== "string" || !body.author.trim()) {
    return NextResponse.json({ error: "Author is required." }, { status: 400 })
  }

  if (typeof body.text !== "string" || !body.text.trim()) {
    return NextResponse.json({ error: "Message text is required." }, { status: 400 })
  }

  return NextResponse.json(await appendConversationMessage({ ...body, projectId: access.projectId }))
}

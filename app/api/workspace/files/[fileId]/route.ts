import { NextRequest, NextResponse } from "next/server"

import { readJsonBody } from "@/lib/backend/http"
import { updateWorkspaceFile } from "@/lib/backend/service"
import { requireProjectAccess } from "@/lib/server/project-auth"

export const runtime = "nodejs"

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ fileId: string }> }
) {
  const access = await requireProjectAccess(request)
  if (!access.ok) return access.response

  const { fileId } = await context.params
  const payload = await readJsonBody(request)
  if (!payload.ok) return payload.response

  const body = payload.data as { content?: string }

  if (typeof body.content !== "string") {
    return NextResponse.json({ error: "File content must be a string." }, { status: 400 })
  }

  return NextResponse.json(await updateWorkspaceFile(access.projectId, fileId, body.content))
}

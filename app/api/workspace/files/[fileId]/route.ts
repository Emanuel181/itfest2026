import { NextRequest, NextResponse } from "next/server"

import { getProjectIdFromRequest, invalidProjectResponse, readJsonBody } from "@/lib/backend/http"
import { updateWorkspaceFile } from "@/lib/backend/service"

export const runtime = "nodejs"

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ fileId: string }> }
) {
  const projectId = getProjectIdFromRequest(request)
  if (!projectId) return invalidProjectResponse()

  const { fileId } = await context.params
  const payload = await readJsonBody(request)
  if (!payload.ok) return payload.response

  const body = payload.data as { content?: string }

  if (typeof body.content !== "string") {
    return NextResponse.json({ error: "File content must be a string." }, { status: 400 })
  }

  return NextResponse.json(await updateWorkspaceFile(projectId, fileId, body.content))
}

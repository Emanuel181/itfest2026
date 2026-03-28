import { NextRequest, NextResponse } from "next/server"

import { getProjectIdFromRequest, invalidProjectResponse, readJsonBody } from "@/lib/backend/http"
import { createWorkspaceFolder } from "@/lib/backend/service"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const projectId = getProjectIdFromRequest(request)
  if (!projectId) return invalidProjectResponse()

  const payload = await readJsonBody(request)
  if (!payload.ok) return payload.response

  const body = payload.data as { parentPath?: string; name?: string }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Folder name is required." }, { status: 400 })
  }

  return NextResponse.json(await createWorkspaceFolder(projectId, body.parentPath ?? "", body.name))
}

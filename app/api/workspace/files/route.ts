import { NextRequest, NextResponse } from "next/server"

import { getProjectIdFromRequest, invalidProjectResponse, readJsonBody } from "@/lib/backend/http"
import { createWorkspaceFile, getProject, selectWorkspaceFile } from "@/lib/backend/service"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const projectId = getProjectIdFromRequest(request)
  if (!projectId) return invalidProjectResponse()

  const project = await getProject(projectId)
  return NextResponse.json(project.workspace)
}

export async function POST(request: NextRequest) {
  const projectId = getProjectIdFromRequest(request)
  if (!projectId) return invalidProjectResponse()

  const payload = await readJsonBody(request)
  if (!payload.ok) return payload.response

  const body = payload.data as { parentPath?: string; name?: string; selectedFileId?: string }

  if (body.selectedFileId) {
    return NextResponse.json(await selectWorkspaceFile(projectId, body.selectedFileId))
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "File name is required." }, { status: 400 })
  }

  return NextResponse.json(await createWorkspaceFile(projectId, body.parentPath ?? "", body.name))
}

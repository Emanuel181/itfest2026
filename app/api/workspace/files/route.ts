import { NextRequest, NextResponse } from "next/server"

import { readJsonBody } from "@/lib/backend/http"
import { createWorkspaceFile, getProject, selectWorkspaceFile } from "@/lib/backend/service"
import { requireProjectAccess } from "@/lib/server/project-auth"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const access = await requireProjectAccess(request)
  if (!access.ok) return access.response

  const project = await getProject(access.projectId)
  return NextResponse.json(project.workspace)
}

export async function POST(request: NextRequest) {
  const access = await requireProjectAccess(request)
  if (!access.ok) return access.response

  const payload = await readJsonBody(request)
  if (!payload.ok) return payload.response

  const body = payload.data as { parentPath?: string; name?: string; selectedFileId?: string }

  if (body.selectedFileId) {
    return NextResponse.json(await selectWorkspaceFile(access.projectId, body.selectedFileId))
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "File name is required." }, { status: 400 })
  }

  return NextResponse.json(await createWorkspaceFile(access.projectId, body.parentPath ?? "", body.name))
}

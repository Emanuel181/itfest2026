import { NextRequest, NextResponse } from "next/server"

import { readJsonBody } from "@/lib/backend/http"
import { createWorkspaceFolder } from "@/lib/backend/service"
import { requireProjectAccess } from "@/lib/server/project-auth"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const access = await requireProjectAccess(request)
  if (!access.ok) return access.response

  const payload = await readJsonBody(request)
  if (!payload.ok) return payload.response

  const body = payload.data as { parentPath?: string; name?: string }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Folder name is required." }, { status: 400 })
  }

  return NextResponse.json(await createWorkspaceFolder(access.projectId, body.parentPath ?? "", body.name))
}

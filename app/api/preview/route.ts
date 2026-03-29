import { NextRequest } from "next/server"

import { buildProjectPreviewDocument } from "@/lib/backend/preview"
import { getProject } from "@/lib/backend/service"
import { requireProjectAccess } from "@/lib/server/project-auth"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const access = await requireProjectAccess(request)
  if (!access.ok) return access.response

  const project = await getProject(access.projectId)
  const html = await buildProjectPreviewDocument(project)

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  })
}

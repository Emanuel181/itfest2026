import { NextRequest } from "next/server"

import { getProjectIdFromRequest, invalidProjectResponse } from "@/lib/backend/http"
import { buildProjectPreviewDocument } from "@/lib/backend/preview"
import { getProject } from "@/lib/backend/service"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const projectId = getProjectIdFromRequest(request)
  if (!projectId) return invalidProjectResponse()

  const project = await getProject(projectId)
  const html = await buildProjectPreviewDocument(project)

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  })
}

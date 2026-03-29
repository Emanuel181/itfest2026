import { NextRequest, NextResponse } from "next/server"

import {
  getProjectIdFromRequest,
  invalidProjectResponse,
  isStageKey,
  readJsonBody,
} from "@/lib/backend/http"
import {
  generateBacklog,
  generateDocumentationFromConversation,
  generateMaintenanceReview,
  generateRequirements,
  getProject,
  resetProject,
  runMerge,
  saveStoryPlanning,
  saveStoryVariants,
  selectStoryVariant,
  transitionStage,
  updateBrief,
} from "@/lib/backend/service"
import type { BriefState, StageKey, StoryVariant } from "@/lib/backend/types"

export const runtime = "nodejs"
export const maxDuration = 180

export async function GET(request: NextRequest) {
  const projectId = getProjectIdFromRequest(request)
  if (!projectId) return invalidProjectResponse()

  return NextResponse.json(await getProject(projectId))
}

export async function PATCH(request: NextRequest) {
  const projectId = getProjectIdFromRequest(request)
  if (!projectId) return invalidProjectResponse()

  const payload = await readJsonBody(request)
  if (!payload.ok) return payload.response

  const body = payload.data as
    | { type: "transition-stage"; stage: StageKey; detail?: string }
    | { type: "update-brief"; brief: BriefState }
    | { type: "generate-documentation-from-conversation" }
    | { type: "generate-requirements" }
    | { type: "generate-backlog" }
    | { type: "save-story-planning"; storyId: string; storyPoints: number; pokerHistory: string[]; pokerConsensus: string }
    | { type: "save-story-variants"; storyId: string; variants: StoryVariant[] }
    | { type: "select-variant"; storyId: string; variantId: string }
    | { type: "run-merge" }
    | { type: "generate-maintenance-review" }
    | { type: "reset-project" }

  switch (body.type) {
    case "transition-stage":
      if (!isStageKey(body.stage)) {
        return NextResponse.json({ error: "A valid stage is required." }, { status: 400 })
      }
      return NextResponse.json(await transitionStage(projectId, body.stage, body.detail))
    case "update-brief":
      return NextResponse.json(await updateBrief(projectId, body.brief))
    case "generate-documentation-from-conversation":
      return NextResponse.json(await generateDocumentationFromConversation(projectId))
    case "generate-requirements":
      return NextResponse.json(await generateRequirements(projectId))
    case "generate-backlog":
      return NextResponse.json(await generateBacklog(projectId))
    case "save-story-planning":
      return NextResponse.json(
        await saveStoryPlanning(projectId, body.storyId, body.storyPoints, body.pokerHistory, body.pokerConsensus)
      )
    case "save-story-variants":
      return NextResponse.json(await saveStoryVariants(projectId, body.storyId, body.variants))
    case "select-variant":
      if (typeof body.storyId !== "string" || !body.storyId.trim()) {
        return NextResponse.json({ error: "storyId is required." }, { status: 400 })
      }
      if (typeof body.variantId !== "string" || !body.variantId.trim()) {
        return NextResponse.json({ error: "variantId is required." }, { status: 400 })
      }
      return NextResponse.json(await selectStoryVariant(projectId, body.storyId, body.variantId))
    case "run-merge":
      return NextResponse.json(await runMerge(projectId))
    case "generate-maintenance-review":
      return NextResponse.json(await generateMaintenanceReview(projectId))
    case "reset-project":
      return NextResponse.json(await resetProject(projectId))
    default:
      return NextResponse.json({ error: "Unsupported project action." }, { status: 400 })
  }
}

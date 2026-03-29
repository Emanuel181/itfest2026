import { NextRequest, NextResponse } from "next/server"

import {
  isStageKey,
  readJsonBody,
} from "@/lib/backend/http"
import {
  approveSecurityReview,
  generateRequirements,
  generateFeatures,
  generateDocumentationFromConversation,
  generateCode,
  generateProjectReview,
  generateSecurityReview,
  runFullPipeline,
  runMerge,
  generateUserStories,
  getProject,
  markPreviewGenerated,
  openPreviewWindow,
  regenerateWorkspace,
  resetProject,
  selectFeature,
  selectStory,
  selectStoryVariant,
  transitionStage,
  updateBrief,
} from "@/lib/backend/service"
import { requireProjectAccess } from "@/lib/server/project-auth"
import type { BriefState, StageKey } from "@/lib/backend/types"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const access = await requireProjectAccess(request)
  if (!access.ok) return access.response

  return NextResponse.json(await getProject(access.projectId))
}

export async function PATCH(request: NextRequest) {
  const access = await requireProjectAccess(request)
  if (!access.ok) return access.response

  const payload = await readJsonBody(request)
  if (!payload.ok) return payload.response

  const body = payload.data as
    | { type: "transition-stage"; stage: StageKey; detail?: string }
    | {
        type: "update-brief"
        brief: BriefState
        productDocumentation?: string
        technicalDocumentation?: string
      }
    | { type: "generate-documentation-from-conversation" }
    | { type: "generate-requirements" }
    | { type: "generate-features" }
    | { type: "run-full-pipeline" }
    | { type: "select-feature"; featureId: string }
    | { type: "generate-user-stories" }
    | { type: "select-story"; storyId: string }
    | { type: "select-variant"; storyId: string; variantId: string }
    | { type: "generate-code"; storyId?: string }
    | { type: "generate-security-review" }
    | { type: "approve-security-review" }
    | { type: "run-merge" }
    | { type: "generate-project-review" }
    | { type: "regenerate-workspace" }
    | { type: "generate-preview" }
    | { type: "open-preview" }
    | {
        type: "sync-legacy-state"
        legacyState?: Record<string, unknown>
        legacyPoker?: Record<string, unknown>
        replaceLegacyState?: boolean
        replaceLegacyPoker?: boolean
      }
    | { type: "reset-project" }

  switch (body.type) {
    case "transition-stage":
      if (!isStageKey(body.stage)) {
        return NextResponse.json({ error: "A valid stage is required." }, { status: 400 })
      }
      return NextResponse.json(await transitionStage(access.projectId, body.stage, body.detail))
    case "update-brief":
      return NextResponse.json(
        await updateBrief(access.projectId, body.brief, {
          productDocumentation: body.productDocumentation,
          technicalDocumentation: body.technicalDocumentation,
        })
      )
    case "generate-documentation-from-conversation":
      return NextResponse.json(await generateDocumentationFromConversation(access.projectId))
    case "generate-requirements":
      return NextResponse.json(await generateRequirements(access.projectId))
    case "generate-features":
      return NextResponse.json(await generateFeatures(access.projectId))
    case "run-full-pipeline":
      return NextResponse.json(await runFullPipeline(access.projectId))
    case "select-feature":
      if (typeof body.featureId !== "string" || !body.featureId.trim()) {
        return NextResponse.json({ error: "featureId is required." }, { status: 400 })
      }
      return NextResponse.json(await selectFeature(access.projectId, body.featureId))
    case "generate-user-stories":
      return NextResponse.json(await generateUserStories(access.projectId))
    case "select-story":
      if (typeof body.storyId !== "string" || !body.storyId.trim()) {
        return NextResponse.json({ error: "storyId is required." }, { status: 400 })
      }
      return NextResponse.json(await selectStory(access.projectId, body.storyId))
    case "select-variant":
      if (typeof body.storyId !== "string" || !body.storyId.trim()) {
        return NextResponse.json({ error: "storyId is required." }, { status: 400 })
      }
      if (typeof body.variantId !== "string" || !body.variantId.trim()) {
        return NextResponse.json({ error: "variantId is required." }, { status: 400 })
      }
      return NextResponse.json(await selectStoryVariant(access.projectId, body.storyId, body.variantId))
    case "generate-code":
      return NextResponse.json(await generateCode(access.projectId, body.storyId))
    case "generate-security-review":
      return NextResponse.json(await generateSecurityReview(access.projectId))
    case "approve-security-review":
      return NextResponse.json(await approveSecurityReview(access.projectId))
    case "run-merge":
      return NextResponse.json(await runMerge(access.projectId))
    case "generate-project-review":
      return NextResponse.json(await generateProjectReview(access.projectId))
    case "regenerate-workspace":
      return NextResponse.json(await regenerateWorkspace(access.projectId))
    case "generate-preview":
      return NextResponse.json(await markPreviewGenerated(access.projectId))
    case "open-preview":
      return NextResponse.json(await openPreviewWindow(access.projectId))
    case "sync-legacy-state":
      return NextResponse.json(
        await updateBrief(access.projectId, undefined, {
          legacyState: body.legacyState,
          legacyPoker: body.legacyPoker,
          replaceLegacyState: body.replaceLegacyState,
          replaceLegacyPoker: body.replaceLegacyPoker,
          silent: true,
        })
      )
    case "reset-project":
      return NextResponse.json(await resetProject(access.projectId))
    default:
      return NextResponse.json({ error: "Unsupported project action." }, { status: 400 })
  }
}

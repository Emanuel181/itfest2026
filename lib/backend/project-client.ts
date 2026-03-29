import type { ProjectState } from "@/lib/backend/types"
import type { StoredChatMessage, StoredIdeState } from "@/lib/code-viewer/virtual-files"

export function getProjectIdFromCurrentUrl() {
  if (typeof window === "undefined") return ""

  const url = new URL(window.location.href)
  return url.searchParams.get("project") ?? ""
}

export function withOptionalProjectQuery(path: string, projectId: string) {
  if (!projectId) return path

  const separator = path.includes("?") ? "&" : "?"
  return `${path}${separator}project=${encodeURIComponent(projectId)}`
}

export async function syncLegacySnapshots(input: {
  projectId: string
  legacyState?: Record<string, unknown>
  legacyPoker?: Record<string, unknown>
  replaceLegacyState?: boolean
  replaceLegacyPoker?: boolean
}) {
  if (!input.projectId) return

  await fetch(`/api/project?project=${encodeURIComponent(input.projectId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "sync-legacy-state",
      legacyState: input.legacyState,
      legacyPoker: input.legacyPoker,
      replaceLegacyState: input.replaceLegacyState,
      replaceLegacyPoker: input.replaceLegacyPoker,
    }),
  }).catch(() => undefined)
}

export async function fetchProjectSnapshot(projectId: string) {
  if (!projectId) return null

  const response = await fetch(`/api/project?project=${encodeURIComponent(projectId)}`, {
    cache: "no-store",
  }).catch(() => null)

  if (!response?.ok) return null
  return (await response.json()) as ProjectState
}

export function buildStoredIdeStateFromProject(project: ProjectState | null): StoredIdeState {
  const legacyState = (project?.legacyState ?? {}) as Record<string, unknown>

  return {
    productDocumentation:
      (typeof project?.productDocumentation === "string" && project.productDocumentation.trim()
        ? project.productDocumentation
        : typeof legacyState.productDocumentation === "string"
          ? legacyState.productDocumentation
          : "") || "",
    technicalDocumentation:
      (typeof project?.technicalDocumentation === "string" && project.technicalDocumentation.trim()
        ? project.technicalDocumentation
        : typeof legacyState.technicalDocumentation === "string"
          ? legacyState.technicalDocumentation
          : "") || "",
    requirements:
      (Array.isArray(project?.requirements) && project.requirements.length > 0
        ? project.requirements
        : Array.isArray(legacyState.requirements)
          ? legacyState.requirements
          : []) || [],
    stories:
      (Array.isArray(project?.userStories) && project.userStories.length > 0
        ? project.userStories
        : Array.isArray(legacyState.stories)
          ? legacyState.stories
          : []) || [],
    reasoningContent:
      legacyState.reasoningContent && typeof legacyState.reasoningContent === "object"
        ? (legacyState.reasoningContent as Record<string, string>)
        : {},
    evalContent:
      legacyState.evalContent && typeof legacyState.evalContent === "object"
        ? (legacyState.evalContent as Record<string, string>)
        : {},
    chatMessages:
      legacyState.chatMessages && typeof legacyState.chatMessages === "object"
        ? (legacyState.chatMessages as Record<string, StoredChatMessage[]>)
        : {},
    noFrontend:
      legacyState.noFrontend && typeof legacyState.noFrontend === "object"
        ? (legacyState.noFrontend as Record<string, boolean>)
        : {},
  }
}

export async function hydrateLegacySnapshots(projectId: string) {
  const project = await fetchProjectSnapshot(projectId)
  if (!project) return null

  const legacyState = project.legacyState ?? {}
  const ideState = buildStoredIdeStateFromProject(project)
  const requirements =
    Array.isArray(ideState.requirements) && ideState.requirements.length > 0 ? ideState.requirements : undefined
  const userStories =
    Array.isArray(ideState.stories) && ideState.stories.length > 0 ? ideState.stories : undefined
  const productDocumentation =
    typeof ideState.productDocumentation === "string" && ideState.productDocumentation.trim()
      ? ideState.productDocumentation
      : undefined
  const technicalDocumentation =
    typeof ideState.technicalDocumentation === "string" && ideState.technicalDocumentation.trim()
      ? ideState.technicalDocumentation
      : undefined

  return {
    project,
    ideState,
    legacyState,
    legacyPoker: project.legacyPoker ?? {},
    productDocumentation,
    technicalDocumentation,
    requirements,
    userStories,
  }
}

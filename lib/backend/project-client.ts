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
}) {
  if (!input.projectId) return

  await fetch(`/api/project?project=${encodeURIComponent(input.projectId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "sync-legacy-state",
      legacyState: input.legacyState,
      legacyPoker: input.legacyPoker,
    }),
  }).catch(() => undefined)
}

export async function hydrateLegacySnapshots(projectId: string) {
  if (!projectId) return null

  const response = await fetch(`/api/project?project=${encodeURIComponent(projectId)}`, {
    cache: "no-store",
  }).catch(() => null)

  if (!response?.ok) return null
  const project = (await response.json()) as {
    legacyState?: Record<string, unknown>
    legacyPoker?: Record<string, unknown>
    productDocumentation?: string
    technicalDocumentation?: string
    requirements?: unknown[]
    userStories?: unknown[]
  }
  const legacyState = project.legacyState ?? {}
  const requirements =
    Array.isArray(project.requirements) && project.requirements.length > 0
      ? project.requirements
      : Array.isArray(legacyState.requirements)
        ? legacyState.requirements
        : undefined
  const userStories =
    Array.isArray(project.userStories) && project.userStories.length > 0
      ? project.userStories
      : Array.isArray(legacyState.stories)
        ? legacyState.stories
        : undefined
  const productDocumentation =
    typeof project.productDocumentation === "string" && project.productDocumentation.trim()
      ? project.productDocumentation
      : typeof legacyState.productDocumentation === "string"
        ? legacyState.productDocumentation
        : undefined
  const technicalDocumentation =
    typeof project.technicalDocumentation === "string" && project.technicalDocumentation.trim()
      ? project.technicalDocumentation
      : typeof legacyState.technicalDocumentation === "string"
        ? legacyState.technicalDocumentation
        : undefined

  return {
    legacyState,
    legacyPoker: project.legacyPoker ?? {},
    productDocumentation,
    technicalDocumentation,
    requirements,
    userStories,
  }
}

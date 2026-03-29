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

  return {
    legacyState: project.legacyState ?? {},
    legacyPoker: project.legacyPoker ?? {},
    productDocumentation: project.productDocumentation,
    technicalDocumentation: project.technicalDocumentation,
    requirements: project.requirements,
    userStories: project.userStories,
  }
}

import type { UserStory } from "@/lib/agents/types"

export type StoredChatMessage = {
  id: string
  role: "user" | "agent"
  content: string
  timestamp: string
}

export type StoredIdeState = {
  productDocumentation?: string
  technicalDocumentation?: string
  requirements?: unknown[]
  stories?: UserStory[]
  reasoningContent?: Record<string, string>
  evalContent?: Record<string, string>
  chatMessages?: Record<string, StoredChatMessage[]>
  noFrontend?: Record<string, boolean>
}

export type VirtualFile = {
  path: string
  content: string
  kind: "code" | "json" | "markdown" | "text"
  origin: "documentation" | "requirements" | "story" | "variant" | "merge" | "report" | "system"
}

export type VirtualFileBuildResult = {
  files: VirtualFile[]
  storyCount: number
  variantCount: number
  selectedVariantCount: number
}

function parseDocument(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null

  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function detectKind(path: string): VirtualFile["kind"] {
  if (path.endsWith(".ts") || path.endsWith(".tsx") || path.endsWith(".js") || path.endsWith(".jsx")) return "code"
  if (path.endsWith(".json")) return "json"
  if (path.endsWith(".md")) return "markdown"
  return "text"
}

function addFile(files: VirtualFile[], path: string, content: string, origin: VirtualFile["origin"]) {
  files.push({
    path,
    content,
    kind: detectKind(path),
    origin,
  })
}

function buildReadme(stories: UserStory[], selectedCount: number) {
  if (stories.length === 0) {
    return [
      "# AI Workspace",
      "",
      "No generated implementation files are available yet.",
      "",
      "Use the live generation flow or one of the mock buttons in the SDLC steps, then refresh this view.",
    ].join("\n")
  }

  return [
    "# AI Workspace",
    "",
    `Stories available: ${stories.length}`,
    `Selected variants: ${selectedCount}`,
    "",
    "This workspace view is reconstructed from the AI generation state stored by the application.",
    "",
    "Included artifacts:",
    "- product and technical docs when available",
    "- requirements and story metadata",
    "- orchestrator, backend, frontend, security, reasoning, and evaluator outputs",
    "- merged preview files for selected variants",
  ].join("\n")
}

function buildMergedFiles(stories: UserStory[]) {
  const selectedStories = stories.filter((story) => story.chosenVariant)
  if (selectedStories.length === 0) return []

  const files: VirtualFile[] = []
  const selectedSummary = selectedStories.map((story) => ({
    id: story.id,
    title: story.title,
    chosenVariant: story.chosenVariant,
  }))

  addFile(
    files,
    "package.json",
    JSON.stringify(
      {
        name: "ai-generated-workspace",
        private: true,
        dependencies: {
          next: "^16.0.0",
          react: "^19.0.0",
          "react-dom": "^19.0.0",
        },
      },
      null,
      2
    ),
    "merge"
  )

  addFile(
    files,
    "src/app/layout.tsx",
    `export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}`,
    "merge"
  )

  addFile(
    files,
    "src/app/page.tsx",
    `const mergedStories = ${JSON.stringify(selectedSummary, null, 2)}

export default function Page() {
  return (
    <main style={{ padding: 32, fontFamily: "ui-sans-serif, system-ui" }}>
      <h1>AI Generated Project</h1>
      <p>${selectedStories.length} selected stories are ready for preview.</p>
      <ul>
        {mergedStories.map((story) => (
          <li key={story.id}>
            {story.id}: {story.title} ({story.chosenVariant})
          </li>
        ))}
      </ul>
    </main>
  )
}`,
    "merge"
  )

  addFile(files, "reports/selected-variants.json", JSON.stringify(selectedSummary, null, 2), "merge")

  for (const story of selectedStories) {
    const variant = story.variants.find((item) => item.id === story.chosenVariant)
    if (!variant) continue

    if (variant.backend.content.trim()) {
      addFile(files, `src/merged/${story.id}/backend.ts`, variant.backend.content, "merge")
    }

    if (variant.frontend.content.trim()) {
      addFile(files, `src/merged/${story.id}/frontend.tsx`, variant.frontend.content, "merge")
    }
  }

  return files
}

export function buildVirtualFilesFromState(state: StoredIdeState | null | undefined): VirtualFileBuildResult {
  const files: VirtualFile[] = []
  const productDoc = parseDocument(state?.productDocumentation)
  const technicalDoc = parseDocument(state?.technicalDocumentation)
  const requirements = Array.isArray(state?.requirements) ? state?.requirements : []
  const stories = Array.isArray(state?.stories) ? state?.stories : []
  const reasoningContent = state?.reasoningContent ?? {}
  const evalContent = state?.evalContent ?? {}
  const chatMessages = state?.chatMessages ?? {}
  const noFrontend = state?.noFrontend ?? {}

  addFile(files, "README.md", buildReadme(stories, stories.filter((story) => story.chosenVariant).length), "system")

  if (productDoc) {
    addFile(files, "docs/product-documentation.json", JSON.stringify(productDoc, null, 2), "documentation")
  }

  if (technicalDoc) {
    addFile(files, "docs/technical-documentation.json", JSON.stringify(technicalDoc, null, 2), "documentation")
  }

  if (requirements.length > 0) {
    addFile(files, "analysis/requirements.json", JSON.stringify(requirements, null, 2), "requirements")
  }

  if (stories.length > 0) {
    addFile(
      files,
      "backlog/user-stories.json",
      JSON.stringify(
        stories.map((story) => ({
          id: story.id,
          title: story.title,
          status: story.status,
          chosenVariant: story.chosenVariant ?? null,
          priority: story.priority ?? null,
          type: story.type ?? null,
        })),
        null,
        2
      ),
      "story"
    )
  }

  for (const story of stories) {
    addFile(
      files,
      `stories/${story.id}/story.json`,
      JSON.stringify(
        {
          id: story.id,
          reqId: story.reqId,
          title: story.title,
          description: story.description,
          status: story.status,
          chosenVariant: story.chosenVariant ?? null,
          labels: story.labels ?? [],
          acceptanceCriteria: story.acceptanceCriteria ?? [],
          notes: story.notes ?? "",
        },
        null,
        2
      ),
      "story"
    )

    if (evalContent[story.id]) {
      addFile(files, `stories/${story.id}/evaluation.json`, evalContent[story.id], "report")
    }

    for (const variant of story.variants) {
      const variantBase = `src/generated/${story.id}/${variant.id}`
      const key = `${story.id}:${variant.id}`

      if (reasoningContent[key]?.trim()) {
        addFile(files, `${variantBase}/reasoning.md`, reasoningContent[key], "variant")
      }

      if (variant.orchestrator.content.trim()) {
        addFile(files, `${variantBase}/orchestrator.md`, variant.orchestrator.content, "variant")
      }

      if (variant.backend.content.trim()) {
        addFile(files, `${variantBase}/backend.ts`, variant.backend.content, "variant")
      }

      if (variant.frontend.content.trim()) {
        addFile(files, `${variantBase}/frontend.tsx`, variant.frontend.content, "variant")
      } else if (noFrontend[key]) {
        addFile(files, `${variantBase}/frontend.md`, "No frontend implementation required for this variant.", "variant")
      }

      if (variant.security.content.trim()) {
        addFile(files, `${variantBase}/security.md`, variant.security.content, "report")
      }

      if (chatMessages[key]?.length) {
        addFile(files, `${variantBase}/chat.json`, JSON.stringify(chatMessages[key], null, 2), "variant")
      }
    }
  }

  files.push(...buildMergedFiles(stories))

  files.sort((left, right) => left.path.localeCompare(right.path))

  return {
    files,
    storyCount: stories.length,
    variantCount: stories.reduce((count, story) => count + story.variants.length, 0),
    selectedVariantCount: stories.filter((story) => story.chosenVariant).length,
  }
}

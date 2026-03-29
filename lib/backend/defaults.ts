import type {
  ActivityEntry,
  AgentState,
  BriefState,
  Collaborator,
  MergeReport,
  ProjectState,
  ProjectHealthReport,
  Requirement,
  SecurityReport,
  StoryVariant,
  UserStory,
  WorkspaceFolder,
} from "@/lib/backend/types"

function nowIso() {
  return new Date().toISOString()
}

function stampId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function toSentenceLabel(value: string, fallback: string) {
  const cleaned = value.trim().replace(/[.:]/g, "")
  if (!cleaned) return fallback

  return cleaned
    .split(/\s+/)
    .slice(0, 6)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

function fallbackStoryVariants(story: Pick<UserStory, "id" | "title" | "summary" | "tradeoff" | "code">): StoryVariant[] {
  return [
    {
      id: `${story.id}-VAR-01`,
      label: "Variant 1",
      teamName: "Frontend + Backend + TL Alpha",
      focus: "Fast delivery with an integrated UI-first implementation path.",
      architecture: "Monolithic App Router flow with thin orchestration glue and compact data handling.",
      pros: ["Fastest implementation path", "Low coordination overhead", "Easy to review in one pass"],
      cons: ["Lower isolation between modules", "Harder to scale the workflow independently"],
      tradeoff: "Optimizes for delivery speed over long-term modularity.",
      code: story.code,
    },
    {
      id: `${story.id}-VAR-02`,
      label: "Variant 2",
      teamName: "Frontend + Backend + TL Beta",
      focus: "Balanced architecture with clearer orchestration boundaries.",
      architecture: "Layered UI, orchestration, and data modules with explicit approval checkpoints.",
      pros: ["Better maintainability", "Cleaner agent handoffs", "Good balance of speed and structure"],
      cons: ["More moving parts", "Slightly higher coordination cost"],
      tradeoff: "Balances delivery speed with maintainability for future iterations.",
      code: `${story.code}\nexport const implementationMode = "balanced"\n`,
    },
    {
      id: `${story.id}-VAR-03`,
      label: "Variant 3",
      teamName: "Frontend + Backend + TL Gamma",
      focus: "Modular implementation with stronger review and extension points.",
      architecture: "Componentized workspace with stronger separation between runtime data, views, and orchestration state.",
      pros: ["Strongest extensibility", "Cleaner long-term boundaries", "Review-friendly structure"],
      cons: ["Highest setup cost", "More abstraction for the initial story"],
      tradeoff: "Optimizes for extensibility and control instead of initial speed.",
      code: `${story.code}\nexport const implementationMode = "modular"\n`,
    },
  ]
}

function normalizeUserStories(userStories: UserStory[] | undefined): UserStory[] {
  if (!userStories) return []

  return userStories.map((story, index) => {
    const storyId = story.id || `US-${String(index + 1).padStart(2, "0")}`
    const normalizedBase: UserStory = {
      ...story,
      id: storyId,
      title: story.title ?? `Story ${index + 1}`,
      stack: story.stack ?? "Next.js + OpenAI",
      summary: story.summary ?? "",
      tradeoff: story.tradeoff ?? "",
      estimate: story.estimate ?? "M",
      complexityNote: story.complexityNote ?? "",
      dependencyIds: story.dependencyIds ?? [],
      previewTitle: story.previewTitle ?? "Preview",
      previewDescription: story.previewDescription ?? "",
      code: story.code ?? "",
      variants: [],
      selectedVariantId: "",
    }

    const variants =
      (story.variants ?? [])
        .map((variant, variantIndex) => ({
          ...variant,
          id: variant.id || `${storyId}-VAR-${String(variantIndex + 1).padStart(2, "0")}`,
          label: variant.label || `Variant ${variantIndex + 1}`,
          teamName: variant.teamName || `Team ${variantIndex + 1}`,
          focus: variant.focus || normalizedBase.summary,
          architecture: variant.architecture || normalizedBase.tradeoff,
          pros: variant.pros ?? [],
          cons: variant.cons ?? [],
          tradeoff: variant.tradeoff || normalizedBase.tradeoff,
          code: variant.code || normalizedBase.code,
        }))
        .slice(0, 3) ?? []

    const nextVariants = variants.length > 0 ? variants : fallbackStoryVariants(normalizedBase)
    const selectedVariantId =
      nextVariants.find((variant) => variant.id === story.selectedVariantId)?.id ?? nextVariants[0]?.id ?? ""

    return {
      ...normalizedBase,
      variants: nextVariants,
      selectedVariantId,
    }
  })
}

export function buildWorkspaceFolders(): WorkspaceFolder[] {
  return [
    { id: "folder-docs", name: "docs", path: "docs" },
    { id: "folder-specs", name: "specs", path: "specs" },
    { id: "folder-src", name: "src", path: "src" },
    { id: "folder-src-app", name: "app", path: "src/app" },
    { id: "folder-src-components", name: "components", path: "src/components" },
    { id: "folder-src-lib", name: "lib", path: "src/lib" },
  ]
}

export function createDefaultFileContent(path: string) {
  const name = path.split("/").filter(Boolean).pop() ?? path

  if (path.endsWith(".md")) return `# ${name.replace(/[-_]/g, " ")}\n`
  if (path.endsWith(".ts") || path.endsWith(".tsx")) {
    return `export const ${toSentenceLabel(name.replace(/\.[^.]+$/, ""), "newFile").replace(/\s+/g, "")} = {}\n`
  }
  if (path.endsWith(".json")) return "{\n  \n}\n"

  return ""
}

export function createDefaultBrief(): BriefState {
  return {
    title: "",
    objective: "",
    audience: [],
    scope: [],
    deliverables: [],
    risks: [],
    techStack: ["Next.js", "OpenAI"],
    dbSchema: "",
    architecture: "",
  }
}

export function createDefaultCollaborators(): Collaborator[] {
  return []
}

export function createDefaultRequirements(): Requirement[] {
  return []
}

export function createDefaultAgents(): AgentState[] {
  return [
    {
      id: "agent-business",
      name: "Business AI",
      specialty: "Brief synthesis",
      stage: "Conversation",
      status: "standby",
      goal: "Clarify business scope and generate approval-ready artifacts.",
      lastRunSummary: "Așteaptă brief-ul inițial.",
    },
    {
      id: "agent-tech",
      name: "Tech AI",
      specialty: "Architecture planning",
      stage: "Documentation",
      status: "standby",
      goal: "Translate approved requirements into implementation paths.",
      lastRunSummary: "Așteaptă detalii tehnice.",
    },
    {
      id: "agent-orchestrator",
      name: "Orchestrator Agent",
      specialty: "Flow coordination",
      stage: "Requirements",
      status: "queued",
      goal: "Coordinate generation between stages and preserve artifacts.",
      lastRunSummary: "Pregătit pentru primul handoff.",
    },
    {
      id: "agent-merge",
      name: "Merge Agent",
      specialty: "Integration planning",
      stage: "Merge",
      status: "queued",
      goal: "Prepare merge candidate and preview handoff.",
      lastRunSummary: "Nu există încă un workspace generat.",
    },
    {
      id: "agent-security",
      name: "Security Agent",
      specialty: "OWASP and risk review",
      stage: "Security Review",
      status: "queued",
      goal: "Identify security risks before merge and recommend fixes.",
      lastRunSummary: "Așteaptă codul final pentru review.",
    },
    {
      id: "agent-review",
      name: "Project Review Agent",
      specialty: "Health reporting",
      stage: "Project Review",
      status: "queued",
      goal: "Summarize progress, debt, and next actions after merge.",
      lastRunSummary: "Așteaptă primul merge complet.",
    },
  ]
}

export function createDefaultActivity(): ActivityEntry[] {
  return [
    {
      id: "activity-ready",
      title: "Project ready",
      detail: "Proiectul pornește gol. Completează brief-ul și generează artefactele din etapele următoare.",
      time: "Acum",
    },
  ]
}

export function createDefaultSecurityReport(): SecurityReport {
  return {
    status: "idle",
    summary: "Security review has not started yet.",
    issues: [],
  }
}

export function createDefaultMergeReport(): MergeReport {
  return {
    status: "idle",
    summary: "Merge & integration has not started yet.",
    mergedStoryIds: [],
    changelog: [],
  }
}

export function createDefaultProjectHealth(): ProjectHealthReport {
  return {
    status: "idle",
    summary: "Project review has not been generated yet.",
    progress: 0,
    coverage: "No merged stories yet.",
    technicalDebt: [],
    nextActions: [],
  }
}

export function createDefaultProjectState(projectId: string): ProjectState {
  const createdAt = nowIso()

  return {
    id: projectId,
    createdAt,
    updatedAt: createdAt,
    currentStage: "Conversation",
    search: "",
    brief: createDefaultBrief(),
    productDocumentation: "",
    technicalDocumentation: "",
    requirements: createDefaultRequirements(),
    features: [],
    selectedFeatureId: "",
    userStories: [],
    selectedStoryId: "",
    messages: {
      business: [],
      tech: [],
    },
    collaborators: createDefaultCollaborators(),
    agents: createDefaultAgents(),
    agentRuns: [],
    artifacts: [],
    activity: createDefaultActivity(),
    workspace: {
      folders: buildWorkspaceFolders(),
      files: [],
      selectedFileId: "",
      runtimeEntrypoints: ["src/app/layout.tsx", "src/app/page.tsx"],
    },
    securityReport: createDefaultSecurityReport(),
    mergeReport: createDefaultMergeReport(),
    projectHealth: createDefaultProjectHealth(),
    preview: {
      appGenerated: false,
      previewOpened: false,
      mode: "virtual-runtime",
    },
    legacyState: {},
    legacyPoker: {},
  }
}

function looksLikeLegacyDemo(project: ProjectState) {
  const legacyFeatureTitles = new Set([
    "Real-time Collaboration Engine",
    "Role-Based Audit & Approval",
    "Automated SDLC Generator",
  ])

  const hasLegacyFeature = project.features.some((feature) => legacyFeatureTitles.has(feature.title))
  const hasLegacyPreviewFile = project.workspace.files.some(
    (file) =>
      file.content.includes("Team Sprint Board") ||
      file.content.includes("A mocked test app for checking how code changes flow into the integrated preview.")
  )
  const hasLegacyMessages = [...project.messages.business, ...project.messages.tech].some(
    (message) =>
      message.text.includes("agențiile enterprise") ||
      message.text.includes("delay minim pe live-sync")
  )

  return project.id === "project-demo" || hasLegacyFeature || hasLegacyPreviewFile || hasLegacyMessages
}

export function normalizeProjectState(project: ProjectState, projectId: string): ProjectState {
  if (!looksLikeLegacyDemo(project)) {
    const fresh = createDefaultProjectState(projectId)

    return {
      ...fresh,
      ...project,
      search: project.search ?? fresh.search,
      brief: project.brief ?? fresh.brief,
      productDocumentation: project.productDocumentation ?? fresh.productDocumentation,
      technicalDocumentation: project.technicalDocumentation ?? fresh.technicalDocumentation,
      requirements: project.requirements ?? fresh.requirements,
      features: project.features ?? fresh.features,
      selectedFeatureId: project.selectedFeatureId ?? fresh.selectedFeatureId,
      userStories: normalizeUserStories(project.userStories ?? fresh.userStories),
      selectedStoryId: project.selectedStoryId ?? fresh.selectedStoryId,
      messages: {
        business: project.messages?.business ?? fresh.messages.business,
        tech: project.messages?.tech ?? fresh.messages.tech,
      },
      collaborators: project.collaborators ?? fresh.collaborators,
      agents: project.agents ?? fresh.agents,
      agentRuns: project.agentRuns ?? fresh.agentRuns,
      artifacts: project.artifacts ?? fresh.artifacts,
      activity: project.activity ?? fresh.activity,
      securityReport: project.securityReport ?? fresh.securityReport,
      mergeReport: project.mergeReport ?? fresh.mergeReport,
      projectHealth: project.projectHealth ?? fresh.projectHealth,
      preview: {
        ...fresh.preview,
        ...project.preview,
      },
      legacyState: project.legacyState ?? fresh.legacyState,
      legacyPoker: project.legacyPoker ?? fresh.legacyPoker,
      workspace: {
        ...fresh.workspace,
        ...project.workspace,
        folders:
          (project.workspace?.folders ?? []).length > 0
            ? project.workspace.folders
            : buildWorkspaceFolders(),
        files: project.workspace?.files ?? fresh.workspace.files,
        selectedFileId: project.workspace?.selectedFileId ?? fresh.workspace.selectedFileId,
        runtimeEntrypoints:
          (project.workspace?.runtimeEntrypoints ?? []).length > 0
            ? project.workspace.runtimeEntrypoints
            : ["src/app/layout.tsx", "src/app/page.tsx"],
      },
    }
  }

  const fresh = createDefaultProjectState(projectId)

  return {
    ...fresh,
    id: projectId,
    createdAt: project.createdAt || fresh.createdAt,
    updatedAt: nowIso(),
    currentStage:
      project.brief.title.trim() || project.brief.objective.trim() ? "Documentation" : "Conversation",
    search: project.search ?? "",
    brief: project.brief ?? fresh.brief,
    requirements: project.requirements ?? fresh.requirements,
    userStories: normalizeUserStories(project.userStories ?? fresh.userStories),
    collaborators: project.collaborators ?? fresh.collaborators,
    agents: (project.agents ?? []).length > 0 ? project.agents : fresh.agents,
    agentRuns: project.agentRuns ?? fresh.agentRuns,
    artifacts: project.artifacts ?? fresh.artifacts,
    activity: [
      {
        id: stampId("activity"),
        title: "Legacy demo migrated",
        detail: "Am eliminat artefactele mock vechi și am păstrat brief-ul pentru generare reală.",
        time: "Acum",
      },
      ...fresh.activity,
    ],
    legacyState: project.legacyState ?? fresh.legacyState,
    legacyPoker: project.legacyPoker ?? fresh.legacyPoker,
  }
}

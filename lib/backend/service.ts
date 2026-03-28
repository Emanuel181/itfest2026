import {
  buildWorkspaceFolders,
  createDefaultFileContent,
  createDefaultProjectState,
} from "@/lib/backend/defaults"
import {
  generateFeaturesFromBrief,
  generateBriefFromConversation,
  generateOpenAIReply,
  generateStoriesFromFeature,
  generateWorkspaceScaffold,
} from "@/lib/backend/openai"
import { validateProjectPreview } from "@/lib/backend/preview"
import { readProjectState, updateProjectState } from "@/lib/backend/store"
import type {
  ActivityEntry,
  BriefState,
  Message,
  MessageChannel,
  AgentRun,
  OrchestrationArtifact,
  ProjectState,
  ProjectHealthReport,
  Requirement,
  SecurityIssue,
  StageKey,
  WorkspaceFile,
  WorkspaceFolder,
} from "@/lib/backend/types"

function stampId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function nowIso() {
  return new Date().toISOString()
}

function nowLabel() {
  return "Acum"
}

function touch(project: ProjectState) {
  return { ...project, updatedAt: new Date().toISOString() }
}

function appendActivity(project: ProjectState, title: string, detail: string) {
  const entry: ActivityEntry = {
    id: stampId("activity"),
    title,
    detail,
    time: nowLabel(),
  }

  return touch({
    ...project,
    activity: [entry, ...project.activity],
  })
}

function updateAgentSummary(project: ProjectState, agentId: string, summary: string, status?: ProjectState["agents"][number]["status"]) {
  return {
    ...project,
    agents: project.agents.map((agent) =>
      agent.id === agentId
        ? {
            ...agent,
            lastRunSummary: summary,
            status: status ?? agent.status,
          }
        : agent
    ),
  }
}

function getSelectedFeature(project: ProjectState) {
  return project.features.find((item) => item.id === project.selectedFeatureId) ?? project.features[0]
}

function getSelectedStory(project: ProjectState) {
  return project.userStories.find((item) => item.id === project.selectedStoryId) ?? project.userStories[0]
}

function getSelectedVariant(project: ProjectState, story?: ProjectState["userStories"][number]) {
  const activeStory = story ?? getSelectedStory(project)
  if (!activeStory) return undefined

  return activeStory.variants.find((item) => item.id === activeStory.selectedVariantId) ?? activeStory.variants[0]
}

function getWorkspaceName(path: string) {
  const parts = path.split("/").filter(Boolean)
  return parts[parts.length - 1] ?? path
}

function joinWorkspacePath(parentPath: string, name: string) {
  return [parentPath, name].filter(Boolean).join("/")
}

function getAncestorFolderPaths(path: string) {
  const parts = path.split("/").filter(Boolean)
  const parentSegments = parts.slice(0, -1)
  const folders: string[] = []

  for (let index = 0; index < parentSegments.length; index += 1) {
    folders.push(parentSegments.slice(0, index + 1).join("/"))
  }

  return folders
}

function ensureFolders(paths: string[], existingFolders: WorkspaceFolder[]) {
  const foldersByPath = new Map(existingFolders.map((folder) => [folder.path, folder]))
  let addedCount = 0

  for (const path of paths) {
    if (!path || foldersByPath.has(path)) continue

    const folder: WorkspaceFolder = {
      id: stampId("folder"),
      name: getWorkspaceName(path),
      path,
    }
    foldersByPath.set(path, folder)
    addedCount += 1
  }

  return {
    folders: [...foldersByPath.values()].sort((left, right) => left.path.localeCompare(right.path)),
    addedCount,
  }
}

function isBriefReadyForFeatureGeneration(brief: BriefState) {
  return Boolean(brief.title.trim() && brief.objective.trim())
}

function createRequirementsFromBrief(brief: BriefState): Requirement[] {
  const scopedRequirements: Requirement[] = brief.scope.map((item, index) => ({
    id: `REQ-F-${String(index + 1).padStart(2, "0")}`,
    title: item || `Functional requirement ${index + 1}`,
    detail: "Derived from the approved product scope.",
    kind: "functional",
    status: "approved",
    featureIds: [],
    storyIds: [],
  }))

  const deliveryRequirements: Requirement[] = brief.deliverables.map((item, index) => ({
    id: `REQ-D-${String(index + 1).padStart(2, "0")}`,
    title: item || `Deliverable requirement ${index + 1}`,
    detail: "Must produce a reviewable implementation artifact.",
    kind: "functional",
    status: "derived",
    featureIds: [],
    storyIds: [],
  }))

  const riskRequirements: Requirement[] = brief.risks.map((item, index) => ({
    id: `REQ-NF-${String(index + 1).padStart(2, "0")}`,
    title: item || `Non-functional requirement ${index + 1}`,
    detail: "Tracked as a quality or delivery risk that affects implementation planning.",
    kind: "non-functional",
    status: "draft",
    featureIds: [],
    storyIds: [],
  }))

  return [...scopedRequirements, ...deliveryRequirements, ...riskRequirements]
}

function createSecurityIssues(project: ProjectState): SecurityIssue[] {
  const joinedRequirementText = project.requirements.map((requirement) => `${requirement.title} ${requirement.detail}`).join(" ")
  const workspaceText = project.workspace.files.map((file) => `${file.path}\n${file.content}`).join("\n")
  const lowerWorkspace = workspaceText.toLowerCase()
  const lowerRequirements = joinedRequirementText.toLowerCase()
  const lowerBrief = [
    project.brief.title,
    project.brief.objective,
    ...project.brief.scope,
    ...project.brief.deliverables,
    ...project.brief.risks,
  ]
    .join(" ")
    .toLowerCase()

  const issues: SecurityIssue[] = []

  if (!/(auth|login|permission|role|access control|cognito)/.test(lowerRequirements + lowerBrief)) {
    issues.push({
      id: "SEC-01",
      title: "Authentication and authorization are not explicit in the implementation plan",
      severity: "high",
      detail: "Brief-ul și requirements-urile nu definesc clar controlul de acces pentru echipă și proiecte.",
      remediation: "Adaugă auth, roluri și project scoping explicit înainte de merge.",
      storyIds: project.selectedStoryId ? [project.selectedStoryId] : [],
    })
  }

  if (/(todo|fixme|mock|stub)/.test(lowerWorkspace)) {
    issues.push({
      id: "SEC-02",
      title: "Generated workspace still contains placeholder implementation markers",
      severity: "medium",
      detail: "Există markeri de tip TODO/FIXME/mock/stub în workspace-ul final.",
      remediation: "Înlocuiește placeholder-ele cu implementări reale sau marchează clar ce nu intră în merge.",
      storyIds: project.selectedStoryId ? [project.selectedStoryId] : [],
    })
  }

  if (/dangerouslysetinnerhtml|eval\(|new function\(|innerhtml\s*=/.test(lowerWorkspace)) {
    issues.push({
      id: "SEC-03",
      title: "Potential unsafe client-side code path detected",
      severity: "high",
      detail: "Workspace-ul conține pattern-uri care pot executa sau injecta conținut nesigur în browser.",
      remediation: "Elimină pattern-urile periculoase și sanitizează orice conținut dinamic înainte de render.",
      storyIds: project.selectedStoryId ? [project.selectedStoryId] : [],
    })
  }

  if (issues.length === 0) {
    issues.push({
      id: "SEC-OK-01",
      title: "No high-confidence OWASP issues found in the current scaffold",
      severity: "low",
      detail: "Revizuirea automată nu a găsit pattern-uri riscante evidente în codul și artefactele actuale.",
      remediation: "Păstrează review uman pe auth, validare input și data isolation înainte de merge.",
      storyIds: project.selectedStoryId ? [project.selectedStoryId] : [],
    })
  }

  return issues
}

function createMergeChangelog(project: ProjectState) {
  const latestArtifacts = project.artifacts.slice(0, 5).map((artifact) => `${artifact.stage}: ${artifact.title}`)
  const latestActivity = project.activity.slice(0, 4).map((entry) => `${entry.title} - ${entry.detail}`)

  return [
    ...latestArtifacts,
    ...latestActivity,
    ...(project.selectedStoryId ? [`Final merge candidate anchored to ${project.selectedStoryId}.`] : []),
  ].slice(0, 8)
}

function createProjectHealth(project: ProjectState): ProjectHealthReport {
  const totalStages = 11
  const completedStageOrder: StageKey[] = [
    "Conversation",
    "Documentation",
    "Requirements",
    "Features",
    "User Stories",
    "Planning",
    "Final Code",
    "Security Review",
    "Merge",
    "Project Review",
    "Preview",
  ]
  const progress = Math.round(((completedStageOrder.indexOf(project.currentStage) + 1) / totalStages) * 100)
  const technicalDebt: string[] = []

  if (project.securityReport.issues.some((issue) => issue.severity === "high")) {
    technicalDebt.push("Open high-severity security findings still require human confirmation.")
  }

  if (project.workspace.files.some((file) => /todo|fixme|mock|stub/i.test(file.content))) {
    technicalDebt.push("Workspace still contains placeholder or mock implementation markers.")
  }

  if (project.mergeReport.changelog.length === 0) {
    technicalDebt.push("Merge changelog is still thin and should capture more integration detail.")
  }

  const nextActions = [
    project.preview.appGenerated ? "Review preview UX and confirm the chosen implementation variant." : "Generate the preview after review is complete.",
    project.securityReport.status === "approved"
      ? "Track remaining hardening tasks as follow-up stories."
      : "Approve or remediate the security report before merge.",
    "Add explicit human sign-off notes to preserve the SDLC audit trail.",
  ]

  return {
    status: "completed",
    summary: `Project health synthesized from ${project.userStories.length} stories, ${project.workspace.files.length} workspace files, and ${project.agentRuns.length} agent runs.`,
    generatedAt: nowIso(),
    progress,
    coverage: `${project.features.length} features / ${project.userStories.length} stories traced into the current implementation flow.`,
    technicalDebt,
    nextActions,
  }
}

function resetReviewState(project: ProjectState) {
  return {
    ...project,
    securityReport: {
      status: "idle" as const,
      summary: "Security review has not started yet.",
      issues: [],
    },
    mergeReport: {
      status: "idle" as const,
      summary: "Merge & integration has not started yet.",
      mergedStoryIds: [],
      changelog: [],
    },
    projectHealth: {
      status: "idle" as const,
      summary: "Project review has not been generated yet.",
      progress: 0,
      coverage: "No merged stories yet.",
      technicalDebt: [],
      nextActions: [],
    },
  }
}

function recordAgentRun(
  project: ProjectState,
  input: {
    agentId: string
    agentName: string
    stage: StageKey
    action: AgentRun["action"]
    status: AgentRun["status"]
    summary: string
    artifact?: Omit<OrchestrationArtifact, "id" | "createdAt" | "updatedAt" | "sourceRunId">
    agentStatus?: ProjectState["agents"][number]["status"]
  }
) {
  const now = nowIso()
  const artifact =
    input.artifact === undefined
      ? null
      : {
          id: stampId("artifact"),
          createdAt: now,
          updatedAt: now,
          sourceRunId: "",
          ...input.artifact,
        }

  const run: AgentRun = {
    id: stampId("run"),
    agentId: input.agentId,
    agentName: input.agentName,
    stage: input.stage,
    action: input.action,
    status: input.status,
    summary: input.summary,
    artifactIds: artifact ? [artifact.id] : [],
    startedAt: now,
    finishedAt: input.status === "running" ? undefined : now,
  }

  const nextProject = touch({
    ...updateAgentSummary(project, input.agentId, input.summary, input.agentStatus),
    agentRuns: [run, ...project.agentRuns].slice(0, 50),
    artifacts: artifact ? [{ ...artifact, sourceRunId: run.id }, ...project.artifacts].slice(0, 50) : project.artifacts,
  })

  return { project: nextProject, run, artifact: artifact ? { ...artifact, sourceRunId: run.id } : null }
}

function canStageBeOpened(project: ProjectState, stage: StageKey) {
  switch (stage) {
    case "Conversation":
    case "Documentation":
      return { allowed: true as const }
    case "Requirements":
      return isBriefReadyForFeatureGeneration(project.brief)
        ? { allowed: true as const }
        : { allowed: false as const, reason: "Completează titlul și obiectivul brief-ului înainte de etapa Requirements." }
    case "Features":
      return project.requirements.length > 0
        ? { allowed: true as const }
        : { allowed: false as const, reason: "Generează și aprobă requirements înainte de etapa Features." }
    case "User Stories":
      return project.features.length > 0 && Boolean(getSelectedFeature(project))
        ? { allowed: true as const }
        : { allowed: false as const, reason: "Generează și selectează un feature înainte de etapa User Stories." }
    case "Planning":
      return project.userStories.length > 0 && Boolean(getSelectedStory(project)) && Boolean(getSelectedVariant(project))
        ? { allowed: true as const }
        : { allowed: false as const, reason: "Generează o user story și alege o variantă de implementare înainte de etapa Planning." }
    case "Final Code":
      return project.userStories.length > 0 && Boolean(getSelectedStory(project)) && Boolean(getSelectedVariant(project))
        ? { allowed: true as const }
        : { allowed: false as const, reason: "Generează o user story și alege o variantă de implementare înainte de etapa Final Code." }
    case "Security Review":
      return project.workspace.files.length > 0
        ? { allowed: true as const }
        : { allowed: false as const, reason: "Generează mai întâi codul final înainte de etapa Security Review." }
    case "Merge":
      return project.securityReport.status === "approved"
        ? { allowed: true as const }
        : { allowed: false as const, reason: "Aprobă security review înainte de etapa Merge." }
    case "Project Review":
      return project.mergeReport.status === "completed"
        ? { allowed: true as const }
        : { allowed: false as const, reason: "Finalizează merge-ul înainte de etapa Project Review." }
    case "Preview":
      return project.projectHealth.status === "completed" && project.preview.appGenerated && project.workspace.files.length > 0
        ? { allowed: true as const }
        : { allowed: false as const, reason: "Finalizează review-ul proiectului și generează preview-ul înainte de etapa Preview." }
    default:
      return { allowed: false as const, reason: "Stage necunoscut." }
  }
}

const orchestrationAgents = {
  requirementGeneration: { agentId: "agent-discovery", agentName: "Client Discovery AI" },
  featureGeneration: { agentId: "agent-discovery", agentName: "Client Discovery AI" },
  storyGeneration: { agentId: "agent-orchestrator", agentName: "Orchestrator Agent" },
  workspaceGeneration: { agentId: "agent-tech", agentName: "Solution Architect AI" },
  securityReview: { agentId: "agent-security", agentName: "Security Agent" },
  projectReview: { agentId: "agent-review", agentName: "Project Review Agent" },
  previewGeneration: { agentId: "agent-merge", agentName: "Merge Agent" },
} as const

function mergeWorkspace(
  project: ProjectState,
  generatedFolders: WorkspaceFolder[],
  generatedFiles: WorkspaceFile[],
  options?: {
    replaceExistingFiles?: boolean
    preferredSelectedPath?: string
  }
) {
  const baseFolders = buildWorkspaceFolders()
  const folderPaths = [
    ...baseFolders.map((folder) => folder.path),
    ...project.workspace.folders.map((folder) => folder.path),
    ...generatedFolders.map((folder) => folder.path),
    ...generatedFiles.flatMap((file) => getAncestorFolderPaths(file.path)),
  ]
  const ensuredFolders = ensureFolders(folderPaths, [...baseFolders, ...project.workspace.folders])

  const filesByPath = new Map<string, WorkspaceFile>(project.workspace.files.map((file) => [file.path, file]))
  let addedFiles = 0
  let replacedFiles = 0

  for (const file of generatedFiles) {
    const existing = filesByPath.get(file.path)

    if (!existing) {
      filesByPath.set(file.path, file)
      addedFiles += 1
      continue
    }

    if (!options?.replaceExistingFiles) continue

    filesByPath.set(file.path, {
      ...existing,
      name: file.name,
      content: file.content,
      path: file.path,
    })
    replacedFiles += 1
  }

  const nextFiles = [...filesByPath.values()].sort((left, right) => left.path.localeCompare(right.path))
  const selectedFile =
    (options?.preferredSelectedPath ? nextFiles.find((file) => file.path === options.preferredSelectedPath) : undefined) ??
    nextFiles.find((file) => file.id === project.workspace.selectedFileId) ??
    nextFiles[0]

  return {
    project: touch({
      ...project,
      workspace: {
        ...project.workspace,
        folders: ensuredFolders.folders,
        files: nextFiles,
        selectedFileId: selectedFile?.id ?? "",
      },
    }),
    addedFiles,
    replacedFiles,
    addedFolders: ensuredFolders.addedCount,
  }
}

function applyGeneratedWorkspace(
  project: ProjectState,
  generated: Awaited<ReturnType<typeof generateWorkspaceScaffold>>,
  options?: {
    replaceExistingFiles?: boolean
  }
) {
  const preferredSelectedPath =
    generated.runtimeEntrypoints.find((entrypoint) => entrypoint.includes("/page.")) ??
    generated.runtimeEntrypoints[0] ??
    generated.files.find((file) => file.path.startsWith("src/"))?.path
  const merged = mergeWorkspace(project, generated.folders, generated.files, {
    replaceExistingFiles: options?.replaceExistingFiles,
    preferredSelectedPath,
  })

  return {
    ...merged,
    project: touch({
      ...merged.project,
      workspace: {
        ...merged.project.workspace,
        runtimeEntrypoints: generated.runtimeEntrypoints,
      },
    }),
  }
}

export async function getProject(projectId: string) {
  return readProjectState(projectId)
}

export async function transitionStage(projectId: string, stage: StageKey, detail?: string) {
  return updateProjectState(projectId, async (project) => {
    const gate = canStageBeOpened(project, stage)
    if (!gate.allowed) {
      return appendActivity(project, "Stage blocked", gate.reason)
    }

    const next = touch({ ...project, currentStage: stage })
    return detail ? appendActivity(next, `Moved to ${stage}`, detail) : next
  })
}

export async function updateBrief(projectId: string, brief: BriefState) {
  return updateProjectState(projectId, async (project) => {
    const next = touch({
      ...project,
      brief,
    })

    return appendActivity(next, "Brief updated", "Project brief a fost salvat în backend fără să rescrie artefactele generate.")
  })
}

export async function generateDocumentationFromConversation(projectId: string) {
  const project = await getProject(projectId)
  const nextBrief = await generateBriefFromConversation({
    currentBrief: project.brief,
    conversationMessages: project.messages.general,
  })

  return updateProjectState(projectId, async (current) => {
    const next = touch({
      ...current,
      brief: nextBrief,
    })

    return appendActivity(
      next,
      "Documentation generated",
      "Brief-ul a fost generat automat din conversația unificată cu clientul."
    )
  })
}

export async function generateRequirements(projectId: string) {
  const project = await getProject(projectId)

  if (!isBriefReadyForFeatureGeneration(project.brief)) {
    return updateProjectState(projectId, async (current) => {
      const blocked = recordAgentRun(current, {
        agentId: orchestrationAgents.requirementGeneration.agentId,
        agentName: orchestrationAgents.requirementGeneration.agentName,
        stage: "Requirements",
        action: "generate-requirements",
        status: "blocked",
        summary: "Requirement generation blocked because the brief is incomplete.",
        agentStatus: "blocked",
      })

      return appendActivity(blocked.project, "Requirements unavailable", "Completează brief-ul înainte de generarea requirements.")
    })
  }

  const nextRequirements = createRequirementsFromBrief(project.brief)

  return updateProjectState(projectId, async (current) => {
    if (nextRequirements.length === 0) {
      const failed = recordAgentRun(current, {
        agentId: orchestrationAgents.requirementGeneration.agentId,
        agentName: orchestrationAgents.requirementGeneration.agentName,
        stage: "Requirements",
        action: "generate-requirements",
        status: "failed",
        summary: "Requirement generator returned no requirements.",
        agentStatus: "blocked",
      })

      return appendActivity(failed.project, "Requirements unavailable", "Nu au putut fi derivate requirements din brief.")
    }

    const summary = `Am derivat ${nextRequirements.length} requirements din brief.`
    const recorded = recordAgentRun(current, {
      agentId: orchestrationAgents.requirementGeneration.agentId,
      agentName: orchestrationAgents.requirementGeneration.agentName,
      stage: "Requirements",
      action: "generate-requirements",
      status: "completed",
      summary,
      artifact: {
        kind: "requirement-set",
        stage: "Requirements",
        title: "Derived requirements",
        summary: `Requirements extracted from ${current.brief.title || "the current brief"}.`,
        sourceIds: nextRequirements.map((requirement) => requirement.id),
      },
      agentStatus: "standby",
    })

    const next = touch({
      ...resetReviewState(recorded.project),
      currentStage: "Requirements",
      requirements: nextRequirements,
      features: [],
      selectedFeatureId: "",
      userStories: [],
      selectedStoryId: "",
      preview: {
        ...current.preview,
        appGenerated: false,
        previewOpened: false,
      },
    })

    return appendActivity(next, "Requirements generated", summary)
  })
}

export async function generateFeatures(projectId: string) {
  const project = await getProject(projectId)

  if (project.requirements.length === 0) {
    return updateProjectState(projectId, async (current) => {
      const blocked = recordAgentRun(current, {
        agentId: orchestrationAgents.featureGeneration.agentId,
        agentName: orchestrationAgents.featureGeneration.agentName,
        stage: "Features",
        action: "generate-features",
        status: "blocked",
        summary: "Feature generation blocked because no requirements are available.",
        agentStatus: "blocked",
      })

      return appendActivity(
        blocked.project,
        "Features unavailable",
        "Generează requirements înainte de etapa Features."
      )
    })
  }

  const nextFeatures = await generateFeaturesFromBrief(project.brief)

  return updateProjectState(projectId, async (current) => {
    if (current.requirements.length === 0) {
      const blocked = recordAgentRun(current, {
        agentId: orchestrationAgents.featureGeneration.agentId,
        agentName: orchestrationAgents.featureGeneration.agentName,
        stage: "Features",
        action: "generate-features",
        status: "blocked",
        summary: "Feature generation blocked because no requirements are available.",
        agentStatus: "blocked",
      })

      return appendActivity(
        blocked.project,
        "Features unavailable",
        "Generează requirements înainte de etapa Features."
      )
    }

    if (nextFeatures.length === 0) {
      const failed = recordAgentRun(current, {
        agentId: orchestrationAgents.featureGeneration.agentId,
        agentName: orchestrationAgents.featureGeneration.agentName,
        stage: "Features",
        action: "generate-features",
        status: "failed",
        summary: "Feature generator returned no valid features.",
        agentStatus: "blocked",
      })

      return appendActivity(failed.project, "Features unavailable", "Generatorul nu a returnat niciun feature valid.")
    }

    const nextSelectedFeature = nextFeatures[0]
    const summary = `Am generat ${nextFeatures.length} feature-uri pornind din brief.`
    const recorded = recordAgentRun(current, {
      agentId: orchestrationAgents.featureGeneration.agentId,
      agentName: orchestrationAgents.featureGeneration.agentName,
      stage: "Features",
      action: "generate-features",
      status: "completed",
      summary,
      artifact: {
        kind: "feature-set",
        stage: "Features",
        title: "Generated feature set",
        summary: `Feature backlog derived from ${project.brief.title || "the current brief"}.`,
        sourceIds: nextFeatures.map((feature) => feature.id),
      },
      agentStatus: "standby",
    })

    const next = touch({
      ...resetReviewState(recorded.project),
      currentStage: "Features",
      features: nextFeatures,
      selectedFeatureId: nextSelectedFeature?.id ?? "",
      userStories: [],
      selectedStoryId: "",
      preview: {
        ...current.preview,
        appGenerated: false,
        previewOpened: false,
      },
    })

    return appendActivity(next, "Features generated", summary)
  })
}

export async function selectFeature(projectId: string, featureId: string) {
  return updateProjectState(projectId, async (project) => {
    const nextFeature = project.features.find((item) => item.id === featureId)
    if (!nextFeature) {
      return appendActivity(project, "Feature unavailable", `${featureId} nu există în proiect.`)
    }

    const next = touch({
      ...project,
      selectedFeatureId: featureId,
      userStories: [],
      selectedStoryId: "",
      preview: {
        ...project.preview,
        appGenerated: false,
        previewOpened: false,
      },
    })

    return appendActivity(next, "Feature selected", `${featureId} este acum feature-ul activ.`)
  })
}

export async function generateUserStories(projectId: string) {
  const project = await getProject(projectId)
  const feature = getSelectedFeature(project)

  if (!feature) {
    return updateProjectState(projectId, async (current) => {
      const blocked = recordAgentRun(current, {
        agentId: orchestrationAgents.storyGeneration.agentId,
        agentName: orchestrationAgents.storyGeneration.agentName,
        stage: "User Stories",
        action: "generate-user-stories",
        status: "blocked",
        summary: "User story generation blocked because no feature is selected.",
        agentStatus: "blocked",
      })

      return appendActivity(blocked.project, "Stories unavailable", "Selectează sau generează mai întâi un feature.")
    })
  }

  const nextStories = await generateStoriesFromFeature(feature, project.brief)

  return updateProjectState(projectId, async (current) => {
    const activeFeature = current.features.find((item) => item.id === feature.id)
    if (!activeFeature) {
      const blocked = recordAgentRun(current, {
        agentId: orchestrationAgents.storyGeneration.agentId,
        agentName: orchestrationAgents.storyGeneration.agentName,
        stage: "User Stories",
        action: "generate-user-stories",
        status: "blocked",
        summary: "User story generation blocked because the selected feature changed.",
        agentStatus: "blocked",
      })

      return appendActivity(blocked.project, "Stories unavailable", "Feature-ul selectat s-a schimbat înainte de finalizarea generării.")
    }

    if (nextStories.length === 0) {
      const failed = recordAgentRun(current, {
        agentId: orchestrationAgents.storyGeneration.agentId,
        agentName: orchestrationAgents.storyGeneration.agentName,
        stage: "User Stories",
        action: "generate-user-stories",
        status: "failed",
        summary: "User story generator returned no valid stories.",
        agentStatus: "blocked",
      })

      return appendActivity(failed.project, "Stories unavailable", "Generatorul nu a returnat nicio user story validă.")
    }

    const summary = `Feature-ul ${activeFeature.id} are acum ${nextStories.length} user stories.`
    const recorded = recordAgentRun(current, {
      agentId: orchestrationAgents.storyGeneration.agentId,
      agentName: orchestrationAgents.storyGeneration.agentName,
      stage: "User Stories",
      action: "generate-user-stories",
      status: "completed",
      summary,
      artifact: {
        kind: "story-set",
        stage: "User Stories",
        title: `Story set for ${activeFeature.id}`,
        summary: `User stories derived from ${activeFeature.title}.`,
        sourceIds: nextStories.map((story) => story.id),
      },
      agentStatus: "standby",
    })

    const next = touch({
      ...resetReviewState(recorded.project),
      currentStage: "User Stories",
      userStories: nextStories,
      selectedStoryId: nextStories[0]?.id ?? "",
      preview: {
        ...current.preview,
        appGenerated: false,
        previewOpened: false,
      },
    })

    return appendActivity(next, "User stories generated", summary)
  })
}

export async function selectStory(projectId: string, storyId: string) {
  return updateProjectState(projectId, async (project) => {
    const nextStory = project.userStories.find((item) => item.id === storyId)
    if (!nextStory) {
      return appendActivity(project, "Story unavailable", `${storyId} nu există în proiect.`)
    }

    const next = touch({
      ...project,
      selectedStoryId: storyId,
      preview: {
        ...project.preview,
        appGenerated: false,
        previewOpened: false,
      },
    })

    return appendActivity(next, "Story selected", `${storyId} este acum story-ul activ.`)
  })
}

export async function selectStoryVariant(projectId: string, storyId: string, variantId: string) {
  return updateProjectState(projectId, async (project) => {
    const story = project.userStories.find((item) => item.id === storyId)
    if (!story) {
      return appendActivity(project, "Variant unavailable", `Story-ul ${storyId} nu există în proiect.`)
    }

    const variant = story.variants.find((item) => item.id === variantId)
    if (!variant) {
      return appendActivity(project, "Variant unavailable", `Varianta ${variantId} nu există pentru ${storyId}.`)
    }

    const next = touch({
      ...project,
      selectedStoryId: storyId,
      userStories: project.userStories.map((item) =>
        item.id === storyId
          ? {
              ...item,
              selectedVariantId: variantId,
            }
          : item
      ),
      preview: {
        ...project.preview,
        appGenerated: false,
        previewOpened: false,
      },
    })

    return appendActivity(next, "Variant selected", `${variant.label} este acum varianta activă pentru ${storyId}.`)
  })
}

export async function regenerateWorkspace(projectId: string) {
  const project = await getProject(projectId)
  const feature = getSelectedFeature(project)
  const story = getSelectedStory(project)
  const variant = getSelectedVariant(project, story)

  if (!feature || !story || !variant) {
    return updateProjectState(projectId, async (current) => {
      const blocked = recordAgentRun(current, {
        agentId: orchestrationAgents.workspaceGeneration.agentId,
        agentName: orchestrationAgents.workspaceGeneration.agentName,
        stage: "Final Code",
        action: "regenerate-workspace",
        status: "blocked",
        summary: "Workspace generation blocked because feature, story, or variant is missing.",
        agentStatus: "blocked",
      })
      return appendActivity(blocked.project, "Workspace unavailable", "Generează mai întâi feature-urile, user stories și alege o variantă.")
    })
  }

  const generated = await generateWorkspaceScaffold({
    brief: project.brief,
    feature,
    story,
    variant,
  })

  return updateProjectState(projectId, async (current) => {
    const activeFeature = current.features.find((item) => item.id === feature.id)
    const activeStory = current.userStories.find((item) => item.id === story.id)
    const activeVariant = activeStory?.variants.find((item) => item.id === variant.id)

    if (!activeFeature || !activeStory || !activeVariant) {
      const blocked = recordAgentRun(current, {
        agentId: orchestrationAgents.workspaceGeneration.agentId,
        agentName: orchestrationAgents.workspaceGeneration.agentName,
        stage: "Final Code",
        action: "regenerate-workspace",
        status: "blocked",
        summary: "Workspace generation blocked because feature, story, or variant changed while the scaffold was being built.",
        agentStatus: "blocked",
      })

      return appendActivity(blocked.project, "Workspace unavailable", "Feature-ul, story-ul sau varianta selectată s-au schimbat înainte de finalizarea regenerării.")
    }

    const nextWorkspace = applyGeneratedWorkspace(current, generated, { replaceExistingFiles: true })
    const summary =
      nextWorkspace.addedFiles === 0 && nextWorkspace.addedFolders === 0 && nextWorkspace.replacedFiles === 0
        ? `Workspace regenerated for ${activeVariant.label} without structural changes.`
        : `Am adăugat ${nextWorkspace.addedFiles} fișiere, ${nextWorkspace.addedFolders} foldere și am actualizat ${nextWorkspace.replacedFiles} fișiere generate pentru ${activeVariant.label}.`

    const recorded = recordAgentRun(current, {
      agentId: orchestrationAgents.workspaceGeneration.agentId,
      agentName: orchestrationAgents.workspaceGeneration.agentName,
      stage: "Final Code",
      action: "regenerate-workspace",
      status: "completed",
      summary,
      artifact: {
        kind: "workspace-scaffold",
        stage: "Final Code",
        title: `Workspace scaffold for ${activeStory.id} · ${activeVariant.label}`,
        summary: `Generated workspace scaffold anchored to ${activeStory.title} using ${activeVariant.label}.`,
        sourceIds: [activeFeature.id, activeStory.id, activeVariant.id, ...nextWorkspace.project.workspace.files.map((file) => file.id)],
      },
      agentStatus: "standby",
    })

    const mergedProject = touch({
      ...resetReviewState(recorded.project),
      currentStage: "Final Code",
      workspace: nextWorkspace.project.workspace,
    })

    if (nextWorkspace.addedFiles === 0 && nextWorkspace.addedFolders === 0 && nextWorkspace.replacedFiles === 0) {
      return appendActivity(mergedProject, "Workspace unchanged", `Nu au existat fișiere generate noi sau actualizate pentru ${activeVariant.label}.`)
    }

    return appendActivity(
      mergedProject,
      "Workspace regenerated",
      summary
    )
  })
}

export async function generateCode(projectId: string, storyId?: string) {
  const project = await getProject(projectId)
  const resolvedStoryId = storyId ?? project.selectedStoryId
  const story = project.userStories.find((item) => item.id === resolvedStoryId) ?? getSelectedStory(project)
  const feature = getSelectedFeature(project)
  const variant = getSelectedVariant(project, story)

  if (!feature || !story || !variant) {
    return updateProjectState(projectId, async (current) => {
      const blocked = recordAgentRun(current, {
        agentId: orchestrationAgents.workspaceGeneration.agentId,
        agentName: orchestrationAgents.workspaceGeneration.agentName,
        stage: "Final Code",
        action: "regenerate-workspace",
        status: "blocked",
        summary: "Code generation blocked because feature, story, or variant is missing.",
        agentStatus: "blocked",
      })
      return appendActivity(blocked.project, "Code unavailable", "Selectează o user story validă și o variantă înainte de generarea codului.")
    })
  }

  const generated = await generateWorkspaceScaffold({
    brief: project.brief,
    feature,
    story,
    variant,
  })

  return updateProjectState(projectId, async (current) => {
    const activeFeature = current.features.find((item) => item.id === feature.id)
    const activeStory = current.userStories.find((item) => item.id === story.id)
    const activeVariant = activeStory?.variants.find((item) => item.id === variant.id)

    if (!activeFeature || !activeStory || !activeVariant) {
      const blocked = recordAgentRun(current, {
        agentId: orchestrationAgents.workspaceGeneration.agentId,
        agentName: orchestrationAgents.workspaceGeneration.agentName,
        stage: "Final Code",
        action: "regenerate-workspace",
        status: "blocked",
        summary: "Code generation blocked because feature, story, or variant changed while the scaffold was being built.",
        agentStatus: "blocked",
      })

      return appendActivity(blocked.project, "Code unavailable", "Feature-ul, story-ul sau varianta selectată s-au schimbat înainte de finalizarea generării.")
    }

    const storySelectedProject = touch({
      ...current,
      selectedStoryId: activeStory.id,
      userStories: current.userStories.map((item) =>
        item.id === activeStory.id
          ? {
              ...item,
              selectedVariantId: activeVariant.id,
            }
          : item
      ),
      preview: {
        ...current.preview,
        appGenerated: false,
        previewOpened: false,
      },
    })

    const nextWorkspace = applyGeneratedWorkspace(storySelectedProject, generated, { replaceExistingFiles: true })
    const summary =
      nextWorkspace.addedFiles === 0 && nextWorkspace.addedFolders === 0 && nextWorkspace.replacedFiles === 0
        ? `Workspace ready for ${activeStory.id} using ${activeVariant.label} without file changes.`
        : `Codul pentru ${activeStory.id} cu ${activeVariant.label} a adăugat ${nextWorkspace.addedFiles} fișiere, ${nextWorkspace.addedFolders} foldere și a actualizat ${nextWorkspace.replacedFiles} fișiere.`

    const recorded = recordAgentRun(storySelectedProject, {
      agentId: orchestrationAgents.workspaceGeneration.agentId,
      agentName: orchestrationAgents.workspaceGeneration.agentName,
      stage: "Final Code",
      action: "regenerate-workspace",
      status: "completed",
      summary,
      artifact: {
        kind: "workspace-scaffold",
        stage: "Final Code",
        title: `Workspace scaffold for ${activeStory.id} · ${activeVariant.label}`,
        summary: `Generated workspace scaffold anchored to ${activeStory.title} using ${activeVariant.label}.`,
        sourceIds: [activeFeature.id, activeStory.id, activeVariant.id, ...nextWorkspace.project.workspace.files.map((file) => file.id)],
      },
      agentStatus: "standby",
    })

    const next = touch({
      ...resetReviewState(recorded.project),
      currentStage: "Final Code",
      selectedStoryId: activeStory.id,
      workspace: nextWorkspace.project.workspace,
    })

    return appendActivity(next, "Code generated", summary)
  })
}

export async function generateSecurityReview(projectId: string) {
  const project = await getProject(projectId)

  if (project.workspace.files.length === 0) {
    return updateProjectState(projectId, async (current) => {
      const blocked = recordAgentRun(current, {
        agentId: orchestrationAgents.securityReview.agentId,
        agentName: orchestrationAgents.securityReview.agentName,
        stage: "Security Review",
        action: "generate-security-review",
        status: "blocked",
        summary: "Security review blocked because the final code workspace is empty.",
        agentStatus: "blocked",
      })

      return appendActivity(blocked.project, "Security review unavailable", "Generează mai întâi codul final înainte de security review.")
    })
  }

  const issues = createSecurityIssues(project)
  const summary =
    issues.length === 1 && issues[0]?.severity === "low"
      ? "Security review completed with no major automated findings."
      : `Security review completed with ${issues.length} findings requiring attention.`

  return updateProjectState(projectId, async (current) => {
    const recorded = recordAgentRun(current, {
      agentId: orchestrationAgents.securityReview.agentId,
      agentName: orchestrationAgents.securityReview.agentName,
      stage: "Security Review",
      action: "generate-security-review",
      status: "completed",
      summary,
      artifact: {
        kind: "security-report",
        stage: "Security Review",
        title: "Security review report",
        summary,
        sourceIds: issues.map((issue) => issue.id),
      },
      agentStatus: "standby",
    })

    const next = touch({
      ...recorded.project,
      currentStage: "Security Review",
      securityReport: {
        status: "reviewed",
        summary,
        reviewedAt: nowIso(),
        issues,
      },
      mergeReport: {
        status: "idle",
        summary: "Merge & integration has not started yet.",
        mergedStoryIds: [],
        changelog: [],
      },
      projectHealth: {
        status: "idle",
        summary: "Project review has not been generated yet.",
        progress: 0,
        coverage: "No merged stories yet.",
        technicalDebt: [],
        nextActions: [],
      },
      preview: {
        ...current.preview,
        appGenerated: false,
        previewOpened: false,
      },
    })

    return appendActivity(next, "Security review generated", summary)
  })
}

export async function approveSecurityReview(projectId: string) {
  return updateProjectState(projectId, async (project) => {
    if (project.securityReport.status !== "reviewed") {
      const blocked = recordAgentRun(project, {
        agentId: orchestrationAgents.securityReview.agentId,
        agentName: orchestrationAgents.securityReview.agentName,
        stage: "Security Review",
        action: "approve-security-review",
        status: "blocked",
        summary: "Security approval blocked because no reviewed report exists yet.",
        agentStatus: "blocked",
      })

      return appendActivity(blocked.project, "Security approval unavailable", "Rulează întâi security review înainte de aprobare.")
    }

    const recorded = recordAgentRun(project, {
      agentId: orchestrationAgents.securityReview.agentId,
      agentName: orchestrationAgents.securityReview.agentName,
      stage: "Security Review",
      action: "approve-security-review",
      status: "completed",
      summary: "Security report approved for merge handoff.",
      agentStatus: "standby",
    })

    const next = touch({
      ...recorded.project,
      currentStage: "Security Review",
      securityReport: {
        ...project.securityReport,
        status: "approved",
        approvedAt: nowIso(),
      },
    })

    return appendActivity(next, "Security review approved", "Raportul de securitate a fost aprobat pentru merge.")
  })
}

export async function runMerge(projectId: string) {
  const project = await getProject(projectId)

  if (project.securityReport.status !== "approved") {
    return updateProjectState(projectId, async (current) => {
      const blocked = recordAgentRun(current, {
        agentId: orchestrationAgents.previewGeneration.agentId,
        agentName: orchestrationAgents.previewGeneration.agentName,
        stage: "Merge",
        action: "run-merge",
        status: "blocked",
        summary: "Merge blocked because security review is not approved.",
        agentStatus: "blocked",
      })

      return appendActivity(blocked.project, "Merge unavailable", "Aprobă security review înainte de merge.")
    })
  }

  const changelog = createMergeChangelog(project)
  const mergedStoryIds = project.selectedStoryId ? [project.selectedStoryId] : project.userStories.map((story) => story.id)
  const summary = `Merge completed for ${mergedStoryIds.length} story candidates with ${changelog.length} changelog entries.`

  return updateProjectState(projectId, async (current) => {
    const recorded = recordAgentRun(current, {
      agentId: orchestrationAgents.previewGeneration.agentId,
      agentName: orchestrationAgents.previewGeneration.agentName,
      stage: "Merge",
      action: "run-merge",
      status: "completed",
      summary,
      artifact: {
        kind: "merge-report",
        stage: "Merge",
        title: "Merge & integration report",
        summary,
        sourceIds: mergedStoryIds,
      },
      agentStatus: "standby",
    })

    const next = touch({
      ...recorded.project,
      currentStage: "Merge",
      mergeReport: {
        status: "completed",
        summary,
        mergedAt: nowIso(),
        mergedStoryIds,
        changelog,
      },
      projectHealth: {
        status: "idle",
        summary: "Project review has not been generated yet.",
        progress: 0,
        coverage: "No merged stories yet.",
        technicalDebt: [],
        nextActions: [],
      },
      preview: {
        ...current.preview,
        appGenerated: false,
        previewOpened: false,
      },
    })

    return appendActivity(next, "Merge completed", summary)
  })
}

export async function generateProjectReview(projectId: string) {
  const project = await getProject(projectId)

  if (project.mergeReport.status !== "completed") {
    return updateProjectState(projectId, async (current) => {
      const blocked = recordAgentRun(current, {
        agentId: orchestrationAgents.projectReview.agentId,
        agentName: orchestrationAgents.projectReview.agentName,
        stage: "Project Review",
        action: "generate-project-review",
        status: "blocked",
        summary: "Project review blocked because merge has not completed.",
        agentStatus: "blocked",
      })

      return appendActivity(blocked.project, "Project review unavailable", "Finalizează merge-ul înainte de project review.")
    })
  }

  const health = createProjectHealth({ ...project, currentStage: "Project Review" })

  return updateProjectState(projectId, async (current) => {
    const recorded = recordAgentRun(current, {
      agentId: orchestrationAgents.projectReview.agentId,
      agentName: orchestrationAgents.projectReview.agentName,
      stage: "Project Review",
      action: "generate-project-review",
      status: "completed",
      summary: health.summary,
      artifact: {
        kind: "project-review",
        stage: "Project Review",
        title: "Project health report",
        summary: health.summary,
        sourceIds: current.mergeReport.mergedStoryIds,
      },
      agentStatus: "standby",
    })

    const next = touch({
      ...recorded.project,
      currentStage: "Project Review",
      projectHealth: health,
      preview: {
        ...current.preview,
        appGenerated: false,
        previewOpened: false,
      },
    })

    return appendActivity(next, "Project review generated", health.summary)
  })
}

export async function appendConversationMessage(input: {
  projectId: string
  channel: MessageChannel
  author: string
  text: string
}) {
  const normalized = input.text.trim()
  if (!normalized) {
    return getProject(input.projectId)
  }

  const humanMessage: Message = {
    id: stampId("msg"),
    author: input.author,
    role: "human",
    text: normalized,
  }

  await updateProjectState(input.projectId, async (project) => {
    const nextMessages = {
      ...project.messages,
      general: [...project.messages.general, humanMessage],
    }

    const next = touch({
      ...project,
      messages: nextMessages,
    })

    return appendActivity(next, humanMessage.author, "A trimis un mesaj în conversația generală.")
  })

  const project = await getProject(input.projectId)
  const evolvedBrief = await generateBriefFromConversation({
    currentBrief: project.brief,
    conversationMessages: project.messages.general,
  })
  const aiReply = await generateOpenAIReply({
    author: input.author,
    message: normalized,
    brief: evolvedBrief,
    history: project.messages.general,
  })

  const aiMessage: Message = {
    id: stampId("msg"),
    author: "Client Discovery AI",
    role: "ai",
    text: aiReply,
  }

  return updateProjectState(input.projectId, async (current) => {
    const next = touch({
      ...current,
      brief: evolvedBrief,
      messages: {
        ...current.messages,
        general: [...current.messages.general, aiMessage],
      },
    })

    return appendActivity(next, "Client Discovery AI", "A actualizat brief-ul și a continuat conversația.")
  })
}

export async function createWorkspaceFolder(projectId: string, parentPath: string, name: string) {
  return updateProjectState(projectId, async (project) => {
    const trimmedName = name.trim()
    const fullPath = joinWorkspacePath(parentPath, trimmedName)
    if (!trimmedName) return project

    const ensuredFolders = ensureFolders(
      [...project.workspace.folders.map((folder) => folder.path), ...getAncestorFolderPaths(fullPath), fullPath],
      project.workspace.folders
    )

    if (ensuredFolders.addedCount === 0) {
      return appendActivity(project, "Workspace unchanged", `${fullPath} există deja.`)
    }

    const next = touch({
      ...project,
      workspace: {
        ...project.workspace,
        folders: ensuredFolders.folders,
      },
    })

    return appendActivity(next, "Folder created", `${fullPath} a fost adăugat în workspace.`)
  })
}

export async function createWorkspaceFile(projectId: string, parentPath: string, name: string) {
  return updateProjectState(projectId, async (project) => {
    const trimmedName = name.trim()
    const fullPath = joinWorkspacePath(parentPath, trimmedName)
    if (!trimmedName) return project

    if (project.workspace.files.some((file) => file.path === fullPath)) {
      return appendActivity(project, "Workspace unchanged", `${fullPath} există deja.`)
    }

    const ensuredFolders = ensureFolders(
      [...project.workspace.folders.map((folder) => folder.path), ...getAncestorFolderPaths(fullPath)],
      project.workspace.folders
    )

    const file: WorkspaceFile = {
      id: stampId("file"),
      name: getWorkspaceName(fullPath),
      path: fullPath,
      content: createDefaultFileContent(fullPath),
    }

    const next = touch({
      ...project,
      workspace: {
        ...project.workspace,
        folders: ensuredFolders.folders,
        files: [...project.workspace.files, file].sort((left, right) => left.path.localeCompare(right.path)),
        selectedFileId: file.id,
      },
    })

    return appendActivity(next, "File created", `${file.path} este gata de editare.`)
  })
}

export async function updateWorkspaceFile(projectId: string, fileId: string, content: string) {
  return updateProjectState(projectId, async (project) => {
    const exists = project.workspace.files.some((file) => file.id === fileId)
    if (!exists) return project

    return touch({
      ...project,
      workspace: {
        ...project.workspace,
        files: project.workspace.files.map((file) => (file.id === fileId ? { ...file, content } : file)),
      },
    })
  })
}

export async function selectWorkspaceFile(projectId: string, fileId: string) {
  return updateProjectState(projectId, async (project) => {
    const fileExists = project.workspace.files.some((file) => file.id === fileId)
    if (!fileExists) {
      return appendActivity(project, "Workspace unchanged", `Fișierul ${fileId} nu există.`)
    }

    return touch({
      ...project,
      workspace: {
        ...project.workspace,
        selectedFileId: fileId,
      },
    })
  })
}

export async function markPreviewGenerated(projectId: string) {
  const project = await getProject(projectId)
  const feature = getSelectedFeature(project)
  const story = getSelectedStory(project)

  if (!feature || !story || project.projectHealth.status !== "completed") {
    return updateProjectState(projectId, async (current) => {
      const blocked = recordAgentRun(current, {
        agentId: orchestrationAgents.previewGeneration.agentId,
        agentName: orchestrationAgents.previewGeneration.agentName,
        stage: "Preview",
        action: "generate-preview",
        status: "blocked",
        summary: "Preview generation blocked because the project review flow is incomplete.",
        agentStatus: "blocked",
      })
      return appendActivity(
        blocked.project,
        "Preview unavailable",
        "Finalizează Final Code, Security Review, Merge și Project Review înainte de preview."
      )
    })
  }

  try {
    await validateProjectPreview(project)
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Preview bundle failed."

    return updateProjectState(projectId, async (current) => {
      const failed = recordAgentRun(current, {
        agentId: orchestrationAgents.previewGeneration.agentId,
        agentName: orchestrationAgents.previewGeneration.agentName,
        stage: "Preview",
        action: "generate-preview",
        status: "failed",
        summary: `Preview generation failed: ${detail}`,
        agentStatus: "blocked",
      })

      return appendActivity(failed.project, "Preview unavailable", detail)
    })
  }

  return updateProjectState(projectId, async (current) => {
    const activeFeature = current.features.find((item) => item.id === feature.id)
    const activeStory = current.userStories.find((item) => item.id === story.id)

    if (!activeFeature || !activeStory) {
      const blocked = recordAgentRun(current, {
        agentId: orchestrationAgents.previewGeneration.agentId,
        agentName: orchestrationAgents.previewGeneration.agentName,
        stage: "Preview",
        action: "generate-preview",
        status: "blocked",
        summary: "Preview generation blocked because feature or story changed while the preview was being prepared.",
        agentStatus: "blocked",
      })

      return appendActivity(blocked.project, "Preview unavailable", "Feature-ul sau story-ul selectat s-a schimbat înainte de finalizarea preview-ului.")
    }

    if (current.workspace.files.length === 0) {
      const failed = recordAgentRun(current, {
        agentId: orchestrationAgents.previewGeneration.agentId,
        agentName: orchestrationAgents.previewGeneration.agentName,
        stage: "Preview",
        action: "generate-preview",
        status: "failed",
        summary: "Preview generation failed because workspace is empty.",
        agentStatus: "blocked",
      })

      return appendActivity(failed.project, "Preview unavailable", "Workspace-ul nu conține încă fișiere valide pentru preview.")
    }

    const summary = "Preview-ul aplicației este gata de vizualizare."
    const recorded = recordAgentRun(current, {
      agentId: orchestrationAgents.previewGeneration.agentId,
      agentName: orchestrationAgents.previewGeneration.agentName,
      stage: "Preview",
      action: "generate-preview",
      status: "completed",
      summary,
      artifact: {
        kind: "preview-snapshot",
        stage: "Preview",
        title: `Preview snapshot for ${activeStory.id}`,
        summary: `Browser preview generated from the current workspace for ${activeStory.title}.`,
        sourceIds: [activeFeature.id, activeStory.id, ...current.workspace.files.map((file) => file.id)],
      },
      agentStatus: "standby",
    })

    const next = touch({
      ...recorded.project,
      currentStage: "Preview",
      preview: {
        ...current.preview,
        appGenerated: true,
        previewOpened: true,
      },
    })

    return appendActivity(next, "Application generated", summary)
  })
}

export async function runFullPipeline(projectId: string) {
  let project = await getProject(projectId)

  if (!isBriefReadyForFeatureGeneration(project.brief)) {
    return appendActivity(project, "Pipeline blocked", "Completează titlul și obiectivul brief-ului înainte de rularea completă.")
  }

  project = await generateRequirements(projectId)
  if (project.requirements.length === 0) return project

  project = await transitionStage(projectId, "Requirements", "Pipeline orchestrat: requirements derivate din brief.")
  if (project.currentStage !== "Requirements") return project

  project = await generateFeatures(projectId)
  if (project.features.length === 0) return project

  project = await transitionStage(projectId, "Features", "Pipeline orchestrat: feature generation finalizată.")
  if (project.currentStage !== "Features") return project

  project = await generateUserStories(projectId)
  if (project.userStories.length === 0) return project

  project = await transitionStage(projectId, "User Stories", "Pipeline orchestrat: user stories generate cu estimări și dependențe.")
  if (project.currentStage !== "User Stories") return project

  project = await transitionStage(projectId, "Planning", "Pipeline orchestrat: backlog-ul este gata pentru planificare și handoff.")
  if (project.currentStage !== "Planning") return project

  project = await regenerateWorkspace(projectId)
  if (project.workspace.files.length === 0) return project

  project = await transitionStage(projectId, "Final Code", "Pipeline orchestrat: workspace generat pentru implementare.")
  if (project.currentStage !== "Final Code") return project

  project = await generateSecurityReview(projectId)
  if (project.securityReport.status !== "reviewed") return project

  project = await approveSecurityReview(projectId)
  if (project.securityReport.status !== "approved") return project

  project = await runMerge(projectId)
  if (project.mergeReport.status !== "completed") return project

  project = await generateProjectReview(projectId)
  if (project.projectHealth.status !== "completed") return project

  project = await markPreviewGenerated(projectId)
  if (!project.preview.appGenerated) return project

  return appendActivity(project, "Pipeline completed", "Runtime-ul complet a rulat de la brief la security, merge, review și preview.")
}

export async function openPreviewWindow(projectId: string) {
  return updateProjectState(projectId, async (project) => {
    if (!project.preview.appGenerated || project.workspace.files.length === 0) {
      return appendActivity(project, "Preview unavailable", "Generează mai întâi preview-ul aplicației.")
    }

    const next = touch({
      ...project,
      preview: {
        ...project.preview,
        previewOpened: true,
      },
    })

    return appendActivity(next, "Preview opened", "Fereastra de preview este activă.")
  })
}

export async function resetProject(projectId: string) {
  return updateProjectState(projectId, async () => createDefaultProjectState(projectId))
}

export async function getHealth(projectId: string) {
  const project = await getProject(projectId)

  return {
    ok: true,
    projectId: project.id,
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    openaiModel: process.env.OPENAI_MODEL ?? "gpt-5-mini",
    runtime: "nodejs",
  }
}

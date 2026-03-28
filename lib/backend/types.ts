export type StageKey =
  | "Conversation"
  | "Documentation"
  | "Requirements"
  | "Features"
  | "User Stories"
  | "Planning"
  | "Final Code"
  | "Security Review"
  | "Merge"
  | "Project Review"
  | "Preview"

export type Message = {
  id: string
  author: string
  role: "human" | "ai"
  text: string
}

export type BriefState = {
  title: string
  objective: string
  audience: string[]
  scope: string[]
  deliverables: string[]
  risks: string[]
  techStack: string[]
  dbSchema: string
  architecture: string
}

export type ActivityEntry = {
  id: string
  title: string
  detail: string
  time: string
}

export type OrchestrationArtifact = {
  id: string
  kind:
    | "requirement-set"
    | "feature-set"
    | "story-set"
    | "workspace-scaffold"
    | "security-report"
    | "merge-report"
    | "project-review"
    | "preview-snapshot"
  stage: StageKey
  title: string
  summary: string
  sourceRunId: string
  sourceIds: string[]
  createdAt: string
  updatedAt: string
}

export type AgentRun = {
  id: string
  agentId: string
  agentName: string
  stage: StageKey
  action:
    | "generate-requirements"
    | "generate-features"
    | "generate-user-stories"
    | "regenerate-workspace"
    | "generate-security-review"
    | "approve-security-review"
    | "run-merge"
    | "generate-project-review"
    | "generate-preview"
  status: "queued" | "running" | "completed" | "blocked" | "failed"
  summary: string
  artifactIds: string[]
  startedAt: string
  finishedAt?: string
}

export type Feature = {
  id: string
  title: string
  summary: string
  preview: string
  estimate: "S" | "M" | "L" | "XL"
  complexityNote: string
  dependencyIds: string[]
  variations: string[]
  acceptance: string[]
}

export type Requirement = {
  id: string
  title: string
  detail: string
  kind: "functional" | "non-functional"
  status: "draft" | "derived" | "approved"
  featureIds: string[]
  storyIds: string[]
}

export type StoryVariant = {
  id: string
  label: string
  teamName: string
  focus: string
  architecture: string
  pros: string[]
  cons: string[]
  tradeoff: string
  code: string
}

export type UserStory = {
  id: string
  title: string
  stack: string
  summary: string
  tradeoff: string
  estimate: "S" | "M" | "L" | "XL"
  complexityNote: string
  dependencyIds: string[]
  previewTitle: string
  previewDescription: string
  code: string
  variants: StoryVariant[]
  selectedVariantId: string
}

export type WorkspaceFile = {
  id: string
  name: string
  path: string
  content: string
}

export type WorkspaceFolder = {
  id: string
  name: string
  path: string
}

export type AgentState = {
  id: string
  name: string
  specialty: string
  stage: StageKey
  status: "queued" | "active" | "standby" | "blocked"
  goal: string
  lastRunSummary: string
}

export type Collaborator = {
  name: string
  role: string
  initials: string
  status: string
}

export type WorkspaceState = {
  folders: WorkspaceFolder[]
  files: WorkspaceFile[]
  selectedFileId: string
  runtimeEntrypoints: string[]
}

export type PreviewState = {
  appGenerated: boolean
  previewOpened: boolean
  mode: "virtual-runtime"
}

export type SecurityIssue = {
  id: string
  title: string
  severity: "low" | "medium" | "high"
  detail: string
  remediation: string
  storyIds: string[]
}

export type SecurityReport = {
  status: "idle" | "reviewed" | "approved"
  summary: string
  reviewedAt?: string
  approvedAt?: string
  issues: SecurityIssue[]
}

export type MergeReport = {
  status: "idle" | "ready" | "completed"
  summary: string
  mergedAt?: string
  mergedStoryIds: string[]
  changelog: string[]
}

export type ProjectHealthReport = {
  status: "idle" | "completed"
  summary: string
  generatedAt?: string
  progress: number
  coverage: string
  technicalDebt: string[]
  nextActions: string[]
}

export type ProjectState = {
  id: string
  createdAt: string
  updatedAt: string
  currentStage: StageKey
  search: string
  brief: BriefState
  requirements: Requirement[]
  features: Feature[]
  selectedFeatureId: string
  userStories: UserStory[]
  selectedStoryId: string
  messages: {
    general: Message[]
  }
  collaborators: Collaborator[]
  agents: AgentState[]
  agentRuns: AgentRun[]
  artifacts: OrchestrationArtifact[]
  activity: ActivityEntry[]
  workspace: WorkspaceState
  securityReport: SecurityReport
  mergeReport: MergeReport
  projectHealth: ProjectHealthReport
  preview: PreviewState
}

export type MessageChannel = "general"

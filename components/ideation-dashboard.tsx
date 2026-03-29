"use client"

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react"
import { withProjectQuery } from "@/lib/backend/project-url"
import { useTheme } from "@/components/theme-provider"
import { ReactFlow, Controls, Background } from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import type { ProjectState as BackendProjectState } from "@/lib/backend/types"
import { cn } from "@/lib/utils"

type StageKey = BackendProjectState["currentStage"]

type BriefState = {
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

type BriefListKey = "audience" | "scope" | "deliverables" | "risks"

type WorkspaceFile = {
  id: string
  name: string
  path: string
  content: string
}

type WorkspaceFolder = {
  id: string
  name: string
  path: string
}

type SchemaModel = {
  name: string
  fields: { name: string; type: string }[]
}

type SchemaRelation = {
  from: string
  to: string
  field: string
}

type RequirementView = {
  id: string
  title: string
  detail: string
  kind: "functional" | "non-functional"
  status: "draft" | "derived" | "approved"
  featureIds: string[]
  storyIds: string[]
}

type TraceSegment = {
  label: string
  value: string
  tone?: "default" | "primary" | "accent"
}

type SlashAction = "refactor" | "comment" | "scaffold"
type TerminalSlashAction = "fix" | "explain" | "command"
type TerminalLine = { type: "system" | "out" | "error" | "cmd" | "trace"; text: string }

const stages: StageKey[] = [
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

const stageNumbers: Partial<Record<StageKey, string>> = {
  Conversation: "01",
  Documentation: "02",
  Requirements: "03",
  Features: "04",
  "User Stories": "05",
  Planning: "06",
  "Final Code": "07",
  "Security Review": "08",
  Merge: "09",
  "Project Review": "10",
  Preview: "11",
}

const stageDescriptions: Partial<Record<StageKey, string>> = {
  Conversation: "Un singur chat de discovery unde AI-ul clarifică produsul și recomandă soluția.",
  Documentation: "Generare scheme tehnice și brief de produs.",
  Requirements: "Derivare și aprobare requirements funcționale și non-funcționale.",
  Features: "Selecție a modulelor și variațiilor recomandate.",
  "User Stories": "Maparea Agile a feature-urilor bifate.",
  Planning: "Estimări, dependențe și handoff pentru implementare.",
  "Final Code": "Se vede codul final pentru aplicația formată.",
  "Security Review": "Audit automat și aprobare umană înainte de merge.",
  Merge: "Integrare ordonată și changelog pentru story-ul ales.",
  "Project Review": "Raport de sănătate, progres și datorie tehnică.",
  Preview: "Aplicația este generată și rulată în preview.",
}

const topLinks: StageKey[] = ["Conversation", "Documentation", "Security Review", "Preview"]

const starterPrompts = [
  "Avem nevoie de un flow clar de la idee la preview.",
  "Documentația trebuie aprobată de echipă înainte de implementare.",
  "Vreau să compar 3 variante generate și să aleg rapid una.",
]

const documentationFieldMeta: Record<
  BriefListKey,
  { label: string; description: string; placeholder: string; accent: string }
> = {
  audience: {
    label: "Audience",
    description: "Cine beneficiază imediat de produs și ce rol are în echipă.",
    placeholder: "Add audience segment...",
    accent: "from-chart-2/20 via-chart-2/10 to-transparent",
  },
  scope: {
    label: "Scope",
    description: "Ce intră în MVP și stabilește ritmul de livrare.",
    placeholder: "Define scoped capability...",
    accent: "from-primary/20 via-primary/10 to-transparent",
  },
  deliverables: {
    label: "Deliverables",
    description: "Artefactele aprobabile care marchează progresul echipei.",
    placeholder: "Add expected deliverable...",
    accent: "from-chart-3/20 via-chart-3/10 to-transparent",
  },
  risks: {
    label: "Risks",
    description: "Blocaje și surse de ambiguitate pe care vrem să le prevenim devreme.",
    placeholder: "Document risk or dependency...",
    accent: "from-destructive/15 via-destructive/8 to-transparent",
  },
}

const initialArchNodes = [
  { id: '1', position: { x: 100, y: 0 }, data: { label: '💻 IDE UI (Next.js)' }, type: 'input' },
  { id: '2', position: { x: 100, y: 80 }, data: { label: '🚪 API Gateway' } },
  { id: '3', position: { x: 280, y: 80 }, data: { label: '⚡ WebSocket' } },
  { id: '4', position: { x: -80, y: 80 }, data: { label: '🔴 Redis Cache' } },
  { id: '5', position: { x: 100, y: 160 }, data: { label: '🧠 AI Orchestrator' } },
  { id: '6', position: { x: -80, y: 160 }, data: { label: '🐘 PostgreSQL DB' } },
  { id: '7', position: { x: 280, y: 200 }, data: { label: '🛡️ Security Agent' } },
  { id: '8', position: { x: 0, y: 250 }, data: { label: '🗣️ Client Discovery AI' } },
  { id: '9', position: { x: 180, y: 250 }, data: { label: '🏗️ Solution Architect AI' } },
  { id: '10', position: { x: 100, y: 350 }, data: { label: '☁️ AWS Bedrock' }, type: 'output' },
]

const initialArchEdges = [
  { id: 'e1-2', source: '1', target: '2', animated: true },
  { id: 'e1-3', source: '1', target: '3', animated: true },
  { id: 'e2-4', source: '2', target: '4' },
  { id: 'e2-5', source: '2', target: '5' },
  { id: 'e3-5', source: '3', target: '5' },
  { id: 'e5-6', source: '5', target: '6' },
  { id: 'e5-7', source: '5', target: '7', animated: true },
  { id: 'e5-8', source: '5', target: '8', animated: true },
  { id: 'e5-9', source: '5', target: '9', animated: true },
  { id: 'e8-10', source: '8', target: '10' },
  { id: 'e9-10', source: '9', target: '10' },
  { id: 'e7-10', source: '7', target: '10' },
]

function getWorkspaceParentPath(path: string) {
  const parts = path.split("/").filter(Boolean)
  return parts.slice(0, -1).join("/")
}

function createAiEditedContent(file: WorkspaceFile, action: SlashAction, instruction: string) {
  const normalizedInstruction = instruction.trim() || "update the active application flow"

  if (file.name.endsWith(".md")) {
    return `${file.content}\n## AI Edit Request\n- File: ${file.path}\n- Action: ${action}\n- Requested app change: ${normalizedInstruction}\n- Result: update drafted from the slash editor prompt.\n`
  }

  const summaryComment =
    action === "comment"
      ? `// AI note for app update: ${normalizedInstruction}`
      : action === "scaffold"
        ? `// AI scaffold request: ${normalizedInstruction}`
        : `// AI refactor request: ${normalizedInstruction}`

  const snippet =
    action === "comment"
      ? `${summaryComment}\n`
      : action === "scaffold"
        ? `${summaryComment}\nexport const aiEditDraft = {\n  targetFile: ${JSON.stringify(file.path)},\n  requestedChange: ${JSON.stringify(normalizedInstruction)},\n  status: "draft-applied",\n}\n`
        : `${summaryComment}\nexport function applyAiInstructionDraft() {\n  return {\n    targetFile: ${JSON.stringify(file.path)},\n    requestedChange: ${JSON.stringify(normalizedInstruction)},\n    status: "needs-review",\n  }\n}\n`

  return `${snippet}\n${file.content}`
}

function createTerminalAiResponse(action: TerminalSlashAction, instruction: string) {
  const normalizedInstruction = instruction.trim() || "inspect the current terminal flow"

  if (action === "explain") {
    return {
      command: "",
      output: `AI explanation:\n- Context: ${normalizedInstruction}\n- Suggestion: ruleaza comanda cea mai mică posibilă și validează output-ul înainte de preview.`,
    }
  }

  if (action === "fix") {
    return {
      command: "npm run dev",
      output: `AI fix suggestion:\n- Interpretez cererea ca "${normalizedInstruction}".\n- Recomand să pornești serverul local cu \`npm run dev\` și apoi să verifici preview-ul.`,
    }
  }

  return {
    command: "npm run dev",
    output: `AI command generated for: ${normalizedInstruction}`,
  }
}

function buildAiTrace(title: string, steps: string[]) {
  return `AI Trace · ${title}\n${steps.map((step, index) => `${index + 1}. ${step}`).join("\n")}`
}

function parseSchemaDiagram(schema: string) {
  const modelRegex = /model\s+(\w+)\s*\{([\s\S]*?)\}/g
  const scalarTypes = new Set(["String", "Int", "Boolean", "DateTime", "Float", "Decimal", "Json", "Bytes", "BigInt"])
  const models: SchemaModel[] = []
  const relations: SchemaRelation[] = []

  for (const match of schema.matchAll(modelRegex)) {
    const [, modelName, body] = match
    const fields = body
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("//"))
      .map((line) => line.split(/\s+/))
      .filter((parts) => parts.length >= 2)
      .map(([name, rawType]) => ({
        name,
        type: rawType.replace(/[?\[\]]/g, ""),
      }))

    models.push({ name: modelName, fields })
  }

  const modelNames = new Set(models.map((model) => model.name))

  for (const model of models) {
    for (const field of model.fields) {
      if (!scalarTypes.has(field.type) && modelNames.has(field.type)) {
        const duplicate = relations.some(
          (relation) => relation.from === model.name && relation.to === field.type && relation.field === field.name
        )

        if (!duplicate) {
          relations.push({ from: model.name, to: field.type, field: field.name })
        }
      }
    }
  }

  const nodes = models.map((model, index) => ({
    id: model.name,
    position: {
      x: (index % 2) * 280,
      y: Math.floor(index / 2) * 220,
    },
    data: {
      label: `${model.name}\n${model.fields
        .slice(0, 4)
        .map((field) => `${field.name}: ${field.type}`)
        .join("\n")}`,
    },
    style: {
      width: 220,
      borderRadius: 16,
      border: "1px solid rgba(25,22,21,0.12)",
      background: "rgba(255,255,255,0.9)",
      padding: 14,
      fontSize: 12,
      lineHeight: 1.5,
      whiteSpace: "pre-line" as const,
      color: "#191615",
      boxShadow: "0 12px 30px rgba(25,22,21,0.06)",
    },
  }))

  const edges = relations.map((relation, index) => ({
    id: `schema-${index}`,
    source: relation.from,
    target: relation.to,
    animated: true,
    label: relation.field,
    style: { stroke: "rgba(16,185,129,0.6)", strokeWidth: 1.5 },
    labelStyle: { fill: "rgba(25,22,21,0.65)", fontSize: 11 },
  }))

  return { models, relations, nodes, edges }
}

function tokenizeForMatching(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 4)
}

function scoreRequirementMatch(requirementText: string, candidateText: string) {
  const requirementTokens = new Set(tokenizeForMatching(requirementText))
  const candidateTokens = new Set(tokenizeForMatching(candidateText))
  let score = 0

  requirementTokens.forEach((token) => {
    if (candidateTokens.has(token)) {
      score += 1
    }
  })

  return score
}

function findRelatedFeatureIds(
  requirementText: string,
  features: BackendProjectState["features"],
  fallbackIndex?: number
) {
  const matches = features
    .map((feature, index) => ({
      id: feature.id,
      score: scoreRequirementMatch(
        requirementText,
        [feature.title, feature.summary, feature.complexityNote, ...feature.variations, ...feature.acceptance].join(" ")
      ),
      index,
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map((entry) => entry.id)

  if (matches.length > 0) {
    return matches
  }

  return typeof fallbackIndex === "number" && features[fallbackIndex] ? [features[fallbackIndex].id] : []
}

function findRelatedStoryIds(
  requirementText: string,
  stories: BackendProjectState["userStories"],
  fallbackIndex?: number
) {
  const matches = stories
    .map((story, index) => ({
      id: story.id,
      score: scoreRequirementMatch(
        requirementText,
        [story.title, story.summary, story.tradeoff, story.complexityNote, story.previewTitle, story.previewDescription].join(" ")
      ),
      index,
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map((entry) => entry.id)

  if (matches.length > 0) {
    return matches
  }

  return typeof fallbackIndex === "number" && stories[fallbackIndex] ? [stories[fallbackIndex].id] : []
}

function buildRequirementsView(brief: BriefState, features: BackendProjectState["features"], stories: BackendProjectState["userStories"]) {
  const scopedRequirements: RequirementView[] = brief.scope.map((item, index) => ({
    id: `REQ-F-${String(index + 1).padStart(2, "0")}`,
    title: item || `Functional requirement ${index + 1}`,
    detail: features[index]?.summary || "Derived from the approved product scope.",
    kind: "functional",
    status: "approved",
    featureIds: findRelatedFeatureIds([item, features[index]?.summary ?? ""].join(" "), features, index),
    storyIds: findRelatedStoryIds([item, features[index]?.summary ?? ""].join(" "), stories, index),
  }))

  const deliveryRequirements: RequirementView[] = brief.deliverables.map((item, index) => ({
    id: `REQ-D-${String(index + 1).padStart(2, "0")}`,
    title: item || `Deliverable requirement ${index + 1}`,
    detail: stories[index]?.summary || "Must produce a reviewable implementation artifact.",
    kind: "functional",
    status: "derived",
    featureIds: findRelatedFeatureIds([item, stories[index]?.summary ?? ""].join(" "), features, index),
    storyIds: findRelatedStoryIds([item, stories[index]?.summary ?? ""].join(" "), stories, index),
  }))

  const riskRequirements: RequirementView[] = brief.risks.map((item, index) => ({
    id: `REQ-NF-${String(index + 1).padStart(2, "0")}`,
    title: item || `Non-functional requirement ${index + 1}`,
    detail: "Tracked as a quality or delivery risk that affects implementation planning.",
    kind: "non-functional",
    status: "draft",
    featureIds: findRelatedFeatureIds(item, features, index),
    storyIds: findRelatedStoryIds(item, stories, index),
  }))

  return [...scopedRequirements, ...deliveryRequirements, ...riskRequirements]
}

function buildDependencyGraph(
  features: BackendProjectState["features"],
  stories: BackendProjectState["userStories"],
  mode: "features" | "stories",
  activeId?: string,
  highlightedIds: string[] = []
) {
  const items = mode === "features" ? features : stories
  const highlightedIdSet = new Set(highlightedIds)
  const nodeWidth = 220
  const nodes = items.map((item, index) => ({
    id: item.id,
    position: {
      x: (index % 2) * 250,
      y: Math.floor(index / 2) * 130,
    },
    data: {
      label:
        mode === "features"
          ? `${item.id}\n${item.title}\nEst. ${item.estimate}`
          : `${item.id}\n${item.title}\nEst. ${item.estimate}`,
    },
    style: {
      width: nodeWidth,
      borderRadius: 16,
      border:
        item.id === activeId
          ? "1px solid rgba(16,185,129,0.55)"
          : highlightedIdSet.has(item.id)
            ? "1px solid rgba(234,179,8,0.45)"
            : "1px solid rgba(25,22,21,0.12)",
      background:
        item.id === activeId
          ? "rgba(16,185,129,0.12)"
          : highlightedIdSet.has(item.id)
            ? "rgba(234,179,8,0.12)"
            : "rgba(255,255,255,0.92)",
      padding: 14,
      fontSize: 12,
      lineHeight: 1.45,
      whiteSpace: "pre-line" as const,
      color: "#191615",
      boxShadow:
        item.id === activeId
          ? "0 16px 36px rgba(16,185,129,0.16)"
          : highlightedIdSet.has(item.id)
            ? "0 16px 36px rgba(234,179,8,0.12)"
            : "0 12px 30px rgba(25,22,21,0.06)",
      cursor: "pointer",
    },
  }))

  const edges = items.flatMap((item, index) =>
    item.dependencyIds.map((dependencyId) => ({
      id: `${dependencyId}-${item.id}-${index}`,
      source: dependencyId,
      target: item.id,
      animated: true,
      style: {
        stroke:
          highlightedIdSet.has(item.id) && highlightedIdSet.has(dependencyId)
            ? "rgba(234,179,8,0.75)"
            : "rgba(16,185,129,0.65)",
        strokeWidth: highlightedIdSet.has(item.id) && highlightedIdSet.has(dependencyId) ? 2 : 1.5,
      },
    }))
  )

  return { nodes, edges }
}

function TraceBreadcrumb({ segments }: { segments: TraceSegment[] }) {
  if (segments.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[14px] border border-border/40 bg-background/60 px-3 py-2">
      {segments.map((segment, index) => (
        <div key={`${segment.label}-${segment.value}-${index}`} className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">{segment.label}</span>
          <span
            className={cn(
              "rounded-full border px-2.5 py-1 text-[10px] font-medium",
              segment.tone === "primary" && "border-primary/25 bg-primary/10 text-primary",
              segment.tone === "accent" && "border-chart-2/30 bg-chart-2/10 text-chart-2",
              (!segment.tone || segment.tone === "default") && "border-border/40 bg-background/80 text-foreground/85"
            )}
          >
            {segment.value}
          </span>
          {index < segments.length - 1 ? <span className="text-[11px] text-muted-foreground/60">→</span> : null}
        </div>
      ))}
    </div>
  )
}

function Icon({ name, className }: { name: string; className?: string }) {
  const common = "size-4 stroke-[1.8]"
  switch (name) {
    case "search":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cn(common, className)}>
          <circle cx="11" cy="11" r="6" stroke="currentColor" />
          <path d="m20 20-4.2-4.2" stroke="currentColor" strokeLinecap="round" />
        </svg>
      )
    case "send":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cn(common, className)}>
          <path d="M4 12 20 4l-4 16-3.5-5L4 12Z" stroke="currentColor" strokeLinejoin="round" />
          <path d="M12.5 15 20 4" stroke="currentColor" strokeLinecap="round" />
        </svg>
      )
    case "spark":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cn(common, className)}>
          <path d="m12 3 1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3Z" stroke="currentColor" strokeLinejoin="round" />
        </svg>
      )
    case "pulse":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cn(common, className)}>
          <path d="M3 12h4l2.5-5 4 10 2.5-5H21" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case "branch":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cn(common, className)}>
          <circle cx="6" cy="6" r="2.5" stroke="currentColor" />
          <circle cx="18" cy="6" r="2.5" stroke="currentColor" />
          <circle cx="18" cy="18" r="2.5" stroke="currentColor" />
          <path d="M8.5 6H15.5M18 8.5V15.5M8.5 6V18H15.5" stroke="currentColor" strokeLinecap="round" />
        </svg>
      )
    case "users":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cn(common, className)}>
          <path d="M16 19a4 4 0 0 0-8 0" stroke="currentColor" strokeLinecap="round" />
          <circle cx="12" cy="9" r="3" stroke="currentColor" />
          <path d="M20 19a3 3 0 0 0-3-3" stroke="currentColor" strokeLinecap="round" />
          <path d="M17 6.5a2.5 2.5 0 1 1 0 5" stroke="currentColor" strokeLinecap="round" />
        </svg>
      )
    case "target":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cn(common, className)}>
          <circle cx="12" cy="12" r="8" stroke="currentColor" />
          <circle cx="12" cy="12" r="4" stroke="currentColor" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        </svg>
      )
    case "plus":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cn(common, className)}>
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeLinecap="round" />
        </svg>
      )
    case "close":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cn(common, className)}>
          <path d="m7 7 10 10M17 7 7 17" stroke="currentColor" strokeLinecap="round" />
        </svg>
      )
    case "cpu":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cn(common, className)}>
          <rect x="7" y="7" width="10" height="10" rx="2" stroke="currentColor" />
          <path d="M9.5 1.5v3M14.5 1.5v3M9.5 19.5v3M14.5 19.5v3M1.5 9.5h3M1.5 14.5h3M19.5 9.5h3M19.5 14.5h3" stroke="currentColor" strokeLinecap="round" />
          <path d="M10 10h4v4h-4z" stroke="currentColor" />
        </svg>
      )
    case "database":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cn(common, className)}>
          <ellipse cx="12" cy="5" rx="9" ry="3" stroke="currentColor" />
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" stroke="currentColor" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" stroke="currentColor" />
        </svg>
      )
    case "layout":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cn(common, className)}>
          <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" />
          <path d="M3 9h18M9 21V9" stroke="currentColor" />
        </svg>
      )
    case "code":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cn(common, className)}>
          <polyline points="16 18 22 12 16 6" stroke="currentColor" strokeLinejoin="round" strokeLinecap="round" />
          <polyline points="8 6 2 12 8 18" stroke="currentColor" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      )
    case "file":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cn(common, className)}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" />
          <polyline points="14 2 14 8 20 8" stroke="currentColor" />
        </svg>
      )
    case "folder":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cn(common, className)}>
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" stroke="currentColor" />
        </svg>
      )
    case "terminal":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cn(common, className)}>
          <polyline points="4 17 10 11 4 5" stroke="currentColor" strokeLinejoin="round" strokeLinecap="round" />
          <line x1="12" y1="19" x2="20" y2="19" stroke="currentColor" strokeLinecap="round" />
        </svg>
      )
    case "external-link":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cn(common, className)}>
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="15 3 21 3 21 9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="10" y1="14" x2="21" y2="3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case "play":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cn(common, className)}>
          <polygon points="5 3 19 12 5 21 5 3" stroke="currentColor" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      )
    case "shield":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cn(common, className)}>
          <path d="M12 3 5 6v6c0 4.5 2.8 7.8 7 9 4.2-1.2 7-4.5 7-9V6l-7-3Z" stroke="currentColor" strokeLinejoin="round" />
          <path d="m9.5 12 1.7 1.7 3.6-3.9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case "chart":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cn(common, className)}>
          <path d="M4 19h16" stroke="currentColor" strokeLinecap="round" />
          <path d="M7 16v-4M12 16V8M17 16V5" stroke="currentColor" strokeLinecap="round" />
        </svg>
      )
    case "sun":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cn(common, className)}>
          <circle cx="12" cy="12" r="4" stroke="currentColor" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" stroke="currentColor" strokeLinecap="round" />
        </svg>
      )
    case "moon":
      return (
        <svg viewBox="0 0 24 24" fill="none" className={cn(common, className)}>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      )
    default:
      return null
  }
}

function IDEHeader({ title, icon, rightNode }: { title: string; icon: string; rightNode?: ReactNode }) {
  return (
    <div className="flex h-[42px] shrink-0 items-center justify-between border-b border-white/5 bg-black/10 px-4 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <Icon name={icon} className="size-[15px] text-foreground opacity-60" />
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground/80">{title}</h2>
      </div>
      {rightNode}
    </div>
  )
}

const fallbackSecurityReport = {
  status: "idle" as const,
  summary: "Security review has not started yet.",
  issues: [],
}

const fallbackMergeReport = {
  status: "idle" as const,
  summary: "Merge & integration has not started yet.",
  mergedStoryIds: [],
  changelog: [],
}

const fallbackProjectHealth = {
  status: "idle" as const,
  summary: "Project review has not been generated yet.",
  progress: 0,
  coverage: "No merged stories yet.",
  technicalDebt: [],
  nextActions: [],
}

export function IdeationDashboard({
  initialProject,
  initialProjectId,
}: {
  initialProject: BackendProjectState
  initialProjectId: string
}) {
  const editorRef = useRef<HTMLTextAreaElement | null>(null)
  const terminalInputRef = useRef<HTMLInputElement | null>(null)
  const saveTimeoutRef = useRef<number | null>(null)
  const briefSaveTimeoutRef = useRef<number | null>(null)
  const { theme, setTheme } = useTheme()
  const [isHydrated, setIsHydrated] = useState(false)

  const [currentStage, setCurrentStage] = useState<StageKey>(initialProject.currentStage)
  const [search, setSearch] = useState(initialProject.search)
  const [brief, setBrief] = useState(initialProject.brief)
  const [generalMessages, setGeneralMessages] = useState(initialProject.messages?.general ?? [])
  const [composer, setComposer] = useState("")
  const [activity, setActivity] = useState(initialProject.activity)
  const [currentProjectId] = useState(initialProjectId)
  const [requirements, setRequirements] = useState<RequirementView[]>((initialProject as BackendProjectState & { requirements?: RequirementView[] }).requirements ?? [])
  const [selectedFeatureId, setSelectedFeatureId] = useState(initialProject.selectedFeatureId)
  const [selectedStoryId, setSelectedStoryId] = useState(initialProject.selectedStoryId)
  const [selectedFileId, setSelectedFileId] = useState(initialProject.workspace.selectedFileId)
  const [selectedExplorerPath, setSelectedExplorerPath] = useState(initialProject.workspace.folders[0]?.path ?? "docs")
  const [docTab, setDocTab] = useState<"business" | "tech">("business")
  const [autoSave, setAutoSave] = useState(true)
  const [appGenerated, setAppGenerated] = useState(initialProject.preview.appGenerated)
  const [previewOpened, setPreviewOpened] = useState(initialProject.preview.previewOpened)
  const [slashMenuOpen, setSlashMenuOpen] = useState(false)
  const [slashAction, setSlashAction] = useState<SlashAction>("refactor")
  const [slashPrompt, setSlashPrompt] = useState("")
  const [terminalSlashMenuOpen, setTerminalSlashMenuOpen] = useState(false)
  const [terminalSlashAction, setTerminalSlashAction] = useState<TerminalSlashAction>("command")
  const [terminalSlashPrompt, setTerminalSlashPrompt] = useState("")
  const [workspaceCreateKind, setWorkspaceCreateKind] = useState<"file" | "folder" | null>(null)
  const [workspaceCreateName, setWorkspaceCreateName] = useState("")
  const [workspaceCreateParentPath, setWorkspaceCreateParentPath] = useState("")
  const [featureRequirementFilterId, setFeatureRequirementFilterId] = useState("")
  const [storyRequirementFilterId, setStoryRequirementFilterId] = useState("")
  const [isGeneratingFeatures, setIsGeneratingFeatures] = useState(false)
  const [isGeneratingRequirements, setIsGeneratingRequirements] = useState(false)
  const [isGeneratingStories, setIsGeneratingStories] = useState(false)
  const [isGeneratingCode, setIsGeneratingCode] = useState(false)
  const [isSendingMessage, setIsSendingMessage] = useState(false)
  const [isAiThinking, setIsAiThinking] = useState(false)
  const [isGeneratingSecurityReview, setIsGeneratingSecurityReview] = useState(false)
  const [isRunningMerge, setIsRunningMerge] = useState(false)
  const [isGeneratingProjectReview, setIsGeneratingProjectReview] = useState(false)
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false)
  const [codeGenerationStatus, setCodeGenerationStatus] = useState<{
    stage: "idle" | "running" | "completed" | "failed"
    storyId: string
    detail: string
  }>({
    stage: "idle",
    storyId: "",
    detail: "Așteaptă o user story pentru a porni generarea codului.",
  })

  const [terminalHistory, setTerminalHistory] = useState<TerminalLine[]>([
    { type: "system", text: "Luminescent OS v1.2.0 initialized." },
    { type: "system", text: "Type 'help' to see available commands or 'npm run dev' for the virtual preview runtime." }
  ])
  const [terminalInput, setTerminalInput] = useState("")

  const handleTerminalSubmit = () => {
    if (!terminalInput.trim()) return;
    const cmd = terminalInput.trim();
    setTerminalHistory(prev => [...prev, { type: "cmd", text: `root@ide:~$ ${cmd}` }]);
    
    setTimeout(() => {
      if (cmd === "npm run dev" || cmd === "npm start") {
        setTerminalHistory(prev => [
          ...prev,
          {
            type: "trace",
            text: buildAiTrace("terminal preview command", [
              "validate command and map it to the virtual preview runtime",
              "prepare preview generation request from the current workspace",
              "wait for backend preview state to be updated",
              "announce runtime endpoint in the terminal",
            ]),
          },
          { type: "out", text: "starting virtual preview runtime...\n- validating stage gates\n- requesting preview generation from backend" },
        ]);
        void requestProjectUpdate("/api/project", {
          method: "PATCH",
          body: JSON.stringify({ type: "generate-preview" }),
        })
          .then(() => {
            setTerminalHistory((prev) => [
              ...prev,
              { type: "out", text: "virtual preview runtime ready in 140 ms\n\n  ➜  Runtime: luminescent://live-preview" },
            ])
          })
          .catch((error) => {
            const message = error instanceof Error ? error.message : "Preview request failed"
            setTerminalHistory((prev) => [...prev, { type: "error", text: `preview:failed\n${message}` }])
          })
      } else if (cmd === "clear") {
        setTerminalHistory([]);
      } else if (cmd === "help") {
        setTerminalHistory(prev => [
          ...prev,
          {
            type: "trace",
            text: buildAiTrace("terminal help", [
              "inspect available terminal shortcuts",
              "return the small built-in command set",
            ]),
          },
          { type: "out", text: "Available commands:\n  npm run dev   Start virtual preview runtime and jump to Preview\n  clear         Clear console\n  help          Show this message" },
        ]);
      } else {
        setTerminalHistory(prev => [...prev, { type: "error", text: `bash: ${cmd}: command not found` }]);
      }
    }, 400);
    setTerminalInput("");
  }

  const [collaboratorsState, setCollaboratorsState] = useState(initialProject.collaborators ?? [])
  const [subagentsState, setSubagentsState] = useState(initialProject.agents ?? [])
  const [agentRunsState, setAgentRunsState] = useState(initialProject.agentRuns ?? [])
  const [artifactsState, setArtifactsState] = useState(initialProject.artifacts ?? [])
  const [features, setFeatures] = useState(initialProject.features ?? [])
  const [userStories, setUserStories] = useState(initialProject.userStories ?? [])
  const [securityReport, setSecurityReport] = useState(initialProject.securityReport ?? fallbackSecurityReport)
  const [mergeReport, setMergeReport] = useState(initialProject.mergeReport ?? fallbackMergeReport)
  const [projectHealth, setProjectHealth] = useState(initialProject.projectHealth ?? fallbackProjectHealth)

  const selectedFeature = features.find((item) => item.id === selectedFeatureId) ?? features[0]
  const selectedStory = userStories.find((item) => item.id === selectedStoryId) ?? userStories[0]
  const selectedVariant = selectedStory?.variants.find((item) => item.id === selectedStory.selectedVariantId) ?? selectedStory?.variants[0]
  const schemaDiagram = useMemo(() => parseSchemaDiagram(brief.dbSchema), [brief.dbSchema])
  const requirementsView = useMemo(() => buildRequirementsView(brief, features, userStories), [brief, features, userStories])
  const activeFeatureRequirement = requirementsView.find((requirement) => requirement.id === featureRequirementFilterId)
  const activeStoryRequirement = requirementsView.find((requirement) => requirement.id === storyRequirementFilterId)
  const traceRequirement = useMemo(() => {
    if (activeStoryRequirement) {
      return activeStoryRequirement
    }

    if (activeFeatureRequirement) {
      return activeFeatureRequirement
    }

    if (selectedStory) {
      return requirementsView.find((requirement) => requirement.storyIds.includes(selectedStory.id))
    }

    if (selectedFeature) {
      return requirementsView.find((requirement) => requirement.featureIds.includes(selectedFeature.id))
    }

    return undefined
  }, [activeFeatureRequirement, activeStoryRequirement, requirementsView, selectedFeature, selectedStory])
  const activeFeatureRequirementNodeIds = useMemo(() => activeFeatureRequirement?.featureIds ?? [], [activeFeatureRequirement])
  const activeStoryRequirementNodeIds = useMemo(() => activeStoryRequirement?.storyIds ?? [], [activeStoryRequirement])
  const highlightedFeatureRequirementIds = useMemo(
    () => new Set(requirementsView.filter((requirement) => selectedFeature && requirement.featureIds.includes(selectedFeature.id)).map((requirement) => requirement.id)),
    [requirementsView, selectedFeature]
  )
  const highlightedStoryRequirementIds = useMemo(
    () => new Set(requirementsView.filter((requirement) => selectedStory && requirement.storyIds.includes(selectedStory.id)).map((requirement) => requirement.id)),
    [requirementsView, selectedStory]
  )
  const filteredFeatures = useMemo(() => {
    if (!activeFeatureRequirement) {
      return features
    }

    return features.filter((feature) => activeFeatureRequirement.featureIds.includes(feature.id))
  }, [activeFeatureRequirement, features])
  const filteredStories = useMemo(() => {
    if (!activeStoryRequirement) {
      return userStories
    }

    return userStories.filter((story) => activeStoryRequirement.storyIds.includes(story.id))
  }, [activeStoryRequirement, userStories])
  const featureDependencyGraph = useMemo(
    () => buildDependencyGraph(filteredFeatures, userStories, "features", selectedFeature?.id, activeFeatureRequirementNodeIds),
    [activeFeatureRequirementNodeIds, filteredFeatures, userStories, selectedFeature?.id]
  )
  const storyDependencyGraph = useMemo(
    () => buildDependencyGraph(features, filteredStories, "stories", selectedStory?.id, activeStoryRequirementNodeIds),
    [activeStoryRequirementNodeIds, features, filteredStories, selectedStory?.id]
  )
  const [workspaceFolders, setWorkspaceFolders] = useState<WorkspaceFolder[]>(initialProject.workspace?.folders ?? [])
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFile[]>(initialProject.workspace?.files ?? [])
  const activeFile = workspaceFiles.find((file) => file.id === selectedFileId) ?? workspaceFiles[0]
  const [projectVersion, setProjectVersion] = useState(initialProject.updatedAt)
  const hasFeatures = features.length > 0
  const hasRequirements = requirements.length > 0
  const hasStories = userStories.length > 0
  const hasWorkspaceFiles = workspaceFiles.length > 0
  const securityCounts = useMemo(
    () => ({
      high: securityReport.issues.filter((issue) => issue.severity === "high").length,
      medium: securityReport.issues.filter((issue) => issue.severity === "medium").length,
      low: securityReport.issues.filter((issue) => issue.severity === "low").length,
    }),
    [securityReport]
  )
  const featureEstimateSummary = useMemo(
    () =>
      ["S", "M", "L", "XL"].map((size) => ({
        size,
        count: filteredFeatures.filter((feature) => feature.estimate === size).length,
      })),
    [filteredFeatures]
  )
  const storyEstimateSummary = useMemo(
    () =>
      ["S", "M", "L", "XL"].map((size) => ({
        size,
        count: filteredStories.filter((story) => story.estimate === size).length,
      })),
    [filteredStories]
  )
  const documentationProgress = useMemo(() => {
    const checks = [
      brief.title.trim(),
      brief.objective.trim(),
      ...brief.audience.map((item) => item.trim()),
      ...brief.scope.map((item) => item.trim()),
      ...brief.deliverables.map((item) => item.trim()),
      ...brief.risks.map((item) => item.trim()),
      brief.architecture.trim(),
      ...brief.techStack.map((item) => item.trim()),
      brief.dbSchema.trim(),
    ]

    const filled = checks.filter(Boolean).length
    return Math.round((filled / checks.length) * 100)
  }, [brief])
  const traceSegments = useMemo(() => {
    const segments: TraceSegment[] = []

    if (traceRequirement) {
      segments.push({ label: "Requirement", value: `${traceRequirement.id} · ${traceRequirement.title}`, tone: "accent" })
    }

    if (selectedFeature) {
      segments.push({ label: "Feature", value: `${selectedFeature.id} · ${selectedFeature.title}`, tone: "primary" })
    }

    if (selectedStory) {
      segments.push({ label: "Story", value: `${selectedStory.id} · ${selectedStory.title}`, tone: "primary" })
    }

    if (selectedVariant) {
      segments.push({ label: "Variant", value: `${selectedVariant.label} · ${selectedVariant.teamName}` })
    }

    if (activeFile) {
      segments.push({ label: "Code", value: activeFile.path })
    }

    return segments
  }, [activeFile, selectedFeature, selectedStory, selectedVariant, traceRequirement])

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  function handleDependencyNodeClick(_: ReactMouseEvent, node: { id: string }) {
    if (features.some((feature) => feature.id === node.id)) {
      void openFeature(node.id)
      return
    }

    if (userStories.some((story) => story.id === node.id)) {
      void chooseStory(node.id)
    }
  }

  function toggleRequirementFilter(mode: "features" | "stories", requirementId: string) {
    if (mode === "features") {
      setFeatureRequirementFilterId((current) => (current === requirementId ? "" : requirementId))
      return
    }

    setStoryRequirementFilterId((current) => (current === requirementId ? "" : requirementId))
  }

  function applyProjectState(project: BackendProjectState) {
    const workspaceFiles = project.workspace?.files ?? []
    const selectedFile =
      workspaceFiles.find((file) => file.id === project.workspace?.selectedFileId) ?? workspaceFiles[0]

    setCurrentStage(project.currentStage)
    setSearch(project.search)
    setBrief(project.brief)
    setRequirements((project as BackendProjectState & { requirements?: RequirementView[] }).requirements ?? [])
    setFeatures(project.features ?? [])
    setSelectedFeatureId(project.selectedFeatureId ?? "")
    setUserStories(project.userStories ?? [])
    setSelectedStoryId(project.selectedStoryId ?? "")
    setGeneralMessages(project.messages?.general ?? [])
    setCollaboratorsState(project.collaborators ?? [])
    setSubagentsState(project.agents ?? [])
    setAgentRunsState(project.agentRuns ?? [])
    setArtifactsState(project.artifacts ?? [])
    setActivity(project.activity ?? [])
    setWorkspaceFolders(project.workspace?.folders ?? [])
    setWorkspaceFiles(project.workspace?.files ?? [])
    setSelectedFileId(project.workspace?.selectedFileId ?? "")
    setSelectedExplorerPath(selectedFile ? getWorkspaceParentPath(selectedFile.path) : project.workspace?.folders?.[0]?.path ?? "")
    setSecurityReport(project.securityReport ?? fallbackSecurityReport)
    setMergeReport(project.mergeReport ?? fallbackMergeReport)
    setProjectHealth(project.projectHealth ?? fallbackProjectHealth)
    setAppGenerated(project.preview?.appGenerated ?? false)
    setPreviewOpened(project.preview?.previewOpened ?? false)
    setProjectVersion(project.updatedAt)
    setIsAiThinking(false)
  }

  async function requestProjectUpdate(url: string, init?: RequestInit) {
    const response = await fetch(withProjectQuery(url, currentProjectId), {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    })

    if (!response.ok) {
      let detail = ""
      try {
        const payload = (await response.json()) as { error?: string }
        detail = payload.error ? `: ${payload.error}` : ""
      } catch {
        try {
          const text = await response.text()
          detail = text ? `: ${text}` : ""
        } catch {}
      }

      throw new Error(`Request failed with status ${response.status}${detail}`)
    }

    const project = (await response.json()) as BackendProjectState
    applyProjectState(project)
    return project
  }

  function queueFileSave(fileId: string, content: string) {
    if (!autoSave) return

    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      void requestProjectUpdate(`/api/workspace/files/${fileId}`, {
        method: "PATCH",
        body: JSON.stringify({ content }),
      }).catch(() => undefined)
    }, 450)
  }

  function queueBriefSave(nextBrief: BriefState) {
    if (!autoSave) return

    if (briefSaveTimeoutRef.current) {
      window.clearTimeout(briefSaveTimeoutRef.current)
    }

    briefSaveTimeoutRef.current = window.setTimeout(() => {
      void requestProjectUpdate("/api/project", {
        method: "PATCH",
        body: JSON.stringify({ type: "update-brief", brief: nextBrief }),
      }).catch(() => undefined)
    }, 500)
  }

  function updateBriefDraft(updater: (current: BriefState) => BriefState) {
    const nextBrief = updater(brief)
    setBrief(nextBrief)
    queueBriefSave(nextBrief)
  }

  function updateBriefList(key: BriefListKey, index: number, value: string) {
    const next = [...brief[key]]
    next[index] = value
    updateBriefDraft((current) => ({ ...current, [key]: next }))
  }

  function addBriefListItem(key: BriefListKey) {
    updateBriefDraft((current) => ({ ...current, [key]: [...current[key], ""] }))
  }

  async function moveToStage(stage: StageKey, detail?: string) {
    await requestProjectUpdate("/api/project", {
      method: "PATCH",
      body: JSON.stringify({ type: "transition-stage", stage, detail }),
    })
  }

  function transitionToStage(stage: StageKey, detail?: string) {
    void moveToStage(stage, detail).catch(() => undefined)
  }

  function openWorkspaceFile(fileId: string) {
    const file = workspaceFiles.find((entry) => entry.id === fileId)
    if (!file) return

    setSelectedFileId(file.id)
    setSelectedExplorerPath(getWorkspaceParentPath(file.path))
    void requestProjectUpdate("/api/workspace/files", {
      method: "POST",
      body: JSON.stringify({ selectedFileId: file.id }),
    }).catch(() => undefined)
  }

  function startWorkspaceCreation(kind: "file" | "folder", parentPath = selectedExplorerPath) {
    setWorkspaceCreateKind(kind)
    setWorkspaceCreateParentPath(parentPath)
    setWorkspaceCreateName("")
  }

  function cancelWorkspaceCreation() {
    setWorkspaceCreateKind(null)
    setWorkspaceCreateName("")
  }

  async function submitWorkspaceCreation() {
    const trimmedName = workspaceCreateName.trim()
    if (!workspaceCreateKind || !trimmedName) return

    if (workspaceCreateKind === "folder") {
      await requestProjectUpdate("/api/workspace/folders", {
        method: "POST",
        body: JSON.stringify({ parentPath: workspaceCreateParentPath, name: trimmedName }),
      })
      cancelWorkspaceCreation()
      return
    }

    await requestProjectUpdate("/api/workspace/files", {
      method: "POST",
      body: JSON.stringify({ parentPath: workspaceCreateParentPath, name: trimmedName }),
    })
    cancelWorkspaceCreation()
  }

  function updateActiveFileContent(nextContent: string) {
    if (!activeFile) return

    setWorkspaceFiles((current) =>
      current.map((file) =>
        file.id === activeFile?.id ? { ...file, content: nextContent } : file
      )
    )
    queueFileSave(activeFile.id, nextContent)
  }

  function openSlashMenu(nextAction: SlashAction = "refactor") {
    setSlashAction(nextAction)
    setSlashPrompt("")
    setSlashMenuOpen(true)
  }

  function closeSlashMenu() {
    setSlashMenuOpen(false)
    setSlashPrompt("")
    window.setTimeout(() => {
      editorRef.current?.focus()
    }, 0)
  }

  function openTerminalSlashMenu(nextAction: TerminalSlashAction = "command") {
    setTerminalSlashAction(nextAction)
    setTerminalSlashPrompt("")
    setTerminalSlashMenuOpen(true)
  }

  function closeTerminalSlashMenu() {
    setTerminalSlashMenuOpen(false)
    setTerminalSlashPrompt("")
    window.setTimeout(() => {
      terminalInputRef.current?.focus()
    }, 0)
  }

  function applySlashCommand() {
    if (!activeFile) return

    const nextContent = createAiEditedContent(activeFile, slashAction, slashPrompt)
    updateActiveFileContent(nextContent)
    setTerminalHistory((current) => [
      ...current,
      {
        type: "trace",
        text: buildAiTrace("slash edit", [
          `read active file ${activeFile.path}`,
          `interpret request as ${slashAction} on the current application surface`,
          `draft file changes from prompt: ${slashPrompt.trim() || "update the active application flow"}`,
          "apply the edit mock directly in the editor and queue autosave",
        ]),
      },
      {
        type: "out",
        text: `AI edit applied on ${activeFile.name} with /${slashAction}${slashPrompt.trim() ? ` -> ${slashPrompt.trim()}` : ""}`,
      },
    ])
    closeSlashMenu()
  }

  function applyTerminalSlashCommand() {
    const aiResult = createTerminalAiResponse(terminalSlashAction, terminalSlashPrompt)

    setTerminalHistory((current) => [
      ...current,
      {
        type: "trace",
        text: buildAiTrace("terminal slash command", [
          `inspect slash mode /${terminalSlashAction}`,
          `interpret prompt: ${terminalSlashPrompt.trim() || "inspect the current terminal flow"}`,
          aiResult.command ? `prepare suggested command: ${aiResult.command}` : "prepare explanation without shell command",
          "print the AI-assisted terminal response",
        ]),
      },
      {
        type: "out",
        text: aiResult.output,
      },
    ])

    if (aiResult.command) {
      setTerminalInput(aiResult.command)
    }

    closeTerminalSlashMenu()
  }

  function handleEditorKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape" && slashMenuOpen) {
      event.preventDefault()
      closeSlashMenu()
      return
    }

    if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) {
      return
    }

    const target = event.currentTarget
    const selectionCollapsed = target.selectionStart === target.selectionEnd
    const previousCharacter = target.value.slice(Math.max(0, target.selectionStart - 1), target.selectionStart)
    const nextCharacter = target.value.slice(target.selectionStart, target.selectionStart + 1)
    const isCommandContext = selectionCollapsed && (!previousCharacter || /[\s([{=:,]/.test(previousCharacter)) && nextCharacter !== "/"

    if (!isCommandContext) {
      return
    }

    event.preventDefault()
    openSlashMenu()
  }

  function handleTerminalKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape" && terminalSlashMenuOpen) {
      event.preventDefault()
      closeTerminalSlashMenu()
      return
    }

    if (event.key === "Enter" && !terminalSlashMenuOpen) {
      handleTerminalSubmit()
      return
    }

    if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) {
      return
    }

    const target = event.currentTarget
    const selectionCollapsed = target.selectionStart === target.selectionEnd
    const previousCharacter = target.value.slice(Math.max(0, (target.selectionStart ?? 0) - 1), target.selectionStart ?? 0)
    const nextCharacter = target.value.slice(target.selectionStart ?? 0, (target.selectionStart ?? 0) + 1)
    const isCommandContext = selectionCollapsed && (!previousCharacter || /\s/.test(previousCharacter)) && nextCharacter !== "/"

    if (!isCommandContext) {
      return
    }

    event.preventDefault()
    openTerminalSlashMenu()
  }

  async function sendMessage() {
    if (isSendingMessage) return

    const trimmed = composer.trim()
    if (!trimmed) return

    const optimisticMessage = {
      id: `pending-${Date.now()}`,
      author: "Alex",
      role: "human" as const,
      text: trimmed,
    }

    setComposer("")
    setIsSendingMessage(true)
    setIsAiThinking(true)
    setGeneralMessages((current) => [...current, optimisticMessage])

    try {
      await requestProjectUpdate("/api/messages", {
        method: "POST",
        body: JSON.stringify({
          channel: "general",
          author: "Alex",
          text: trimmed,
        }),
      })
    } catch (error) {
      setGeneralMessages((current) => current.filter((message) => message.id !== optimisticMessage.id))
      setIsAiThinking(false)
      setComposer(trimmed)
      throw error
    } finally {
      setIsSendingMessage(false)
    }
  }

  async function regenerateDocumentation() {
    await requestProjectUpdate("/api/project", {
      method: "PATCH",
      body: JSON.stringify({ type: "generate-documentation-from-conversation" }),
    })
  }

  async function pushToDocumentation() {
    await regenerateDocumentation()
    await moveToStage("Documentation", "Conversația a fost promovată în documentație.")
  }

  async function approveDocumentation() {
    if (isGeneratingRequirements) return
    setIsGeneratingRequirements(true)
    try {
      await requestProjectUpdate("/api/project", {
        method: "PATCH",
        body: JSON.stringify({ type: "generate-requirements" }),
      })
    } finally {
      setIsGeneratingRequirements(false)
    }
  }

  async function moveToFeatures() {
    if (isGeneratingFeatures) return
    setIsGeneratingFeatures(true)
    try {
      await requestProjectUpdate("/api/project", {
        method: "PATCH",
        body: JSON.stringify({ type: "generate-features" }),
      })
    } finally {
      setIsGeneratingFeatures(false)
    }
  }

  async function openFeature(featureId: string) {
    await requestProjectUpdate("/api/project", {
      method: "PATCH",
      body: JSON.stringify({ type: "select-feature", featureId }),
    })
  }

  async function moveToUserStories() {
    if (isGeneratingStories) return
    setIsGeneratingStories(true)
    try {
      await requestProjectUpdate("/api/project", {
        method: "PATCH",
        body: JSON.stringify({ type: "generate-user-stories" }),
      })
    } finally {
      setIsGeneratingStories(false)
    }
  }

  async function chooseStory(storyId: string) {
    await requestProjectUpdate("/api/project", {
      method: "PATCH",
      body: JSON.stringify({ type: "select-story", storyId }),
    })
  }

  async function chooseVariant(storyId: string, variantId: string) {
    await requestProjectUpdate("/api/project", {
      method: "PATCH",
      body: JSON.stringify({ type: "select-variant", storyId, variantId }),
    })
  }

  async function moveToPlanning() {
    await moveToStage("Planning", "User stories au fost trimise către etapa de planning și assignment.")
  }

  async function approveStory() {
    if (isGeneratingCode) return
    const storyId = selectedStory?.id ?? ""
    setIsGeneratingCode(true)
    setCodeGenerationStatus({
      stage: "running",
      storyId,
      detail: `Pornesc regenerarea workspace-ului pentru ${storyId || "story-ul selectat"} cu ${selectedVariant?.label ?? "varianta selectată"}.`,
    })
    setTerminalHistory((prev) => [
      ...prev,
      { type: "system", text: `codegen:start ${storyId || "selected-story"}` },
      {
        type: "trace",
        text: buildAiTrace("generate code", [
          `resolve selected story: ${storyId || "selected-story"}`,
          `resolve selected variant: ${selectedVariant?.label ?? "selected-variant"}`,
          "read brief, selected feature, and selected story context",
          "build or refresh the workspace scaffold in backend",
          "merge generated files into Final Code and focus the runtime entrypoint",
        ]),
      },
      { type: "out", text: `Generating code for ${storyId || "selected story"}...\n- selecting story context\n- selecting implementation variant\n- building workspace scaffold\n- preparing Final Code editor` },
    ])
    try {
      await requestProjectUpdate("/api/project", {
        method: "PATCH",
        body: JSON.stringify({ type: "generate-code" }),
      })
      setCodeGenerationStatus({
        stage: "completed",
        storyId,
        detail: `Workspace-ul pentru ${storyId || "story-ul selectat"} este gata în Final Code cu ${selectedVariant?.label ?? "varianta selectată"}.`,
      })
      setTerminalHistory((prev) => [
        ...prev,
        { type: "out", text: `codegen:done ${storyId || "selected-story"}\nWorkspace ready. You can now inspect and edit the generated files.` },
      ])
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown code generation error"
      setCodeGenerationStatus({
        stage: "failed",
        storyId,
        detail: `Generarea codului a eșuat pentru ${storyId || "story-ul selectat"}.`,
      })
      setTerminalHistory((prev) => [
        ...prev,
        { type: "error", text: `codegen:failed ${storyId || "selected-story"}\n${message}` },
      ])
      throw error
    } finally {
      setIsGeneratingCode(false)
    }
  }

  async function generateCodeForStory(storyId: string) {
    if (isGeneratingCode) return
    setIsGeneratingCode(true)
    setCodeGenerationStatus({
      stage: "running",
      storyId,
      detail: `Pornesc regenerarea workspace-ului pentru ${storyId} cu varianta aleasă.`,
    })
    setTerminalHistory((prev) => [
      ...prev,
      { type: "system", text: `codegen:start ${storyId}` },
      {
        type: "trace",
        text: buildAiTrace("generate code for story", [
          `pin story context to ${storyId}`,
          "resolve the selected implementation variant for this story",
          "read implementation brief and active feature dependencies",
          "request workspace scaffold generation for the chosen story",
          "apply generated files and switch focus to Final Code output",
        ]),
      },
      { type: "out", text: `Generating code for ${storyId}...\n- selecting story context\n- selecting implementation variant\n- building workspace scaffold\n- preparing Final Code editor` },
    ])
    try {
      await requestProjectUpdate("/api/project", {
        method: "PATCH",
        body: JSON.stringify({ type: "generate-code", storyId }),
      })
      setCodeGenerationStatus({
        stage: "completed",
        storyId,
        detail: `Workspace-ul pentru ${storyId} este gata în Final Code cu varianta aleasă.`,
      })
      setTerminalHistory((prev) => [
        ...prev,
        { type: "out", text: `codegen:done ${storyId}\nWorkspace ready. You can now inspect and edit the generated files.` },
      ])
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown code generation error"
      setCodeGenerationStatus({
        stage: "failed",
        storyId,
        detail: `Generarea codului a eșuat pentru ${storyId}.`,
      })
      setTerminalHistory((prev) => [
        ...prev,
        { type: "error", text: `codegen:failed ${storyId}\n${message}` },
      ])
      throw error
    } finally {
      setIsGeneratingCode(false)
    }
  }

  async function regenerateCode() {
    const storyId = selectedStory?.id ?? ""
    if (isGeneratingCode) return
    setIsGeneratingCode(true)
    setCodeGenerationStatus({
      stage: "running",
      storyId,
      detail: `Regenerare manuală pentru ${storyId || "story-ul selectat"} cu ${selectedVariant?.label ?? "varianta selectată"}.`,
    })
    setTerminalHistory((prev) => [
      ...prev,
      { type: "system", text: `codegen:refresh ${storyId || "selected-story"}` },
      {
        type: "trace",
        text: buildAiTrace("regenerate code", [
          `reuse current story context: ${storyId || "selected-story"}`,
          `reuse selected variant: ${selectedVariant?.label ?? "selected-variant"}`,
          "compare existing workspace with the incoming generated scaffold",
          "preserve editable files where possible and refresh generated runtime files",
          "persist the refreshed workspace back into Final Code",
        ]),
      },
      { type: "out", text: `Regenerating workspace for ${storyId || "selected story"}...\nExisting edits are preserved whenever possible.` },
    ])
    try {
      await requestProjectUpdate("/api/project", {
        method: "PATCH",
        body: JSON.stringify({ type: "regenerate-workspace" }),
      })
      setCodeGenerationStatus({
        stage: "completed",
        storyId,
        detail: `Regenerarea pentru ${storyId || "story-ul selectat"} s-a încheiat.`,
      })
      setTerminalHistory((prev) => [
        ...prev,
        { type: "out", text: `codegen:refresh-done ${storyId || "selected-story"}\nWorkspace refreshed.` },
      ])
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown code regeneration error"
      setCodeGenerationStatus({
        stage: "failed",
        storyId,
        detail: `Regenerarea codului a eșuat pentru ${storyId || "story-ul selectat"}.`,
      })
      setTerminalHistory((prev) => [
        ...prev,
        { type: "error", text: `codegen:refresh-failed ${storyId || "selected-story"}\n${message}` },
      ])
      throw error
    } finally {
      setIsGeneratingCode(false)
    }
  }

  async function runSecurityReviewStage() {
    if (isGeneratingSecurityReview) return
    setIsGeneratingSecurityReview(true)
    setTerminalHistory((prev) => [
      ...prev,
      { type: "system", text: `security:start ${selectedStory?.id || "selected-story"}` },
      {
        type: "trace",
        text: buildAiTrace("security review", [
          "inspect the current workspace, requirement trace, and active story",
          "derive OWASP-style findings from generated code and requirements",
          "persist the security report and move the workflow into Security Review",
        ]),
      },
      { type: "out", text: "Running security review...\n- scanning workspace\n- checking requirement trace\n- preparing report for approval" },
    ])

    try {
      await requestProjectUpdate("/api/project", {
        method: "PATCH",
        body: JSON.stringify({ type: "generate-security-review" }),
      })
      setTerminalHistory((prev) => [...prev, { type: "out", text: "security:done\nSecurity report ready for human approval." }])
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown security review error"
      setTerminalHistory((prev) => [...prev, { type: "error", text: `security:failed\n${message}` }])
      throw error
    } finally {
      setIsGeneratingSecurityReview(false)
    }
  }

  async function approveSecurityAndMerge() {
    if (isRunningMerge) return
    setIsRunningMerge(true)
    setTerminalHistory((prev) => [
      ...prev,
      { type: "system", text: `merge:approve ${selectedStory?.id || "selected-story"}` },
      {
        type: "trace",
        text: buildAiTrace("security approval and merge", [
          "approve the reviewed security report for merge handoff",
          "build integration changelog from artifacts and activity feed",
          "persist merge completion for the selected implementation candidate",
        ]),
      },
      { type: "out", text: "Approving security review and running merge...\n- persisting approval\n- compiling changelog\n- integrating merge candidate" },
    ])

    try {
      await requestProjectUpdate("/api/project", {
        method: "PATCH",
        body: JSON.stringify({ type: "approve-security-review" }),
      })
      await requestProjectUpdate("/api/project", {
        method: "PATCH",
        body: JSON.stringify({ type: "run-merge" }),
      })
      setTerminalHistory((prev) => [...prev, { type: "out", text: "merge:done\nMerge & integration completed." }])
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown merge error"
      setTerminalHistory((prev) => [...prev, { type: "error", text: `merge:failed\n${message}` }])
      throw error
    } finally {
      setIsRunningMerge(false)
    }
  }

  async function runProjectReviewStage() {
    if (isGeneratingProjectReview) return
    setIsGeneratingProjectReview(true)
    setTerminalHistory((prev) => [
      ...prev,
      { type: "system", text: "project-review:start" },
      {
        type: "trace",
        text: buildAiTrace("project review", [
          "collect merge output, artifact history, and workflow status",
          "compute progress, coverage, and technical debt summary",
          "persist the health report for final preview handoff",
        ]),
      },
      { type: "out", text: "Generating project review...\n- summarizing merge output\n- computing health metrics\n- preparing preview handoff" },
    ])

    try {
      await requestProjectUpdate("/api/project", {
        method: "PATCH",
        body: JSON.stringify({ type: "generate-project-review" }),
      })
      setTerminalHistory((prev) => [...prev, { type: "out", text: "project-review:done\nProject health report is ready." }])
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown project review error"
      setTerminalHistory((prev) => [...prev, { type: "error", text: `project-review:failed\n${message}` }])
      throw error
    } finally {
      setIsGeneratingProjectReview(false)
    }
  }

  async function generateApplication() {
    if (isGeneratingPreview) return
    setIsGeneratingPreview(true)
    setTerminalHistory((prev) => [
      ...prev,
      { type: "system", text: `preview:start ${selectedStory?.id || "selected-story"}` },
      {
        type: "trace",
        text: buildAiTrace("generate preview", [
          "inspect the current workspace files and runtime entrypoints",
          "prepare the preview stage from the persisted Final Code workspace",
          "bundle the browser runtime through esbuild",
          "open the live preview surface for inspection",
        ]),
      },
      { type: "out", text: "Generating preview from the current workspace...\n- validating entrypoints\n- bundling browser runtime\n- opening Preview stage" },
    ])
    try {
      await requestProjectUpdate("/api/project", {
        method: "PATCH",
        body: JSON.stringify({ type: "generate-preview" }),
      })
      setTerminalHistory((prev) => [
        ...prev,
        { type: "out", text: `preview:done ${selectedStory?.id || "selected-story"}\nPreview stage is ready from the current Final Code workspace.` },
      ])
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown preview generation error"
      setTerminalHistory((prev) => [
        ...prev,
        { type: "error", text: `preview:failed ${selectedStory?.id || "selected-story"}\n${message}` },
      ])
      throw error
    } finally {
      setIsGeneratingPreview(false)
    }
  }

  async function runFullRuntime() {
    await requestProjectUpdate("/api/project", {
      method: "PATCH",
      body: JSON.stringify({ type: "run-full-pipeline" }),
    })
  }

  async function openPreviewWindow() {
    await requestProjectUpdate("/api/project", {
      method: "PATCH",
      body: JSON.stringify({ type: "open-preview" }),
    })
  }

  async function restartFlow() {
    await requestProjectUpdate("/api/project", {
      method: "PATCH",
      body: JSON.stringify({ type: "reset-project" }),
    })
  }

  function renderExplorerTree(parentPath = "", depth = 0): ReactNode {
    const folders = workspaceFolders
      .filter((folder) => getWorkspaceParentPath(folder.path) === parentPath)
      .sort((left, right) => left.path.localeCompare(right.path))
    const files = workspaceFiles
      .filter((file) => getWorkspaceParentPath(file.path) === parentPath)
      .sort((left, right) => left.path.localeCompare(right.path))

    return (
      <>
        {folders.map((folder) => {
          const isSelectedFolder = selectedExplorerPath === folder.path

          return (
            <div key={folder.id} className="space-y-0.5">
              <button
                type="button"
                onClick={() => setSelectedExplorerPath(folder.path)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-[12px] transition-all",
                  isSelectedFolder
                    ? "border-primary/20 bg-primary/8 text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
                style={{ paddingLeft: `${depth * 12 + 10}px` }}
              >
                <Icon name="folder" className={cn("size-3.5 shrink-0", isSelectedFolder ? "text-primary" : "opacity-80")} />
                <span className="truncate">{folder.name}</span>
              </button>
              {renderExplorerTree(folder.path, depth + 1)}
            </div>
          )
        })}

        {files.map((file) => {
          const isActive = activeFile?.id === file.id

          return (
            <button
              key={file.id}
              type="button"
              onClick={() => openWorkspaceFile(file.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-[12px] transition-all",
                isActive
                  ? "border-primary/20 bg-primary/10 text-primary font-medium"
                  : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
              style={{ paddingLeft: `${depth * 12 + 10}px` }}
            >
              <Icon name="file" className="size-3.5 shrink-0 opacity-80" />
              <span className="truncate">{file.name}</span>
            </button>
          )
        })}
      </>
    )
  }

  const filteredStages = stages.filter((stage) => stage.toLowerCase().includes(search.toLowerCase()))

  if (!isHydrated) {
    return (
      <div className="flex h-screen w-full flex-col overflow-hidden bg-background font-sans text-sm text-foreground selection:bg-primary/20">
        <header className="relative z-50 flex h-14 w-full shrink-0 items-center justify-between border-b border-border/40 bg-card/80 px-4 shadow-sm backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
          <div className="flex items-center gap-2.5">
            <div className="grid size-7 place-items-center rounded-[8px] border border-primary/20 bg-gradient-to-br from-primary to-primary/80 shadow-[0_2px_10px_rgba(16,185,129,0.25)]">
              <Icon name="spark" className="size-4 text-primary-foreground" />
            </div>
            <span className="font-brand text-[15px] font-semibold tracking-tight text-foreground">Luminescent</span>
          </div>
        </header>
        <div className="flex flex-1 items-center justify-center bg-background/60">
          <div className="w-full max-w-xl rounded-[24px] border border-border/40 bg-card/70 p-8 shadow-sm">
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-primary">Loading Workspace</div>
            <div className="mt-3 text-[20px] font-semibold tracking-tight text-foreground">Pregătim dashboard-ul colaborativ</div>
            <div className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              Sincronizăm conversația, etapele SDLC și starea proiectului înainte să afișăm interfața completă.
            </div>
            <div className="mt-5 flex items-center gap-2">
              {[0, 1, 2].map((dot) => (
                <span
                  key={dot}
                  className="inline-block size-2 rounded-full bg-primary/80 animate-pulse"
                  style={{ animationDelay: `${dot * 180}ms` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background font-sans text-sm text-foreground selection:bg-primary/20">
      <header className="relative z-50 flex h-14 w-full shrink-0 items-center justify-between border-b border-border/40 bg-card/80 px-4 shadow-sm backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2.5">
            <div className="grid size-7 place-items-center rounded-[8px] border border-primary/20 bg-gradient-to-br from-primary to-primary/80 shadow-[0_2px_10px_rgba(16,185,129,0.25)]">
              <Icon name="spark" className="size-4 text-primary-foreground" />
            </div>
            <span className="font-brand text-[15px] font-semibold tracking-tight text-foreground">Luminescent</span>
          </div>
          <div className="hidden h-5 w-px bg-border/60 sm:block" />
          <nav className="hidden items-center gap-2 sm:flex">
            {topLinks.map((item) => (
              <Button
                key={item}
                size="sm"
                variant="ghost"
                onClick={() => transitionToStage(item, `Navigare rapidă către ${item.toLowerCase()}.`)}
                className={cn(
                  "h-8 rounded-[8px] px-3 text-[12px]",
                  currentStage === item ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span>{isHydrated ? item : ""}</span>
              </Button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative hidden w-72 md:block">
            <Icon name="search" className="absolute left-2.5 top-[9px] size-[14px] text-muted-foreground/60" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filtrează etapele..."
              className="h-8 rounded-[8px] border-border/40 bg-muted/30 pl-8 text-[12px] shadow-inner placeholder:text-muted-foreground/50"
            />
          </div>
          <Badge variant="outline" className="hidden rounded-full border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-widest text-primary sm:inline-flex">
            Userflow First
          </Badge>
          <Button
            size="icon"
            variant="outline"
            className="size-8 rounded-[8px] border-border/40 bg-muted/30 text-foreground/80 shadow-inner hover:bg-muted"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} className="size-4" />
          </Button>
          <Button
            size="sm"
            className="h-8 rounded-[8px] bg-primary text-[12px] font-medium text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_1px_3px_rgba(16,185,129,0.2)] transition-all hover:bg-primary/95"
            onClick={() =>
              currentStage === "Preview"
                ? restartFlow()
                : transitionToStage(stages[Math.min(stages.indexOf(currentStage) + 1, stages.length - 1)], "A fost deschisă etapa următoare din flow.")
            }
          >
            {currentStage === "Preview" ? "Restart Flow" : "Next Step"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 rounded-[8px] border-primary/20 bg-primary/10 px-3 text-[12px] text-primary hover:bg-primary/15"
            onClick={runFullRuntime}
          >
            Run A-Z Runtime
          </Button>
        </div>
      </header>

      <div className="relative flex flex-1 overflow-hidden">
        <div className="pointer-events-none absolute left-1/3 top-1/2 h-[60vw] w-[60vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 opacity-30 blur-[100px] mix-blend-screen" />
        <div className="pointer-events-none absolute right-1/4 top-1/4 h-[40vw] w-[40vw] rounded-full bg-chart-2/5 opacity-20 blur-[100px] mix-blend-screen" />

        <aside className="relative z-10 hidden w-64 shrink-0 flex-col border-r border-white/5 bg-background/50 backdrop-blur-xl lg:flex">
          <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
            <div className="mb-1 flex items-center gap-2 border-b border-border/30 px-2 pb-3">
              <Icon name="layout" className="size-4 text-muted-foreground/70" />
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/70">Workflow</span>
            </div>

            <div className="space-y-[3px]">
              {filteredStages.map((stage) => {
                const active = currentStage === stage
                return (
                  <button
                    key={stage}
                    onClick={() => transitionToStage(stage, `S-a navigat către ${stage.toLowerCase()}.`)}
                    className={cn(
                      "group flex w-full items-start gap-3 rounded-[8px] px-2 py-2 text-left text-[13px] font-medium transition-all duration-200",
                      active ? "bg-primary/10 text-primary shadow-sm ring-1 ring-inset ring-primary/20" : "text-muted-foreground/80 hover:bg-card hover:text-foreground hover:shadow-sm"
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-[22px] shrink-0 place-items-center rounded-[6px] border font-mono text-[9.5px] font-semibold transition-all duration-300",
                        active ? "border-primary/20 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-[0_1px_5px_rgba(16,185,129,0.3)]" : "border-border/50 bg-muted/40 text-muted-foreground/70 group-hover:bg-muted group-hover:text-foreground"
                      )}
                    >
                      {stageNumbers[stage]}
                    </span>
                    <span className="flex flex-col gap-0.5">
                      <span>{isHydrated ? stage : ""}</span>
                      <span className="text-[11px] font-normal leading-snug text-muted-foreground/75">
                        {isHydrated ? stageDescriptions[stage] : ""}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </aside>

        <main className="group relative z-10 flex min-w-0 flex-1 flex-col bg-background dark:bg-black/10">
          {currentStage === "Conversation" && (
            <div className="flex h-full flex-col xl:flex-row">
              <div className="flex min-w-0 flex-1 flex-col">
                <IDEHeader
                  title="Team Conversation"
                  icon="users"
                  rightNode={
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setAutoSave((current) => !current)}
                      className="h-[26px] text-[11px] text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                    >
                      {autoSave ? "Auto-Save On" : "Auto-Save Off"}
                    </Button>
                  }
                />
                <div className="grid flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[1.3fr_0.7fr] lg:p-6">
                  <Card className="flex min-h-[420px] flex-col overflow-hidden rounded-[16px] border-border/40 bg-card/70">
                    <div className="border-b border-border/40 px-4 py-3 flex flex-wrap gap-4 items-center justify-between">
                      <div>
                        <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-primary">
                          Client Discovery AI
                        </div>
                        <p className="mt-1 text-[12px] text-muted-foreground">
                          Un singur chat pentru client discovery. AI-ul comunică precum un consultant senior, pune întrebări bune și propune soluția tehnică atunci când lipsește.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                          Product + Tech in one flow
                        </Badge>
                        <Button size="sm" variant="outline" onClick={restartFlow} className="h-7 rounded-md text-[11px]">
                          Reset project
                        </Button>
                      </div>
                    </div>
                    <div className="flex-1 space-y-4 overflow-y-auto p-4">
                      {generalMessages.length > 0 ? (
                        generalMessages.map((message) => (
                          <div
                            key={message.id}
                            className={cn("flex flex-col gap-1", message.role === "human" ? "items-end" : "items-start")}
                          >
                            <span className="px-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">{message.author}</span>
                            <div
                              className={cn(
                                "max-w-[90%] rounded-[16px] px-3.5 py-2.5 text-[13px] leading-[1.6] shadow-sm",
                                message.role === "human"
                                  ? "rounded-tr-[4px] bg-primary text-primary-foreground"
                                  : "rounded-tl-[4px] border border-border/40 bg-background/80 text-foreground/90"
                              )}
                            >
                              {message.text}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-[16px] border border-dashed border-border/40 bg-background/50 px-4 py-6 text-[13px] leading-relaxed text-muted-foreground">
                          Conversația este goală. Spune pe scurt ce website vrei să construiești, pentru cine este și ce trebuie să facă. AI-ul continuă cu întrebări simple și recomandări tehnice dacă lipsesc.
                        </div>
                      )}
                      {isAiThinking && (
                        <div className="flex flex-col gap-1 items-start">
                          <span className="px-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">Client Discovery AI</span>
                          <div className="max-w-[90%] rounded-[16px] rounded-tl-[4px] border border-primary/20 bg-primary/5 px-3.5 py-3 text-[12px] text-foreground/85 shadow-sm">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-medium text-primary">AI analizează răspunsul</span>
                              {[0, 1, 2].map((dot) => (
                                <span
                                  key={dot}
                                  className="inline-block size-1.5 rounded-full bg-primary/80 animate-pulse"
                                  style={{ animationDelay: `${dot * 180}ms` }}
                                />
                              ))}
                            </div>
                            <div className="mt-2 space-y-1 text-[11px] leading-relaxed text-muted-foreground">
                              <div>• clarifică produsul dorit</div>
                              <div>• extrage funcționalități și constrângeri</div>
                              <div>• pregătește brief-ul pentru livrare</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="border-t border-border/40 bg-card/60 p-3">
                      <div className="flex items-center gap-2">
                        <Input
                          value={composer}
                          onChange={(event) => setComposer(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter") return
                            event.preventDefault()
                            void sendMessage()
                          }}
                          placeholder="Scrie pe scurt ideea, cerința sau răspunsul tău..."
                          className="h-10 rounded-full border-border/50 bg-background/50 px-4 text-[12px]"
                        />
                        <Button size="icon" onClick={() => void sendMessage()} disabled={!composer.trim() || isSendingMessage} className="size-9 rounded-full">
                          <Icon name="send" className="size-3" />
                        </Button>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {starterPrompts.map((prompt) => (
                          <button
                            key={prompt}
                            onClick={() => setComposer(prompt)}
                            className="truncate rounded-full border border-border/60 bg-card px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </Card>

                  <Card className="flex flex-col rounded-[16px] border-border/40 bg-card/70 p-5">
                    <div className="mb-4 space-y-2">
                      <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                        Human + AI
                      </Badge>
                      <h3 className="font-serif text-2xl font-semibold tracking-tight">Din conversație în documentație</h3>
                      <p className="text-[13px] leading-relaxed text-muted-foreground">
                        Aici validăm că un singur chat bun produce documentația completă, atât pentru produs, cât și pentru partea tehnică.
                      </p>
                    </div>
                    <div className="space-y-3 text-[13px]">
                      <div className="rounded-[12px] border border-border/40 bg-background/70 p-3">
                        <div className="mb-1 text-[10px] font-mono uppercase tracking-widest text-primary">Current objective</div>
                        <p className="leading-relaxed text-foreground/85">
                          {brief.objective || "Definește obiectivul principal și transformăm brief-ul în artefacte reale din backend."}
                        </p>
                      </div>
                      <div className="rounded-[12px] border border-border/40 bg-background/70 p-3">
                        <div className="mb-1 text-[10px] font-mono uppercase tracking-widest text-primary">Next artifact</div>
                        <p className="leading-relaxed text-foreground/85">Project brief editabil care va genera use case-uri și preview-uri.</p>
                      </div>
                    </div>
                    <div className="mt-auto flex flex-col gap-2 pt-5">
                      <Button onClick={pushToDocumentation} className="w-full">
                        Construiește documentația
                      </Button>
                      <Button variant="outline" onClick={regenerateDocumentation} className="w-full">
                        AI summarizează conversația
                      </Button>
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {currentStage === "Documentation" && (
            <div className="flex h-full flex-col">
              <IDEHeader
                title="Documentation Builder"
                icon="database"
                rightNode={
                  <Button size="sm" variant="ghost" onClick={regenerateDocumentation} className="h-[26px] text-[11px] text-primary hover:bg-primary/10">
                    Regenerate from chat
                  </Button>
                }
              />
              <div className="flex-1 overflow-y-auto bg-background/20 px-4 py-6 md:px-8 md:py-8">
                <div className="mx-auto max-w-4xl">
                  <div className="space-y-8">
                    <div className="space-y-5">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="rounded-md border-border/50 bg-background/70 text-foreground/80">Draft</Badge>
                        <Badge variant="outline" className="rounded-md border-border/50 bg-background/70 text-foreground/80">AI Synced</Badge>
                        <Badge variant="outline" className="rounded-md border-border/50 bg-background/70 text-foreground/80">{documentationProgress}% complete</Badge>
                      </div>

                      <div id="overview" className="space-y-3">
                        <Textarea
                          value={brief.title}
                          onChange={(event) => updateBriefDraft((current) => ({ ...current, title: event.target.value }))}
                          rows={1}
                          className="min-h-0 resize-none border-none bg-transparent p-0 text-[40px] font-bold leading-tight tracking-tight text-foreground shadow-none outline-none placeholder:text-muted-foreground/30 focus-visible:ring-0 sm:text-[54px]"
                        />
                        <p className="max-w-3xl text-[15px] leading-8 text-muted-foreground">
                          {docTab === "business"
                            ? "Un brief clar, editabil, care poate fi aprobat rapid de echipă înainte de generarea feature-urilor."
                            : "O pagină tehnică simplă pentru validarea arhitecturii, stack-ului și a modelului de date."}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <div className="inline-flex rounded-lg border border-border/40 bg-background/70 p-1">
                          <Button
                            size="sm"
                            variant={docTab === "business" ? "default" : "ghost"}
                            onClick={() => setDocTab("business")}
                            className="h-8 rounded-md px-4 text-[12px]"
                          >
                            Business Plan
                          </Button>
                          <Button
                            size="sm"
                            variant={docTab === "tech" ? "default" : "ghost"}
                            onClick={() => setDocTab("tech")}
                            className="h-8 rounded-md px-4 text-[12px]"
                          >
                            Technical Architecture
                          </Button>
                        </div>
                        <span className="text-[12px] text-muted-foreground">Source: Team Conversation</span>
                      </div>
                    </div>

                    <Separator className="bg-border/40" />

                    <div className="space-y-10">
                      {docTab === "business" && (
                        <div className="space-y-10 animate-in fade-in duration-200">
                          <section id="objective" className="space-y-3">
                            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Objective</div>
                            <Textarea
                              value={brief.objective}
                              onChange={(event) => updateBriefDraft((current) => ({ ...current, objective: event.target.value }))}
                              className="min-h-[140px] resize-none border-none bg-transparent p-0 text-[16px] leading-8 text-foreground/90 shadow-none outline-none focus-visible:ring-0"
                              placeholder="What is the main goal of this product?"
                            />
                          </section>

                          <div className="space-y-10">
                            {(["audience", "scope", "deliverables", "risks"] as BriefListKey[]).map((key) => (
                              <section key={key} id={key} className="space-y-4">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <h3 className="text-[24px] font-semibold tracking-tight text-foreground">{documentationFieldMeta[key].label}</h3>
                                    <p className="mt-1 text-[14px] leading-7 text-muted-foreground">{documentationFieldMeta[key].description}</p>
                                  </div>
                                  <Button size="icon-sm" variant="ghost" onClick={() => addBriefListItem(key)} className="rounded-md">
                                    <Icon name="plus" className="size-3.5" />
                                  </Button>
                                </div>

                                <div className="space-y-2">
                                  {brief[key].map((item, index) => (
                                    <div key={`${key}-${index}`} className="flex items-start gap-3">
                                      <span className="pt-3 text-sm text-muted-foreground">•</span>
                                      <Input
                                        value={item}
                                        onChange={(event) => updateBriefList(key, index, event.target.value)}
                                        className="h-11 rounded-lg border-border/30 bg-transparent px-0 text-[15px] shadow-none focus-visible:ring-0"
                                        placeholder={documentationFieldMeta[key].placeholder}
                                      />
                                    </div>
                                  ))}
                                </div>
                              </section>
                            ))}
                          </div>
                        </div>
                      )}

                      {docTab === "tech" && (
                        <div className="space-y-10 animate-in fade-in duration-200">
                          <section id="architecture" className="space-y-3">
                            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Architecture</div>
                            <Textarea
                              value={brief.architecture}
                              onChange={(event) => updateBriefDraft((current) => ({ ...current, architecture: event.target.value }))}
                              className="min-h-[180px] resize-none border-none bg-transparent p-0 text-[16px] leading-8 text-foreground/90 shadow-none outline-none focus-visible:ring-0"
                              placeholder="Describe how the components interact..."
                            />
                          </section>

                          <section id="blueprint" className="space-y-4">
                            <div>
                              <h3 className="text-[24px] font-semibold tracking-tight text-foreground">Architecture Blueprint</h3>
                              <p className="mt-1 text-[14px] leading-7 text-muted-foreground">O vedere vizuală simplă asupra componentelor majore.</p>
                            </div>
                            <div className="relative h-[360px] overflow-hidden rounded-xl border border-border/40 bg-background/50 shadow-inner md:h-[460px]">
                              <div style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0 }}>
                                <ReactFlow
                                  style={{ width: "100%", height: "100%" }}
                                  nodes={initialArchNodes}
                                  edges={initialArchEdges}
                                  fitView
                                  fitViewOptions={{ padding: 0.2 }}
                                  zoomOnScroll
                                  panOnScroll={false}
                                  selectionOnDrag={false}
                                >
                                  <Background gap={16} size={1} color="rgba(255,255,255,0.05)" />
                                  <Controls showInteractive={false} className="fill-foreground border-border/40 bg-card" />
                                </ReactFlow>
                              </div>
                            </div>
                          </section>

                          <section id="stack" className="space-y-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <h3 className="text-[24px] font-semibold tracking-tight text-foreground">Tech Stack</h3>
                                <p className="mt-1 text-[14px] leading-7 text-muted-foreground">Componentele de bază ale implementării.</p>
                              </div>
                              <Button size="icon-sm" variant="ghost" onClick={() => updateBriefDraft((current) => ({ ...current, techStack: [...current.techStack, ""] }))} className="rounded-md">
                                <Icon name="plus" className="size-3.5" />
                              </Button>
                            </div>

                            <div className="space-y-2">
                              {brief.techStack.map((item, index) => (
                                <div key={`tech-${index}`} className="flex items-start gap-3">
                                  <span className="pt-3 text-sm text-muted-foreground">•</span>
                                  <Input
                                    value={item}
                                    onChange={(event) => {
                                      const next = [...brief.techStack]
                                      next[index] = event.target.value
                                      updateBriefDraft((current) => ({ ...current, techStack: next }))
                                    }}
                                    className="h-11 rounded-lg border-border/30 bg-transparent px-0 font-mono text-[15px] shadow-none focus-visible:ring-0"
                                    placeholder="Add stack component..."
                                  />
                                </div>
                              ))}
                            </div>
                          </section>

                          <section id="schema" className="space-y-4">
                            <div>
                              <h3 className="text-[24px] font-semibold tracking-tight text-foreground">Database Schema</h3>
                              <p className="mt-1 text-[14px] leading-7 text-muted-foreground">Editorul și diagrama live rămân sincronizate, ca să vezi imediat relațiile dintre modele.</p>
                            </div>
                            <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                              <div className="overflow-hidden rounded-xl border border-border/40 bg-background/60">
                                <div className="flex items-center justify-between border-b border-border/40 px-4 py-2.5">
                                  <span className="font-mono text-[11px] text-muted-foreground">schema.prisma</span>
                                  <span className="text-[11px] text-muted-foreground">{schemaDiagram.models.length} models</span>
                                </div>
                                <Textarea
                                  value={brief.dbSchema}
                                  onChange={(event) => updateBriefDraft((current) => ({ ...current, dbSchema: event.target.value }))}
                                  className="min-h-[320px] resize-none border-none bg-transparent p-4 font-mono text-[13px] leading-7 text-foreground/88 shadow-none focus-visible:ring-0"
                                  placeholder="model User { ... }"
                                />
                              </div>

                              <div className="overflow-hidden rounded-xl border border-border/40 bg-background/60">
                                <div className="flex items-center justify-between border-b border-border/40 px-4 py-2.5">
                                  <span className="text-[11px] text-muted-foreground">Schema Map</span>
                                  <span className="text-[11px] text-muted-foreground">{schemaDiagram.relations.length} relations</span>
                                </div>
                                <div className="space-y-3 p-4">
                                  <div className="relative h-[320px] overflow-hidden rounded-lg border border-border/30 bg-background/70">
                                    <div style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0 }}>
                                      <ReactFlow
                                        style={{ width: "100%", height: "100%" }}
                                        nodes={schemaDiagram.nodes}
                                        edges={schemaDiagram.edges}
                                        fitView
                                        fitViewOptions={{ padding: 0.2 }}
                                        zoomOnScroll
                                        panOnScroll={false}
                                        selectionOnDrag={false}
                                      >
                                        <Background gap={18} size={1} color="rgba(25,22,21,0.08)" />
                                        <Controls showInteractive={false} className="fill-foreground border-border/40 bg-card" />
                                      </ReactFlow>
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    {schemaDiagram.relations.length > 0 ? (
                                      schemaDiagram.relations.map((relation) => (
                                        <div key={`${relation.from}-${relation.field}`} className="rounded-lg border border-border/30 bg-background/70 px-3 py-2 text-[12px] text-foreground/85">
                                          <span className="font-medium">{relation.from}</span>
                                          {" -> "}
                                          <span className="font-medium">{relation.to}</span>
                                          <span className="text-muted-foreground"> via `{relation.field}`</span>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="rounded-lg border border-dashed border-border/40 px-3 py-3 text-[12px] text-muted-foreground">
                                        Nu am detectat încă relații între modele. Adaugă câmpuri care referă alte modele pentru a vedea conexiunile.
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </section>
                        </div>
                      )}
                    </div>

                    <Separator className="bg-border/40" />

                    <div className="flex items-center justify-between gap-4 pb-8">
                      <p className="text-[13px] text-muted-foreground">Ready to move this page into feature generation.</p>
                      <Button onClick={approveDocumentation} size="sm" className="h-10 rounded-md bg-primary px-5 text-[12px] font-medium text-primary-foreground transition-all hover:bg-primary/90">
                        {isGeneratingRequirements ? "Generating requirements..." : <>Generate Requirements <Icon name="play" className="size-3" /></>}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStage === "Requirements" && (
            <div className="flex h-full flex-col">
              <IDEHeader
                title="Requirements Review"
                icon="target"
                rightNode={
                  <Button size="sm" variant="ghost" onClick={moveToFeatures} disabled={isGeneratingFeatures} className="h-[26px] text-[11px] text-primary hover:bg-primary/10">
                    {isGeneratingFeatures ? "Generating..." : "Generate Features"}
                  </Button>
                }
              />
              <div className="grid flex-1 gap-4 overflow-y-auto p-4 xl:grid-cols-[1.1fr_0.9fr] xl:p-6">
                <Card className="rounded-[16px] border-border/40 bg-card/70 p-5">
                  <div className="space-y-2">
                    <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                      Derived Requirements
                    </Badge>
                    <h3 className="font-serif text-2xl font-semibold tracking-tight">Approval-ready requirement set</h3>
                    <p className="text-[13px] leading-relaxed text-muted-foreground">
                      Requirements-urile sunt extrase din brief și pot fi folosite ca sursă stabilă pentru feature planning și user stories.
                    </p>
                  </div>
                  <div className="mt-5 space-y-3">
                    {hasRequirements ? (
                      requirementsView.map((requirement) => (
                        <div key={requirement.id} className="rounded-[14px] border border-border/40 bg-background/70 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[10px] font-mono uppercase tracking-widest text-primary">{requirement.id}</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="border-border/50 bg-background/60 text-[10px] uppercase tracking-widest text-muted-foreground">
                                {requirement.kind}
                              </Badge>
                              <Badge variant="outline" className="border-border/50 bg-background/60 text-[10px] uppercase tracking-widest text-foreground/80">
                                {requirement.status}
                              </Badge>
                            </div>
                          </div>
                          <h4 className="mt-2 text-[15px] font-semibold text-foreground/90">{requirement.title}</h4>
                          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{requirement.detail}</p>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[14px] border border-dashed border-border/40 bg-background/70 px-4 py-6 text-[13px] text-muted-foreground">
                        Generează requirements din documentație pentru a continua flow-ul.
                      </div>
                    )}
                  </div>
                </Card>

                <Card className="rounded-[16px] border-border/40 bg-card/70 p-5">
                  <div className="space-y-2">
                    <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                      Handoff
                    </Badge>
                    <h3 className="font-serif text-2xl font-semibold tracking-tight">From brief to feature backlog</h3>
                    <p className="text-[13px] leading-relaxed text-muted-foreground">
                      După ce requirement set-ul este acceptat, orchestratorul poate produce feature backlog-ul și dependențele inițiale.
                    </p>
                  </div>
                  <div className="mt-5 space-y-3">
                    <div className="rounded-[14px] border border-border/40 bg-background/70 p-4 text-[12px] leading-relaxed text-muted-foreground">
                      <span className="mb-1 block text-[10px] font-mono uppercase tracking-widest text-primary">Coverage</span>
                      {requirementsView.filter((item) => item.kind === "functional").length} functional requirements ·{" "}
                      {requirementsView.filter((item) => item.kind === "non-functional").length} non-functional requirements
                    </div>
                    <div className="rounded-[14px] border border-border/40 bg-background/70 p-4 text-[12px] leading-relaxed text-muted-foreground">
                      Feature generation will stay grounded in the approved requirement set instead of reading only the brief fields.
                    </div>
                  </div>
                  <div className="mt-6">
                    <Button onClick={moveToFeatures} className="w-full" disabled={!hasRequirements || isGeneratingFeatures}>
                      {isGeneratingFeatures ? "Generating features..." : "Generate Feature Backlog"}
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {currentStage === "Features" && (
            <div className="flex h-full flex-col">
              <IDEHeader
                title="Features & Variations"
                icon="layout"
                rightNode={
                  <Button size="sm" variant="ghost" onClick={moveToUserStories} disabled={isGeneratingStories} className="h-[26px] text-[11px] text-primary hover:bg-primary/10">
                    {isGeneratingStories ? "Generating..." : "Generate User Stories"}
                  </Button>
                }
              />
              <div className="grid flex-1 gap-4 overflow-y-auto p-4 xl:grid-cols-[1.2fr_0.8fr] xl:p-6">
                <div className="grid content-start gap-4 lg:grid-cols-2">
                  {hasFeatures ? (
                    filteredFeatures.length > 0 ? (
                    filteredFeatures.map((feature) => {
                      const active = selectedFeature?.id === feature.id
                      return (
                        <Card
                          key={feature.id}
                          className={cn(
                            "flex flex-col rounded-[16px] border-border/40 bg-card/70 p-5 transition-all",
                            active && "border-primary/50 shadow-[0_0_0_1px_rgba(16,185,129,0.2)]"
                          )}
                        >
                          <div className="mb-4 flex items-center justify-between">
                            <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                              {feature.id}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground">{feature.preview}</span>
                          </div>
                          <h3 className="mb-2 text-[18px] font-semibold leading-snug text-foreground/90">{feature.title}</h3>
                          <p className="mb-4 text-[13px] leading-relaxed text-muted-foreground">{feature.summary}</p>

                          <div className="mb-4 flex flex-wrap gap-2">
                            <Badge variant="outline" className="border-border/50 bg-background/60 text-[10px] uppercase tracking-widest text-foreground/80">
                              Estimate {feature.estimate}
                            </Badge>
                            {feature.dependencyIds.length > 0 ? (
                              <Badge variant="outline" className="border-border/50 bg-background/60 text-[10px] uppercase tracking-widest text-muted-foreground">
                                Depends on {feature.dependencyIds.join(", ")}
                              </Badge>
                            ) : null}
                          </div>

                          <div className="mb-4 rounded-[10px] border border-border/40 bg-background/50 px-3 py-2 text-[12px] text-muted-foreground">
                            {feature.complexityNote}
                          </div>

                          <div className="space-y-2 border-t border-border/30 pt-4">
                            <span className="text-[10px] font-mono text-primary/70 uppercase">Variations (AI Recommended)</span>
                            {feature.variations.map((criterion) => (
                              <div key={criterion} className="rounded-[10px] border-l-[1.5px] border-primary/40 bg-background/60 px-3 py-2 text-[12px] text-foreground/85">
                                {criterion}
                              </div>
                            ))}
                          </div>
                          <div className="mt-auto flex gap-2 pt-5">
                            <Button onClick={() => openFeature(feature.id)} className="h-9 flex-1 text-[12px]">
                              {active ? "Focus Enabled" : "Select Feature"}
                            </Button>
                          </div>
                        </Card>
                      )
                    })
                    ) : (
                      <Card className="col-span-full rounded-[16px] border-dashed border-border/50 bg-card/60 p-6">
                        <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                          Filter active
                        </Badge>
                        <h3 className="mt-4 text-[22px] font-semibold tracking-tight">Niciun feature nu se potrivește requirement-ului selectat</h3>
                        <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
                          Încearcă alt requirement sau resetează filtrul pentru a reveni la tot backlog-ul de features.
                        </p>
                        <Button onClick={() => setFeatureRequirementFilterId("")} className="mt-5">
                          Clear requirement filter
                        </Button>
                      </Card>
                    )
                  ) : (
                    <Card className="col-span-full rounded-[16px] border-dashed border-border/50 bg-card/60 p-6">
                      <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                        No generated features
                      </Badge>
                      <h3 className="mt-4 text-[22px] font-semibold tracking-tight">Generează feature-urile din brief-ul aprobat</h3>
                      <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
                        Etapa aceasta nu mai vine pre-populată. Backend-ul generează feature-uri doar după ce brief-ul este completat și aprobat.
                      </p>
                      <Button onClick={moveToFeatures} className="mt-5" disabled={isGeneratingFeatures}>
                        {isGeneratingFeatures ? "Generating features..." : "Generate Features"}
                      </Button>
                    </Card>
                  )}
                </div>

                <div className="flex flex-col gap-4">
                  <Card className="rounded-[16px] border-border/40 bg-card/70 p-5">
                    <div className="space-y-2">
                      <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                        Requirements + Estimation
                      </Badge>
                      <h3 className="font-serif text-2xl font-semibold tracking-tight">Delivery Intelligence</h3>
                      <p className="text-[13px] leading-relaxed text-muted-foreground">
                        Cerințele derivate din brief, estimările agregate și dependențele de feature sunt centralizate aici.
                      </p>
                    </div>
                    <div className="mt-5">
                      <TraceBreadcrumb segments={traceSegments.slice(0, 2)} />
                    </div>
                    {activeFeatureRequirement ? (
                      <div className="mt-5 flex items-center justify-between gap-3 rounded-[14px] border border-primary/20 bg-primary/5 px-4 py-3">
                        <div>
                          <div className="text-[10px] font-mono uppercase tracking-widest text-primary">Requirement Filter</div>
                          <p className="mt-1 text-[12px] text-foreground/85">{activeFeatureRequirement.title}</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => setFeatureRequirementFilterId("")}>
                          Clear
                        </Button>
                      </div>
                    ) : null}
                    <div className="mt-5 grid grid-cols-4 gap-2">
                      {featureEstimateSummary.map((entry) => (
                        <div key={entry.size} className="rounded-[12px] border border-border/40 bg-background/70 p-3">
                          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{entry.size}</div>
                          <div className="mt-1 text-[18px] font-semibold text-foreground/90">{entry.count}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-5 space-y-2">
                      {requirementsView.slice(0, 6).map((requirement) => (
                        (() => {
                          const isFiltered = activeFeatureRequirement?.id === requirement.id
                          const isHighlighted = highlightedFeatureRequirementIds.has(requirement.id)
                          return (
                        <button
                          key={requirement.id}
                          type="button"
                          onClick={() => toggleRequirementFilter("features", requirement.id)}
                          className={cn(
                            "w-full rounded-[12px] border bg-background/65 p-3 text-left transition-all",
                            isFiltered
                              ? "border-primary/40 bg-primary/5 shadow-[0_0_0_1px_rgba(16,185,129,0.12)]"
                              : isHighlighted
                                ? "border-chart-2/40 bg-chart-2/10 shadow-[0_0_0_1px_rgba(234,179,8,0.12)]"
                                : "border-border/40 hover:border-primary/20 hover:bg-background/80"
                          )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[10px] font-mono uppercase tracking-widest text-primary">{requirement.id}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{requirement.kind}</span>
                              {isHighlighted && !isFiltered ? (
                                <span className="text-[10px] uppercase tracking-widest text-chart-2">linked</span>
                              ) : null}
                              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                                {requirement.featureIds.length} features
                              </span>
                            </div>
                          </div>
                          <p className="mt-2 text-[12px] font-semibold text-foreground/90">{requirement.title}</p>
                          <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">{requirement.detail}</p>
                        </button>
                          )
                        })()
                      ))}
                    </div>
                    <div className="mt-5 overflow-hidden rounded-xl border border-border/40 bg-background/60">
                      <div className="flex items-center justify-between border-b border-border/40 px-4 py-2.5">
                        <span className="text-[11px] text-muted-foreground">Feature dependency graph</span>
                        <span className="text-[11px] text-muted-foreground">{featureDependencyGraph.edges.length} links</span>
                      </div>
                      <div className="relative h-[280px] overflow-hidden">
                        <div style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0 }}>
                          <ReactFlow
                            style={{ width: "100%", height: "100%" }}
                            nodes={featureDependencyGraph.nodes}
                            edges={featureDependencyGraph.edges}
                            onNodeClick={handleDependencyNodeClick}
                            fitView
                            fitViewOptions={{ padding: 0.25 }}
                            zoomOnScroll
                            panOnScroll={false}
                            selectionOnDrag={false}
                          >
                            <Background gap={18} size={1} color="rgba(25,22,21,0.08)" />
                            <Controls showInteractive={false} className="fill-foreground border-border/40 bg-card" />
                          </ReactFlow>
                        </div>
                      </div>
                    </div>
                  </Card>

                  <Card className="flex flex-col rounded-[16px] border-border/40 bg-card/70 p-5">
                    {selectedFeature ? (
                      <>
                        <div className="space-y-2">
                          <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                            Selected Feature
                          </Badge>
                          <h3 className="font-serif text-2xl font-semibold tracking-tight">{selectedFeature.title}</h3>
                          <p className="text-[13px] leading-relaxed text-muted-foreground">
                            Din acest modul vor fi extrase User Stories. Bifează implementarea tehnică dorită.
                          </p>
                        </div>
                        <div className="mt-5 rounded-[18px] border border-border/40 bg-background/80 p-5">
                          <div className="mb-3 text-[10px] font-mono uppercase tracking-widest text-primary">{selectedFeature.preview}</div>
                          <div className="space-y-3">
                            <div className="rounded-[12px] bg-primary/10 p-4 text-sm font-medium text-foreground/90">
                              Mapare logică: {selectedFeature.summary}
                            </div>
                            <div className="rounded-[12px] border border-border/40 bg-background/70 p-4 text-[12px] leading-relaxed text-muted-foreground">
                              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-primary/70">Estimate</span>
                              {selectedFeature.estimate} · {selectedFeature.complexityNote}
                              {selectedFeature.dependencyIds.length > 0 ? ` · Depends on ${selectedFeature.dependencyIds.join(", ")}` : ""}
                            </div>
                            <div className="rounded-[12px] border border-dashed border-border/50 p-4 text-[12px] leading-relaxed text-muted-foreground">
                              Acceptance Criteria base:
                              <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground/80">
                                {selectedFeature.acceptance.map((acc) => (
                                  <li key={acc}>{acc}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="rounded-[18px] border border-dashed border-border/50 bg-background/50 p-5 text-[13px] leading-relaxed text-muted-foreground">
                        Selectează sau generează un feature pentru a debloca etapa următoare.
                      </div>
                    )}
                    <div className="mt-auto pt-6">
                      <Button onClick={moveToUserStories} className="w-full" disabled={!selectedFeature || isGeneratingStories}>
                        {isGeneratingStories ? "Generating stories..." : "Generează Pipeline Agile (Stories)"}
                      </Button>
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {currentStage === "User Stories" && (
            <div className="flex h-full flex-col">
              <IDEHeader
                title="Agile User Stories Dashboard"
                icon="branch"
                rightNode={
                  <Button size="sm" variant="ghost" onClick={moveToPlanning} className="h-[26px] text-[11px] text-primary hover:bg-primary/10">
                    Open planning
                  </Button>
                }
              />
              <div className="grid flex-1 gap-4 overflow-y-auto p-4 xl:grid-cols-[1.25fr_0.75fr] lg:p-6">
                <div className="grid content-start gap-4 lg:grid-cols-2">
                  {hasStories ? (
                    filteredStories.length > 0 ? (
                    filteredStories.map((story) => {
                      const active = selectedStory?.id === story.id
                      return (
                        <Card
                          key={story.id}
                          className={cn(
                            "flex flex-col rounded-[16px] border-border/40 bg-card/70 p-5 transition-all",
                            active && "border-primary/50 shadow-[0_0_0_1px_rgba(16,185,129,0.22)]"
                          )}
                        >
                          <div className="mb-4 flex items-center justify-between">
                            <Badge variant="outline" className={cn("uppercase", active ? "border-primary/20 bg-primary/10 text-primary" : "text-muted-foreground")}>
                              {story.id}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground">{story.stack}</span>
                          </div>
                          <h3 className="mb-2 text-[19px] font-semibold">{story.title}</h3>
                          <p className="mb-3 text-[13px] leading-relaxed text-muted-foreground">{story.summary}</p>

                          <div className="mb-3 flex flex-wrap gap-2">
                            <Badge variant="outline" className="border-border/50 bg-background/60 text-[10px] uppercase tracking-widest text-foreground/80">
                              Estimate {story.estimate}
                            </Badge>
                            {story.dependencyIds.length > 0 ? (
                              <Badge variant="outline" className="border-border/50 bg-background/60 text-[10px] uppercase tracking-widest text-muted-foreground">
                                Depends on {story.dependencyIds.join(", ")}
                              </Badge>
                            ) : null}
                          </div>

                          <div className="rounded-[14px] border border-border/40 bg-background/70 p-4">
                            <div className="mb-1 text-[10px] font-mono uppercase tracking-widest text-primary">{story.previewTitle}</div>
                            <p className="text-[12px] leading-relaxed text-foreground/85">{story.previewDescription}</p>
                          </div>
                          <div className="mt-3 rounded-[14px] border border-dashed border-border/40 bg-background/60 p-4 text-[12px] leading-relaxed text-muted-foreground">
                            <span className="mb-1 block text-[10px] font-semibold uppercase text-primary/70">Tradeoff Analysis:</span>
                            {story.tradeoff}
                          </div>
                          <div className="mt-3 rounded-[14px] border border-border/40 bg-background/60 p-4 text-[12px] leading-relaxed text-muted-foreground">
                            <span className="mb-1 block text-[10px] font-semibold uppercase text-primary/70">Complexity / Estimate</span>
                            {story.complexityNote}
                          </div>
                          <div className="mt-3 rounded-[14px] border border-border/40 bg-background/60 p-4">
                            <div className="mb-3 text-[10px] font-mono uppercase tracking-widest text-primary">Triple Variant</div>
                            <div className="space-y-2">
                              {story.variants.map((variant) => {
                                const variantActive = story.selectedVariantId === variant.id
                                return (
                                  <button
                                    key={variant.id}
                                    type="button"
                                    onClick={() => chooseVariant(story.id, variant.id)}
                                    className={cn(
                                      "w-full rounded-[12px] border px-3 py-3 text-left transition-all",
                                      variantActive
                                        ? "border-primary/35 bg-primary/8 shadow-[0_0_0_1px_rgba(16,185,129,0.12)]"
                                        : "border-border/40 bg-background/80 hover:border-primary/20"
                                    )}
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <div>
                                        <div className="text-[10px] font-mono uppercase tracking-widest text-primary">{variant.label}</div>
                                        <div className="mt-1 text-[12px] font-semibold text-foreground/90">{variant.teamName}</div>
                                      </div>
                                      {variantActive ? (
                                        <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                                          Selected
                                        </Badge>
                                      ) : null}
                                    </div>
                                    <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{variant.focus}</p>
                                    <p className="mt-2 text-[11.5px] leading-relaxed text-foreground/80">{variant.architecture}</p>
                                  </button>
                                )
                              })}
                            </div>
                          </div>

                          <div className="mt-auto flex flex-col gap-2 pt-5">
                            <Button onClick={() => chooseStory(story.id)}>
                              {active ? "Scaffold Pinned" : "Select Story Scaffold"}
                            </Button>
                            <Button
                              variant="outline"
                              disabled={isGeneratingCode}
                              onClick={() => generateCodeForStory(story.id)}
                            >
                              {isGeneratingCode && active ? "Generating..." : "Generate Code"}
                            </Button>
                          </div>
                        </Card>
                      )
                    })
                    ) : (
                      <Card className="col-span-full rounded-[16px] border-dashed border-border/50 bg-card/60 p-6">
                        <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                          Filter active
                        </Badge>
                        <h3 className="mt-4 text-[22px] font-semibold tracking-tight">Niciun user story nu se potrivește requirement-ului selectat</h3>
                        <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
                          Schimbă requirement-ul activ sau golește filtrul pentru a vedea din nou întregul story set.
                        </p>
                        <Button onClick={() => setStoryRequirementFilterId("")} className="mt-5">
                          Clear requirement filter
                        </Button>
                      </Card>
                    )
                  ) : (
                    <Card className="col-span-full rounded-[16px] border-dashed border-border/50 bg-card/60 p-6">
                      <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                        No generated stories
                      </Badge>
                      <h3 className="mt-4 text-[22px] font-semibold tracking-tight">Generează user stories pentru feature-ul selectat</h3>
                      <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
                        Story-urile nu mai apar implicit din seed-ul inițial. Sunt generate la cerere din feature-ul activ.
                      </p>
                      <Button onClick={moveToUserStories} className="mt-5" disabled={!selectedFeature || isGeneratingStories}>
                        {isGeneratingStories ? "Generating stories..." : "Generate User Stories"}
                      </Button>
                    </Card>
                  )}
                </div>

                <Card className="rounded-[16px] border-border/40 bg-card/70 p-5">
                  <div className="space-y-2">
                    <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                      Requirements + Dependencies
                    </Badge>
                    <h3 className="font-serif text-2xl font-semibold tracking-tight">Planning Console</h3>
                    <p className="text-[13px] leading-relaxed text-muted-foreground">
                      Panou dedicat pentru requirements derivate, estimările backlog-ului și graful de dependențe dintre stories.
                    </p>
                  </div>
                  <div className="mt-5">
                    <TraceBreadcrumb segments={traceSegments.slice(0, 3)} />
                  </div>
                  {activeStoryRequirement ? (
                    <div className="mt-5 flex items-center justify-between gap-3 rounded-[14px] border border-primary/20 bg-primary/5 px-4 py-3">
                      <div>
                        <div className="text-[10px] font-mono uppercase tracking-widest text-primary">Requirement Filter</div>
                        <p className="mt-1 text-[12px] text-foreground/85">{activeStoryRequirement.title}</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setStoryRequirementFilterId("")}>
                        Clear
                      </Button>
                    </div>
                  ) : null}
                  {selectedStory ? (
                    <div className="mt-5 rounded-[16px] border border-primary/20 bg-primary/5 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[10px] font-mono uppercase tracking-widest text-primary">Focused Story</div>
                          <h4 className="mt-1 text-[16px] font-semibold text-foreground/90">{selectedStory.title}</h4>
                        </div>
                        <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                          {selectedStory.id}
                        </Badge>
                      </div>
                      <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{selectedStory.summary}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="outline" className="border-border/50 bg-background/60 text-[10px] uppercase tracking-widest text-foreground/80">
                          Estimate {selectedStory.estimate}
                        </Badge>
                        {selectedStory.dependencyIds.length > 0 ? (
                          <Badge variant="outline" className="border-border/50 bg-background/60 text-[10px] uppercase tracking-widest text-muted-foreground">
                            Depends on {selectedStory.dependencyIds.join(", ")}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-5 grid grid-cols-4 gap-2">
                    {storyEstimateSummary.map((entry) => (
                      <div key={entry.size} className="rounded-[12px] border border-border/40 bg-background/70 p-3">
                        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{entry.size}</div>
                        <div className="mt-1 text-[18px] font-semibold text-foreground/90">{entry.count}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 space-y-2">
                    {requirementsView.map((requirement) => (
                      (() => {
                        const isFiltered = activeStoryRequirement?.id === requirement.id
                        const isHighlighted = highlightedStoryRequirementIds.has(requirement.id)
                        return (
                      <button
                        key={requirement.id}
                        type="button"
                        onClick={() => toggleRequirementFilter("stories", requirement.id)}
                        className={cn(
                          "w-full rounded-[12px] border bg-background/65 p-3 text-left transition-all",
                          isFiltered
                            ? "border-primary/40 bg-primary/5 shadow-[0_0_0_1px_rgba(16,185,129,0.12)]"
                            : isHighlighted
                              ? "border-chart-2/40 bg-chart-2/10 shadow-[0_0_0_1px_rgba(234,179,8,0.12)]"
                              : "border-border/40 hover:border-primary/20 hover:bg-background/80"
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[10px] font-mono uppercase tracking-widest text-primary">{requirement.id}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{requirement.status}</span>
                            {isHighlighted && !isFiltered ? (
                              <span className="text-[10px] uppercase tracking-widest text-chart-2">linked</span>
                            ) : null}
                            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                              {requirement.storyIds.length} stories
                            </span>
                          </div>
                        </div>
                        <p className="mt-2 text-[12px] font-semibold text-foreground/90">{requirement.title}</p>
                        <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">{requirement.detail}</p>
                      </button>
                        )
                      })()
                    ))}
                  </div>
                  <div className="mt-5 overflow-hidden rounded-xl border border-border/40 bg-background/60">
                    <div className="flex items-center justify-between border-b border-border/40 px-4 py-2.5">
                      <span className="text-[11px] text-muted-foreground">Story dependency graph</span>
                      <span className="text-[11px] text-muted-foreground">{storyDependencyGraph.edges.length} links</span>
                    </div>
                    <div className="relative h-[320px] overflow-hidden">
                      <div style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0 }}>
                        <ReactFlow
                          style={{ width: "100%", height: "100%" }}
                          nodes={storyDependencyGraph.nodes}
                          edges={storyDependencyGraph.edges}
                          onNodeClick={handleDependencyNodeClick}
                          fitView
                          fitViewOptions={{ padding: 0.25 }}
                          zoomOnScroll
                          panOnScroll={false}
                          selectionOnDrag={false}
                        >
                          <Background gap={18} size={1} color="rgba(25,22,21,0.08)" />
                          <Controls showInteractive={false} className="fill-foreground border-border/40 bg-card" />
                        </ReactFlow>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {currentStage === "Planning" && (
            <div className="flex h-full flex-col">
              <IDEHeader
                title="Assignment & Planning"
                icon="pulse"
                rightNode={
                  <Button size="sm" variant="ghost" onClick={approveStory} disabled={isGeneratingCode} className="h-[26px] text-[11px] text-primary hover:bg-primary/10">
                    {isGeneratingCode ? "Generating..." : "Open final code"}
                  </Button>
                }
              />
              <div className="grid flex-1 gap-4 overflow-y-auto p-4 xl:grid-cols-[1fr_380px] xl:p-6">
                <Card className="rounded-[16px] border-border/40 bg-card/70 p-5">
                  <div className="space-y-2">
                    <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                      Orchestrator Handoff
                    </Badge>
                    <h3 className="font-serif text-2xl font-semibold tracking-tight">Implementation planning board</h3>
                    <p className="text-[13px] leading-relaxed text-muted-foreground">
                      Etapa de planning consolidează requirement trace-ul, story-ul activ și dependențele înainte de generarea codului.
                    </p>
                  </div>
                  <div className="mt-5">
                    <TraceBreadcrumb segments={traceSegments.slice(0, 3)} />
                  </div>
                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-[16px] border border-border/40 bg-background/70 p-4">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-primary">Selected story</div>
                      <h4 className="mt-2 text-[18px] font-semibold text-foreground/90">{selectedStory?.title ?? "No story selected"}</h4>
                      <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                        {selectedStory?.summary ?? "Selectează o story din etapa anterioară pentru a continua către implementare."}
                      </p>
                      {selectedStory ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge variant="outline" className="border-border/50 bg-background/60 text-[10px] uppercase tracking-widest text-foreground/80">
                            Estimate {selectedStory.estimate}
                          </Badge>
                          <Badge variant="outline" className="border-border/50 bg-background/60 text-[10px] uppercase tracking-widest text-muted-foreground">
                            {selectedStory.stack}
                          </Badge>
                        </div>
                      ) : null}
                    </div>
                    <div className="rounded-[16px] border border-border/40 bg-background/70 p-4">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-primary">Chosen variant</div>
                      <h4 className="mt-2 text-[18px] font-semibold text-foreground/90">{selectedVariant?.label ?? "No variant selected"}</h4>
                      <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                        {selectedVariant?.focus ?? "Alege o variantă din cele 3 echipe paralele pentru a continua către implementare."}
                      </p>
                      {selectedVariant ? (
                        <div className="mt-3 space-y-2">
                          <div className="rounded-[12px] border border-border/30 bg-background/70 px-3 py-2 text-[12px] text-foreground/85">
                            {selectedVariant.teamName}
                          </div>
                          <div className="rounded-[12px] border border-border/30 bg-background/70 px-3 py-2 text-[12px] text-muted-foreground">
                            {selectedVariant.architecture}
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <div className="rounded-[16px] border border-border/40 bg-background/70 p-4">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-primary">Dependencies</div>
                      <div className="mt-3 space-y-2">
                        {selectedStory?.dependencyIds.length ? (
                          selectedStory.dependencyIds.map((dependencyId) => (
                            <div key={dependencyId} className="rounded-[12px] border border-border/30 bg-background/70 px-3 py-2 text-[12px] text-foreground/85">
                              {dependencyId}
                            </div>
                          ))
                        ) : (
                          <div className="rounded-[12px] border border-dashed border-border/40 px-3 py-3 text-[12px] text-muted-foreground">
                            Story-ul activ nu are dependențe explicite.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 overflow-hidden rounded-xl border border-border/40 bg-background/60">
                    <div className="flex items-center justify-between border-b border-border/40 px-4 py-2.5">
                      <span className="text-[11px] text-muted-foreground">Story dependency graph</span>
                      <span className="text-[11px] text-muted-foreground">{storyDependencyGraph.edges.length} links</span>
                    </div>
                    <div className="relative h-[320px] overflow-hidden">
                      <div style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0 }}>
                        <ReactFlow
                          style={{ width: "100%", height: "100%" }}
                          nodes={storyDependencyGraph.nodes}
                          edges={storyDependencyGraph.edges}
                          onNodeClick={handleDependencyNodeClick}
                          fitView
                          fitViewOptions={{ padding: 0.25 }}
                          zoomOnScroll
                          panOnScroll={false}
                          selectionOnDrag={false}
                        >
                          <Background gap={18} size={1} color="rgba(25,22,21,0.08)" />
                          <Controls showInteractive={false} className="fill-foreground border-border/40 bg-card" />
                        </ReactFlow>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="rounded-[16px] border-border/40 bg-card/70 p-5">
                  <div className="space-y-2">
                    <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                      Ready for implementation
                    </Badge>
                    <h3 className="font-serif text-2xl font-semibold tracking-tight">Final handoff</h3>
                    <p className="text-[13px] leading-relaxed text-muted-foreground">
                      Când planificarea este acceptată, putem deschide etapa Final Code pentru scaffold și editare asistată.
                    </p>
                  </div>
                  <div className="mt-5 space-y-3">
                    <div className="rounded-[14px] border border-border/40 bg-background/70 p-4 text-[12px] leading-relaxed text-muted-foreground">
                      Requirement trace: {traceRequirement?.id ?? "none"} {traceRequirement ? `· ${traceRequirement.title}` : ""}
                    </div>
                    <div className="rounded-[14px] border border-border/40 bg-background/70 p-4 text-[12px] leading-relaxed text-muted-foreground">
                      Selected feature: {selectedFeature?.id ?? "none"} {selectedFeature ? `· ${selectedFeature.title}` : ""}
                    </div>
                  </div>
                  <div className="mt-6">
                    <Button onClick={approveStory} className="w-full" disabled={!selectedStory || isGeneratingCode}>
                      {isGeneratingCode ? "Generating code..." : "Generate final code scaffold"}
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {currentStage === "Final Code" && (
            <div className="flex h-full flex-col xl:flex-row">
              <div className="flex min-w-0 flex-1 flex-col bg-black/5 dark:bg-black/20">
                <IDEHeader
                  title="Final Code Workspace"
                  icon="code"
                  rightNode={
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={regenerateCode} className="h-[22px] px-2 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground">
                        Regenerate code
                      </Button>
                      <Button size="sm" variant="ghost" onClick={runSecurityReviewStage} disabled={isGeneratingSecurityReview} className="h-[22px] border border-primary/20 bg-primary/10 px-2 text-[10px] text-primary hover:bg-primary/20">
                        {isGeneratingSecurityReview ? "Reviewing..." : "Run security review"}
                      </Button>
                    </div>
                  }
                />
                <div className="flex min-h-0 flex-1">
                  {/* File Explorer */}
                  <div className="hidden w-56 shrink-0 border-r border-border/40 bg-background/10 md:block">
                    <div className="flex h-8 items-center justify-between border-b border-border/40 px-3 text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">
                      <span>Explorer</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => startWorkspaceCreation("folder")}
                          className="rounded px-1.5 py-0.5 text-[9px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          +Dir
                        </button>
                        <button
                          type="button"
                          onClick={() => startWorkspaceCreation("file")}
                          className="rounded px-1.5 py-0.5 text-[9px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          +File
                        </button>
                      </div>
                    </div>
                    <div className="border-b border-border/30 px-3 py-2">
                      <div className="text-[9px] font-mono uppercase tracking-[0.14em] text-muted-foreground/70">
                        Target: {selectedExplorerPath || "root"}
                      </div>
                      {workspaceCreateKind ? (
                        <div className="mt-2 space-y-2">
                          <Input
                            value={workspaceCreateName}
                            onChange={(event) => setWorkspaceCreateName(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault()
                                submitWorkspaceCreation()
                              }
                              if (event.key === "Escape") {
                                event.preventDefault()
                                cancelWorkspaceCreation()
                              }
                            }}
                            placeholder={workspaceCreateKind === "file" ? "new-file.ts" : "new-folder"}
                            className="h-8 rounded-lg border-border/50 bg-background/70 px-3 text-[11px]"
                            autoFocus
                          />
                          <div className="flex gap-1.5">
                            <Button size="sm" onClick={submitWorkspaceCreation} className="h-7 px-2 text-[10px]">
                              Create
                            </Button>
                            <Button size="sm" variant="ghost" onClick={cancelWorkspaceCreation} className="h-7 px-2 text-[10px]">
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <div className="space-y-0.5 p-2">
                      {renderExplorerTree()}
                    </div>
                  </div>
                  
                  {/* Editor Frame */}
                  <div className="relative flex-1 flex flex-col min-w-0 border-r border-border/40">
                    <div className="border-b border-border/30 px-3 py-2">
                      <div className="flex items-center justify-between gap-3 rounded-[12px] border border-border/40 bg-background/60 px-3 py-2">
                        <div>
                          <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-primary">Code Generation</div>
                          <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">{codeGenerationStatus.detail}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-full text-[9px] uppercase tracking-[0.14em]",
                            codeGenerationStatus.stage === "running" && "border-primary/20 bg-primary/10 text-primary",
                            codeGenerationStatus.stage === "completed" && "border-chart-2/20 bg-chart-2/10 text-chart-2",
                            codeGenerationStatus.stage === "failed" && "border-destructive/20 bg-destructive/10 text-destructive",
                            codeGenerationStatus.stage === "idle" && "border-border/60 bg-background/60 text-muted-foreground"
                          )}
                        >
                          {codeGenerationStatus.stage}
                        </Badge>
                      </div>
                    </div>
                    <div className="border-b border-border/30 px-3 py-2">
                      <TraceBreadcrumb segments={traceSegments} />
                    </div>
                    <div className="flex bg-muted/20 border-b border-border/40 overflow-x-auto no-scrollbar">
                      {workspaceFiles.map((file) => (
                        <button
                          key={file.id}
                          onClick={() => openWorkspaceFile(file.id)}
                          className={cn(
                            "flex items-center gap-2 px-3 py-1.5 min-w-[120px] max-w-[200px] border-r border-border/40 text-[11px] font-mono transition-colors",
                            activeFile?.id === file.id ? "bg-background text-foreground border-t-[2px] border-t-primary" : "text-muted-foreground hover:bg-muted/50 border-t-[2px] border-t-transparent"
                          )}
                          title={file.path}
                        >
                          <Icon name="file" className="size-3 shrink-0" />
                          <span className="truncate">{file.name}</span>
                        </button>
                      ))}
                    </div>
                    
                    <div className="flex-1 relative">
                      <div className="pointer-events-none absolute left-4 top-3 z-10 rounded-md border border-border/40 bg-background/80 px-2 py-1 text-[10px] font-mono text-muted-foreground backdrop-blur-sm">
                        {activeFile?.path ?? "No file selected"}
                      </div>
                      {slashMenuOpen ? (
                        <div className="absolute right-4 top-4 z-20 w-[320px] rounded-2xl border border-primary/20 bg-background/95 p-3 shadow-[0_20px_50px_rgba(0,0,0,0.28)] backdrop-blur-xl">
                          <div className="mb-2 flex items-start justify-between gap-3">
                            <div>
                              <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-primary">AI Slash Edit</div>
                              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                                Scrie exact ce vrei să modifice în aplicație pe fișierul activ.
                              </p>
                            </div>
                            <Button size="icon-xs" variant="ghost" onClick={closeSlashMenu} className="shrink-0">
                              <Icon name="close" className="size-3" />
                            </Button>
                          </div>

                          <div className="mb-3 flex flex-wrap gap-2">
                            {([
                              { id: "refactor", label: "Refactor" },
                              { id: "comment", label: "Comment" },
                              { id: "scaffold", label: "Scaffold" },
                            ] as const).map((option) => (
                              <button
                                key={option.id}
                                type="button"
                                onClick={() => setSlashAction(option.id)}
                                className={cn(
                                  "rounded-full border px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest transition-colors",
                                  slashAction === option.id
                                    ? "border-primary/30 bg-primary/12 text-primary"
                                    : "border-border/50 bg-background/70 text-muted-foreground hover:text-foreground"
                                )}
                              >
                                /{option.label}
                              </button>
                            ))}
                          </div>

                          <Input
                            value={slashPrompt}
                            onChange={(event) => setSlashPrompt(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault()
                                applySlashCommand()
                              }
                            }}
                            placeholder="Ex: schimbă hero-ul, adaugă buton de delete produs, fă cardurile mai mari"
                            className="h-10 rounded-xl border-border/50 bg-background/70 text-[12px]"
                            autoFocus
                          />

                          <div className="mt-3 flex items-center justify-between gap-3">
                            <span className="text-[10px] text-muted-foreground">
                              Enter aplică o schiță de editare AI pe fișierul activ.
                            </span>
                            <Button size="sm" onClick={applySlashCommand} className="h-8 px-3 text-[11px]">
                              Apply requested edit
                            </Button>
                          </div>
                        </div>
                      ) : null}
                      {hasWorkspaceFiles ? (
                        <Textarea
                          ref={editorRef}
                          value={activeFile?.content ?? ""}
                          onChange={(event) => updateActiveFileContent(event.target.value)}
                          onKeyDown={handleEditorKeyDown}
                          className="absolute inset-0 h-full w-full resize-none rounded-none border-none bg-transparent p-4 pt-12 font-mono text-[13px] leading-[1.6] text-foreground/90 shadow-none focus-visible:ring-0"
                          spellCheck={false}
                        />
                      ) : (
                        <div className="absolute inset-0 grid place-items-center p-8">
                          <div className="max-w-md rounded-[18px] border border-dashed border-border/50 bg-background/60 p-6 text-center">
                            <div className="text-[11px] font-mono uppercase tracking-[0.16em] text-primary">Workspace Empty</div>
                            <h3 className="mt-3 text-[22px] font-semibold tracking-tight">Generează primul scaffold din story-ul selectat</h3>
                            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                              Editorul este acum complet backend-driven și pornește gol. Poți genera cod sau crea manual fișiere și foldere.
                            </p>
                            <div className="mt-5 flex justify-center gap-2">
                              <Button onClick={approveStory} disabled={!selectedStory || isGeneratingCode}>
                                {isGeneratingCode ? "Generating..." : "Generate Code"}
                              </Button>
                              <Button variant="outline" onClick={() => startWorkspaceCreation("file")}>
                                Create File
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Terminal pane underneath editor */}
                    <div className="h-[200px] shrink-0 bg-secondary flex flex-col text-[11.5px] font-mono shadow-inner border-t border-border/40 z-10 w-full overflow-hidden">
                      <div className="flex h-7 items-center justify-start border-b border-border/40 px-0 bg-secondary/80 gap-1 overflow-x-auto no-scrollbar">
                        <button className="px-3 h-full border-b-[2px] border-b-transparent text-muted-foreground uppercase text-[10px] tracking-widest hover:text-foreground">Problems</button>
                        <button className="px-3 h-full border-b-[2px] border-b-transparent text-muted-foreground uppercase text-[10px] tracking-widest hover:text-foreground">Output</button>
                        <button className="px-3 h-full border-b-[2px] border-b-primary text-foreground font-bold uppercase text-[10px] tracking-widest bg-background/50">Terminal</button>
                      </div>
                      <div className="relative flex-1 overflow-y-auto p-3 space-y-1 w-full bg-background/20 font-medium">
                        {terminalHistory.map((line, i) => (
                          <div
                            key={i}
                            className={cn(
                              "whitespace-pre-wrap leading-relaxed",
                              line.type === "error"
                                ? "text-destructive"
                                : line.type === "cmd"
                                  ? "text-foreground font-bold"
                                  : line.type === "trace"
                                    ? "rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-2 text-[10.5px] text-primary/90"
                                    : "text-chart-2/90"
                            )}
                          >
                            {line.text}
                          </div>
                        ))}
                        {terminalSlashMenuOpen ? (
                          <div className="absolute bottom-11 left-3 z-20 w-[280px] rounded-xl border border-border/60 bg-background/96 p-2 shadow-[0_10px_30px_rgba(0,0,0,0.24)] backdrop-blur-md">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-primary">AI Terminal</div>
                              <div className="flex items-center gap-1">
                                {([
                                  { id: "command", label: "Cmd" },
                                  { id: "fix", label: "Fix" },
                                  { id: "explain", label: "Explain" },
                                ] as const).map((option) => (
                                  <button
                                    key={option.id}
                                    type="button"
                                    onClick={() => setTerminalSlashAction(option.id)}
                                    className={cn(
                                      "rounded-md border px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wide transition-colors",
                                      terminalSlashAction === option.id
                                        ? "border-primary/30 bg-primary/12 text-primary"
                                        : "border-border/50 bg-background/60 text-muted-foreground hover:text-foreground"
                                    )}
                                  >
                                    /{option.label}
                                  </button>
                                ))}
                                <Button size="icon-xs" variant="ghost" onClick={closeTerminalSlashMenu} className="size-5 shrink-0">
                                  <Icon name="close" className="size-3" />
                                </Button>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Input
                                value={terminalSlashPrompt}
                                onChange={(event) => setTerminalSlashPrompt(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault()
                                    applyTerminalSlashCommand()
                                  }
                                }}
                                placeholder="Ex: start local preview"
                                className="h-8 rounded-lg border-border/50 bg-background/70 px-3 text-[11px]"
                                autoFocus
                              />
                              <Button size="sm" onClick={applyTerminalSlashCommand} className="h-8 px-2.5 text-[10px]">
                                Apply
                              </Button>
                            </div>
                          </div>
                        ) : null}
                        <div className="flex items-center gap-2 mt-1 -ml-0.5">
                          <span className="text-chart-2 font-bold shrink-0">root@ide:~$</span>
                          <input 
                            ref={terminalInputRef}
                            value={terminalInput}
                            onChange={(e) => setTerminalInput(e.target.value)}
                            onKeyDown={handleTerminalKeyDown}
                            className="flex-1 min-w-0 bg-transparent outline-none text-foreground placeholder:text-muted-foreground/60 focus:ring-0 shadow-none border-none appearance-none"
                            spellCheck={false}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStage === "Security Review" && (
            <div className="flex h-full flex-col">
              <IDEHeader
                title="Security Review"
                icon="shield"
                rightNode={
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => transitionToStage("Final Code", "S-a revenit la cod pentru remediere înainte de merge.")} className="h-[22px] px-2 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground">
                      Back to code
                    </Button>
                    <Button size="sm" variant="ghost" onClick={approveSecurityAndMerge} disabled={securityReport.status !== "reviewed" || isRunningMerge} className="h-[22px] border border-primary/20 bg-primary/10 px-2 text-[10px] text-primary hover:bg-primary/20">
                      {isRunningMerge ? "Merging..." : "Approve and merge"}
                    </Button>
                  </div>
                }
              />
              <div className="grid flex-1 gap-4 overflow-y-auto p-4 xl:grid-cols-[1fr_360px] xl:p-6">
                <Card className="rounded-[16px] border-border/40 bg-card/70 p-5">
                  <div className="space-y-2">
                    <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                      Security Agent
                    </Badge>
                    <h3 className="font-serif text-2xl font-semibold tracking-tight">Security findings before merge</h3>
                    <p className="text-[13px] leading-relaxed text-muted-foreground">
                      Raportul leagă story-ul activ de riscurile detectate automat și cere aprobare umană înainte de integrare.
                    </p>
                  </div>
                  <div className="mt-5">
                    <TraceBreadcrumb segments={traceSegments.slice(0, 4)} />
                  </div>
                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    <div className="rounded-[14px] border border-destructive/20 bg-destructive/8 p-4">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-destructive">High</div>
                      <div className="mt-2 text-2xl font-semibold">{securityCounts.high}</div>
                    </div>
                    <div className="rounded-[14px] border border-chart-3/20 bg-chart-3/8 p-4">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-chart-3">Medium</div>
                      <div className="mt-2 text-2xl font-semibold">{securityCounts.medium}</div>
                    </div>
                    <div className="rounded-[14px] border border-primary/20 bg-primary/8 p-4">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-primary">Low</div>
                      <div className="mt-2 text-2xl font-semibold">{securityCounts.low}</div>
                    </div>
                  </div>
                  <div className="mt-5 space-y-3">
                    {securityReport.issues.map((issue) => (
                      <div key={issue.id} className="rounded-[16px] border border-border/40 bg-background/70 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-[10px] font-mono uppercase tracking-widest text-primary">{issue.id}</div>
                            <h4 className="mt-1 text-[16px] font-semibold text-foreground/90">{issue.title}</h4>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "uppercase tracking-widest",
                              issue.severity === "high" && "border-destructive/25 bg-destructive/10 text-destructive",
                              issue.severity === "medium" && "border-chart-3/25 bg-chart-3/10 text-chart-3",
                              issue.severity === "low" && "border-primary/25 bg-primary/10 text-primary"
                            )}
                          >
                            {issue.severity}
                          </Badge>
                        </div>
                        <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">{issue.detail}</p>
                        <div className="mt-3 rounded-[12px] border border-border/30 bg-background/80 px-3 py-2 text-[12px] text-foreground/85">
                          Remediation: {issue.remediation}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="rounded-[16px] border-border/40 bg-card/70 p-5">
                  <div className="space-y-2">
                    <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                      Human gate
                    </Badge>
                    <h3 className="font-serif text-2xl font-semibold tracking-tight">Approve for merge</h3>
                    <p className="text-[13px] leading-relaxed text-muted-foreground">{securityReport.summary}</p>
                  </div>
                  <div className="mt-5 space-y-3">
                    <div className="rounded-[14px] border border-border/40 bg-background/70 p-4 text-[12px] leading-relaxed text-muted-foreground">
                      Status: {securityReport.status}
                    </div>
                    <div className="rounded-[14px] border border-border/40 bg-background/70 p-4 text-[12px] leading-relaxed text-muted-foreground">
                      Reviewed at: {securityReport.reviewedAt ?? "pending"}
                    </div>
                    <div className="rounded-[14px] border border-border/40 bg-background/70 p-4 text-[12px] leading-relaxed text-muted-foreground">
                      Approved at: {securityReport.approvedAt ?? "waiting for approval"}
                    </div>
                  </div>
                  <div className="mt-6">
                    <Button onClick={approveSecurityAndMerge} className="w-full" disabled={securityReport.status !== "reviewed" || isRunningMerge}>
                      {isRunningMerge ? "Approving and merging..." : "Approve fixes and continue to merge"}
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {currentStage === "Merge" && (
            <div className="flex h-full flex-col">
              <IDEHeader
                title="Merge & Integration"
                icon="branch"
                rightNode={
                  <Button size="sm" variant="ghost" onClick={runProjectReviewStage} disabled={mergeReport.status !== "completed" || isGeneratingProjectReview} className="h-[22px] border border-primary/20 bg-primary/10 px-2 text-[10px] text-primary hover:bg-primary/20">
                    {isGeneratingProjectReview ? "Reviewing..." : "Generate project review"}
                  </Button>
                }
              />
              <div className="grid flex-1 gap-4 overflow-y-auto p-4 xl:grid-cols-[1fr_360px] xl:p-6">
                <Card className="rounded-[16px] border-border/40 bg-card/70 p-5">
                  <div className="space-y-2">
                    <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                      Merge Agent
                    </Badge>
                    <h3 className="font-serif text-2xl font-semibold tracking-tight">Integrated changelog</h3>
                    <p className="text-[13px] leading-relaxed text-muted-foreground">{mergeReport.summary}</p>
                  </div>
                  <div className="mt-5 space-y-3">
                    {mergeReport.changelog.length > 0 ? (
                      mergeReport.changelog.map((entry, index) => (
                        <div key={`${entry}-${index}`} className="rounded-[14px] border border-border/40 bg-background/70 px-4 py-3 text-[12px] leading-relaxed text-foreground/85">
                          {entry}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[14px] border border-dashed border-border/40 px-4 py-4 text-[12px] text-muted-foreground">
                        Merge-ul nu a fost rulat încă pentru story-ul curent.
                      </div>
                    )}
                  </div>
                </Card>

                <Card className="rounded-[16px] border-border/40 bg-card/70 p-5">
                  <div className="space-y-2">
                    <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                      Merge status
                    </Badge>
                    <h3 className="font-serif text-2xl font-semibold tracking-tight">Readiness</h3>
                  </div>
                  <div className="mt-5 space-y-3">
                    <div className="rounded-[14px] border border-border/40 bg-background/70 p-4 text-[12px] leading-relaxed text-muted-foreground">
                      Status: {mergeReport.status}
                    </div>
                    <div className="rounded-[14px] border border-border/40 bg-background/70 p-4 text-[12px] leading-relaxed text-muted-foreground">
                      Stories merged: {mergeReport.mergedStoryIds.length}
                    </div>
                    <div className="rounded-[14px] border border-border/40 bg-background/70 p-4 text-[12px] leading-relaxed text-muted-foreground">
                      Merged at: {mergeReport.mergedAt ?? "pending"}
                    </div>
                  </div>
                  <div className="mt-6">
                    <Button onClick={runProjectReviewStage} className="w-full" disabled={mergeReport.status !== "completed" || isGeneratingProjectReview}>
                      {isGeneratingProjectReview ? "Generating review..." : "Continue to project review"}
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {currentStage === "Project Review" && (
            <div className="flex h-full flex-col">
              <IDEHeader
                title="Project Review"
                icon="chart"
                rightNode={
                  <Button size="sm" variant="ghost" onClick={generateApplication} disabled={projectHealth.status !== "completed" || isGeneratingPreview} className="h-[22px] border border-primary/20 bg-primary/10 px-2 text-[10px] text-primary hover:bg-primary/20">
                    {isGeneratingPreview ? "Generating preview..." : "Generate app preview"}
                  </Button>
                }
              />
              <div className="grid flex-1 gap-4 overflow-y-auto p-4 xl:grid-cols-[1fr_360px] xl:p-6">
                <Card className="rounded-[16px] border-border/40 bg-card/70 p-5">
                  <div className="space-y-2">
                    <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                      Project Review Agent
                    </Badge>
                    <h3 className="font-serif text-2xl font-semibold tracking-tight">Project health summary</h3>
                    <p className="text-[13px] leading-relaxed text-muted-foreground">{projectHealth.summary}</p>
                  </div>
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <div className="rounded-[14px] border border-primary/20 bg-primary/8 p-4">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-primary">Progress</div>
                      <div className="mt-2 text-2xl font-semibold">{projectHealth.progress}%</div>
                    </div>
                    <div className="rounded-[14px] border border-border/40 bg-background/70 p-4">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Coverage</div>
                      <div className="mt-2 text-[12px] leading-relaxed text-foreground/85">{projectHealth.coverage}</div>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-[16px] border border-border/40 bg-background/70 p-4">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-primary">Technical debt</div>
                      <div className="mt-3 space-y-2">
                        {projectHealth.technicalDebt.length > 0 ? (
                          projectHealth.technicalDebt.map((item, index) => (
                            <div key={`${item}-${index}`} className="rounded-[12px] border border-border/30 bg-background/80 px-3 py-2 text-[12px] text-muted-foreground">
                              {item}
                            </div>
                          ))
                        ) : (
                          <div className="rounded-[12px] border border-dashed border-border/40 px-3 py-3 text-[12px] text-muted-foreground">
                            Nu există datorie tehnică semnalată de review-ul automat.
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="rounded-[16px] border border-border/40 bg-background/70 p-4">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-primary">Next actions</div>
                      <div className="mt-3 space-y-2">
                        {projectHealth.nextActions.map((item, index) => (
                          <div key={`${item}-${index}`} className="rounded-[12px] border border-border/30 bg-background/80 px-3 py-2 text-[12px] text-muted-foreground">
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="rounded-[16px] border-border/40 bg-card/70 p-5">
                  <div className="space-y-2">
                    <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                      Preview handoff
                    </Badge>
                    <h3 className="font-serif text-2xl font-semibold tracking-tight">Final gate</h3>
                    <p className="text-[13px] leading-relaxed text-muted-foreground">
                      După project review, preview-ul devine ultimul pas pentru validarea experienței finale.
                    </p>
                  </div>
                  <div className="mt-5 space-y-3">
                    <div className="rounded-[14px] border border-border/40 bg-background/70 p-4 text-[12px] leading-relaxed text-muted-foreground">
                      Review status: {projectHealth.status}
                    </div>
                    <div className="rounded-[14px] border border-border/40 bg-background/70 p-4 text-[12px] leading-relaxed text-muted-foreground">
                      Generated at: {projectHealth.generatedAt ?? "pending"}
                    </div>
                  </div>
                  <div className="mt-6">
                    <Button onClick={generateApplication} className="w-full" disabled={projectHealth.status !== "completed" || isGeneratingPreview}>
                      {isGeneratingPreview ? "Generating preview..." : "Generate preview from reviewed merge"}
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {currentStage === "Preview" && (
            <div className="flex h-full flex-col">
              <IDEHeader
                title="Generated Application Preview"
                icon="play"
                rightNode={
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={openPreviewWindow} disabled={isGeneratingPreview} className="h-[22px] px-2 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground">
                      {previewOpened ? "Preview active" : "Open preview"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => transitionToStage("Project Review", "S-a revenit la raportul de proiect pentru ajustări înainte de preview.")} className="h-[22px] border border-primary/20 bg-primary/10 px-2 text-[10px] text-primary hover:bg-primary/20">
                      Back to review
                    </Button>
                  </div>
                }
              />
              <div className="grid flex-1 gap-4 overflow-y-auto p-4 xl:grid-cols-[1fr_360px] xl:p-6">
                <Card className="flex min-h-[520px] flex-col overflow-hidden rounded-[18px] border-border/40 bg-card/70 flex-1">
                  <div className="flex h-8 items-center gap-2 border-b border-border/40 bg-muted/40 px-3 shrink-0">
                    <div className="flex gap-1.5">
                      <div className="size-2.5 rounded-full bg-destructive/80" />
                      <div className="size-2.5 rounded-full bg-chart-4/80" />
                      <div className="size-2.5 rounded-full bg-chart-2/80" />
                    </div>
                    <div className="mx-4 flex h-5 flex-1 items-center justify-start px-2 gap-2 rounded-[4px] border border-border/40 bg-background/50 font-mono text-[10px] text-muted-foreground">
                       <Icon name="search" className="size-3" />
                       luminescent://live-preview
                    </div>
                  </div>
                  
                  <div className="flex-1 bg-white relative w-full h-full">
                     {isGeneratingPreview ? (
                      <div className="h-full w-full flex flex-col items-center justify-center bg-card text-muted-foreground text-center px-8">
                         <Icon name="play" className="size-12 opacity-20 mb-4" />
                         <p className="font-medium text-foreground/85">Generez preview-ul din workspace-ul curent...</p>
                         <p className="mt-2 max-w-md text-[12px] leading-relaxed">
                           Așteaptă puțin. Construiesc runtime-ul și pregătesc iframe-ul cu ultima versiune a codului.
                         </p>
                       </div>
                     ) : appGenerated ? (
                       <iframe 
                         src={withProjectQuery(`/api/preview?v=${encodeURIComponent(projectVersion)}`, currentProjectId)}
                         className="absolute inset-0 w-full h-full border-none bg-background"
                         title="App Preview"
                       />
                     ) : (
                      <div className="h-full w-full flex flex-col items-center justify-center bg-card text-muted-foreground">
                         <Icon name="terminal" className="size-12 opacity-20 mb-4" />
                         <p>Apasă `Generate app preview` după ce workspace-ul a fost generat, pentru a deschide preview-ul din codul curent.</p>
                       </div>
                     )}
                  </div>
                </Card>

                <Card className="flex flex-col rounded-[18px] border-border/40 bg-card/70 p-5">
                  <div className="space-y-2">
                    <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                      Flow recap
                    </Badge>
                    <h3 className="font-serif text-2xl font-semibold tracking-tight">Tot userflow-ul este conectat</h3>
                    <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                      {isGeneratingPreview
                        ? "Preview-ul se generează acum din workspace-ul Final Code."
                        : previewOpened
                          ? "Preview-ul este alimentat live din conținutul workspace-ului Final Code."
                          : "Deschide preview-ul pentru a vedea instant modificările făcute în workspace."}
                    </p>
                  </div>
                  <div className="mt-5 space-y-3">
                    {stages.map((stage) => (
                      <div key={stage} className="rounded-[12px] border border-border/40 bg-background/70 p-3">
                      <div className="mb-1 text-[10px] font-mono uppercase tracking-widest text-primary">{stageNumbers[stage]}</div>
                        <div className="text-[13px] font-semibold text-foreground/90">{isHydrated ? stage : ""}</div>
                        <div className="text-[12px] leading-relaxed text-muted-foreground">{isHydrated ? stageDescriptions[stage] : ""}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          )}
        </main>

        <aside className="relative z-10 hidden w-[260px] 2xl:w-[300px] shrink-0 flex-col border-l border-white/5 bg-background/50 backdrop-blur-xl lg:flex overflow-hidden">
          <div className="flex h-[42px] shrink-0 items-center justify-between border-b border-border/30 bg-black/10 px-4">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/70">Team & Trace</span>
            <Icon name="users" className="size-4 text-muted-foreground/70" />
          </div>
          <div className="flex flex-col flex-1 gap-6 overflow-y-auto p-5">
            <div className="space-y-4 shrink-0">
              <h4 className="flex items-center gap-2 text-[10px] font-mono font-semibold uppercase tracking-widest text-muted-foreground/80">
                <div className="size-1.5 rounded-full bg-chart-2 shadow-sm" />
                Active Peers
              </h4>
              <div className="space-y-3.5">
                {collaboratorsState.map((collaborator) => (
                  <div key={collaborator.name} className="group flex items-start gap-3 rounded-[8px] border border-transparent p-1.5 transition-colors hover:border-border/30 hover:bg-muted/40">
                    <div className="grid size-8 shrink-0 place-items-center rounded-full border border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5 text-[11px] font-bold text-primary shadow-sm transition-transform group-hover:scale-105">
                      {collaborator.initials}
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <p className="mb-1.5 flex items-center gap-2 text-[12.5px] font-semibold leading-none text-foreground/90">
                        {collaborator.name}
                        <span className="rounded-[4px] bg-muted/60 px-1 py-0.5 text-[9px] font-mono uppercase text-muted-foreground">{collaborator.role.split(" ")[0]}</span>
                      </p>
                      <p className="truncate text-[11px] font-medium text-muted-foreground/80">{collaborator.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator className="bg-border/40" />

            <div className="space-y-4">
              <h4 className="flex items-center gap-2 text-[10px] font-mono font-semibold uppercase tracking-widest text-muted-foreground/80">
                <div className="size-1.5 rounded-full bg-primary shadow-sm" />
                Agent Activity
              </h4>
              <div className="space-y-3">
                {activity.slice(0, 5).map((entry) => (
                  <div key={entry.id} className="rounded-[12px] border border-border/40 bg-background/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[12px] font-semibold text-foreground/90">{entry.title}</p>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-primary/80">{entry.time}</span>
                    </div>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">{entry.detail}</p>
                  </div>
                ))}
              </div>
            </div>
            <Separator />
            <div className="space-y-4 shrink-0">
              <h4 className="flex items-center gap-2 text-[10px] font-mono font-semibold uppercase tracking-widest text-muted-foreground/80">
                <div className="size-1.5 rounded-full bg-primary shadow-sm" />
                Subagents
              </h4>
              <div className="space-y-3">
                {subagentsState.map((agent) => (
                  <div key={agent.id} className="rounded-[12px] border border-border/40 bg-background/65 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[12px] font-semibold text-foreground/90">{agent.name}</div>
                        <div className="text-[11px] text-muted-foreground">{agent.specialty}</div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full text-[9px] uppercase tracking-[0.14em]",
                          agent.status === "active"
                            ? "border-primary/20 bg-primary/10 text-primary"
                            : "border-border/60 bg-background/60 text-muted-foreground"
                        )}
                      >
                        {agent.status}
                      </Badge>
                    </div>
                    <div className="mt-3 text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground/60">
                      Next stage: {agent.stage}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <Separator />
            <div className="space-y-4">
              <h4 className="flex items-center gap-2 text-[10px] font-mono font-semibold uppercase tracking-widest text-muted-foreground/80">
                <div className="size-1.5 rounded-full bg-chart-3 shadow-sm" />
                Orchestration Trace
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-[12px] border border-border/40 bg-background/65 p-3">
                  <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground/60">Runs</div>
                  <div className="mt-1 text-[18px] font-semibold text-foreground/90">{agentRunsState.length}</div>
                </div>
                <div className="rounded-[12px] border border-border/40 bg-background/65 p-3">
                  <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground/60">Artifacts</div>
                  <div className="mt-1 text-[18px] font-semibold text-foreground/90">{artifactsState.length}</div>
                </div>
              </div>
              {agentRunsState[0] ? (
                <div className="rounded-[12px] border border-border/40 bg-background/60 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[12px] font-semibold text-foreground/90">{agentRunsState[0].agentName}</p>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-primary/80">{agentRunsState[0].status}</span>
                  </div>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">{agentRunsState[0].summary}</p>
                </div>
              ) : null}
              {artifactsState[0] ? (
                <div className="rounded-[12px] border border-border/40 bg-background/60 p-3">
                  <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground/60">Latest artifact</div>
                  <p className="mt-1 text-[12px] font-semibold text-foreground/90">{artifactsState[0].title}</p>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">{artifactsState[0].summary}</p>
                </div>
              ) : null}
            </div>
            <div className="space-y-4 min-h-0">
              <h4 className="flex items-center gap-2 text-[10px] font-mono font-semibold uppercase tracking-widest text-muted-foreground/80">
                <div className="size-1.5 rounded-full bg-chart-4 shadow-sm" />
                Activity Feed
              </h4>
              <div className="space-y-3">
                {activity.slice(0, 6).map((entry) => (
                  <div key={entry.id} className="rounded-[12px] border border-border/40 bg-background/65 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[12px] font-semibold text-foreground/90">{entry.title}</div>
                      <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60">{entry.time}</span>
                    </div>
                    <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{entry.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

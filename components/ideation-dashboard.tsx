"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useTheme } from "next-themes"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type StageKey =
  | "Conversation"
  | "Documentation"
  | "Use Cases"
  | "Variants"
  | "Final Code"
  | "Preview"

type BriefState = {
  title: string
  objective: string
  audience: string[]
  scope: string[]
  deliverables: string[]
  risks: string[]
}

type Message = {
  id: string
  author: "Alex" | "Mara" | "Ionut" | "AI Copilot"
  role: "human" | "ai"
  text: string
}

type ActivityEntry = {
  id: string
  title: string
  detail: string
  time: string
}

type UseCase = {
  id: string
  title: string
  summary: string
  preview: string
  acceptance: string[]
}

type Variant = {
  id: string
  title: string
  stack: string
  summary: string
  tradeoff: string
  previewTitle: string
  previewDescription: string
  code: string
}

type WorkspaceFile = {
  id: string
  name: string
  content: string
}

const stages: StageKey[] = [
  "Conversation",
  "Documentation",
  "Use Cases",
  "Variants",
  "Final Code",
  "Preview",
]

const stageNumbers: Record<StageKey, string> = {
  Conversation: "01",
  Documentation: "02",
  "Use Cases": "03",
  Variants: "04",
  "Final Code": "05",
  Preview: "06",
}

const stageDescriptions: Record<StageKey, string> = {
  Conversation: "Oamenii discută între ei și cu AI-ul.",
  Documentation: "Conversația este transformată în documentație editabilă.",
  "Use Cases": "Din documentație se generează use case-uri și preview-uri.",
  Variants: "Echipele AI propun 3 variante de implementare.",
  "Final Code": "Se vede codul final pentru varianta aleasă.",
  Preview: "Aplicația este generată și rulată în preview.",
}

const topLinks: StageKey[] = ["Conversation", "Documentation", "Preview"]

const starterPrompts = [
  "Avem nevoie de un flow clar de la idee la preview.",
  "Documentația trebuie aprobată de echipă înainte de implementare.",
  "Vreau să compar 3 variante generate și să aleg rapid una.",
]

const collaborators = [
  { name: "Alex", role: "Product lead", initials: "AC", status: "clarifică ideea" },
  { name: "Mara", role: "UX architect", initials: "MR", status: "rafinează userflow-ul" },
  { name: "Ionut", role: "Tech lead", initials: "IN", status: "pregătește varianta finală" },
]

const initialBrief: BriefState = {
  title: "AI-Native SDLC IDE",
  objective:
    "Construiți un IDE colaborativ unde echipele discută, documentează, aleg varianta de implementare și generează aplicația finală cu preview.",
  audience: ["Product manageri", "Developeri", "Technical leads"],
  scope: [
    "Conversație echipă + AI",
    "Documentație structurată și aprobată",
    "3 variante de implementare cu preview",
  ],
  deliverables: [
    "Project brief aprobat",
    "Use case-uri și preview-uri generate",
    "Cod final și preview rulabil",
  ],
  risks: ["Confuzie între etape", "Prea multe butoane fără scop", "Alegere dificilă între variante"],
}

const initialMessages: Message[] = [
  {
    id: "m1",
    author: "Alex",
    role: "human",
    text: "Vreau un flow unde echipa discută cu AI-ul și totul duce natural spre aplicația finală.",
  },
  {
    id: "m2",
    author: "Mara",
    role: "human",
    text: "Preview-urile trebuie să apară devreme, ca să putem alege varianta potrivită.",
  },
  {
    id: "m3",
    author: "AI Copilot",
    role: "ai",
    text: "Am înțeles. Structurez experiența în 6 etape continue: conversație, documentație, use case-uri, variante, cod final și preview.",
  },
]

const initialActivity: ActivityEntry[] = [
  { id: "a1", title: "Flow initialized", detail: "Workspace-ul pornește din etapa de conversație.", time: "Acum" },
  { id: "a2", title: "AI Copilot", detail: "A sintetizat direcția produsului în 6 pași.", time: "Acum" },
]

function toSentenceLabel(value: string, fallback: string) {
  const cleaned = value.trim().replace(/[.:]/g, "")
  if (!cleaned) return fallback
  return cleaned
    .split(/\s+/)
    .slice(0, 6)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

function buildUseCases(brief: BriefState): UseCase[] {
  return [
    {
      id: "UC-01",
      title: "Conversație ghidată între oameni și AI",
      summary: `AI-ul preia discuția despre ${brief.title.toLowerCase()} și o transformă într-un brief coerent.`,
      preview: "Chat orchestration view",
      acceptance: [
        "membrii echipei pot contribui în același fir",
        "AI-ul propune sumar și întrebări de clarificare",
        "discuția poate fi promovată în documentație",
      ],
    },
    {
      id: "UC-02",
      title: "Generare de documentație din context",
      summary: `Documentația derivă din obiectivul: ${brief.objective}`,
      preview: "Editable documentation canvas",
      acceptance: [
        "brief-ul se poate edita inline",
        "fiecare secțiune se poate aproba",
        "use case-urile apar după aprobare",
      ],
    },
    {
      id: "UC-03",
      title: "Comparare a 3 variante de implementare",
      summary: "Echipa vede tradeoff-uri, preview-uri și selectează varianta finală.",
      preview: "Variant comparison board",
      acceptance: [
        "sunt generate exact 3 variante",
        "fiecare variantă are preview și rezumat",
        "una singură poate fi aleasă pentru codul final",
      ],
    },
  ]
}

function buildVariants(useCase: UseCase, brief: BriefState): Variant[] {
  const objectiveKey = toSentenceLabel(brief.objective, "Collaborative Flow")
  return [
    {
      id: "VAR-A",
      title: "Variant A · Guided Pipeline",
      stack: "Next.js + timeline orchestration",
      summary: "Flow strict, cu aprobări între etape și vizibilitate clară pentru fiecare handoff.",
      tradeoff: "Cea mai clară variantă pentru demo și onboarding, dar cu libertate mai mică de explorare.",
      previewTitle: "Linear workspace preview",
      previewDescription: "Utilizatorul avansează etapă cu etapă și vede mereu următoarea acțiune recomandată.",
      code: `export const selectedFlow = {\n  name: "${objectiveKey}",\n  variant: "guided-pipeline",\n  stages: ["conversation", "documentation", "use-cases", "variants", "final-code", "preview"],\n  approvalRequired: true,\n}\n`,
    },
    {
      id: "VAR-B",
      title: "Variant B · Split Canvas",
      stack: "Next.js + collaborative panes",
      summary: "Conversația, documentația și preview-ul apar simultan într-un canvas împărțit.",
      tradeoff: "Mai spectaculoasă vizual, dar poate încărca utilizatorii care vor un flow simplu.",
      previewTitle: "Parallel collaboration preview",
      previewDescription: "Echipa urmărește editarea documentației și preview-ul în același timp.",
      code: `export const selectedFlow = {\n  name: "${objectiveKey}",\n  variant: "split-canvas",\n  panes: ["chat", "docs", "preview"],\n  comparisonMode: "always-on",\n}\n`,
    },
    {
      id: "VAR-C",
      title: "Variant C · Review First",
      stack: "Next.js + gated delivery rooms",
      summary: "Fiecare pas produce un artefact formal și cere review uman înainte de continuare.",
      tradeoff: "Foarte bună pentru enterprise și audit, dar mai lentă pentru iterații rapide.",
      previewTitle: "Governed delivery preview",
      previewDescription: "Fiecare artefact este înghețat, aprobat și împins în etapa următoare.",
      code: `export const selectedFlow = {\n  name: "${objectiveKey}",\n  variant: "review-first",\n  governance: "strict",\n  rooms: ["brief", "requirements", "selection", "merge"],\n}\n`,
    },
  ].map((variant) => ({
    ...variant,
    summary: `${variant.summary} Use case focus: ${useCase.title.toLowerCase()}.`,
  }))
}

function buildWorkspaceFiles(brief: BriefState, useCase: UseCase, variant: Variant): WorkspaceFile[] {
  return [
    {
      id: "file-brief",
      name: "project-brief.md",
      content: `# ${brief.title}\n\n## Objective\n${brief.objective}\n\n## Audience\n${brief.audience.map((item) => `- ${item}`).join("\n")}\n\n## Scope\n${brief.scope.map((item) => `- ${item}`).join("\n")}\n`,
    },
    {
      id: "file-use-case",
      name: "selected-use-case.md",
      content: `# ${useCase.id} ${useCase.title}\n\n${useCase.summary}\n\n## Acceptance Criteria\n${useCase.acceptance.map((item) => `- ${item}`).join("\n")}\n`,
    },
    {
      id: "file-app",
      name: "app-flow.ts",
      content: `${variant.code}\nexport function generatePreview() {\n  return {\n    title: "${variant.previewTitle}",\n    status: "ready-for-preview",\n    useCase: "${useCase.id}",\n  }\n}\n`,
    },
  ]
}

function buildAiReply(message: string) {
  const normalized = message.trim()
  if (!normalized) return "Continuăm."
  return `Am preluat direcția "${toSentenceLabel(normalized, "Flow Update")}" și o împing în următorul artefact logic.`
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

export function IdeationDashboard() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  const [currentStage, setCurrentStage] = useState<StageKey>("Conversation")
  const [search, setSearch] = useState("")
  const [brief, setBrief] = useState(initialBrief)
  const [messages, setMessages] = useState(initialMessages)
  const [composer, setComposer] = useState("")
  const [activeSpeaker, setActiveSpeaker] = useState<"Alex" | "Mara" | "Ionut">("Alex")
  const [activity, setActivity] = useState(initialActivity)
  const [selectedUseCaseId, setSelectedUseCaseId] = useState("UC-01")
  const [selectedVariantId, setSelectedVariantId] = useState("VAR-A")
  const [selectedFileId, setSelectedFileId] = useState("file-brief")
  const [autoSave, setAutoSave] = useState(true)
  const [appGenerated, setAppGenerated] = useState(false)
  const [previewOpened, setPreviewOpened] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const useCases = useMemo(() => buildUseCases(brief), [brief])
  const selectedUseCase = useCases.find((item) => item.id === selectedUseCaseId) ?? useCases[0]
  const variants = useMemo(() => buildVariants(selectedUseCase, brief), [selectedUseCase, brief])
  const selectedVariant = variants.find((item) => item.id === selectedVariantId) ?? variants[0]
  const generatedFiles = useMemo(() => buildWorkspaceFiles(brief, selectedUseCase, selectedVariant), [brief, selectedUseCase, selectedVariant])
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFile[]>([])
  const activeFile = workspaceFiles.find((file) => file.id === selectedFileId) ?? workspaceFiles[0]

  useEffect(() => {
    if (!workspaceFiles.some((file) => file.id === selectedFileId)) {
      setSelectedFileId(workspaceFiles[0]?.id ?? "")
    }
  }, [workspaceFiles, selectedFileId])

  useEffect(() => {
    setWorkspaceFiles(generatedFiles)
  }, [generatedFiles])

  function addActivity(title: string, detail: string) {
    setActivity((current) => [
      { id: `a-${Date.now()}-${current.length}`, title, detail, time: "Acum" },
      ...current,
    ])
  }

  function moveToStage(stage: StageKey, detail?: string) {
    setCurrentStage(stage)
    if (detail) {
      addActivity(`Moved to ${stage}`, detail)
    }
  }

  function sendMessage() {
    const trimmed = composer.trim()
    if (!trimmed) return

    const nextMessage: Message = {
      id: `m-${Date.now()}`,
      author: activeSpeaker,
      role: "human",
      text: trimmed,
    }

    const aiReply: Message = {
      id: `m-${Date.now() + 1}`,
      author: "AI Copilot",
      role: "ai",
      text: buildAiReply(trimmed),
    }

    setMessages((current) => [...current, nextMessage, aiReply])
    setComposer("")
    addActivity(activeSpeaker, `A trimis un mesaj care rafinează direcția produsului.`)
  }

  function regenerateDocumentation() {
    setBrief((current) => ({
      ...current,
      title: `${toSentenceLabel(current.title, "AI Native IDE")} Flow`,
      objective: `${current.objective} Echipa vede clar ce urmează și poate avansa fără blocaje.`,
      deliverables: Array.from(new Set([...current.deliverables, "Flow final aprobat pentru demo"])),
    }))
    addActivity("Documentation regenerated", "Brief-ul a fost actualizat din conversație.")
  }

  function pushToDocumentation() {
    regenerateDocumentation()
    moveToStage("Documentation", "Conversația a fost promovată în documentație.")
  }

  function approveDocumentation() {
    addActivity("Brief approved", "Documentația este gata pentru generarea use case-urilor.")
    moveToStage("Use Cases", "Use case-urile au fost generate din documentație.")
  }

  function openUseCase(useCaseId: string) {
    setSelectedUseCaseId(useCaseId)
    addActivity("Use case selected", `${useCaseId} a devenit focusul comparației.`)
  }

  function moveToVariants() {
    addActivity("Variants generated", "Au fost generate 3 variante pentru use case-ul ales.")
    moveToStage("Variants", "Comparăm cele 3 implementări propuse.")
  }

  function chooseVariant(variantId: string) {
    setSelectedVariantId(variantId)
    addActivity("Variant selected", `${variantId} a fost aleasă pentru codul final.`)
  }

  function approveVariant() {
    addActivity("Final code ready", `${selectedVariant.id} a fost promovată în zona de cod final.`)
    moveToStage("Final Code", "Codul final reflectă varianta selectată.")
  }

  function regenerateCode() {
    setSelectedVariantId((current) => current)
    addActivity("Code regenerated", "Comentariile și structura finală au fost reîmprospătate.")
  }

  function generateApplication() {
    setAppGenerated(true)
    setPreviewOpened(true)
    addActivity("Application generated", "Preview-ul aplicației este gata de vizualizare.")
    moveToStage("Preview", "Aplicația finală a fost generată din codul selectat.")
  }

  function openPreviewWindow() {
    setPreviewOpened(true)
    addActivity("Preview opened", "Fereastra de preview este activă.")
  }

  function restartFlow() {
    setCurrentStage("Conversation")
    setSelectedUseCaseId("UC-01")
    setSelectedVariantId("VAR-A")
    setSelectedFileId("file-brief")
    setAppGenerated(false)
    setPreviewOpened(false)
    addActivity("Flow restarted", "Experiența a fost resetată la conversația inițială.")
  }

  const filteredStages = stages.filter((stage) => stage.toLowerCase().includes(search.toLowerCase()))

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
                onClick={() => moveToStage(item, `Navigare rapidă către ${item.toLowerCase()}.`)}
                className={cn(
                  "h-8 rounded-[8px] px-3 text-[12px]",
                  currentStage === item ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {item}
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
          {mounted && (
            <Button
              size="icon"
              variant="outline"
              className="size-8 rounded-[8px] border-border/40 bg-muted/30 text-foreground/80 shadow-inner hover:bg-muted"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} className="size-4" />
            </Button>
          )}
          <Button
            size="sm"
            className="h-8 rounded-[8px] bg-primary text-[12px] font-medium text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_1px_3px_rgba(16,185,129,0.2)] transition-all hover:bg-primary/95"
            onClick={() =>
              currentStage === "Preview"
                ? restartFlow()
                : moveToStage(stages[Math.min(stages.indexOf(currentStage) + 1, stages.length - 1)], "A fost deschisă etapa următoare din flow.")
            }
          >
            {currentStage === "Preview" ? "Restart Flow" : "Next Step"}
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
                    onClick={() => moveToStage(stage, `S-a navigat către ${stage.toLowerCase()}.`)}
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
                      <span>{stage}</span>
                      <span className="text-[11px] font-normal leading-snug text-muted-foreground/75">{stageDescriptions[stage]}</span>
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
                    <div className="border-b border-border/40 px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {(["Alex", "Mara", "Ionut"] as const).map((speaker) => (
                          <Button
                            key={speaker}
                            size="sm"
                            variant={activeSpeaker === speaker ? "default" : "outline"}
                            onClick={() => setActiveSpeaker(speaker)}
                            className="h-8 rounded-full px-3 text-[11px]"
                          >
                            {speaker}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="flex-1 space-y-4 overflow-y-auto p-4">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={cn("flex flex-col gap-1", message.role === "human" ? "items-end" : "items-start")}
                        >
                          <span className="px-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">{message.author}</span>
                          <div
                            className={cn(
                              "max-w-[90%] rounded-[16px] px-3.5 py-2.5 text-[13px] leading-[1.6] shadow-sm",
                              message.role === "human" ? "rounded-tr-[4px] bg-primary text-primary-foreground" : "rounded-tl-[4px] border border-border/40 bg-background/80 text-foreground/90"
                            )}
                          >
                            {message.text}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-border/40 bg-card/60 p-3">
                      <div className="flex items-center gap-2">
                        <Input
                          value={composer}
                          onChange={(event) => setComposer(event.target.value)}
                          onKeyDown={(event) => event.key === "Enter" && sendMessage()}
                          placeholder="Scrie următoarea clarificare pentru AI..."
                          className="h-10 rounded-full border-border/50 bg-background/50 px-4 text-[12px]"
                        />
                        <Button size="icon" onClick={sendMessage} disabled={!composer.trim()} className="size-9 rounded-full">
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
                        Aici validăm că discuția dintre oameni și AI produce imediat următorul artefact logic.
                      </p>
                    </div>
                    <div className="space-y-3 text-[13px]">
                      <div className="rounded-[12px] border border-border/40 bg-background/70 p-3">
                        <div className="mb-1 text-[10px] font-mono uppercase tracking-widest text-primary">Current objective</div>
                        <p className="leading-relaxed text-foreground/85">{brief.objective}</p>
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
              <div className="grid flex-1 gap-4 overflow-y-auto p-4 xl:grid-cols-[1.1fr_0.9fr] xl:p-6">
                <Card className="rounded-[16px] border-border/40 bg-card/70 p-5">
                  <div className="space-y-5">
                    <div>
                      <label className="mb-2 block text-[10px] font-mono uppercase tracking-[0.15em] text-primary">Project title</label>
                      <Textarea
                        value={brief.title}
                        onChange={(event) => setBrief({ ...brief, title: event.target.value })}
                        rows={1}
                        className="min-h-0 resize-none border-border/40 bg-background/60 text-[28px] font-serif font-semibold tracking-tight"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-[10px] font-mono uppercase tracking-[0.15em] text-primary">Objective</label>
                      <Textarea
                        value={brief.objective}
                        onChange={(event) => setBrief({ ...brief, objective: event.target.value })}
                        className="min-h-[110px] border-border/40 bg-background/60 leading-[1.7]"
                      />
                    </div>
                    {(["audience", "scope", "deliverables", "risks"] as const).map((key) => (
                      <div key={key} className="rounded-[14px] border border-border/40 bg-background/50 p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <label className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">{key}</label>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setBrief({ ...brief, [key]: [...brief[key], ""] })}
                            className="h-7 px-2 text-[10px] text-primary hover:bg-primary/10"
                          >
                            + Add item
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {brief[key].map((item, index) => (
                            <Input
                              key={`${key}-${index}`}
                              value={item}
                              onChange={(event) => {
                                const next = [...brief[key]]
                                next[index] = event.target.value
                                setBrief({ ...brief, [key]: next })
                              }}
                              className="h-9 border-border/40 bg-card/70"
                              placeholder="..."
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="flex flex-col rounded-[16px] border-border/40 bg-card/70 p-5">
                  <div className="space-y-2">
                    <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                      Documentation ready
                    </Badge>
                    <h3 className="font-serif text-2xl font-semibold tracking-tight">Brief aprobat, apoi use case-uri</h3>
                    <p className="text-[13px] leading-relaxed text-muted-foreground">
                      Etapa asta transformă conversația în document oficial. Când îl aprobăm, trecem direct la use case-uri și preview-uri.
                    </p>
                  </div>
                  <div className="mt-5 space-y-3">
                    {brief.deliverables.map((item) => (
                      <div key={item} className="rounded-[12px] border border-border/40 bg-background/70 p-3 text-[13px] text-foreground/85">
                        {item}
                      </div>
                    ))}
                  </div>
                  <div className="mt-auto flex flex-col gap-2 pt-6">
                    <Button onClick={approveDocumentation}>Aprobă brief-ul și generează use case-uri</Button>
                    <Button variant="outline" onClick={() => moveToStage("Conversation", "Echipa revine la discuție pentru clarificări.")}>
                      Înapoi la conversație
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {currentStage === "Use Cases" && (
            <div className="flex h-full flex-col">
              <IDEHeader
                title="Use Cases & Previews"
                icon="layout"
                rightNode={
                  <Button size="sm" variant="ghost" onClick={moveToVariants} className="h-[26px] text-[11px] text-primary hover:bg-primary/10">
                    Generate 3 variants
                  </Button>
                }
              />
              <div className="grid flex-1 gap-4 overflow-y-auto p-4 xl:grid-cols-[1.2fr_0.8fr] xl:p-6">
                <div className="grid content-start gap-4 lg:grid-cols-2">
                  {useCases.map((useCase) => {
                    const active = selectedUseCase.id === useCase.id
                    return (
                      <Card
                        key={useCase.id}
                        className={cn(
                          "flex flex-col rounded-[16px] border-border/40 bg-card/70 p-5 transition-all",
                          active && "border-primary/50 shadow-[0_0_0_1px_rgba(16,185,129,0.2)]"
                        )}
                      >
                        <div className="mb-4 flex items-center justify-between">
                          <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                            {useCase.id}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground">{useCase.preview}</span>
                        </div>
                        <h3 className="mb-2 text-[18px] font-semibold leading-snug text-foreground/90">{useCase.title}</h3>
                        <p className="mb-4 text-[13px] leading-relaxed text-muted-foreground">{useCase.summary}</p>
                        <div className="space-y-2 border-t border-border/30 pt-4">
                          {useCase.acceptance.map((criterion) => (
                            <div key={criterion} className="rounded-[10px] bg-background/60 px-3 py-2 text-[12px] text-foreground/85">
                              {criterion}
                            </div>
                          ))}
                        </div>
                        <div className="mt-auto flex gap-2 pt-5">
                          <Button onClick={() => openUseCase(useCase.id)} className="flex-1">
                            Alege use case-ul
                          </Button>
                          <Button variant="outline" onClick={() => moveToStage("Documentation", "S-a revenit la documentație pentru ajustări.")} className="flex-1">
                            Editează brief-ul
                          </Button>
                        </div>
                      </Card>
                    )
                  })}
                </div>

                <Card className="flex flex-col rounded-[16px] border-border/40 bg-card/70 p-5">
                  <div className="space-y-2">
                    <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                      Selected preview
                    </Badge>
                    <h3 className="font-serif text-2xl font-semibold tracking-tight">{selectedUseCase.title}</h3>
                    <p className="text-[13px] leading-relaxed text-muted-foreground">
                      Din acest use case vor fi generate cele 3 variante pe care echipa le compară înainte de codul final.
                    </p>
                  </div>
                  <div className="mt-5 rounded-[18px] border border-border/40 bg-background/80 p-5">
                    <div className="mb-3 text-[10px] font-mono uppercase tracking-widest text-primary">{selectedUseCase.preview}</div>
                    <div className="space-y-3">
                      <div className="rounded-[12px] bg-primary/10 p-4 text-sm font-medium text-foreground/90">
                        Live preview focus: colaborare, generare și selecție controlată.
                      </div>
                      <div className="rounded-[12px] border border-dashed border-border/50 p-4 text-[12px] leading-relaxed text-muted-foreground">
                        UI-ul afișează un rezumat al conversației, documentația aprobată și CTA-ul care deschide comparația între cele 3 variante.
                      </div>
                    </div>
                  </div>
                  <div className="mt-auto pt-6">
                    <Button onClick={moveToVariants} className="w-full">
                      Continuă către cele 3 variante
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {currentStage === "Variants" && (
            <div className="flex h-full flex-col">
              <IDEHeader
                title="Three Generated Variants"
                icon="branch"
                rightNode={
                  <Button size="sm" variant="ghost" onClick={approveVariant} className="h-[26px] text-[11px] text-primary hover:bg-primary/10">
                    Open final code
                  </Button>
                }
              />
              <div className="grid flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-3 lg:p-6">
                {variants.map((variant) => {
                  const active = selectedVariant.id === variant.id
                  return (
                    <Card
                      key={variant.id}
                      className={cn(
                        "flex flex-col rounded-[16px] border-border/40 bg-card/70 p-5 transition-all",
                        active && "border-primary/50 shadow-[0_0_0_1px_rgba(16,185,129,0.22)]"
                      )}
                    >
                      <div className="mb-4 flex items-center justify-between">
                        <Badge variant="outline" className={cn("uppercase", active ? "border-primary/20 bg-primary/10 text-primary" : "text-muted-foreground")}>
                          {variant.id}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">{variant.stack}</span>
                      </div>
                      <h3 className="mb-2 text-[19px] font-semibold">{variant.title}</h3>
                      <p className="mb-3 text-[13px] leading-relaxed text-muted-foreground">{variant.summary}</p>
                      <div className="rounded-[14px] border border-border/40 bg-background/70 p-4">
                        <div className="mb-1 text-[10px] font-mono uppercase tracking-widest text-primary">{variant.previewTitle}</div>
                        <p className="text-[12px] leading-relaxed text-foreground/85">{variant.previewDescription}</p>
                      </div>
                      <div className="mt-3 rounded-[14px] border border-dashed border-border/40 bg-background/60 p-4 text-[12px] leading-relaxed text-muted-foreground">
                        {variant.tradeoff}
                      </div>
                      <div className="mt-auto flex flex-col gap-2 pt-5">
                        <Button onClick={() => chooseVariant(variant.id)}>
                          {active ? "Varianta selectată" : "Alege varianta"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            chooseVariant(variant.id)
                            moveToStage("Final Code", "Codul final a fost deschis pentru varianta aleasă.")
                          }}
                        >
                          Vezi codul final
                        </Button>
                      </div>
                    </Card>
                  )
                })}
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
                      <Button size="sm" variant="ghost" onClick={generateApplication} className="h-[22px] border border-primary/20 bg-primary/10 px-2 text-[10px] text-primary hover:bg-primary/20">
                        Generate app preview
                      </Button>
                    </div>
                  }
                />
                <div className="flex min-h-0 flex-1">
                  <div className="hidden w-56 shrink-0 border-r border-border/40 bg-background/10 md:block">
                    <div className="space-y-1 p-2">
                      {workspaceFiles.map((file) => (
                        <button
                          key={file.id}
                          onClick={() => setSelectedFileId(file.id)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md border px-2 py-2 text-left text-[12.5px] transition-all",
                            activeFile.id === file.id ? "border-primary/20 bg-primary/10 font-medium text-primary shadow-sm" : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                          )}
                        >
                          <Icon name="file" className="size-3.5 shrink-0 opacity-80" />
                          <span className="truncate">{file.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="relative flex-1 border-r border-border/40">
                    <Textarea
                      value={activeFile?.content ?? ""}
                      onChange={(event) =>
                        setWorkspaceFiles((current) =>
                          current.map((file) =>
                            file.id === activeFile?.id ? { ...file, content: event.target.value } : file
                          )
                        )
                      }
                      className="absolute inset-0 h-full w-full resize-none rounded-none border-none bg-transparent p-4 font-mono text-[13.5px] leading-[1.7] text-foreground/90 shadow-none focus-visible:ring-0"
                      spellCheck={false}
                    />
                  </div>
                  <div className="hidden w-[360px] shrink-0 flex-col bg-card/50 xl:flex">
                    <IDEHeader title="Code Summary" icon="terminal" />
                    <div className="flex-1 space-y-4 p-4">
                      <div className="rounded-[14px] border border-border/40 bg-background/70 p-4">
                        <div className="mb-1 text-[10px] font-mono uppercase tracking-widest text-primary">Chosen variant</div>
                        <div className="text-[14px] font-semibold">{selectedVariant.title}</div>
                        <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{selectedVariant.tradeoff}</p>
                      </div>
                      <div className="rounded-[14px] border border-border/40 bg-background/70 p-4">
                        <div className="mb-1 text-[10px] font-mono uppercase tracking-widest text-primary">Next step</div>
                        <p className="text-[12px] leading-relaxed text-foreground/85">
                          Din acest punct, butonul principal generează aplicația și o deschide în preview.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
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
                    <Button size="sm" variant="ghost" onClick={openPreviewWindow} className="h-[22px] px-2 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground">
                      Open preview
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => moveToStage("Final Code", "S-a revenit la codul final pentru ajustări.")} className="h-[22px] border border-primary/20 bg-primary/10 px-2 text-[10px] text-primary hover:bg-primary/20">
                      Back to code
                    </Button>
                  </div>
                }
              />
              <div className="grid flex-1 gap-4 overflow-y-auto p-4 xl:grid-cols-[1fr_360px] xl:p-6">
                <Card className="flex min-h-[520px] flex-col overflow-hidden rounded-[18px] border-border/40 bg-card/70">
                  <div className="flex h-8 items-center gap-2 border-b border-border/40 bg-muted/40 px-3">
                    <div className="flex gap-1.5">
                      <div className="size-2.5 rounded-full bg-destructive/80" />
                      <div className="size-2.5 rounded-full bg-chart-4/80" />
                      <div className="size-2.5 rounded-full bg-chart-2/80" />
                    </div>
                    <div className="mx-4 flex h-5 flex-1 items-center justify-center rounded-sm border border-border/40 bg-background/50 text-center font-mono text-[10px] text-muted-foreground">
                      preview.luminescent.app
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col justify-between p-6">
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                          {appGenerated ? "App generated" : "Ready to generate"}
                        </Badge>
                        <h1 className="font-serif text-3xl font-semibold tracking-tight">{brief.title}</h1>
                        <p className="max-w-2xl text-[14px] leading-relaxed text-muted-foreground">{brief.objective}</p>
                      </div>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="rounded-[16px] border border-border/40 bg-background/80 p-4">
                          <div className="mb-1 text-[10px] font-mono uppercase tracking-widest text-primary">Selected use case</div>
                          <div className="text-[14px] font-semibold">{selectedUseCase.title}</div>
                        </div>
                        <div className="rounded-[16px] border border-border/40 bg-background/80 p-4">
                          <div className="mb-1 text-[10px] font-mono uppercase tracking-widest text-primary">Chosen variant</div>
                          <div className="text-[14px] font-semibold">{selectedVariant.title}</div>
                        </div>
                        <div className="rounded-[16px] border border-border/40 bg-background/80 p-4">
                          <div className="mb-1 text-[10px] font-mono uppercase tracking-widest text-primary">Preview status</div>
                          <div className="text-[14px] font-semibold">{previewOpened ? "Live" : "Paused"}</div>
                        </div>
                      </div>
                      <div className="rounded-[20px] border border-dashed border-primary/30 bg-primary/5 p-6">
                        <div className="mb-2 text-[10px] font-mono uppercase tracking-widest text-primary">{selectedVariant.previewTitle}</div>
                        <p className="mb-4 max-w-2xl text-[14px] leading-relaxed text-foreground/85">{selectedVariant.previewDescription}</p>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-[14px] border border-border/40 bg-background/80 p-4 text-[13px] text-foreground/85">
                            Team chat, documentația și selecția de variante sunt legate într-un singur flux coerent.
                          </div>
                          <div className="rounded-[14px] border border-border/40 bg-background/80 p-4 text-[13px] text-foreground/85">
                            CTA-ul principal duce mereu utilizatorul către pasul logic următor, fără butoane moarte.
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <Button onClick={restartFlow}>Pornește un flow nou</Button>
                      <Button variant="outline" onClick={() => moveToStage("Conversation", "Echipa revine la primul pas al userflow-ului.")}>
                        Înapoi la conversație
                      </Button>
                    </div>
                  </div>
                </Card>

                <Card className="flex flex-col rounded-[18px] border-border/40 bg-card/70 p-5">
                  <div className="space-y-2">
                    <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                      Flow recap
                    </Badge>
                    <h3 className="font-serif text-2xl font-semibold tracking-tight">Tot userflow-ul este conectat</h3>
                  </div>
                  <div className="mt-5 space-y-3">
                    {stages.map((stage) => (
                      <div key={stage} className="rounded-[12px] border border-border/40 bg-background/70 p-3">
                        <div className="mb-1 text-[10px] font-mono uppercase tracking-widest text-primary">{stageNumbers[stage]}</div>
                        <div className="text-[13px] font-semibold text-foreground/90">{stage}</div>
                        <div className="text-[12px] leading-relaxed text-muted-foreground">{stageDescriptions[stage]}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          )}
        </main>

        <aside className="relative z-10 hidden w-72 shrink-0 flex-col border-l border-white/5 bg-background/50 backdrop-blur-xl 2xl:flex">
          <div className="flex h-[42px] shrink-0 items-center justify-between border-b border-border/30 bg-black/10 px-4">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/70">Team & Trace</span>
            <Icon name="users" className="size-4 text-muted-foreground/70" />
          </div>
          <div className="flex-1 space-y-8 overflow-y-auto p-5">
            <div className="space-y-4">
              <h4 className="flex items-center gap-2 text-[10px] font-mono font-semibold uppercase tracking-widest text-muted-foreground/80">
                <div className="size-1.5 rounded-full bg-chart-2 shadow-sm" />
                Active Peers
              </h4>
              <div className="space-y-3.5">
                {collaborators.map((collaborator) => (
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

            <Separator className="bg-border/30" />

            <div className="space-y-4">
              <h4 className="flex items-center gap-2 text-[10px] font-mono font-semibold uppercase tracking-widest text-muted-foreground/80">
                <Icon name="pulse" className="size-3 text-primary/80" />
                Auto-Logs
              </h4>
              <div className="space-y-0 pb-4">
                {activity.slice(0, 8).map((entry) => (
                  <div key={entry.id} className="relative cursor-default pb-5 pl-5 opacity-80 transition-opacity hover:opacity-100 last:pb-0">
                    <div className="absolute left-0 top-1.5 z-10 size-2 rounded-full bg-primary ring-4 ring-background shadow-[0_0_10px_rgba(16,185,129,0.35)]" />
                    <div className="absolute bottom-[-10px] left-[3px] top-3 -z-0 w-px bg-gradient-to-b from-border/70 to-border/20 last:hidden" />
                    <div className="mt-[-2px] space-y-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[12.5px] font-semibold tracking-tight text-primary">{entry.title}</span>
                        <span className="shrink-0 text-[9.5px] font-mono uppercase tracking-wider text-muted-foreground/60">{entry.time}</span>
                      </div>
                      <p className="text-[11.5px] leading-snug text-muted-foreground/80">{entry.detail}</p>
                    </div>
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

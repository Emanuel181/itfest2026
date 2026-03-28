"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useTheme } from "next-themes"
import { ReactFlow, Controls, Background } from "@xyflow/react"
import "@xyflow/react/dist/style.css"
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
  | "Features"
  | "User Stories"
  | "Final Code"
  | "Preview"

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

type Message = {
  id: string
  author: "Alex" | "Mara" | "Ionut" | "AI Copilot" | "Business AI" | "Tech AI"
  role: "human" | "ai"
  text: string
}

type ActivityEntry = {
  id: string
  title: string
  detail: string
  time: string
}

type Feature = {
  id: string
  title: string
  summary: string
  preview: string
  variations: string[]
  acceptance: string[]
}

type UserStory = {
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
  "Features",
  "User Stories",
  "Final Code",
  "Preview",
]

const stageNumbers: Record<StageKey, string> = {
  Conversation: "01",
  Documentation: "02",
  Features: "03",
  "User Stories": "04",
  "Final Code": "05",
  Preview: "06",
}

const stageDescriptions: Record<StageKey, string> = {
  Conversation: "Oamenii discută pe ramuri separate: Business și Tech",
  Documentation: "Generare scheme tehnice și brief de produs.",
  Features: "Selecție a modulelor și variațiilor recomandate.",
  "User Stories": "Maparea Agile a feature-urilor bifate.",
  "Final Code": "Se vede codul final pentru aplicația formată.",
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

const initialArchNodes = [
  { id: '1', position: { x: 100, y: 0 }, data: { label: '💻 IDE UI (Next.js)' }, type: 'input' },
  { id: '2', position: { x: 100, y: 80 }, data: { label: '🚪 API Gateway' } },
  { id: '3', position: { x: 280, y: 80 }, data: { label: '⚡ WebSocket' } },
  { id: '4', position: { x: -80, y: 80 }, data: { label: '🔴 Redis Cache' } },
  { id: '5', position: { x: 100, y: 160 }, data: { label: '🧠 AI Orchestrator' } },
  { id: '6', position: { x: -80, y: 160 }, data: { label: '🐘 PostgreSQL DB' } },
  { id: '7', position: { x: 280, y: 200 }, data: { label: '🛡️ Security Agent' } },
  { id: '8', position: { x: 0, y: 250 }, data: { label: '📈 Business AI' } },
  { id: '9', position: { x: 180, y: 250 }, data: { label: '⚙️ Technical AI' } },
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

const initialBrief: BriefState = {
  title: "AI-Native SDLC IDE",
  objective:
    "Construiți un IDE unde echipele discută, documentează, aleg feature-uri și generează o aplicație complexă.",
  audience: ["Product manageri", "Developeri", "Technical leads"],
  scope: [
    "Conversație pe 2 planuri (Business/Tech)",
    "Documentație de arhitectură și brief",
    "Generare dinamică User Stories",
  ],
  deliverables: [
    "Project brief aprobat",
    "Arhitectură tehnică validată",
    "Cod final și preview rulabil",
  ],
  risks: ["Confuzie între etape", "Alegere dificilă între variante tehnice"],
  techStack: ["Next.js", "TailwindCSS", "PostgreSQL", "Supabase", "Redis"],
  dbSchema: "model User {\n  id String @id @default(uuid())\n  email String @unique\n  role String\n}\n\nmodel Story {\n  id String @id\n  title String\n}",
  architecture: "Fullstack Next.js architecture with Edge Functions and collaborative WebSocket server for real-time presence.",
}

const initialBusinessMessages: Message[] = [
  {
    id: "mb1",
    author: "Alex",
    role: "human",
    text: "Mă gândesc că targetul nostru sunt agențiile enterprise.",
  },
  {
    id: "mb2",
    author: "Business AI",
    role: "ai",
    text: "Excelent. Pentru agenții, modelul de 'SaaS cu licențiere on-premise' generează cele mai puține frecări. Adăugăm funcții de RBAC în brief?",
  },
]

const initialTechMessages: Message[] = [
  {
    id: "mt1",
    author: "Ionut",
    role: "human",
    text: "Vrem un delay minim pe live-sync. Posibil un Y.js adapter.",
  },
  {
    id: "mt2",
    author: "Tech AI",
    role: "ai",
    text: "Recomand WebSockets pe instanțe edge. Vom folosi un server Hocuspocus lângă baza ta Supabase/PostgreSQL.",
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

function buildFeatures(brief: BriefState): Feature[] {
  return [
    {
      id: "FEAT-01",
      title: "Real-time Collaboration Engine",
      summary: `Infrastructură de sincronizare date pentru ${brief.title.toLowerCase()}.`,
      preview: "Chat orchestration view",
      variations: ["Utilizare Y.js + WebSockets via Hocuspocus", "Polling optimizat via SWR (mai ieftin)", "Liveblocks managed via REST"],
      acceptance: [
        "Cursor prezența vizuală pentru colaboratori",
        "Conflicte rezolvate per-character",
      ],
    },
    {
      id: "FEAT-02",
      title: "Role-Based Audit & Approval",
      summary: `Proces de QA formal derivat din obiectivul arhitectural: ${brief.architecture.substring(0, 30)}...`,
      preview: "Editable documentation canvas",
      variations: ["Sistem hibrid cu AI auto-approve pentru Low-Risk", "Manual strict cu 2+ semnături umane"],
      acceptance: [
        "Jurnale stocate imutabil",
        "Blocare acțiuni critice for unauthorized users",
      ],
    },
    {
      id: "FEAT-03",
      title: "Automated SDLC Generator",
      summary: "Agenti de AI ce traduc scheme de DB + Brief în cod boilerplate Node.js.",
      preview: "Variant comparison board",
      variations: ["Microservices Scaffold in Docker", "Next.js Monolith route generators"],
      acceptance: [
        "Generează Prisma schema automat",
        "O singură execuție creează minim MVP",
      ],
    },
  ]
}

function buildUserStories(feature: Feature, brief: BriefState): UserStory[] {
  const objectiveKey = toSentenceLabel(brief.objective, "Collaborative Flow")
  return [
    {
      id: "US-01",
      title: "Story: Setup Live Sync",
      stack: "Next.js + WebSockets",
      summary: "Ca developer, vreau să leg Hocuspocus pentru a suporta cursor prezența.",
      tradeoff: "Timp de deploy mărit, dar experiența client este flawless.",
      previewTitle: "Live Sync Preview",
      previewDescription: "Sincronizarea multi-player pornește automat la accesarea planșei.",
      code: `export const featureStack = {\n  feat: "${objectiveKey}",\n  adapter: "y-websocket",\n  serverUrl: "wss://engine.luminescent.app",\n}\n`,
    },
    {
      id: "US-02",
      title: "Story: CI/CD Approvals",
      stack: "GitHub Actions + Prisma",
      summary: "Ca product lead, vreau ca orice modificare de schema DB să ceară +1.",
      tradeoff: "Adaugă un gate de 5 minute la pipeline-uri.",
      previewTitle: "Approval Gate",
      previewDescription: "Cererile sunt delegate catre QA agent înainte de merge la origin/main.",
      code: `export const authPipeline = {\n  feat: "${objectiveKey}",\n  rules: [{ enforce: "db-schema", checks: 2 }],\n}\n`,
    },
    {
      id: "US-03",
      title: "Story: Scaffold Generators",
      stack: "AST Builders + LLM",
      summary: "Ca architect, vreau ca endpoint-urile CRUD să fie turn-key.",
      tradeoff: "Mentenanță grea pe engine-urile de AST parsing dar viteză pentru end-user.",
      previewTitle: "Boilerplate Factory",
      previewDescription: "Aplicația injectează rutele Next.js API in runtime pe Vercel Edge.",
      code: `export const generator = {\n  target: "next-app-router",\n  useActions: true,\n  db: "prisma",\n}\n`,
    },
  ].map((variant) => ({
    ...variant,
    summary: `${variant.summary} (Derived from ${feature.title.toLowerCase()}).`,
  }))
}

function buildWorkspaceFiles(brief: BriefState, feature: Feature, userStory: UserStory): WorkspaceFile[] {
  return [
    {
      id: "file-brief",
      name: "project-brief.md",
      content: `# ${brief.title}\n\n## Objective\n${brief.objective}\n\n## Audience\n${brief.audience.map((item) => `- ${item}`).join("\n")}\n\n## Scope\n${brief.scope.map((item) => `- ${item}`).join("\n")}\n`,
    },
    {
      id: "file-feature",
      name: "selected-feature.md",
      content: `# ${feature.id} ${feature.title}\n\n${feature.summary}\n\n## Variations\n${feature.variations.map((item) => `- ${item}`).join("\n")}\n`,
    },
    {
      id: "file-app",
      name: "app-flow.ts",
      content: `${userStory.code}\nexport function generatePreview() {\n  return {\n    title: "${userStory.previewTitle}",\n    status: "ready-for-preview",\n    feature: "${feature.id}",\n  }\n}\n`,
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
  const [activeTab, setActiveTab] = useState<"business" | "tech">("business")
  const [businessMessages, setBusinessMessages] = useState(initialBusinessMessages)
  const [techMessages, setTechMessages] = useState(initialTechMessages)
  const [composer, setComposer] = useState("")
  const [activeSpeakerBusiness, setActiveSpeakerBusiness] = useState<"Alex" | "Mara">("Alex")
  const [activeSpeakerTech, setActiveSpeakerTech] = useState<"Ionut" | "Alex">("Ionut")
  const [activity, setActivity] = useState(initialActivity)
  const [selectedFeatureId, setSelectedFeatureId] = useState("FEAT-01")
  const [selectedStoryId, setSelectedStoryId] = useState("US-01")
  const [selectedFileId, setSelectedFileId] = useState("file-brief")
  const [docTab, setDocTab] = useState<"business" | "tech">("business")
  const [autoSave, setAutoSave] = useState(true)
  const [appGenerated, setAppGenerated] = useState(false)
  const [previewOpened, setPreviewOpened] = useState(false)

  const [terminalHistory, setTerminalHistory] = useState<{type: string, text: string}[]>([
    { type: "system", text: "Luminescent OS v1.2.0 initialized." },
    { type: "system", text: "Type 'help' to see available commands or 'npm run dev'." }
  ])
  const [terminalInput, setTerminalInput] = useState("")

  const handleTerminalSubmit = () => {
    if (!terminalInput.trim()) return;
    const cmd = terminalInput.trim();
    setTerminalHistory(prev => [...prev, { type: "cmd", text: `root@ide:~$ ${cmd}` }]);
    
    setTimeout(() => {
      if (cmd === "npm run dev" || cmd === "npm start") {
        setTerminalHistory(prev => [...prev, { type: "out", text: "v1.2.0 build ready in 140 ms\n\n  ➜  Local:   http://localhost:3000/" }]);
        setAppGenerated(true);
        moveToStage("Preview", "Aplicația a pornit pe localhost.");
      } else if (cmd === "clear") {
        setTerminalHistory([]);
      } else if (cmd === "help") {
        setTerminalHistory(prev => [...prev, { type: "out", text: "Available commands:\n  npm run dev   Start local server and jump to Preview\n  clear         Clear console\n  help          Show this message" }]);
      } else {
        setTerminalHistory(prev => [...prev, { type: "error", text: `bash: ${cmd}: command not found` }]);
      }
    }, 400);
    setTerminalInput("");
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  const features = useMemo(() => buildFeatures(brief), [brief])
  const selectedFeature = features.find((item) => item.id === selectedFeatureId) ?? features[0]
  const userStories = useMemo(() => buildUserStories(selectedFeature, brief), [selectedFeature, brief])
  const selectedStory = userStories.find((item) => item.id === selectedStoryId) ?? userStories[0]
  const generatedFiles = useMemo(() => buildWorkspaceFiles(brief, selectedFeature, selectedStory), [brief, selectedFeature, selectedStory])
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
      author: activeTab === "business" ? activeSpeakerBusiness : activeSpeakerTech,
      role: "human",
      text: trimmed,
    }

    const aiReply: Message = {
      id: `m-${Date.now() + 1}`,
      author: activeTab === "business" ? "Business AI" : "Tech AI",
      role: "ai",
      text: buildAiReply(trimmed),
    }

    if (activeTab === "business") {
      setBusinessMessages((current) => [...current, nextMessage, aiReply])
    } else {
      setTechMessages((current) => [...current, nextMessage, aiReply])
    }
    
    setComposer("")
    addActivity(nextMessage.author, `A trimis un mesaj pe planția de ${activeTab}.`)
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
    addActivity("Documentation approved", "Brief-ul tehnic și de business e gata.")
    moveToStage("Features", "Opțiunile de implementare au fost setate.")
  }

  function openFeature(featureId: string) {
    setSelectedFeatureId(featureId)
    addActivity("Feature selected", `${featureId} pus în prim-plan.`)
  }

  function moveToUserStories() {
    addActivity("Stories generated", "Au fost extrase User Stories din modulele selectate.")
    moveToStage("User Stories", "Agile backlog creat cu succes.")
  }

  function chooseStory(storyId: string) {
    setSelectedStoryId(storyId)
    addActivity("Story locked", `${storyId} va bloca arhitectura selectată.`)
  }

  function approveStory() {
    addActivity("Scaffold ready", `${selectedStory.id} trimisă spre backend engine.`)
    moveToStage("Final Code", "Geneză cod sursă finalizată.")
  }

  function regenerateCode() {
    setSelectedStoryId((current) => current)
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
    setSelectedFeatureId("FEAT-01")
    setSelectedStoryId("US-01")
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
                    <div className="border-b border-border/40 px-4 py-3 flex flex-wrap gap-4 items-center justify-between">
                      <div className="flex gap-1 bg-background/50 p-1 rounded-lg shadow-inner">
                        <Button size="sm" variant={activeTab === "business" ? "default" : "ghost"} onClick={() => setActiveTab("business")} className="h-7 px-3 text-[11px] rounded-md">Business Plan AI</Button>
                        <Button size="sm" variant={activeTab === "tech" ? "default" : "ghost"} onClick={() => setActiveTab("tech")} className="h-7 px-3 text-[11px] rounded-md">Technical AI</Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider mr-1 hidden sm:inline-block">Speaking as:</span>
                        {(activeTab === "business" ? ["Alex", "Mara"] : ["Ionut", "Alex"]).map((speaker) => (
                          <Button
                            key={speaker}
                            size="sm"
                            variant={(activeTab === "business" ? activeSpeakerBusiness : activeSpeakerTech) === speaker ? "secondary" : "outline"}
                            onClick={() => activeTab === "business" ? setActiveSpeakerBusiness(speaker as any) : setActiveSpeakerTech(speaker as any)}
                            className={cn("h-7 rounded px-3 text-[10px]", (activeTab === "business" ? activeSpeakerBusiness : activeSpeakerTech) === speaker ? "bg-primary/20 text-primary border-primary/30" : "")}
                          >
                            {speaker}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="flex-1 space-y-4 overflow-y-auto p-4">
                      {(activeTab === "business" ? businessMessages : techMessages).map((message) => (
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
              <div className="flex-1 overflow-y-auto p-4 md:p-8 flex justify-center bg-background/30">
                <Card className="flex flex-col rounded-[16px] border-border/40 bg-card/70 p-8 md:p-12 w-full max-w-[860px] shadow-sm min-h-full relative">
                  <div className="flex-1 space-y-8">
                    {/* Title */}
                    <div>
                      <label className="mb-2 block text-[10px] font-mono uppercase tracking-[0.2em] text-primary/70">Project Title</label>
                      <Textarea
                        value={brief.title}
                        onChange={(event) => setBrief({ ...brief, title: event.target.value })}
                        rows={1}
                        className="min-h-0 resize-none border-none bg-transparent p-0 text-[32px] sm:text-[40px] font-serif font-bold tracking-tight shadow-none outline-none focus-visible:ring-0 placeholder:text-muted-foreground/30 text-foreground leading-[1.1] rounded-none py-1"
                      />
                    </div>
                    
                    {/* TABS */}
                    <div className="flex gap-2 border-b border-border/20 pb-4">
                      <Button size="sm" variant={docTab === "business" ? "default" : "outline"} onClick={() => setDocTab("business")} className="rounded-full px-5 h-8 text-[12px] transition-all">Business Plan</Button>
                      <Button size="sm" variant={docTab === "tech" ? "default" : "outline"} onClick={() => setDocTab("tech")} className="rounded-full px-5 h-8 text-[12px] transition-all">Technical Architecture</Button>
                    </div>

                    {docTab === "business" && (
                      <div className="space-y-10 animate-in fade-in zoom-in-95 duration-200">
                        {/* Objective */}
                        <div className="rounded-[16px] border border-border/40 bg-card/40 p-5 shadow-sm transition-colors hover:bg-card/60">
                          <label className="mb-3 flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.2em] text-primary/80">
                            <Icon name="target" className="size-3.5" /> Core Objective
                          </label>
                          <Textarea
                            value={brief.objective}
                            onChange={(event) => setBrief({ ...brief, objective: event.target.value })}
                            className="min-h-[100px] border-none bg-transparent p-0 text-[14.5px] leading-[1.8] shadow-none outline-none focus-visible:ring-0 text-foreground/90 resize-none"
                            placeholder="What is the main goal of this product?"
                          />
                        </div>
                        
                        {/* Array Fields */}
                        <div className="grid gap-6 md:grid-cols-2">
                           {(["audience", "scope", "deliverables", "risks"] as const).map((key) => (
                              <div key={key} className="rounded-[16px] border border-border/40 bg-card/30 p-5 shadow-sm transition-colors hover:bg-card/40">
                                <div className="flex items-center justify-between mb-4">
                                  <label className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground/90">{key}</label>
                                  <Button size="sm" variant="ghost" onClick={() => setBrief({ ...brief, [key]: [...brief[key], ""] })} className="h-7 w-7 p-0 rounded-full hover:bg-primary/20 text-primary bg-primary/10">
                                    <Icon name="plus" className="size-3.5" />
                                  </Button>
                                </div>
                                <div className="space-y-2">
                                  {brief[key].map((item, index) => (
                                    <div key={`${key}-${index}`} className="relative group flex items-center">
                                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/30 rounded-l-[4px] group-focus-within:bg-primary transition-colors" />
                                      <Input
                                        value={item}
                                        onChange={(event) => {
                                          const next = [...brief[key]]
                                          next[index] = event.target.value
                                          setBrief({ ...brief, [key]: next })
                                        }}
                                        className="h-9 border-none bg-background/50 pl-3 pr-2 text-[13px] shadow-sm focus-visible:ring-1 focus-visible:ring-primary/20 rounded-r-[6px] rounded-l-none transition-all placeholder:text-muted-foreground/40"
                                        placeholder={`Define ${key}...`}
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {docTab === "tech" && (
                      <div className="space-y-10 animate-in fade-in zoom-in-95 duration-200">
                        {/* Architecture */}
                        <div className="rounded-[16px] border border-border/40 bg-card/40 p-5 shadow-sm transition-colors hover:bg-card/60">
                          <label className="mb-3 flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.2em] text-primary/80">
                             <Icon name="cpu" className="size-3.5" /> System Architecture Abstract
                          </label>
                          <Textarea
                            value={brief.architecture}
                            onChange={(event) => setBrief({ ...brief, architecture: event.target.value })}
                            className="min-h-[60px] border-none bg-transparent p-0 text-[14.5px] leading-[1.8] shadow-none outline-none focus-visible:ring-0 text-foreground/90 resize-none"
                            placeholder="Describe how the components interact..."
                          />
                        </div>
                        
                        {/* Arrays for Stack + DB */}
                        <div className="grid gap-6 md:grid-cols-2">
                           <div className="rounded-[16px] border border-border/40 bg-card/30 p-5 shadow-sm transition-colors hover:bg-card/40">
                              <div className="flex items-center justify-between mb-4">
                                <label className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground/90">Tech Stack</label>
                                <Button size="sm" variant="ghost" onClick={() => setBrief({ ...brief, techStack: [...brief.techStack, ""] })} className="h-7 w-7 p-0 rounded-full hover:bg-primary/20 bg-primary/10 text-primary">
                                  <Icon name="plus" className="size-3.5" />
                                </Button>
                              </div>
                              <div className="space-y-2">
                                {brief.techStack.map((item, index) => (
                                  <div key={`tech-${index}`} className="relative group flex items-center">
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500/30 rounded-l-[4px] group-focus-within:bg-emerald-500 transition-colors" />
                                    <Input
                                      value={item}
                                      onChange={(event) => {
                                        const next = [...brief.techStack]
                                        next[index] = event.target.value
                                        setBrief({ ...brief, techStack: next })
                                      }}
                                      className="h-9 border-none bg-background/50 pl-3 pr-2 text-[13px] shadow-sm font-mono focus-visible:ring-1 focus-visible:ring-emerald-500/20 rounded-r-[6px] rounded-l-none placeholder:text-muted-foreground/40"
                                      placeholder="Add stack component..."
                                    />
                                  </div>
                                ))}
                              </div>
                           </div>
                           
                           <div className="rounded-[16px] border border-border/40 bg-card/30 p-5 shadow-sm flex flex-col transition-colors hover:bg-card/40">
                              <div className="flex items-center justify-between mb-4">
                                <label className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground/90">Database Schema</label>
                              </div>
                              <Textarea
                                value={brief.dbSchema}
                                onChange={(event) => setBrief({ ...brief, dbSchema: event.target.value })}
                                className="flex-1 min-h-[200px] font-mono text-[12.5px] bg-black/40 text-emerald-400/90 border-none rounded-[8px] p-4 shadow-inner resize-none focus-visible:ring-1 focus-visible:ring-emerald-500/30 leading-relaxed scrollbar-thin scrollbar-thumb-emerald-500/20"
                                placeholder="model User { ... }"
                              />
                           </div>
                        </div>

                        {/* Interactive Architecture Map */}
                        <div className="rounded-[16px] border border-border/40 bg-card/30 p-5 shadow-sm space-y-4">
                          <label className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.2em] text-primary/80">
                             <div className="relative flex items-center justify-center size-2">
                               <div className="absolute inset-0 rounded-full bg-primary/40 animate-ping" />
                               <div className="relative size-1.5 rounded-full bg-primary" />
                             </div>
                             Live Architecture Blueprint
                          </label>
                          <div className="w-full h-[400px] md:h-[500px] relative rounded-[12px] border border-border/40 overflow-hidden bg-background/40 shadow-inner isolation-auto">
                            <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
                              <ReactFlow 
                                style={{ width: '100%', height: '100%' }}
                                nodes={initialArchNodes} 
                                edges={initialArchEdges} 
                                fitView
                                fitViewOptions={{ padding: 0.2 }}
                                zoomOnScroll={true}
                                panOnScroll={false}
                                selectionOnDrag={false}
                              >
                                <Background gap={16} size={1} color="rgba(255,255,255,0.05)" />
                                <Controls showInteractive={false} className="fill-foreground bg-card border-border/40" />
                              </ReactFlow>
                            </div>
                          </div>
                          <p className="text-[10px] text-muted-foreground/50 text-center font-medium tracking-wide">INTERACTIVE CANVAS — PAN & ZOOM ENABLED</p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* GENERATE BUTTON */}
                  <div className="mt-12 pt-6 border-t border-border/40 flex justify-end items-center gap-3 shrink-0">
                    <span className="text-[11px] text-muted-foreground font-medium hidden sm:inline-block">Ready to proceed?</span>
                    <Button onClick={approveDocumentation} size="sm" className="h-9 px-5 text-[12px] font-medium bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_2px_10px_rgba(16,185,129,0.2)] rounded-[8px] transition-all gap-2">
                      Generate Features <Icon name="play" className="size-3" />
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
                  <Button size="sm" variant="ghost" onClick={moveToUserStories} className="h-[26px] text-[11px] text-primary hover:bg-primary/10">
                    Generate User Stories
                  </Button>
                }
              />
              <div className="grid flex-1 gap-4 overflow-y-auto p-4 xl:grid-cols-[1.2fr_0.8fr] xl:p-6">
                <div className="grid content-start gap-4 lg:grid-cols-2">
                  {features.map((feature) => {
                    const active = selectedFeature.id === feature.id
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
                        
                        {/* Variations generated by AI */}
                        <div className="space-y-2 border-t border-border/30 pt-4">
                          <span className="text-[10px] font-mono text-primary/70 uppercase">Variations (AI Recommended)</span>
                          {feature.variations.map((criterion) => (
                            <div key={criterion} className="rounded-[10px] bg-background/60 px-3 py-2 text-[12px] text-foreground/85 border-l-[1.5px] border-primary/40">
                              {criterion}
                            </div>
                          ))}
                        </div>
                        <div className="mt-auto flex gap-2 pt-5">
                          <Button onClick={() => openFeature(feature.id)} className="flex-1 text-[12px] h-9">
                            {active ? "Focus Enabled" : "Select Feature"}
                          </Button>
                        </div>
                      </Card>
                    )
                  })}
                </div>

                <Card className="flex flex-col rounded-[16px] border-border/40 bg-card/70 p-5">
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
                      <div className="rounded-[12px] border border-dashed border-border/50 p-4 text-[12px] leading-relaxed text-muted-foreground">
                        Acceptance Criteria base:
                        <ul className="list-disc pl-5 mt-2 space-y-1 text-foreground/80">
                           {selectedFeature.acceptance.map(acc => <li key={acc}>{acc}</li>)}
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div className="mt-auto pt-6">
                    <Button onClick={moveToUserStories} className="w-full">
                      Generează Pipeline Agile (Stories)
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {currentStage === "User Stories" && (
            <div className="flex h-full flex-col">
              <IDEHeader
                title="Agile User Stories Dashboard"
                icon="branch"
                rightNode={
                  <Button size="sm" variant="ghost" onClick={approveStory} className="h-[26px] text-[11px] text-primary hover:bg-primary/10">
                    Open final code
                  </Button>
                }
              />
              <div className="grid flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-3 lg:p-6">
                {userStories.map((story) => {
                  const active = selectedStory.id === story.id
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
                      
                      <div className="rounded-[14px] border border-border/40 bg-background/70 p-4">
                        <div className="mb-1 text-[10px] font-mono uppercase tracking-widest text-primary">{story.previewTitle}</div>
                        <p className="text-[12px] leading-relaxed text-foreground/85">{story.previewDescription}</p>
                      </div>
                      <div className="mt-3 rounded-[14px] border border-dashed border-border/40 bg-background/60 p-4 text-[12px] leading-relaxed text-muted-foreground">
                        <span className="text-primary/70 font-semibold block mb-1 text-[10px] uppercase">Tradeoff Analysis:</span>
                        {story.tradeoff}
                      </div>

                      <div className="mt-auto flex flex-col gap-2 pt-5">
                        <Button onClick={() => chooseStory(story.id)}>
                          {active ? "Scaffold Pinned" : "Select Story Scaffold"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            chooseStory(story.id)
                            moveToStage("Final Code", "Codul final a fost generat din User Story-ul ales.")
                          }}
                        >
                          Generate Code
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
                  {/* File Explorer */}
                  <div className="hidden w-56 shrink-0 border-r border-border/40 bg-background/10 md:block">
                    <div className="px-3 flex items-center h-8 text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground border-b border-border/40">EXPLORER</div>
                    <div className="space-y-0.5 p-2">
                      {workspaceFiles.map((file) => (
                        <button
                          key={file.id}
                          onClick={() => setSelectedFileId(file.id)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-sm border px-2 py-1 text-left text-[12px] transition-all",
                            activeFile.id === file.id ? "border-primary/20 bg-primary/10 text-primary font-medium" : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                          )}
                        >
                          <Icon name="file" className="size-3.5 shrink-0 opacity-80" />
                          <span className="truncate">{file.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Editor Frame */}
                  <div className="relative flex-1 flex flex-col min-w-0 border-r border-border/40">
                    <div className="flex bg-muted/20 border-b border-border/40 overflow-x-auto no-scrollbar">
                      {workspaceFiles.map((file) => (
                        <button
                          key={file.id}
                          onClick={() => setSelectedFileId(file.id)}
                          className={cn(
                            "flex items-center gap-2 px-3 py-1.5 min-w-[120px] max-w-[200px] border-r border-border/40 text-[11px] font-mono transition-colors",
                            activeFile.id === file.id ? "bg-background text-foreground border-t-[2px] border-t-primary" : "text-muted-foreground hover:bg-muted/50 border-t-[2px] border-t-transparent"
                          )}
                        >
                          <Icon name="file" className="size-3 shrink-0" />
                          <span className="truncate">{file.name}</span>
                        </button>
                      ))}
                    </div>
                    
                    <div className="flex-1 relative">
                       <Textarea
                        value={activeFile?.content ?? ""}
                        onChange={(event) =>
                          setWorkspaceFiles((current) =>
                            current.map((file) =>
                              file.id === activeFile?.id ? { ...file, content: event.target.value } : file
                            )
                          )
                        }
                        className="absolute inset-0 h-full w-full resize-none rounded-none border-none bg-transparent p-4 font-mono text-[13px] leading-[1.6] text-foreground/90 shadow-none focus-visible:ring-0"
                        spellCheck={false}
                      />
                    </div>
                    
                    {/* Terminal pane underneath editor */}
                    <div className="h-[200px] shrink-0 bg-secondary flex flex-col text-[11.5px] font-mono shadow-inner border-t border-border/40 z-10 w-full overflow-hidden">
                      <div className="flex h-7 items-center justify-start border-b border-border/40 px-0 bg-secondary/80 gap-1 overflow-x-auto no-scrollbar">
                        <button className="px-3 h-full border-b-[2px] border-b-transparent text-muted-foreground uppercase text-[10px] tracking-widest hover:text-foreground">Problems</button>
                        <button className="px-3 h-full border-b-[2px] border-b-transparent text-muted-foreground uppercase text-[10px] tracking-widest hover:text-foreground">Output</button>
                        <button className="px-3 h-full border-b-[2px] border-b-primary text-foreground font-bold uppercase text-[10px] tracking-widest bg-background/50">Terminal</button>
                      </div>
                      <div className="flex-1 overflow-y-auto p-3 space-y-1 w-full bg-background/20 font-medium">
                        {terminalHistory.map((line, i) => (
                          <div key={i} className={cn("whitespace-pre-wrap leading-relaxed", line.type === 'error' ? 'text-destructive' : line.type === 'cmd' ? 'text-foreground font-bold' : 'text-chart-2/90')}>
                            {line.text}
                          </div>
                        ))}
                        <div className="flex items-center gap-2 mt-1 -ml-0.5">
                          <span className="text-chart-2 font-bold shrink-0">root@ide:~$</span>
                          <input 
                            value={terminalInput}
                            onChange={(e) => setTerminalInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleTerminalSubmit()}
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
                <Card className="flex min-h-[520px] flex-col overflow-hidden rounded-[18px] border-border/40 bg-card/70 flex-1">
                  <div className="flex h-8 items-center gap-2 border-b border-border/40 bg-muted/40 px-3 shrink-0">
                    <div className="flex gap-1.5">
                      <div className="size-2.5 rounded-full bg-destructive/80" />
                      <div className="size-2.5 rounded-full bg-chart-4/80" />
                      <div className="size-2.5 rounded-full bg-chart-2/80" />
                    </div>
                    <div className="mx-4 flex h-5 flex-1 items-center justify-start px-2 gap-2 rounded-[4px] border border-border/40 bg-background/50 font-mono text-[10px] text-muted-foreground">
                       <Icon name="search" className="size-3" />
                       http://localhost:3000
                    </div>
                  </div>
                  
                  <div className="flex-1 bg-white relative w-full h-full">
                     {appGenerated ? (
                       <iframe 
                         src="http://localhost:3000" 
                         className="absolute inset-0 w-full h-full border-none bg-background"
                         title="App Preview"
                         allow="allow-scripts allow-same-origin"
                       />
                     ) : (
                       <div className="h-full w-full flex flex-col items-center justify-center bg-card text-muted-foreground">
                         <Icon name="terminal" className="size-12 opacity-20 mb-4" />
                         <p>Ruleaza `npm run dev` din terminalul 'Final Code' pentru a genera app-ul.</p>
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
          </div>
        </aside>
      </div>
    </div>
  )
}

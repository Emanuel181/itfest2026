"use client"

import { useMemo, useState, useEffect, type ReactNode } from "react"
import { useTheme } from "next-themes"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type ModuleKey = "Ideation" | "Requirements" | "User Stories" | "Planning" | "Implementation" | "Workspace"

type BriefState = {
  title: string
  objective: string
  audience: string[]
  scope: string[]
  deliverables: string[]
  risks: string[]
}

type ActivityEntry = { title: string; detail: string; time: string; state: "active" | "queued" }

type Requirement = {
  id: string
  title: string
  description: string
  status: "draft" | "approved"
  comments: number
  owner: string
}

type UserStory = {
  id: string
  title: string
  persona: string
  need: string
  outcome: string
  priority: "high" | "medium"
}

type PlanningItem = {
  id: string
  phase: string
  title: string
  owner: string
  duration: string
  status: "ready" | "in-progress" | "queued"
  lane: "Backlog" | "This Week" | "In Review"
  location: string
  tasks: string[]
}

type ImplementationOption = {
  id: string
  storyId: string
  title: string
  file: string
  summary: string
  code: string
  status: "recommended" | "alternative"
}

const topLinks = ["Docs", "Architecture", "Activity"]

const collaborators = [
  { name: "Alex", role: "Product lead", initials: "AC", status: "In brief review" },
  { name: "Mara", role: "Design systems", initials: "MR", status: "Refining story wording" },
  { name: "Ionut", role: "Platform eng", initials: "IN", status: "Watching implementations" },
]

const initialBrief: BriefState = {
  title: "Luminescent Co-Work",
  objective: "Design an AI-native delivery workspace where teams work with agents in one shared room.",
  audience: ["Product leads", "Engineers validating tradeoffs", "Cross-functional teams"],
  scope: ["Collaborative brief editing", "Automated tracking", "Implementation review"],
  deliverables: ["Project brief", "Requirements chain", "Execution plan"],
  risks: ["Vague briefs", "Over-trusting agents", "Performance validation"],
}

const starterPrompts = [
  "Sharpen objective",
  "Highlight alignment gaps",
  "Prepare for requirements",
]

const initialConversation = [
  { id: "a-1", role: "assistant" as const, text: "Reframed workspace to read like a living document." },
  { id: "u-1", role: "user" as const, text: "Make it premium and collaborative." },
]

const navOrder: ModuleKey[] = ["Ideation", "Requirements", "User Stories", "Planning", "Implementation", "Workspace"]

function toTitle(source: string, fallback: string) {
  const cleaned = source.trim().replace(/[.:]/g, "")
  if (!cleaned) return fallback
  return cleaned.split(/\s+/).slice(0, 6).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
}

function buildRequirements(brief: BriefState): Requirement[] {
  const seeds = [
    { owner: "Requirements Agent", content: brief.objective, comments: 3 },
    ...brief.scope.map((content) => ({ owner: "Architecture Lead", content, comments: 2 })),
    ...brief.deliverables.map((content) => ({ owner: "Delivery Coach", content, comments: 1 })),
  ]
  return seeds.slice(0, 5).map((seed, index) => ({
    id: `REQ-${String(index + 1).padStart(3, "0")}`,
    title: `${toTitle(seed.content, "Requirement")} Spec`,
    description: `Derived from the project brief: ${seed.content}`,
    status: index === 0 ? "approved" : "draft",
    comments: seed.comments,
    owner: seed.owner,
  }))
}

function buildStories(requirements: Requirement[]): UserStory[] {
  return requirements.slice(0, 4).map((req, index) => ({
    id: `STORY-${101 + index}`,
    title: req.title.replace(/ Spec$/, ""),
    persona: index % 2 === 0 ? "Delivery lead" : "Engineering lead",
    need: `a reliable workflow for ${req.id.toLowerCase()}`,
    outcome: `teams can deliver ${req.title.toLowerCase()} faster`,
    priority: index === 0 ? "high" : "medium",
  }))
}

function buildPlanning(stories: UserStory[]): PlanningItem[] {
  const phases = ["Align", "Shape", "Build", "Validate"]
  return stories.map((story, index) => ({
    id: `PLAN-${String(index + 1).padStart(3, "0")}`,
    phase: phases[index] ?? "Build",
    title: `Execute ${story.title}`,
    owner: index % 2 === 0 ? "Product+Platform" : "App Team",
    duration: index === 0 ? "3d" : "2d",
    status: index === 0 ? "in-progress" : index === 1 ? "ready" : "queued",
    lane: index === 0 ? "This Week" : index === 1 ? "In Review" : "Backlog",
    location: index === 0 ? "Delivery lane" : index === 1 ? "Human gate" : "Story expansion",
    tasks: [`Clarify details for ${story.id}`, `Assign owners`, `Prepare handoff`],
  }))
}

function buildImplementations(stories: UserStory[]): ImplementationOption[] {
  return stories.slice(0, 3).map((story, index) => {
    const normalized = story.title.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")
    return {
      id: `IMP-${String(index + 1).padStart(3, "0")}`,
      storyId: story.id,
      title: story.title,
      file: `${normalized || `module_${index + 1}`}.ts`,
      summary: "Reviewed code direction optimize for readability and execution speed.",
      code: `export async function ${normalized}Flow() {\n  return {\n    story: "${story.id}",\n    status: "ready",\n    owner: "${index % 2 === 0 ? "platform" : "app"}",\n  }\n}`,
      status: index === 0 ? "recommended" : "alternative",
    }
  })
}

function moduleActivity(m: ModuleKey, b: BriefState, r: Requirement[], s: UserStory[], p: PlanningItem[], i: ImplementationOption[]): ActivityEntry[] {
  if (m === "Requirements") return [{ title: "Requirements Agent", detail: `Mapped into ${r.length} specs.`, time: "Just now", state: "active" }, { title: "Arch Review", detail: "Aligned scope.", time: "2m ago", state: "queued" }]
  if (m === "User Stories") return [{ title: "Story Gen", detail: `Coverted ${r.length} reqs to ${s.length} stories.`, time: "Now", state: "active" }, { title: "Review", detail: "Waiting.", time: "Wait", state: "queued" }]
  if (m === "Planning") return [{ title: "Planning Agent", detail: `Sequenced ${p.length} tracks.`, time: "Now", state: "active" }]
  if (m === "Implementation") return [{ title: "Impl Agent", detail: `Prepared ${i.length} code strats.`, time: "Now", state: "active" }]
  return [{ title: "Ideation Agent", detail: "Refreshing brief.", time: "Now", state: "active" }, { title: "Facilitator AI", detail: "Highlighting gaps.", time: "3m", state: "queued" }]
}

function Icon({ name, className }: { name: string; className?: string }) {
  const common = "size-4 stroke-[1.8]"
  switch (name) {
    case "search": return <svg viewBox="0 0 24 24" fill="none" className={cn(common, className)}><circle cx="11" cy="11" r="6" stroke="currentColor" /><path d="m20 20-4.2-4.2" stroke="currentColor" strokeLinecap="round" /></svg>
    case "send": return <svg viewBox="0 0 24 24" fill="none" className={cn(common, className)}><path d="M4 12 20 4l-4 16-3.5-5L4 12Z" stroke="currentColor" strokeLinejoin="round" /><path d="M12.5 15 20 4" stroke="currentColor" strokeLinecap="round" /></svg>
    case "spark": return <svg viewBox="0 0 24 24" fill="none" className={cn(common, className)}><path d="m12 3 1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3Z" stroke="currentColor" strokeLinejoin="round" /></svg>
    case "pulse": return <svg viewBox="0 0 24 24" fill="none" className={cn(common, className)}><path d="M3 12h4l2.5-5 4 10 2.5-5H21" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" /></svg>
    case "branch": return <svg viewBox="0 0 24 24" fill="none" className={cn(common, className)}><circle cx="6" cy="6" r="2.5" stroke="currentColor" /><circle cx="18" cy="6" r="2.5" stroke="currentColor" /><circle cx="18" cy="18" r="2.5" stroke="currentColor" /><path d="M8.5 6H15.5M18 8.5V15.5M8.5 6V18H15.5" stroke="currentColor" strokeLinecap="round" /></svg>
    case "users": return <svg viewBox="0 0 24 24" fill="none" className={cn(common, className)}><path d="M16 19a4 4 0 0 0-8 0" stroke="currentColor" strokeLinecap="round" /><circle cx="12" cy="9" r="3" stroke="currentColor" /><path d="M20 19a3 3 0 0 0-3-3" stroke="currentColor" strokeLinecap="round" /><path d="M17 6.5a2.5 2.5 0 1 1 0 5" stroke="currentColor" strokeLinecap="round" /></svg>
    case "database": return <svg viewBox="0 0 24 24" fill="none" className={cn(common, className)}><ellipse cx="12" cy="5" rx="9" ry="3" stroke="currentColor"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" stroke="currentColor"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" stroke="currentColor"/></svg>
    case "layout": return <svg viewBox="0 0 24 24" fill="none" className={cn(common, className)}><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor"/><path d="M3 9h18M9 21V9" stroke="currentColor"/></svg>
    case "code": return <svg viewBox="0 0 24 24" fill="none" className={cn(common, className)}><polyline points="16 18 22 12 16 6" stroke="currentColor" strokeLinejoin="round" strokeLinecap="round"/><polyline points="8 6 2 12 8 18" stroke="currentColor" strokeLinejoin="round" strokeLinecap="round"/></svg>
    case "file": return <svg viewBox="0 0 24 24" fill="none" className={cn(common, className)}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor"/><polyline points="14 2 14 8 20 8" stroke="currentColor"/></svg>
    case "folder": return <svg viewBox="0 0 24 24" fill="none" className={cn(common, className)}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" stroke="currentColor"/></svg>
    case "terminal": return <svg viewBox="0 0 24 24" fill="none" className={cn(common, className)}><polyline points="4 17 10 11 4 5" stroke="currentColor" strokeLinejoin="round" strokeLinecap="round"/><line x1="12" y1="19" x2="20" y2="19" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/></svg>
    case "external-link": return <svg viewBox="0 0 24 24" fill="none" className={cn(common, className)}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/><polyline points="15 3 21 3 21 9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/><line x1="10" y1="14" x2="21" y2="3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/></svg>
    case "play": return <svg viewBox="0 0 24 24" fill="none" className={cn(common, className)}><polygon points="5 3 19 12 5 21 5 3" stroke="currentColor" strokeLinejoin="round" strokeLinecap="round"/></svg>
    case "sun": return <svg viewBox="0 0 24 24" fill="none" className={cn(common, className)}><circle cx="12" cy="12" r="4" stroke="currentColor"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" stroke="currentColor" strokeLinecap="round"/></svg>
    case "moon": return <svg viewBox="0 0 24 24" fill="none" className={cn(common, className)}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" strokeLinejoin="round" strokeLinecap="round"/></svg>
    default: return null
  }
}

// Reusable custom generic Header
function IDEHeader({ title, icon, rightNode }: { title: string; icon: string; rightNode?: ReactNode }) {
  return (
    <div className="flex h-[42px] items-center justify-between border-b border-white/5 bg-black/10 px-4 shrink-0 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <Icon name={icon} className="size-[15px] opacity-60 text-foreground" />
        <h2 className="text-[11px] font-semibold tracking-[0.1em] text-foreground/80 uppercase">{title}</h2>
      </div>
      {rightNode}
    </div>
  )
}

// Core App Layout
export function IdeationDashboard() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  const [currentModule, setCurrentModule] = useState<ModuleKey>("Ideation")
  const [search, setSearch] = useState("")
  const [brief, setBrief] = useState(initialBrief)
  const [prompt, setPrompt] = useState("")
  const [conversation, setConversation] = useState(initialConversation)

  const [workspaceFiles, setWorkspaceFiles] = useState([
    { id: "f1", name: "project_brief.md", type: "markdown", content: `# Luminescent Co-Work\n\nObjective: Design an AI-native delivery workspace.` },
    { id: "f2", name: "module_auth.ts", type: "typescript", content: `export async function authFlow() {\n  return {\n    status: "ready",\n    owner: "platform",\n  }\n}` },
    { id: "f3", name: "database_schema.ts", type: "typescript", content: `import { db } from './config';\n\nexport const getSpecs = () => db.query('SELECT * FROM specs');` },
  ])
  const [activeFileId, setActiveFileId] = useState("f1")

  const [terminalHistory, setTerminalHistory] = useState<{type: string, text: string}[]>([
    { type: "system", text: "Luminescent OS v1.2.0 initialized." },
    { type: "system", text: "Type 'npm run dev' to start preview or 'help' for commands." }
  ])
  const [terminalInput, setTerminalInput] = useState("")
  const [showPreview, setShowPreview] = useState(false)

  const handleTerminalSubmit = () => {
    if (!terminalInput.trim()) return;
    const cmd = terminalInput.trim();
    setTerminalHistory(prev => [...prev, { type: "cmd", text: `root@ide:~$ ${cmd}` }]);
    
    setTimeout(() => {
      if (cmd === "npm run dev" || cmd === "npm run start") {
        setTerminalHistory(prev => [...prev, { type: "out", text: "v1.2.0 build ready in 1250 ms\n\n  ➜  Local:   http://localhost:3000/\n  ➜  Network: use --host to expose" }]);
        setShowPreview(true);
      } else if (cmd === "clear") {
        setTerminalHistory([]);
      } else if (cmd === "help") {
        setTerminalHistory(prev => [...prev, { type: "out", text: "Available commands:\n  npm run dev   Start local dev server and open preview\n  clear         Clear console\n  help          Show this message" }]);
      } else {
        setTerminalHistory(prev => [...prev, { type: "error", text: `bash: ${cmd}: command not found` }]);
      }
    }, 400);
    setTerminalInput("");
  }

  const requirements = useMemo(() => buildRequirements(brief), [brief])
  const stories = useMemo(() => buildStories(requirements), [requirements])
  const planning = useMemo(() => buildPlanning(stories), [stories])
  const implementations = useMemo(() => buildImplementations(stories), [stories])
  const activity = useMemo(() => moduleActivity(currentModule, brief, requirements, stories, planning, implementations), [currentModule, brief, requirements, stories, planning, implementations])

  const sendPrompt = () => {
    const val = prompt.trim()
    if (!val) return
    setConversation((curr) => [
      ...curr,
      { id: `u-${Date.now()}`, role: "user", text: val },
      { id: `a-${Date.now() + 1}`, role: "assistant", text: "Aligned scope based on your exact refinement." },
    ])
    setPrompt("")
  }

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background text-foreground font-sans text-sm selection:bg-primary/20">
      
      {/* 1. TOP NAVBAR */}
      <header className="flex h-14 w-full shrink-0 items-center justify-between border-b border-border/40 bg-card/80 px-4 backdrop-blur-xl z-50 shadow-sm relative">
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent pointer-events-none" />
        
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2.5">
            <div className="grid size-7 place-items-center rounded-[8px] bg-gradient-to-br from-primary to-primary/80 shadow-[0_2px_10px_rgba(16,185,129,0.25)] border border-primary/20">
              <Icon name="spark" className="text-primary-foreground size-4" />
            </div>
            <span className="font-brand text-[15px] font-semibold tracking-tight text-foreground">
              Luminescent
            </span>
          </div>
          <div className="h-5 w-px bg-border/60 max-sm:hidden" />
          <nav className="hidden items-center gap-4 sm:flex">
            {topLinks.map((l) => (
              <a key={l} href="#" className="text-[13px] font-medium text-muted-foreground/80 transition-colors hover:text-foreground">
                {l}
              </a>
            ))}
          </nav>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative group hidden md:block w-72">
            <Icon name="search" className="absolute left-2.5 top-[9px] size-[14px] text-muted-foreground/60 transition-colors group-focus-within:text-primary" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search assets or commands..."
              className="h-8 w-full rounded-[8px] border-border/40 bg-muted/30 pl-8 text-[12px] font-mono shadow-inner outline-none focus-visible:ring-1 focus-visible:border-primary/50 focus-visible:ring-primary/20 transition-all placeholder:text-muted-foreground/50"
            />
          </div>
          <Badge variant="outline" className="hidden sm:inline-flex rounded-full border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[10px] uppercase font-mono tracking-widest text-primary font-medium">
            v1.2.0 Beta
          </Badge>
          {mounted && (
            <Button
              size="icon"
              variant="outline"
              className="size-8 rounded-[8px] border-border/40 bg-muted/30 hover:bg-muted text-foreground/80 shadow-inner"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} className="size-4" />
            </Button>
          )}
          <Button size="sm" className="h-8 rounded-[8px] bg-primary text-[12px] font-medium text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_1px_3px_rgba(16,185,129,0.2)] hover:bg-primary/95 hover:shadow-[0_2px_8px_rgba(16,185,129,0.3)] transition-all flex items-center gap-2 active:scale-[0.98]">
            Deploy Swarm 
            <Icon name="branch" className="size-3.5 opacity-80" />
          </Button>
        </div>
      </header>

      {/* 2. THREE-PANEL WORKSPACE */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Underlay glow FX */}
        <div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] bg-primary/5 rounded-full blur-[100px] pointer-events-none opacity-30 mix-blend-screen" />
        <div className="absolute top-1/4 right-1/4 w-[40vw] h-[40vw] bg-chart-2/5 rounded-full blur-[100px] pointer-events-none opacity-20 mix-blend-screen" />

        {/* LEFT NAV SIDEBAR (256px) - Standard flex structural item */}
        <aside className="w-64 shrink-0 flex-col border-r border-white/5 bg-background/50 backdrop-blur-xl hidden lg:flex relative z-10">
          <div className="p-4 flex flex-col gap-1 w-full flex-1 overflow-y-auto">
            <div className="flex items-center gap-2 px-2 pb-3 mb-1 border-b border-border/30">
              <Icon name="layout" className="size-4 text-muted-foreground/70" />
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/70">Workflow</span>
            </div>
            
            <div className="space-y-[3px]">
              {navOrder.filter(item => search ? item.toLowerCase().includes(search.toLowerCase()) : true).map((module, i) => {
                const active = currentModule === module;
                return (
                  <button
                    key={module}
                    onClick={() => setCurrentModule(module)}
                    className={cn(
                      "group flex w-full items-center gap-3 rounded-[8px] px-2 py-2 text-left text-[13px] font-medium transition-all duration-200 outline-none",
                      active 
                        ? "bg-primary/10 text-primary shadow-sm ring-1 ring-inset ring-primary/20" 
                        : "text-muted-foreground/80 hover:bg-card hover:text-foreground hover:shadow-sm"
                    )}
                  >
                    <span className={cn(
                      "grid size-[22px] shrink-0 place-items-center rounded-[6px] font-mono text-[9.5px] font-semibold transition-all duration-300",
                      active 
                        ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-[0_1px_5px_rgba(16,185,129,0.3)] border border-primary/20" 
                        : "bg-muted/40 border border-border/50 text-muted-foreground/70 group-hover:bg-muted group-hover:text-foreground"
                    )}>
                      0{i + 1}
                    </span>
                    {module}
                  </button>
                )
              })}
            </div>
          </div>
        </aside>

        {/* MIDDLE CONTENT ARENA (Liquid width) */}
        <main className="flex-1 flex flex-col min-w-0 bg-background dark:bg-black/10 z-10 shadow-inner group relative">
          
          {/* A. IDEATION PANEL */}
          {currentModule === "Ideation" && (
            <div className="flex h-full distribute-x divide-x divide-white/5">
              {/* Left Document Editor */}
              <div className="flex flex-1 flex-col min-w-0">
                <IDEHeader 
                  title="Ideation Editor" 
                  icon="layout" 
                  rightNode={
                    <Button size="sm" variant="ghost" className="h-[26px] text-[11px] hover:bg-primary/10 hover:text-primary transition-colors text-muted-foreground">
                      Auto-Save On
                    </Button>
                  } 
                />
                <div className="no-scrollbar flex-1 overflow-y-auto p-6 md:p-10 lg:p-12 relative w-full h-full">
                  <div className="mx-auto max-w-[700px] flex flex-col gap-6 w-full">
                    {/* Title */}
                        <Textarea
                          value={brief.title}
                          onChange={(e) => setBrief({ ...brief, title: e.target.value })}
                          className="min-h-0 resize-none border-none bg-transparent p-0 text-[32px] sm:text-[40px] font-serif font-semibold tracking-tight shadow-none outline-none focus-visible:ring-0 placeholder:text-muted-foreground/30 text-foreground leading-[1.1] rounded-none py-1"
                          rows={1}
                        />
                     {/* Objective */}
                      <div className="group/field relative">
                        <label className="text-[10px] font-mono tracking-[0.15em] uppercase text-primary mb-2 block font-medium opacity-80">
                          Objective Focus
                        </label>
                        <Textarea
                          value={brief.objective}
                          onChange={(e) => setBrief({ ...brief, objective: e.target.value })}
                          className="min-h-[80px] w-full resize-none rounded-[10px] border border-border/30 bg-card/60 p-4 text-[14px] leading-[1.7] text-foreground/90 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] transition-all duration-300 focus-visible:ring-1 focus-visible:border-primary/40 focus-visible:ring-primary/20 focus-visible:bg-card/90 hover:border-border/60"
                        />
                      </div>
                      
                      {/* Array Lists */}
                      {['audience', 'scope', 'deliverables', 'risks'].map(key => (
                         <div key={key} className="group/field border-l-2 border-border/30 pl-4 py-1 flex flex-col focus-within:border-primary/40 transition-colors ml-1">
                           <div className="mb-2 flex items-center justify-between opacity-80 group-focus-within/field:opacity-100 transition-opacity">
                             <label className="text-[10px] font-mono tracking-[0.15em] uppercase text-muted-foreground font-semibold">
                               {key}
                             </label>
                             <Button size="sm" variant="ghost" className="h-[22px] px-2 text-[10px] bg-muted/40 opacity-0 group-hover/field:opacity-100 hover:bg-primary/10 hover:text-primary transition-all rounded-[6px]" onClick={() => setBrief({...brief, [key]: [...brief[key as keyof BriefState], ""] as any})}>
                               + New Node
                             </Button>
                           </div>
                           <div className="flex flex-col gap-2">
                             {(brief[key as keyof BriefState] as string[]).map((itm, idx) => (
                               <Input
                                 key={idx}
                                 value={itm}
                                 onChange={(e) => {
                                   const n = [...(brief[key as keyof BriefState] as string[])];
                                   n[idx] = e.target.value;
                                   setBrief({...brief, [key]: n} as any)
                                 }}
                                 className="h-8 border-none bg-black/5 dark:bg-white-[0.02] px-3 font-medium text-[13px] text-foreground/80 shadow-none hover:bg-card focus-visible:bg-card focus-visible:ring-1 focus-visible:ring-border/60 rounded-[6px] transition-colors"
                                 placeholder="..."
                               />
                             ))}
                           </div>
                         </div>
                      ))}
                  </div>
                </div>
              </div>
              
              {/* Right Assistant Thread */}
              <div className="hidden w-[320px] 2xl:w-[380px] shrink-0 flex-col bg-card/10 xl:flex">
                <IDEHeader title="Agent Context" icon="spark" />
                <div className="no-scrollbar flex-1 overflow-y-auto p-4 space-y-4">
                  {conversation.map(msg => (
                     <div key={msg.id} className={cn("flex flex-col gap-1 text-[13px] w-full", msg.role === 'user' ? "items-end" : "items-start")}>
                      <span className="text-[9px] font-mono tracking-widest text-muted-foreground/60 uppercase px-1">
                        {msg.role}
                      </span>
                      <div className={cn(
                        "rounded-[16px] px-3.5 py-2.5 max-w-[90%] shadow-sm leading-[1.6] transition-all", 
                        msg.role === 'user' 
                          ? "bg-primary text-primary-foreground font-medium rounded-tr-[4px]" 
                          : "bg-card border border-border/40 text-foreground/90 rounded-tl-[4px]"
                      )}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-3 bg-card/60 border-t border-border/40 backdrop-blur-md">
                   <div className="relative group/input flex items-center">
                      <Input
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendPrompt()}
                        placeholder="Instruct agents..."
                        className="h-9 w-full rounded-full border border-border/50 bg-background/50 pr-10 pl-4 text-[12px] shadow-sm focus-visible:ring-1 focus-visible:border-primary/50 focus-visible:ring-primary/20 transition-all font-medium"
                      />
                      <Button size="icon" onClick={sendPrompt} disabled={!prompt.trim()} className="absolute right-[4px] h-[28px] w-[28px] rounded-full bg-primary/90 text-primary-foreground hover:bg-primary shadow-sm hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100">
                        <Icon name="send" className="size-3" />
                      </Button>
                   </div>
                   
                   <div className="flex flex-wrap gap-1.5 mt-3 px-1">
                     {starterPrompts.map(sp => (
                       <button key={sp} onClick={() => setPrompt(sp)} className="text-[10px] font-medium border border-border/60 bg-card hover:bg-muted text-muted-foreground hover:text-foreground px-2 py-1 rounded-full transition-colors truncate max-w-full">
                         {sp}
                       </button>
                     ))}
                   </div>
                </div>
              </div>
            </div>
          )}

          {/* B. REQUIREMENTS LAYER */}
          {currentModule === "Requirements" && (
            <div className="flex h-full flex-col">
              <IDEHeader title="Requirements Definition Ledger" icon="database" />
              <div className="no-scrollbar flex-1 overflow-y-auto w-full p-4 lg:p-6 bg-black/5 dark:bg-black/20">
                <Card className="w-full flex-1 border-border/40 bg-card rounded-[12px] overflow-hidden shadow-sm">
                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-left text-[13px] border-collapse">
                      <thead className="bg-muted/40 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/80 border-b border-border/50 bg-black/5 dark:bg-white/[0.02]">
                        <tr>
                          <th className="px-5 py-3 font-semibold whitespace-nowrap w-[100px]">Node ID</th>
                          <th className="px-5 py-3 font-semibold whitespace-nowrap w-[240px]">Specification</th>
                          <th className="px-5 py-3 font-semibold w-full">Contextual Trace</th>
                          <th className="px-5 py-3 font-semibold whitespace-nowrap w-[180px]">Lead</th>
                          <th className="px-5 py-3 font-semibold whitespace-nowrap w-[100px]">State</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {requirements.map(req => (
                          <tr key={req.id} className="group transition-colors duration-200 hover:bg-muted/40">
                            <td className="px-5 py-3.5 font-mono text-[11.5px] text-muted-foreground group-hover:text-primary transition-colors whitespace-nowrap">{req.id}</td>
                            <td className="px-5 py-3.5 font-medium text-foreground/90">{req.title}</td>
                            <td className="px-5 py-3.5 text-muted-foreground/80 text-[12.5px] leading-relaxed max-w-[400px] truncate">{req.description}</td>
                            <td className="px-5 py-3.5 text-muted-foreground/80 whitespace-nowrap">{req.owner}</td>
                            <td className="px-5 py-3.5 whitespace-nowrap">
                              <Badge variant="outline" className={cn("px-2 py-0.5 font-mono text-[9px] border-opacity-30 uppercase tracking-widest font-semibold", req.status === 'approved' ? 'border-primary text-primary bg-primary/10' : 'text-muted-foreground border-border/60 bg-muted/20')}>
                                {req.status}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* C. USER STORIES */}
          {currentModule === "User Stories" && (
            <div className="flex h-full flex-col">
              <IDEHeader title="Narrative & Flow Structure" icon="database" />
              <div className="no-scrollbar flex-1 overflow-y-auto p-4 lg:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 2xl:gap-6 bg-black/5 dark:bg-black/20 content-start">
                {stories.map(story => (
                  <Card key={story.id} className="relative flex flex-col p-5 border-border/40 bg-card rounded-[14px] hover:-translate-y-1 hover:shadow-lg hover:border-primary/40 transition-all duration-300 group overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    
                    <div className="relative flex items-center justify-between mb-4">
                      <div className="font-mono text-[10.5px] font-semibold tracking-widest text-primary/80 bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-[4px] uppercase">
                        {story.id}
                      </div>
                      <Badge variant="outline" className={cn("text-[9px] uppercase font-mono tracking-wider border-opacity-30 px-1.5 py-0", story.priority === 'high' ? 'text-chart-1 border-chart-1 bg-chart-1/10' : 'text-muted-foreground')}>
                        {story.priority}
                      </Badge>
                    </div>
                    
                    <h3 className="font-bold text-[14px] leading-[1.4] mb-4 text-foreground/90 group-hover:text-primary transition-colors">
                      {story.title}
                    </h3>
                    
                    <div className="mt-auto space-y-2.5 text-[12px] leading-relaxed text-muted-foreground/80 flex-1 border-t border-border/30 pt-4">
                       <p className="flex items-start gap-2">
                         <span className="text-foreground/60 font-mono text-[10px] tracking-wider uppercase bg-muted/50 px-1.5 rounded-[4px] mt-0.5 shrink-0 w-[60px] text-center">As a</span> 
                         <span className="font-medium text-foreground/90">{story.persona}</span>
                       </p>
                       <p className="flex items-start gap-2">
                         <span className="text-foreground/60 font-mono text-[10px] tracking-wider uppercase bg-muted/50 px-1.5 rounded-[4px] mt-0.5 shrink-0 w-[60px] text-center">I need</span> 
                         <span className="text-foreground/80">{story.need}</span>
                       </p>
                       <p className="flex items-start gap-2">
                         <span className="text-primary/70 font-mono text-[10px] tracking-wider uppercase bg-primary/10 border border-primary/20 px-1.5 rounded-[4px] mt-0.5 shrink-0 w-[60px] text-center">So that</span> 
                         <span className="text-foreground/80">{story.outcome}</span>
                       </p>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* D. PLANNING */}
          {currentModule === "Planning" && (
            <div className="flex h-full flex-col">
              <IDEHeader title="Kanban Execution Board" icon="layout" />
              <div className="no-scrollbar flex-1 overflow-x-auto p-4 lg:p-6 flex gap-4 xl:justify-center align-start bg-black/5 dark:bg-black/20">
                 {["Backlog", "This Week", "In Review"].map(lane => (
                   <Card key={lane} className="flex min-w-[300px] w-[340px] shrink-0 flex-col rounded-[14px] border-border/40 bg-card/60 overflow-hidden shadow-sm h-fit max-h-full">
                     <div className="bg-black/5 dark:bg-white/[0.04] px-4 py-3 border-b border-border/40 flex justify-between items-center shrink-0">
                       <h4 className="text-[12.5px] font-bold uppercase tracking-widest text-foreground/80">{lane}</h4>
                       <span className="text-[10px] bg-background border border-border/60 text-muted-foreground px-2 py-0.5 rounded-full font-mono font-bold">{planning.filter(p => p.lane === lane).length}</span>
                     </div>
                     <div className="p-3 bg-muted/10 space-y-3 overflow-y-auto no-scrollbar flex-1">
                       {planning.filter(p => p.lane === lane).map(item => (
                         <div key={item.id} className="rounded-[10px] border border-border/50 bg-card p-3.5 shadow-sm hover:border-primary/50 hover:shadow-md transition-all group cursor-pointer">
                           <div className="flex justify-between items-start mb-2.5">
                             <div className="flex text-[10px] font-mono font-semibold tracking-wider text-muted-foreground/80 uppercase">
                               <span className="text-primary/70 mr-1">{item.id}</span> • <span className="ml-1">{item.phase}</span>
                             </div>
                             <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 uppercase tracking-wider font-semibold", item.status === 'in-progress' ? 'bg-primary/10 text-primary border-primary/30' : 'text-muted-foreground')}>
                               {item.status.replace('-', ' ')}
                             </Badge>
                           </div>
                           <h4 className="text-[13.5px] font-semibold leading-snug mb-3 text-foreground/90 group-hover:text-primary transition-colors">{item.title}</h4>
                           <div className="flex items-center justify-between text-[11px] text-muted-foreground/80 pt-2.5 border-t border-border/30">
                             <div className="flex items-center gap-1.5 truncate">
                               <div className="size-4 rounded-full bg-primary/20 shrink-0" />
                               <span className="truncate max-w-[120px] font-medium">{item.owner}</span>
                             </div>
                             <span className="font-mono bg-muted/60 border border-border/50 px-1.5 py-0.5 rounded-[4px] shrink-0 font-semibold text-[10px] text-foreground/70">{item.duration}</span>
                           </div>
                         </div>
                       ))}
                     </div>
                   </Card>
                 ))}
              </div>
            </div>
          )}

          {/* E. IMPLEMENTATION */}
          {currentModule === "Implementation" && (
            <div className="flex h-full flex-col lg:flex-row">
              <div className="flex-1 flex flex-col min-w-0 bg-black/5 dark:bg-black/20">
                <IDEHeader title="Target Flow Files" icon="code" />
                <div className="no-scrollbar flex-1 p-4 lg:p-6 grid gap-4 lg:gap-6 overflow-y-auto content-start max-w-5xl">
                  {implementations.map(imp => (
                    <Card key={imp.id} className="p-0 border-border/50 rounded-[12px] group hover:border-primary/40 focus-within:border-primary/60 transition-all shadow-sm overflow-hidden flex flex-col">
                      <div className="p-3 px-4 border-b border-border/30 bg-muted/20 flex flex-wrap gap-2 justify-between items-center transition-colors">
                         <div className="flex items-center gap-2">
                           <Icon name="code" className="size-[14px] text-muted-foreground/70" />
                           <span className="text-[12.5px] font-mono font-semibold text-foreground tracking-tight">{imp.file}</span>
                         </div>
                         <div className="flex items-center gap-2">
                           <span className="text-[10px] font-mono text-muted-foreground uppercase hidden sm:inline-block border-r border-border/60 pr-2 mr-1 tracking-widest">{imp.storyId}</span>
                           <Badge variant="outline" className={cn("text-[9px] uppercase font-mono px-2 py-0.5 tracking-widest font-bold border-opacity-30", imp.status === 'recommended' ? 'bg-primary/10 text-primary border-primary' : 'bg-muted/40 text-muted-foreground')}>
                             {imp.status === 'recommended' ? 'AI Recommended' : 'Option B'}
                           </Badge>
                         </div>
                      </div>
                      <div className="p-4 md:p-5 bg-card text-[12px] md:text-[13px] font-mono text-foreground/80 overflow-x-auto whitespace-pre leading-relaxed font-medium">
                        <span className="text-muted-foreground/50">{`// ` + imp.summary}</span>
                        <div className="mt-2 text-foreground/90 pl-1 border-l-2 border-primary/20 bg-muted/10">
                          {imp.code}
                        </div>
                      </div>
                      <div className="px-4 py-3 bg-muted/10 border-t border-border/30 flex justify-end gap-2">
                        <Button variant="outline" size="sm" className="h-7 text-[11px] font-semibold border-border/60">Regenerate</Button>
                        <Button size="sm" className={cn("h-7 text-[11px] font-semibold shadow-none border", imp.status === 'recommended' ? 'bg-primary text-primary-foreground hover:bg-primary/90 border-transparent' : 'bg-card text-foreground hover:bg-muted border-border/60')}>
                          Approve PR
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* F. WORKSPACE EDITOR */}
          {currentModule === "Workspace" && (
            <div className="flex h-full distribute-x divide-x divide-border/50">
              {/* Folders */}
              <div className="w-56 shrink-0 flex-col bg-background/5 flex z-10">
                <IDEHeader title="Project Files" icon="folder" />
                <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                  {workspaceFiles.map(file => (
                    <button 
                      key={file.id} 
                      onClick={() => setActiveFileId(file.id)}
                      className={cn(
                        "flex items-center gap-2 w-full px-2 py-1.5 text-left rounded-md transition-all text-[12.5px]",
                        activeFileId === file.id ? "bg-primary/10 text-primary font-medium border border-primary/20 shadow-sm" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent"
                      )}
                    >
                      <Icon name="file" className="size-3.5 opacity-80 shrink-0" />
                      <span className="truncate">{file.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Code & Terminal */}
              <div className="flex-1 flex flex-col min-w-0 bg-black/5 dark:bg-black/20 overflow-hidden">
                <IDEHeader title={workspaceFiles.find(f => f.id === activeFileId)?.name || "Editor"} icon="code" rightNode={
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setShowPreview(!showPreview)} className="h-[22px] px-2 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors border border-transparent shadow-none flex items-center gap-1">
                      <Icon name="play" className="size-3" />
                      {showPreview ? "Close Preview" : "Run Preview"}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-[22px] text-[10px] text-primary bg-primary/10 hover:bg-primary/20 hover:text-primary transition-colors border border-primary/20 shadow-sm">
                      Commit
                    </Button>
                  </div>
                } />
                <div className="flex-1 relative border-b border-border/50">
                  <Textarea 
                    value={workspaceFiles.find(f => f.id === activeFileId)?.content || ""}
                    onChange={(e) => {
                      const newContent = e.target.value;
                      setWorkspaceFiles(files => files.map(f => f.id === activeFileId ? { ...f, content: newContent } : f))
                    }}
                    className="absolute inset-0 resize-none border-none bg-transparent p-4 font-mono text-[13.5px] leading-[1.7] text-foreground/90 shadow-none focus-visible:ring-0 rounded-none w-full h-full placeholder:text-muted-foreground/30 selection:bg-primary/20"
                    spellCheck={false}
                  />
                </div>
                
                {/* Terminal Pane */}
                <div className="h-48 shrink-0 bg-secondary flex flex-col text-[11.5px] font-mono shadow-inner overflow-hidden border-t border-border z-10">
                  <div className="flex h-7 items-center justify-between border-b border-border/40 px-3 bg-secondary/80">
                    <div className="flex items-center gap-2">
                      <Icon name="terminal" className="size-3 text-muted-foreground" />
                      <span className="text-[10px] tracking-widest text-muted-foreground/80 uppercase">Terminal</span>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-1">
                    {terminalHistory.map((line, i) => (
                      <div key={i} className={cn("whitespace-pre-wrap leading-relaxed", line.type === 'error' ? 'text-destructive' : line.type === 'cmd' ? 'text-foreground font-bold' : 'text-chart-2/90')}>
                        {line.text}
                      </div>
                    ))}
                    <div className="flex items-center gap-2 mt-1 -ml-0.5">
                      <span className="text-chart-2 font-bold">root@ide:~$</span>
                      <input 
                        value={terminalInput}
                        onChange={(e) => setTerminalInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleTerminalSubmit()}
                        autoFocus
                        className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground/60 focus:ring-0 shadow-none border-none appearance-none"
                        spellCheck={false}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Preview Window (Right Split) */}
              {showPreview && (
                <div className="w-[450px] 2xl:w-[500px] shrink-0 flex flex-col bg-card/60 border-l border-border/50">
                  <IDEHeader title="Live Preview" icon="layout" rightNode={
                    <Button size="sm" variant="ghost" onClick={() => window.open('about:blank', '_blank')} className="h-[22px] px-2 text-[10px] text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors flex items-center gap-1.5 rounded-[4px] border-border/30 border">
                      <Icon name="external-link" className="size-[10px]" />
                      New Tab
                    </Button>
                  } />
                  <div className="flex-1 p-2 bg-transparent flex flex-col">
                    {/* Simulated Browser UI */}
                    <div className="flex-1 bg-background rounded-md shadow-sm border border-border/60 overflow-hidden flex flex-col relative">
                      <div className="h-8 bg-muted/40 border-b border-border/40 flex items-center gap-2 px-3">
                        <div className="flex gap-1.5">
                          <div className="size-2.5 rounded-full bg-destructive/80" />
                          <div className="size-2.5 rounded-full bg-chart-4/80" />
                          <div className="size-2.5 rounded-full bg-chart-2/80" />
                        </div>
                        <div className="flex-1 mx-4 bg-background/50 border border-border/40 rounded-sm h-5 text-center flex items-center justify-center text-[10px] text-muted-foreground font-mono">
                          localhost:3000
                        </div>
                      </div>
                      <div className="flex-1 p-6 overflow-y-auto">
                        {/* Dummy logic based on file preview */}
                        {workspaceFiles.find(f => f.id === activeFileId)?.name.endsWith('.md') ? (
                          <div className="space-y-4 font-sans text-foreground/80">
                            <h1 className="text-xl font-serif font-bold mb-4">{brief.title}</h1>
                            <p>{brief.objective}</p>
                            <div className="mt-8 p-4 border border-dashed border-border text-center rounded text-muted-foreground text-xs font-mono">
                              Markdown rendered successfully
                            </div>
                          </div>
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-center text-foreground font-sans">
                            <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-lg text-primary mb-4">
                              <Icon name="spark" className="size-8" />
                            </div>
                            <h2 className="text-lg font-serif font-bold">Component Mounted</h2>
                            <p className="text-muted-foreground/80 text-[13px] mt-2 max-w-[200px]">Hot reloading is perfectly functioning on Node v20.x.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        {/* RIGHT SIDEBAR PANEL (288px) - Clean structural Flex layout */}
        <aside className="w-72 shrink-0 flex-col border-l border-white/5 bg-background/50 backdrop-blur-xl hidden 2xl:flex relative z-10">
          <div className="flex h-[42px] shrink-0 items-center justify-between border-b border-border/30 bg-black/10 px-4">
             <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/70">Team & Trace</span>
             <Icon name="users" className="size-4 text-muted-foreground/70" />
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-8">
            
            {/* Team */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-mono text-muted-foreground/80 uppercase tracking-widest font-semibold flex items-center gap-2">
                <div className="size-1.5 rounded-full bg-chart-2 shadow-sm" />
                Active Peers
              </h4>
              <div className="space-y-3.5">
                {collaborators.map(c => (
                  <div key={c.name} className="flex items-start gap-3 p-1.5 rounded-[8px] hover:bg-muted/40 transition-colors border border-transparent hover:border-border/30 group">
                    <div className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary/10 to-primary/5 text-[11px] font-bold text-primary border border-primary/20 shadow-sm group-hover:scale-105 transition-transform">
                      {c.initials}
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-[12.5px] font-semibold leading-none mb-1.5 text-foreground/90 flex items-center gap-2">
                        {c.name}
                        <span className="text-[9px] font-mono uppercase bg-muted/60 text-muted-foreground px-1 py-0.5 rounded-[4px]">{c.role.split(' ')[0]}</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground/80 truncate font-medium">{c.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator className="bg-border/30" />
            
            {/* Activity Log */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-mono text-muted-foreground/80 uppercase tracking-widest font-semibold flex items-center gap-2">
                 <Icon name="pulse" className="size-3 text-primary/80" />
                 Auto-Logs
              </h4>
              <div className="space-y-0 pb-4">
                {activity.map((act, i) => (
                  <div key={i} className="relative pl-5 pb-5 last:pb-0 hover:opacity-100 opacity-80 transition-opacity cursor-default">
                    {/* Timeline Node */}
                    <div className={cn(
                      "absolute left-0 top-1.5 size-2 rounded-full ring-4 ring-background z-10 shadow-sm transition-all duration-300", 
                      act.state === 'active' ? "bg-primary shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-muted-foreground/40"
                    )} />
                    {/* Timeline Line */}
                    <div className="absolute left-[3px] top-3 bottom-[-10px] w-px bg-gradient-to-b from-border/70 to-border/20 -z-0 last:hidden" />
                    
                    <div className="space-y-1 mt-[-2px]">
                       <div className="flex justify-between items-baseline gap-2">
                         <span className={cn("text-[12.5px] font-semibold tracking-tight", act.state === 'active' ? 'text-primary' : 'text-foreground/90')}>{act.title}</span>
                         <span className="text-[9.5px] text-muted-foreground/60 font-mono shrink-0 uppercase tracking-wider">{act.time}</span>
                       </div>
                       <p className="text-[11.5px] text-muted-foreground/80 leading-snug">{act.detail}</p>
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

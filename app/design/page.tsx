"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from "@/components/ui/drawer"
import { SDLCSidebar } from "@/components/sdlc-sidebar"
import { callAgentStream } from "@/lib/agents/client"
import { createDemoPokerSessions, createDemoStoryAssignees, DEMO_BACKLOG_STORIES, DEMO_REQUIREMENTS } from "@/lib/demo/mock-sdlc"

import type { UserStory } from "@/lib/agents/types"

// ---------------------------------------------------------------------------
// Planning Poker types & constants
// ---------------------------------------------------------------------------
type PokerAgentRole = "frontend_dev" | "backend_dev" | "tech_lead"
type PokerAgent = {
  role: PokerAgentRole
  label: string
  color: string
  icon: string
  apiRole: string
  estimate: number | null
  reasoning: string
  revealed: boolean
}
type PokerLog = { agent: string; color: string; text: string; timestamp: string }
type PokerSession = {
  storyId: string
  phase: "idle" | "estimating" | "revealing" | "debating" | "done"
  agents: PokerAgent[]
  logs: PokerLog[]
  consensusEstimate: number | null
  pokerContext: string
}

const POKER_AGENTS: Omit<PokerAgent, "estimate" | "reasoning" | "revealed">[] = [
  { role: "frontend_dev", label: "Frontend Agent", color: "#6ffbbe", icon: "web", apiRole: "Frontend Agent" },
  { role: "backend_dev", label: "Backend Agent", color: "#4ae176", icon: "dns", apiRole: "Backend Agent" },
  { role: "tech_lead", label: "Tech Lead Agent", color: "#4edea3", icon: "stars", apiRole: "Tech Lead Agent" },
]
const POKER_NUMBERS = [1, 2, 3, 5, 8, 13, 20, 40, 100] as const

function makePokerSession(storyId: string): PokerSession {
  return {
    storyId, phase: "idle", consensusEstimate: null, pokerContext: "", logs: [],
    agents: POKER_AGENTS.map((a) => ({ ...a, estimate: null, reasoning: "", revealed: false })),
  }
}

function snapToPoker(n: number): number {
  const nums = [...POKER_NUMBERS]
  return nums.reduce((prev, curr) => (Math.abs(curr - n) < Math.abs(prev - n) ? curr : prev))
}

function medianOf(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? sorted[mid - 1] : sorted[mid]
}

// ---------------------------------------------------------------------------
// PokerCard component
// ---------------------------------------------------------------------------
function PokerCard({ value, revealed, color, animationDelay = 0 }: {
  value: number | null
  revealed: boolean
  color: string
  animationDelay?: number
}) {
  return (
    <div style={{ perspective: "600px" }}>
      <div
        className={cn(
          "w-12 h-16 rounded-lg border-2 flex items-center justify-center font-bold font-mono text-xl select-none transition-all duration-500",
          revealed ? "scale-100" : "scale-95"
        )}
        style={{
          animationDelay: revealed ? `${animationDelay}ms` : undefined,
          borderColor: revealed ? color : "var(--border)",
          background: revealed ? `${color}15` : "var(--card)",
          color: revealed ? color : "var(--muted-foreground)",
          transform: revealed ? "rotateY(0deg)" : "rotateY(180deg)",
          transformStyle: "preserve-3d",
        }}
      >
        {revealed && value !== null ? (
          value
        ) : (
          <span className="material-symbols-outlined text-muted-foreground/30" style={{ fontSize: 16 }}>casino</span>
        )}
      </div>
    </div>
  )
}

type Requirement = {
  id: string
  title: string
  detail: string
  kind: string
  priority: string
}

// ---------------------------------------------------------------------------
// Main Design Page
// ---------------------------------------------------------------------------
export default function DesignPage() {
  const router = useRouter()

  const [requirements, setRequirements] = useState<Requirement[]>([])
  const [stories, setStories] = useState<UserStory[]>([])
  const [isGeneratingBacklog, setIsGeneratingBacklog] = useState(false)
  const [backlogStream, setBacklogStream] = useState("")
  const [pokerSessions, setPokerSessions] = useState<Record<string, PokerSession>>({})
  const pokerSessionsRef = useRef<Record<string, PokerSession>>({})
  useEffect(() => { pokerSessionsRef.current = pokerSessions }, [pokerSessions])
  const [storyAssignees, setStoryAssignees] = useState<Record<string, string>>({})
  const [runningStories, setRunningStories] = useState<Record<string, boolean>>({})
  const [drawerStoryId, setDrawerStoryId] = useState<string | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)

  const allDonePoker = stories.length > 0 && stories.every((s) => pokerSessions[s.id]?.phase === "done")
  const anyPokerActive = stories.some((s) => {
    const ph = pokerSessions[s.id]?.phase
    return ph === "estimating" || ph === "revealing" || ph === "debating"
  })
  const totalPoints = stories.reduce((acc, s) => acc + (pokerSessions[s.id]?.consensusEstimate ?? 0), 0)

  // Load from localStorage
  useEffect(() => {
    setIsHydrated(true)
    try {
      const raw = localStorage.getItem("itfest_state")
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.requirements) setRequirements(parsed.requirements)
        if (parsed.stories) setStories(parsed.stories)
      }
    } catch { /* ignore */ }
    try {
      const raw = localStorage.getItem("itfest_poker")
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.pokerSessions) setPokerSessions(parsed.pokerSessions)
        if (parsed.storyAssignees) setStoryAssignees(parsed.storyAssignees)
      }
    } catch { /* ignore */ }
  }, [])

  // Persist stories
  useEffect(() => {
    if (!isHydrated) return
    try {
      const existing = JSON.parse(localStorage.getItem("itfest_state") || "{}")
      localStorage.setItem("itfest_state", JSON.stringify({ ...existing, stories }))
    } catch { /* quota */ }
  }, [stories, isHydrated])

  // Persist poker
  useEffect(() => {
    if (!isHydrated) return
    try {
      localStorage.setItem("itfest_poker", JSON.stringify({ pokerSessions, storyAssignees }))
    } catch { /* quota */ }
  }, [pokerSessions, storyAssignees, isHydrated])

  // Generate Backlog
  async function generateBacklog() {
    setIsGeneratingBacklog(true)
    setBacklogStream("")
    setStories([])

    try {
      const res = await fetch("/api/generate-stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirements }),
      })
      if (!res.ok || !res.body) throw new Error(await res.text())

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ""
      let buf = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split("\n")
        buf = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const json = JSON.parse(line.slice(6))
            if (json.error) throw new Error(json.error)
            if (json.delta) {
              full += json.delta
              setBacklogStream((p) => p + json.delta)
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue
            throw e
          }
        }
      }

      const jsonMatch = full.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]) as UserStory[]
          const normalized = parsed.map((s, i) => ({
            ...s,
            id: s.id || `STORY-${String(i + 1).padStart(3, "0")}`,
            title: s.title || `Story ${i + 1}`,
            description: s.description || (s as unknown as Record<string, string>).summary || "",
            status: s.status || "pending" as const,
            variants: [],
            chosenVariant: undefined,
          }))
          setStories(normalized)
        } catch { /* parse error */ }
      }
    } catch (err) {
      setBacklogStream(`Error: ${err}`)
    } finally {
      setIsGeneratingBacklog(false)
    }
  }

  function applyMockBacklog() {
    const demoSessions = createDemoPokerSessions()
    const demoAssignees = createDemoStoryAssignees()

    setIsGeneratingBacklog(false)
    setBacklogStream("")
    setRequirements(DEMO_REQUIREMENTS)
    setStories(DEMO_BACKLOG_STORIES)
    setPokerSessions(demoSessions)
    setStoryAssignees(demoAssignees)
    setRunningStories({})

    try {
      const existing = JSON.parse(localStorage.getItem("itfest_state") || "{}")
      localStorage.setItem(
        "itfest_state",
        JSON.stringify({
          ...existing,
          requirements: DEMO_REQUIREMENTS,
          stories: DEMO_BACKLOG_STORIES,
        })
      )
      localStorage.setItem(
        "itfest_poker",
        JSON.stringify({
          pokerSessions: demoSessions,
          storyAssignees: demoAssignees,
        })
      )
    } catch {
      // ignore demo persistence issues
    }
  }

  // Planning Poker session
  const runPokerSession = useCallback(async (storyId: string) => {
    const existing = pokerSessionsRef.current[storyId]
    if (existing && (existing.phase === "estimating" || existing.phase === "revealing" || existing.phase === "debating")) return

    const storyObj = stories.find((s) => s.id === storyId)
    if (!storyObj) return

    const base = { storyId, storyTitle: storyObj.title, storyDescription: storyObj.description }

    setPokerSessions((p) => ({ ...p, [storyId]: { ...makePokerSession(storyId), phase: "estimating" } }))
    setRunningStories((p) => ({ ...p, [storyId]: true }))

    // Phase 1: all agents estimate in parallel
    const estimateResults = await Promise.all(
      POKER_AGENTS.map(async (agentDef) => {
        let fullText = ""
        try {
          fullText = await callAgentStream(
            { ...base, role: "poker_estimate", context: agentDef.apiRole },
            () => {}
          )
        } catch { fullText = "Card: 5\nReasoning: Estimate unavailable." }
        const cardMatch = fullText.match(/Card:\s*(\d+)/i)
        const reasoningMatch = fullText.match(/Reasoning:\s*(.+)/i)
        const estimate = snapToPoker(cardMatch ? parseInt(cardMatch[1], 10) : 5)
        const reasoning = reasoningMatch ? reasoningMatch[1].trim() : ""
        return { role: agentDef.role, estimate, reasoning }
      })
    )

    // Store estimates, move to revealing
    setPokerSessions((p) => ({
      ...p,
      [storyId]: {
        ...p[storyId],
        phase: "revealing",
        agents: p[storyId].agents.map((a) => {
          const res = estimateResults.find((r) => r.role === a.role)
          return res ? { ...a, estimate: res.estimate, reasoning: res.reasoning, revealed: false } : a
        }),
      },
    }))

    // Phase 2: reveal cards one-by-one
    for (let i = 0; i < POKER_AGENTS.length; i++) {
      await new Promise<void>((res) => setTimeout(res, 600))
      const role = POKER_AGENTS[i].role
      setPokerSessions((p) => ({
        ...p,
        [storyId]: { ...p[storyId], agents: p[storyId].agents.map((a) => (a.role === role ? { ...a, revealed: true } : a)) },
      }))
    }

    // Build snapAgents
    const snapAgents: PokerAgent[] = POKER_AGENTS.map((agentDef) => {
      const res = estimateResults.find((r) => r.role === agentDef.role)
      return { ...agentDef, estimate: res?.estimate ?? 5, reasoning: res?.reasoning ?? "", revealed: true }
    })
    const estimates = snapAgents.map((a) => a.estimate ?? 5)
    const estimatesSummary = snapAgents.map((a) => `${a.label} estimated: ${a.estimate} pts. Reasoning: ${a.reasoning}`).join("\n")

    const finalize = (consensus: number, pokerContext: string) => {
      const topAgent = snapAgents.reduce((a, b) => (b.estimate ?? 0) > (a.estimate ?? 0) ? b : a)
      setStoryAssignees((p) => ({ ...p, [storyId]: topAgent.label }))
      setPokerSessions((p) => ({ ...p, [storyId]: { ...p[storyId], phase: "done", consensusEstimate: consensus, pokerContext } }))
      setRunningStories((p) => ({ ...p, [storyId]: false }))
    }

    // Phase 3: debate
    setPokerSessions((p) => ({ ...p, [storyId]: { ...p[storyId], phase: "debating" } }))

    const debateResponses: string[] = []
    let cumulativeContext = `Initial estimates:\n${estimatesSummary}\n\nDebate so far:`

    for (const agentDef of POKER_AGENTS) {
      const agent = snapAgents.find((a) => a.role === agentDef.role)!
      setPokerSessions((p) => ({
        ...p,
        [storyId]: {
          ...p[storyId],
          logs: [...p[storyId].logs, { agent: agent.label, color: agent.color, text: "", timestamp: new Date().toLocaleTimeString() }],
        },
      }))

      let debateText = ""
      try {
        debateText = await callAgentStream(
          { ...base, role: "poker_debate", context: cumulativeContext, variantId: agentDef.apiRole },
          (delta) => {
            setPokerSessions((p) => {
              const sess = p[storyId]
              if (!sess) return p
              const logs = [...sess.logs]
              logs[logs.length - 1] = { ...logs[logs.length - 1], text: logs[logs.length - 1].text + delta }
              return { ...p, [storyId]: { ...sess, logs } }
            })
          }
        )
      } catch { debateText = "My estimate: 5\nArgument: Unable to respond.\nConsensus proposal: none yet" }

      debateResponses.push(debateText)
      cumulativeContext += `\n\n${agent.label}: ${debateText}`
      await new Promise<void>((res) => setTimeout(res, 300))
    }

    const proposals = debateResponses.map((text) => {
      const m = text.match(/Consensus proposal:\s*(\d+)/i)
      return m ? snapToPoker(parseInt(m[1], 10)) : null
    }).filter((v): v is number => v !== null)

    const consensus = proposals.length > 0 ? medianOf(proposals) : medianOf(estimates)
    const debateTranscript = snapAgents.map((a, i) => `${a.label}:\n${debateResponses[i] ?? ""}`).join("\n\n---\n\n")

    finalize(consensus, [
      `Planning Poker Result: Consensus = ${consensus} pts`,
      `\nInitial Estimates:\n${estimatesSummary}`,
      `\nDebate:\n${debateTranscript}`,
    ].join("\n"))
  }, [stories])

  if (!isHydrated) {
    return <div className="flex h-screen items-center justify-center bg-background"><div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
  }

  const drawerSession = drawerStoryId ? pokerSessions[drawerStoryId] : null
  const drawerStory = drawerStoryId ? stories.find((s) => s.id === drawerStoryId) : null

  return (
    <div className="flex h-screen bg-background text-foreground">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" />

      {/* Sidebar */}
      <aside className="hidden w-[264px] shrink-0 border-r border-border/20 bg-sidebar lg:flex lg:flex-col">
        <div className="flex items-center gap-2.5 border-b border-border/20 px-5 py-3">
          <div className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/70">
            <span className="material-symbols-outlined text-primary-foreground" style={{ fontSize: 14 }}>code</span>
          </div>
          <span className="font-brand text-sm font-bold tracking-tight text-foreground">AgenticSDLC</span>
        </div>
        <SDLCSidebar />
      </aside>

      <main className="flex flex-1 flex-col min-h-0">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-border/20 px-6 py-3 shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-lg font-bold text-foreground">Design</h1>
            <span className="rounded-md bg-orange-500/10 px-2 py-0.5 text-[10px] font-bold text-orange-500">PHASE 3</span>
            {stories.length > 0 && (
              <span className="font-mono text-[10px] text-muted-foreground/50">{stories.length} stories · {totalPoints} pts</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <a href="/analysis" className="flex items-center gap-1 rounded-lg border border-border/30 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_back</span>
              Analysis
            </a>
            <button
              onClick={applyMockBacklog}
              className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>auto_fix_high</span>
              Mock Backlog
            </button>
            {allDonePoker && (
              <button
                onClick={() => router.push(`/implementation?story=${encodeURIComponent(stories[0]?.id ?? "")}&autorun=1`)}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>play_arrow</span>
                Implement Backlog
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_forward</span>
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-4xl px-6 py-6 space-y-6">

            {/* Generate Backlog */}
            {stories.length === 0 && !isGeneratingBacklog && requirements.length > 0 && (
              <button
                onClick={generateBacklog}
                className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl text-xs font-bold uppercase tracking-wider border border-primary/25 bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>auto_awesome</span>
                Generate Product Backlog from Requirements
              </button>
            )}

            {/* Streaming output */}
            {isGeneratingBacklog && (
              <div className="rounded-xl border border-primary/20 bg-card/30 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="size-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span className="text-xs font-bold text-primary uppercase tracking-wider">Generating backlog...</span>
                </div>
                <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {backlogStream || "Analyzing requirements..."}
                </pre>
              </div>
            )}

            {/* Estimate All Stories Button */}
            {stories.length > 0 && !allDonePoker && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-foreground">Planning Poker</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {anyPokerActive
                        ? "Agents are estimating stories..."
                        : "3 AI agents (Tech Lead, Frontend, Backend) will estimate each story, debate, and reach consensus"
                      }
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      stories
                        .filter((s) => !pokerSessions[s.id] || pokerSessions[s.id].phase === "idle")
                        .reduce((chain, s) => chain.then(() => runPokerSession(s.id)), Promise.resolve())
                    }}
                    disabled={anyPokerActive}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition-all shrink-0",
                      anyPokerActive
                        ? "bg-primary/10 text-primary cursor-wait"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    )}
                  >
                    {anyPokerActive ? (
                      <>
                        <span className="size-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                        Estimating...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>casino</span>
                        Estimate All Stories
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Story Cards */}
            {stories.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">Product Backlog</span>
                  <div className="flex-1 h-px bg-border/20" />
                  <span className="font-mono text-[9px] text-muted-foreground/40">{stories.length} stories</span>
                </div>

                {stories.map((story, idx) => {
                  const poker = pokerSessions[story.id]
                  const estimate = poker?.consensusEstimate ?? null
                  const pokerDone = poker?.phase === "done"
                  const pokerActive = poker && (poker.phase === "estimating" || poker.phase === "revealing" || poker.phase === "debating")

                  return (
                    <div
                      key={story.id}
                      className={cn(
                        "rounded-xl border overflow-hidden transition-all",
                        pokerDone
                          ? "bg-card/50 border-primary/20"
                          : pokerActive
                            ? "bg-card/40 border-primary/15"
                            : "bg-card/30 border-border/20"
                      )}
                    >
                      <div className="p-4 space-y-2.5">
                        {/* Row 1: ID + badges + estimate */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[9px] font-bold text-muted-foreground/40">#{String(idx + 1).padStart(2, "0")}</span>
                          <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">{story.id}</span>
                          {story.type && (
                            <span className={cn("rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase",
                              story.type === "feature" ? "bg-primary/10 text-primary" :
                              story.type === "bug" ? "bg-red-500/10 text-red-400" :
                              "bg-amber-500/10 text-amber-500"
                            )}>{story.type}</span>
                          )}
                          {story.priority && (
                            <span className={cn("rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase",
                              story.priority === "critical" ? "bg-red-500/10 text-red-400" :
                              story.priority === "high" ? "bg-amber-500/10 text-amber-500" :
                              "bg-primary/10 text-primary"
                            )}>{story.priority}</span>
                          )}
                          <div className="flex-1" />
                          {estimate != null ? (
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/25">
                              <span className="material-symbols-outlined text-primary" style={{ fontSize: 10 }}>bolt</span>
                              <span className="text-[10px] font-bold font-mono text-primary">{estimate} pts</span>
                            </div>
                          ) : (
                            <span className="text-[9px] font-mono text-muted-foreground/30">TBD</span>
                          )}
                        </div>

                        {/* Title + description */}
                        <p className="text-sm font-semibold text-foreground">{story.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{story.description}</p>

                        {/* Acceptance criteria */}
                        {story.acceptanceCriteria && story.acceptanceCriteria.length > 0 && (
                          <div className="flex items-center gap-1 text-[9px] text-muted-foreground/40">
                            <span className="material-symbols-outlined" style={{ fontSize: 10 }}>checklist</span>
                            {story.acceptanceCriteria.length} acceptance criteria
                          </div>
                        )}

                        {/* Labels */}
                        {story.labels && story.labels.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {story.labels.map((lbl) => (
                              <span key={lbl} className="rounded bg-muted/30 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground/60">{lbl}</span>
                            ))}
                          </div>
                        )}

                        {/* Assignee + status */}
                        <div className="flex items-center justify-between pt-2 border-t border-border/10">
                          {storyAssignees[story.id] ? (
                            <span className="text-[9px] text-primary font-bold">{storyAssignees[story.id]} leads</span>
                          ) : (
                            <span className="text-[9px] text-muted-foreground/30">Awaiting estimation</span>
                          )}
                          <span className={cn(
                            "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase",
                            pokerDone ? "bg-primary/10 text-primary" :
                            pokerActive ? "bg-amber-500/10 text-amber-500" :
                            "bg-muted/30 text-muted-foreground/40"
                          )}>
                            {pokerDone ? "Estimated" : pokerActive ? "Estimating..." : "Queued"}
                          </span>
                        </div>
                      </div>

                      {/* Poker result footer */}
                      {poker && poker.phase !== "idle" && (
                        <button
                          onClick={() => setDrawerStoryId(story.id)}
                          className={cn(
                            "w-full flex items-center gap-2 px-4 py-2.5 border-t transition-colors text-left",
                            pokerDone ? "border-primary/15 bg-primary/5 hover:bg-primary/10" : "border-primary/10 hover:bg-card/50"
                          )}
                        >
                          <span className="material-symbols-outlined text-primary" style={{ fontSize: 13 }}>casino</span>
                          <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                            {pokerDone ? `Consensus: ${estimate} pts` : `${poker.phase}...`}
                          </span>
                          <span className="ml-auto text-[9px] text-muted-foreground/40 flex items-center gap-1">
                            View details
                            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>chevron_right</span>
                          </span>
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Implement Backlog CTA */}
            {allDonePoker && (
              <div className="rounded-xl border border-primary/25 bg-card/40 p-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-foreground">All stories estimated — ready to implement</p>
                  <p className="text-xs text-muted-foreground mt-1">{stories.length} stories · {totalPoints} pts total</p>
                </div>
                <button
                  onClick={() => router.push(`/implementation?story=${encodeURIComponent(stories[0]?.id ?? "")}&autorun=1`)}
                  className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors uppercase tracking-wider"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>play_arrow</span>
                  Implement Backlog
                </button>
              </div>
            )}

            {/* Empty state */}
            {requirements.length === 0 && stories.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <span className="material-symbols-outlined text-muted-foreground/20" style={{ fontSize: 48 }}>view_kanban</span>
                <p className="text-sm text-muted-foreground/40">No requirements available. Go back to Analysis to generate requirements first.</p>
                <a href="/analysis" className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_back</span>
                  Go to Analysis
                </a>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Planning Poker Drawer */}
      <Drawer
        direction="right"
        open={drawerStoryId !== null}
        onOpenChange={(open) => { if (!open) setDrawerStoryId(null) }}
      >
        <DrawerContent className="bg-background border-l border-border/40 flex flex-col p-0 overflow-hidden !max-w-none" style={{ width: "min(960px, 95vw)" }}>
          <DrawerHeader className="flex items-center justify-between px-8 py-5 border-b border-border/30 shrink-0">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 28 }}>casino</span>
              <div>
                <DrawerTitle className="text-xl font-bold text-foreground">Planning Poker</DrawerTitle>
                {drawerStory && (
                  <p className="font-mono text-sm text-muted-foreground mt-1">{drawerStory.id} · {drawerStory.title}</p>
                )}
              </div>
            </div>
            <DrawerClose className="grid size-8 place-items-center rounded-lg bg-muted/30 border border-border/30 hover:bg-muted/50 transition-colors">
              <span className="material-symbols-outlined text-muted-foreground" style={{ fontSize: 18 }}>close</span>
            </DrawerClose>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
            {drawerSession && (
              <>
                {/* Agent cards — 3 columns */}
                <div className="grid grid-cols-3 gap-5">
                  {drawerSession.agents.map((agent, i) => (
                    <div key={agent.role} className="flex flex-col items-center gap-4 p-6 rounded-xl bg-card/30 border border-border/20">
                      <div className="size-14 rounded-full flex items-center justify-center border-2 shrink-0" style={{ background: `${agent.color}12`, borderColor: `${agent.color}30` }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 28, color: agent.color }}>{agent.icon}</span>
                      </div>
                      <PokerCard value={agent.estimate} revealed={agent.revealed} color={agent.color} animationDelay={i * 180} />
                      <span className="text-base font-bold" style={{ color: agent.color }}>{agent.label}</span>
                      {agent.revealed && agent.reasoning && (
                        <p className="text-sm text-muted-foreground text-center leading-relaxed">{agent.reasoning}</p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Debate transcript */}
                {drawerSession.logs.length > 0 && (
                  <div className="rounded-xl bg-card/20 border border-border/20 overflow-hidden">
                    <div className="px-5 py-4 border-b border-border/20 flex items-center gap-2">
                      <span className="material-symbols-outlined text-muted-foreground/50" style={{ fontSize: 18 }}>forum</span>
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/50">Debate transcript</span>
                      <span className="ml-auto font-mono text-xs text-muted-foreground/40">{drawerSession.logs.length} turns</span>
                    </div>
                    <div className="p-5 space-y-4">
                      {drawerSession.logs.map((log, i) => (
                        <div key={i} className="rounded-xl bg-card/30 border border-border/15 overflow-hidden">
                          <div className="flex items-center gap-3 px-5 py-3 border-b border-border/10" style={{ background: `${log.color}08` }}>
                            <div className="w-1.5 h-5 rounded-full shrink-0" style={{ background: log.color }} />
                            <span className="font-bold" style={{ color: log.color }}>{log.agent}</span>
                            <span className="ml-auto font-mono text-xs text-muted-foreground/40">{log.timestamp}</span>
                          </div>
                          <div className="px-5 py-4">
                            <pre className="text-sm font-mono text-muted-foreground leading-relaxed whitespace-pre-wrap">{log.text}</pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Consensus */}
                {drawerSession.phase === "done" && drawerSession.consensusEstimate !== null && (
                  <div className="flex items-center justify-between rounded-xl bg-primary/8 border border-primary/25 px-8 py-6">
                    <div className="flex items-center gap-4">
                      <span className="material-symbols-outlined text-primary" style={{ fontSize: 32 }}>check_circle</span>
                      <div>
                        <p className="text-lg font-bold text-primary uppercase tracking-wide">Consensus reached</p>
                        <p className="text-sm text-muted-foreground mt-1">All agents have agreed on an estimate</p>
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-bold font-mono text-primary">{drawerSession.consensusEstimate}</span>
                      <span className="text-lg font-bold text-primary">pts</span>
                    </div>
                  </div>
                )}

                {/* In-progress */}
                {drawerSession.phase !== "done" && (
                  <div className="flex items-center gap-3 px-6 py-5 rounded-xl bg-primary/5 border border-primary/15">
                    <span className="size-3 rounded-full bg-primary animate-pulse" />
                    <span className="text-base text-primary font-medium capitalize">{drawerSession.phase}...</span>
                  </div>
                )}
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}

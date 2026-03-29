"use client"

import { useEffect, useState, useRef, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { SDLCSidebar } from "@/components/sdlc-sidebar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { callAgentStream } from "@/lib/agents/client"
import {
  createDemoImplementedStories,
  createDemoPokerSessions,
  createDemoStoryAssignees,
  DEMO_MERGED_CODE,
  DEMO_TESTING_SELECTIONS,
} from "@/lib/demo/mock-sdlc"

interface StorySelection {
  id: string
  variant: string
}

interface ActivityEntry {
  id: string
  agent: string
  color: string
  message: string
  timestamp: string
  done?: boolean
}

function TestingPageInner() {
  const searchParams = useSearchParams()

  // Parse story selections from URL
  const [selections, setSelections] = useState<StorySelection[]>([])
  const [mergePhase, setMergePhase] = useState<"idle" | "running" | "done">("idle")
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([])
  const [mergedCode, setMergedCode] = useState<Record<string, string>>({})
  const [isHydrated, setIsHydrated] = useState(false)
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIsHydrated(true)
    const storiesParam = searchParams.get("stories")
    if (storiesParam) {
      const pairs = storiesParam.split(",").map((pair) => {
        const [id, variant] = pair.split(":")
        return { id, variant }
      })
      setSelections(pairs)
    }
  }, [searchParams])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [activityLog.length])

  // Auto-start merge when selections loaded
  useEffect(() => {
    if (selections.length > 0 && mergePhase === "idle") {
      runMerge()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selections])

  async function runMerge() {
    setMergePhase("running")
    setActivityLog([])

    const context = selections.map((s) => `Story ${s.id}: Variant ${s.variant}`).join("\n")

    try {
      let lineBuffer = ""
      await callAgentStream(
        {
          role: "merge",
          storyId: "testing",
          storyTitle: "Integration Merge",
          storyDescription: `Merging ${selections.length} story implementations`,
          context,
        },
        (delta) => {
          lineBuffer += delta
          const lines = lineBuffer.split("\n")
          lineBuffer = lines.pop() ?? ""

          for (const line of lines) {
            if (!line.trim()) continue
            const isSecurityLine = /security|vulnerabilit|audit|compliance/i.test(line)
            const isDeployLine = /deploy|container|docker|build|bundle/i.test(line)
            const isDone = /complete|success|merged|ready|finished/i.test(line)

            setActivityLog((prev) => [
              ...prev,
              {
                id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                agent: isSecurityLine ? "Security Auditor" : isDeployLine ? "Build Agent" : "Merge Agent",
                color: isSecurityLine ? "#ffb4ab" : isDeployLine ? "#ffd080" : "#4edea3",
                message: line.trim(),
                timestamp: new Date().toLocaleTimeString(),
                done: isDone,
              },
            ])
          }
        }
      )

      // Build merged code from localStorage
      try {
        const raw = localStorage.getItem("itfest_state")
        if (raw) {
          const parsed = JSON.parse(raw)
          const files: Record<string, string> = {}
          if (parsed.stories) {
            for (const selection of selections) {
              const story = parsed.stories.find((s: { id: string }) => s.id === selection.id)
              if (story?.variants) {
                const variant = story.variants.find((v: { id: string }) => v.id.includes(selection.variant))
                if (variant) {
                  if (variant.backend?.content) files[`/src/${story.id}/backend.ts`] = variant.backend.content
                  if (variant.frontend?.content) files[`/src/${story.id}/frontend.tsx`] = variant.frontend.content
                }
              }
            }
            // Generate basic app structure
            files["/package.json"] = JSON.stringify({ name: "merged-project", dependencies: { react: "^18", "react-dom": "^18", next: "^14" } }, null, 2)
            files["/src/app/page.tsx"] = `export default function Home() {\n  return <div className="p-8"><h1 className="text-2xl font-bold">Merged Project</h1><p>${selections.length} stories integrated</p></div>\n}`
            files["/src/app/layout.tsx"] = `export default function RootLayout({ children }: { children: React.ReactNode }) {\n  return <html><body>{children}</body></html>\n}`
          }
          setMergedCode(files)
        }
      } catch { /* ignore */ }

      setMergePhase("done")
    } catch (err) {
      setActivityLog((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, agent: "System", color: "#ffb4ab", message: `Error: ${err}`, timestamp: new Date().toLocaleTimeString() },
      ])
      setMergePhase("done")
    }
  }

  function applyMockMerge() {
    const demoStories = createDemoImplementedStories()
    const demoSelections = DEMO_TESTING_SELECTIONS
    const demoActivity: ActivityEntry[] = [
      {
        id: "mock-merge-1",
        agent: "Merge Agent",
        color: "#4edea3",
        message: "Collected selected variants and prepared the integration workspace.",
        timestamp: "10:05:00",
        done: true,
      },
      {
        id: "mock-merge-2",
        agent: "Build Agent",
        color: "#ffd080",
        message: "Bundled the merged preview app and validated the runtime structure.",
        timestamp: "10:05:06",
        done: true,
      },
      {
        id: "mock-merge-3",
        agent: "Security Auditor",
        color: "#ffb4ab",
        message: "Confirmed the selected variants are safe for demo handoff.",
        timestamp: "10:05:12",
        done: true,
      },
    ]

    setSelections(demoSelections)
    setActivityLog(demoActivity)
    setMergedCode(DEMO_MERGED_CODE)
    setMergePhase("done")

    try {
      const existing = JSON.parse(localStorage.getItem("itfest_state") || "{}")
      localStorage.setItem(
        "itfest_state",
        JSON.stringify({
          ...existing,
          stories: demoStories,
        })
      )
      localStorage.setItem(
        "itfest_poker",
        JSON.stringify({
          pokerSessions: createDemoPokerSessions(),
          storyAssignees: createDemoStoryAssignees(),
        })
      )
    } catch {
      // ignore demo persistence issues
    }
  }

  if (!isHydrated) {
    return <div className="flex h-screen items-center justify-center bg-background"><div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
  }

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

      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-border/20 px-6 py-3">
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-lg font-bold text-foreground">Testing & Integration</h1>
            <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-500">PHASE 5</span>
            <span className={cn(
              "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase",
              mergePhase === "done" ? "bg-primary/10 text-primary" :
              mergePhase === "running" ? "bg-amber-500/10 text-amber-500" :
              "bg-muted/30 text-muted-foreground/40"
            )}>
              {mergePhase === "done" ? "COMPLETE" : mergePhase === "running" ? "MERGING" : "READY"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a href="/implementation" className="flex items-center gap-1 rounded-lg border border-border/30 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_back</span>
              Implementation
            </a>
            <button
              onClick={applyMockMerge}
              className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>auto_fix_high</span>
              Mock Merge
            </button>
            {mergePhase === "done" && (
              <a
                href="/maintenance"
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Go to Maintenance
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_forward</span>
              </a>
            )}
          </div>
        </header>

        {/* Two-column layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Merge Terminal */}
          <div className="flex-1 border-r border-border/20 flex flex-col">
            <div className="flex items-center gap-2 border-b border-border/20 px-4 py-2 bg-card/20">
              <div className="flex gap-1.5">
                <span className="size-3 rounded-full bg-red-500/60" />
                <span className="size-3 rounded-full bg-amber-500/60" />
                <span className="size-3 rounded-full bg-green-500/60" />
              </div>
              <span className="font-mono text-[10px] text-muted-foreground/40 ml-2">merge-agent@main-stable</span>
              {mergePhase === "running" && <span className="ml-auto size-2 rounded-full bg-primary animate-pulse" />}
            </div>

            <ScrollArea className="flex-1 bg-[#0a0a0a]">
              <div className="p-4 font-mono text-xs space-y-1.5">
                {activityLog.length === 0 && mergePhase === "idle" && (
                  <div className="text-muted-foreground/30 py-8 text-center">
                    Waiting for merge to start...
                  </div>
                )}
                {activityLog.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-2">
                    <span className="text-muted-foreground/30 shrink-0">{entry.timestamp}</span>
                    <span className="shrink-0 font-bold" style={{ color: entry.color }}>[{entry.agent}]</span>
                    <span className={cn("text-muted-foreground", entry.done && "text-primary font-bold")}>{entry.message}</span>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </ScrollArea>

            {/* Merge stats */}
            {mergePhase === "done" && (
              <div className="border-t border-border/20 bg-card/20 px-4 py-3 flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 14 }}>check_circle</span>
                  <span className="text-xs font-bold text-primary">Merge Complete</span>
                </div>
                <span className="text-[10px] text-muted-foreground/50">{selections.length} stories merged</span>
                <span className="text-[10px] text-muted-foreground/50">0 conflicts</span>
                <span className="font-mono text-[9px] text-muted-foreground/30 ml-auto">
                  commit {selections.map(s => s.id.slice(-3)).join("")}
                </span>
              </div>
            )}
          </div>

          {/* Right: Project Preview */}
          <div className="w-[45%] flex flex-col">
            <div className="flex items-center gap-2 border-b border-border/20 px-4 py-2 bg-card/20">
              <span className="material-symbols-outlined text-muted-foreground/50" style={{ fontSize: 14 }}>preview</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">Project Preview</span>
            </div>

            {mergePhase !== "done" ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-card/10">
                {mergePhase === "running" ? (
                  <>
                    <span className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <p className="text-xs text-muted-foreground/50">Building project preview...</p>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-muted-foreground/20" style={{ fontSize: 48 }}>web</span>
                    <p className="text-xs text-muted-foreground/30">Preview will appear after merge completes</p>
                  </>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* File tree */}
                <div className="border-b border-border/20 bg-card/20 p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="material-symbols-outlined text-muted-foreground/40" style={{ fontSize: 12 }}>folder</span>
                    <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider">Project Files</span>
                  </div>
                  <div className="space-y-0.5">
                    {Object.keys(mergedCode).sort().map((path) => (
                      <div key={path} className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-card/40 transition-colors cursor-default">
                        <span className="material-symbols-outlined text-muted-foreground/40" style={{ fontSize: 12 }}>
                          {path.endsWith(".tsx") || path.endsWith(".ts") ? "javascript" : "description"}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground/70">{path}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Code viewer */}
                <ScrollArea className="flex-1 bg-[#0a0a0a]">
                  <div className="p-4 space-y-4">
                    {Object.entries(mergedCode).sort(([a], [b]) => a.localeCompare(b)).map(([path, content]) => (
                      <div key={path} className="rounded-lg border border-border/10 overflow-hidden">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-card/20 border-b border-border/10">
                          <span className="material-symbols-outlined text-muted-foreground/40" style={{ fontSize: 12 }}>code</span>
                          <span className="font-mono text-[10px] text-muted-foreground/60">{path}</span>
                        </div>
                        <pre className="p-3 font-mono text-[10px] text-muted-foreground/80 leading-relaxed overflow-x-auto whitespace-pre-wrap">
                          {content}
                        </pre>
                      </div>
                    ))}
                    {Object.keys(mergedCode).length === 0 && (
                      <div className="text-center py-8">
                        <span className="text-xs text-muted-foreground/30">No code files generated. Implementation data may not be available.</span>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default function TestingPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    }>
      <TestingPageInner />
    </Suspense>
  )
}

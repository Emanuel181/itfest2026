"use client"

import Link from "next/link"
import { Suspense, useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { SDLCSidebar } from "@/components/sdlc-sidebar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { hydrateLegacySnapshots, syncLegacySnapshots, withOptionalProjectQuery } from "@/lib/backend/project-client"
import { DEMO_PRODUCT_DOC, DEMO_REQUIREMENTS, DEMO_TECHNICAL_DOC } from "@/lib/demo/mock-sdlc"
import { cn } from "@/lib/utils"

type Requirement = {
  id: string
  title: string
  detail: string
  kind: "functional" | "non-functional"
  priority: "must-have" | "should-have" | "nice-to-have"
}

function AnalysisPageInner() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get("project") ?? ""
  const [productDoc, setProductDoc] = useState<Record<string, unknown>>({})
  const [technicalDoc, setTechnicalDoc] = useState<Record<string, unknown>>({})
  const [requirements, setRequirements] = useState<Requirement[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [streamContent, setStreamContent] = useState("")
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function hydratePage() {
      try {
        const existing = JSON.parse(localStorage.getItem("itfest_state") || "{}")
        const dbSnapshot = await hydrateLegacySnapshots(projectId)
        const merged = {
          ...existing,
          ...(dbSnapshot?.legacyState ?? {}),
          productDocumentation: dbSnapshot?.productDocumentation ?? existing.productDocumentation,
          technicalDocumentation: dbSnapshot?.technicalDocumentation ?? existing.technicalDocumentation,
          requirements: dbSnapshot?.requirements ?? existing.requirements,
        }

        localStorage.setItem("itfest_state", JSON.stringify(merged))

        let pDoc = {}
        let tDoc = {}
        if (merged.productDocumentation) {
          try { pDoc = JSON.parse(String(merged.productDocumentation)) } catch { /* ignore */ }
        }
        if (merged.technicalDocumentation) {
          try { tDoc = JSON.parse(String(merged.technicalDocumentation)) } catch { /* ignore */ }
        }

        if (cancelled) return
        setProductDoc(Object.keys(pDoc).length > 0 ? pDoc : DEMO_PRODUCT_DOC)
        setTechnicalDoc(Object.keys(tDoc).length > 0 ? tDoc : DEMO_TECHNICAL_DOC)
        if (Array.isArray(merged.requirements)) setRequirements(merged.requirements as Requirement[])
      } catch {
        if (cancelled) return
        setProductDoc(DEMO_PRODUCT_DOC)
        setTechnicalDoc(DEMO_TECHNICAL_DOC)
      } finally {
        if (!cancelled) setIsHydrated(true)
      }
    }

    void hydratePage()
    return () => {
      cancelled = true
    }
  }, [projectId])

  // Persist requirements
  useEffect(() => {
    if (!isHydrated || requirements.length === 0) return
    try {
      const existing = JSON.parse(localStorage.getItem("itfest_state") || "{}")
      const nextState = { ...existing, requirements }
      localStorage.setItem("itfest_state", JSON.stringify(nextState))
      void syncLegacySnapshots({ projectId, legacyState: nextState })
    } catch { /* quota */ }
  }, [requirements, isHydrated, projectId])

  const hasProductDoc = Boolean(productDoc.title && productDoc.objective)
  const hasTechnicalDoc = Boolean((technicalDoc.techStack as string[] | undefined)?.length)
  const hasDocs = hasProductDoc || hasTechnicalDoc

  async function generateRequirements() {
    setIsGenerating(true)
    setStreamContent("")
    setRequirements([])

    try {
      const res = await fetch("/api/generate-requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productDoc, technicalDoc }),
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
              setStreamContent((prev) => prev + json.delta)
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue
            throw e
          }
        }
      }

      // Parse JSON from response
      const jsonMatch = full.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]) as Requirement[]
          setRequirements(parsed)
        } catch {
          setRequirements([])
        }
      }
    } catch (err) {
      setStreamContent(`Error: ${err}`)
    } finally {
      setIsGenerating(false)
    }
  }

  function applyMockRequirements() {
    setStreamContent("")
    setIsGenerating(false)
    setProductDoc(DEMO_PRODUCT_DOC)
    setTechnicalDoc(DEMO_TECHNICAL_DOC)
    setRequirements(DEMO_REQUIREMENTS)

    try {
      const existing = JSON.parse(localStorage.getItem("itfest_state") || "{}")
      const nextState = {
        ...existing,
        productDocumentation: JSON.stringify(DEMO_PRODUCT_DOC),
        technicalDocumentation: JSON.stringify(DEMO_TECHNICAL_DOC),
        requirements: DEMO_REQUIREMENTS,
      }
      localStorage.setItem(
        "itfest_state",
        JSON.stringify(nextState)
      )
      void syncLegacySnapshots({ projectId, legacyState: nextState })
    } catch {
      // ignore localStorage write failures in demo mode
    }
  }

  const priorityConfig = {
    "must-have": { color: "#ffb4ab", icon: "priority_high", bg: "bg-[#ffb4ab]/10" },
    "should-have": { color: "#ffd080", icon: "arrow_upward", bg: "bg-[#ffd080]/10" },
    "nice-to-have": { color: "#86948a", icon: "arrow_downward", bg: "bg-[#86948a]/10" },
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
            <h1 className="font-serif text-lg font-bold text-foreground">Analysis</h1>
            <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-500">PHASE 2</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href={withOptionalProjectQuery("/", projectId)} className="flex items-center gap-1 rounded-lg border border-border/30 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_back</span>
              Planning
            </Link>
            <button
              onClick={applyMockRequirements}
              className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>auto_fix_high</span>
              Mock Requirements
            </button>
            {requirements.length > 0 && (
              <a
                href={withOptionalProjectQuery("/design", projectId)}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Go to Design
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_forward</span>
              </a>
            )}
          </div>
        </header>

        <ScrollArea className="flex-1">
          <div className="mx-auto max-w-5xl px-6 py-6 space-y-6">
            {/* Documentation Summary */}
            <div className="grid grid-cols-2 gap-4">
              {/* Product Doc Summary */}
              <div className="rounded-xl border border-border/20 bg-card/40 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>description</span>
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60">Product Documentation</span>
                  {hasProductDoc && <span className="ml-auto size-2 rounded-full bg-emerald-500" />}
                </div>
                {hasProductDoc ? (
                  <div className="space-y-2">
                    {productDoc.title ? <p className="text-sm font-semibold text-foreground">{String(productDoc.title)}</p> : null}
                    {productDoc.objective ? <p className="text-xs text-muted-foreground line-clamp-3">{String(productDoc.objective)}</p> : null}
                    {(productDoc.scope as string[] | undefined)?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {(productDoc.scope as string[]).slice(0, 4).map((s, i) => (
                          <span key={i} className="rounded-md bg-muted/40 px-1.5 py-0.5 text-[9px] text-muted-foreground">{s}</span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground/40">No product documentation yet. Go back to Planning.</p>
                )}
              </div>

              {/* Technical Doc Summary */}
              <div className="rounded-xl border border-border/20 bg-card/40 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>architecture</span>
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60">Technical Documentation</span>
                  {hasTechnicalDoc && <span className="ml-auto size-2 rounded-full bg-emerald-500" />}
                </div>
                {hasTechnicalDoc ? (
                  <div className="space-y-2">
                    {technicalDoc.architecture ? <p className="text-xs text-muted-foreground line-clamp-2">{String(technicalDoc.architecture)}</p> : null}
                    {(technicalDoc.techStack as string[] | undefined)?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {(technicalDoc.techStack as string[]).map((t, i) => (
                          <span key={i} className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">{t}</span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground/40">No technical documentation yet. Go back to Planning.</p>
                )}
              </div>
            </div>

            {/* Generate Requirements Button */}
            {hasDocs && requirements.length === 0 && !isGenerating && (
              <button
                onClick={generateRequirements}
                className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl text-xs font-bold uppercase tracking-wider border border-primary/25 bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>auto_awesome</span>
                Generate Requirements from Documentation
              </button>
            )}

            {/* Streaming Output */}
            {isGenerating && (
              <div className="rounded-xl border border-primary/20 bg-card/30 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="size-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span className="text-xs font-bold text-primary uppercase tracking-wider">Generating requirements...</span>
                </div>
                <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {streamContent || "Analyzing documentation..."}
                </pre>
              </div>
            )}

            {/* Requirements List */}
            {requirements.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">Requirements</span>
                  <div className="flex-1 h-px bg-border/20" />
                  <span className="font-mono text-[9px] text-muted-foreground/40">{requirements.length} items</span>
                </div>

                {/* Stats */}
                <div className="flex gap-3">
                  <div className="flex items-center gap-1.5 rounded-lg bg-card/40 border border-border/20 px-3 py-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground/60">Functional</span>
                    <span className="font-mono text-xs font-bold text-primary">{requirements.filter(r => r.kind === "functional").length}</span>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg bg-card/40 border border-border/20 px-3 py-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground/60">Non-functional</span>
                    <span className="font-mono text-xs font-bold text-amber-500">{requirements.filter(r => r.kind === "non-functional").length}</span>
                  </div>
                </div>

                {/* Requirement Cards */}
                <div className="space-y-2">
                  {requirements.map((req, i) => {
                    const pConfig = priorityConfig[req.priority] || priorityConfig["nice-to-have"]
                    return (
                      <div
                        key={req.id || i}
                        className="rounded-xl border border-border/20 bg-card/30 p-4 transition-colors hover:bg-card/50"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            <span className="font-mono text-[9px] font-bold text-muted-foreground/40">{req.id}</span>
                          </div>
                          <div className="flex-1 space-y-1.5">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-semibold text-foreground">{req.title}</h3>
                              <span className={cn(
                                "rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase",
                                req.kind === "functional" ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-500"
                              )}>
                                {req.kind}
                              </span>
                              <span className={cn("flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[9px] font-bold", pConfig.bg)} style={{ color: pConfig.color }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 10 }}>{pConfig.icon}</span>
                                {req.priority}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">{req.detail}</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Regenerate button */}
                <button
                  onClick={generateRequirements}
                  disabled={isGenerating}
                  className="flex items-center gap-1.5 rounded-lg border border-border/30 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>refresh</span>
                  Regenerate
                </button>
              </div>
            )}

            {/* Empty state */}
            {!hasDocs && (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <span className="material-symbols-outlined text-muted-foreground/20" style={{ fontSize: 48 }}>assignment</span>
                <p className="text-sm text-muted-foreground/40">No documentation available. Go back to Planning to create your product and technical documentation.</p>
                <Link href={withOptionalProjectQuery("/", projectId)} className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_back</span>
                  Go to Planning
                </Link>
              </div>
            )}
          </div>
        </ScrollArea>
      </main>
    </div>
  )
}

export default function AnalysisPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    }>
      <AnalysisPageInner />
    </Suspense>
  )
}

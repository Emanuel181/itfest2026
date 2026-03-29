"use client"

import { Suspense, useState, useEffect } from "react"
import { SDLCSidebar } from "@/components/sdlc-sidebar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useSearchParams } from "next/navigation"
import { hydrateLegacySnapshots, syncLegacySnapshots, withOptionalProjectQuery } from "@/lib/backend/project-client"
import { callAgentStream } from "@/lib/agents/client"
import { createDemoImplementedStories, DEMO_SECURITY_REPORT } from "@/lib/demo/mock-sdlc"
import { cn } from "@/lib/utils"

interface SecurityIssue {
  id: string
  severity: "critical" | "high" | "medium" | "low"
  category: string
  title: string
  description: string
  location: string
  recommendation: string
  effort: string
}

interface SecurityReport {
  overallScore: number
  summary: string
  criticalIssues: number
  highIssues: number
  mediumIssues: number
  lowIssues: number
  issues: SecurityIssue[]
  recommendations: string[]
}

function Ring({ value, size = 80, strokeWidth = 6, color }: { value: number; size?: number; strokeWidth?: number; color: string }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" className="text-muted/20" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        className="transition-all duration-1000 ease-out"
      />
    </svg>
  )
}

function MaintenancePageInner() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get("project") ?? ""
  const [report, setReport] = useState<SecurityReport | null>(null)
  const [isAuditing, setIsAuditing] = useState(false)
  const [streamContent, setStreamContent] = useState("")
  const [isHydrated, setIsHydrated] = useState(false)
  const [storiesCount, setStoriesCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function hydratePage() {
      try {
        const dbSnapshot = await hydrateLegacySnapshots(projectId)
        if (!cancelled && Array.isArray(dbSnapshot?.userStories)) {
          setStoriesCount(dbSnapshot.userStories.length)
        }
      } catch { /* ignore */ }
      finally {
        if (!cancelled) setIsHydrated(true)
      }
    }

    void hydratePage()
    return () => {
      cancelled = true
    }
  }, [projectId])

  async function runSecurityAudit() {
    setIsAuditing(true)
    setStreamContent("")
    setReport(null)

    let codeContext = ""
    const dbSnapshot = await hydrateLegacySnapshots(projectId)
    if (Array.isArray(dbSnapshot?.userStories)) {
      for (const story of dbSnapshot.userStories) {
        if (story.variants) {
          for (const variant of story.variants) {
            if (variant.backend?.content) codeContext += `\n--- Backend (${story.id}/${variant.id}) ---\n${variant.backend.content}`
            if (variant.frontend?.content) codeContext += `\n--- Frontend (${story.id}/${variant.id}) ---\n${variant.frontend.content}`
          }
        }
      }
    }

    if (!codeContext) codeContext = "No implementation code available for audit."

    try {
      const full = await callAgentStream(
        {
          role: "security_audit",
          storyId: "maintenance",
          storyTitle: "Security Audit",
          storyDescription: "Comprehensive security audit of the merged project",
          context: codeContext,
        },
        (delta) => {
          setStreamContent((prev) => prev + delta)
        }
      )

      // Parse JSON report
      const jsonMatch = full.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]) as SecurityReport
          setReport(parsed)
        } catch { /* parse error */ }
      }
    } catch (err) {
      setStreamContent(`Error: ${err}`)
    } finally {
      setIsAuditing(false)
    }
  }

  function applyMockAudit() {
    setIsAuditing(false)
    setStreamContent("")
    setReport(DEMO_SECURITY_REPORT)
    setStoriesCount((current) => (current > 0 ? current : createDemoImplementedStories().length))

    const nextState = {
      stories: createDemoImplementedStories(),
    }
    void syncLegacySnapshots({ projectId, legacyState: nextState })
  }

  const severityConfig = {
    critical: { color: "#ef4444", bg: "bg-red-500/10", border: "border-red-500/20", icon: "error" },
    high: { color: "#ffb4ab", bg: "bg-[#ffb4ab]/10", border: "border-[#ffb4ab]/20", icon: "warning" },
    medium: { color: "#ffd080", bg: "bg-[#ffd080]/10", border: "border-[#ffd080]/20", icon: "info" },
    low: { color: "#86948a", bg: "bg-[#86948a]/10", border: "border-[#86948a]/20", icon: "shield" },
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
            <h1 className="font-serif text-lg font-bold text-foreground">Maintenance</h1>
            <span className="rounded-md bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-500">PHASE 6</span>
          </div>
          <div className="flex items-center gap-2">
            <a href={withOptionalProjectQuery("/testing", projectId)} className="flex items-center gap-1 rounded-lg border border-border/30 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_back</span>
              Testing
            </a>
            <button
              onClick={applyMockAudit}
              className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>auto_fix_high</span>
              Mock Audit
            </button>
            <button
              onClick={runSecurityAudit}
              disabled={isAuditing}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-colors",
                isAuditing
                  ? "bg-muted/30 text-muted-foreground cursor-wait"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              {isAuditing ? (
                <>
                  <span className="size-3 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                  Auditing...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>shield</span>
                  Run Security Audit
                </>
              )}
            </button>
          </div>
        </header>

        <ScrollArea className="flex-1">
          <div className="mx-auto max-w-5xl px-6 py-6 space-y-6">

            {/* KPI Cards */}
            <div className="grid grid-cols-4 gap-4">
              <div className="rounded-xl border border-border/20 bg-card/30 p-4 flex flex-col items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">Stories Merged</span>
                <span className="text-3xl font-bold font-mono text-foreground">{storiesCount}</span>
              </div>
              <div className="rounded-xl border border-border/20 bg-card/30 p-4 flex flex-col items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">Compliance</span>
                <div className="relative">
                  <Ring value={report?.overallScore ?? 0} color="#4edea3" />
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-bold font-mono text-primary">
                    {report?.overallScore ?? "—"}
                  </span>
                </div>
              </div>
              <div className="rounded-xl border border-border/20 bg-card/30 p-4 flex flex-col items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">Issues Found</span>
                <span className="text-3xl font-bold font-mono text-foreground">
                  {report ? (report.criticalIssues + report.highIssues + report.mediumIssues + report.lowIssues) : "—"}
                </span>
              </div>
              <div className="rounded-xl border border-border/20 bg-card/30 p-4 flex flex-col items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">Critical</span>
                <span className={cn("text-3xl font-bold font-mono", report?.criticalIssues ? "text-red-500" : "text-muted-foreground/30")}>
                  {report?.criticalIssues ?? "—"}
                </span>
              </div>
            </div>

            {/* Streaming output during audit */}
            {isAuditing && (
              <div className="rounded-xl border border-primary/20 bg-card/30 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="size-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span className="text-xs font-bold text-primary uppercase tracking-wider">Running security audit...</span>
                </div>
                <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {streamContent || "Analyzing codebase..."}
                </pre>
              </div>
            )}

            {/* Security Report */}
            {report && (
              <>
                {/* Summary */}
                <div className="rounded-xl border border-border/20 bg-card/30 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>security</span>
                    <span className="text-sm font-bold text-foreground">Security Assessment</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{report.summary}</p>
                </div>

                {/* Severity Breakdown */}
                <div className="grid grid-cols-4 gap-3">
                  {(["critical", "high", "medium", "low"] as const).map((severity) => {
                    const config = severityConfig[severity]
                    const count = severity === "critical" ? report.criticalIssues :
                                  severity === "high" ? report.highIssues :
                                  severity === "medium" ? report.mediumIssues : report.lowIssues
                    return (
                      <div key={severity} className={cn("rounded-lg border p-3 flex items-center gap-3", config.bg, config.border)}>
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: config.color }}>{config.icon}</span>
                        <div>
                          <span className="text-lg font-bold font-mono" style={{ color: config.color }}>{count}</span>
                          <span className="ml-1 text-[10px] uppercase tracking-wider text-muted-foreground/50">{severity}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Issues List */}
                {report.issues.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">Detailed Findings</span>
                    {report.issues.map((issue, i) => {
                      const config = severityConfig[issue.severity] || severityConfig.low
                      return (
                        <div key={issue.id || i} className={cn("rounded-xl border bg-card/30 p-4", config.border)}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className={cn("rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase", config.bg)} style={{ color: config.color }}>
                              {issue.severity}
                            </span>
                            <span className="text-[9px] text-muted-foreground/40 font-mono">{issue.id}</span>
                            {issue.category && (
                              <span className="text-[9px] text-muted-foreground/40">{issue.category}</span>
                            )}
                          </div>
                          <h4 className="text-sm font-semibold text-foreground mb-1">{issue.title}</h4>
                          <p className="text-xs text-muted-foreground leading-relaxed mb-2">{issue.description}</p>
                          {issue.location && (
                            <p className="text-[10px] text-muted-foreground/40 font-mono mb-1">Location: {issue.location}</p>
                          )}
                          {issue.recommendation && (
                            <div className="mt-2 rounded-lg bg-primary/5 border border-primary/10 px-3 py-2">
                              <span className="text-[9px] font-bold text-primary uppercase tracking-wider">Recommendation</span>
                              <p className="text-xs text-muted-foreground mt-0.5">{issue.recommendation}</p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Recommendations */}
                {report.recommendations && report.recommendations.length > 0 && (
                  <div className="rounded-xl border border-border/20 bg-card/30 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>tips_and_updates</span>
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/50">General Recommendations</span>
                    </div>
                    <ul className="space-y-2">
                      {report.recommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
                          <span className="mt-1 size-1 shrink-0 rounded-full bg-primary/50" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}

            {/* Empty state */}
            {!report && !isAuditing && (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <span className="material-symbols-outlined text-muted-foreground/20" style={{ fontSize: 48 }}>shield</span>
                <p className="text-sm text-muted-foreground/40">Run a security audit to check your project for vulnerabilities</p>
                <button
                  onClick={runSecurityAudit}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>shield</span>
                  Run Security Audit
                </button>
              </div>
            )}
          </div>
        </ScrollArea>
      </main>
    </div>
  )
}

export default function MaintenancePage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    }>
      <MaintenancePageInner />
    </Suspense>
  )
}

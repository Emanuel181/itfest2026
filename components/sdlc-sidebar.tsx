"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { withOptionalProjectQuery } from "@/lib/backend/project-client"
import type { CollaboratorPresence } from "@/lib/backend/types"

type SDLCPhase = {
  id: string
  number: number
  label: string
  icon: string
  color: string
  stages: SDLCStage[]
}

type SDLCStage = {
  id: string
  number: string
  label: string
  description: string
  icon: string
  href: string
}

const SDLC_PHASES: SDLCPhase[] = [
  {
    id: "planning",
    number: 1,
    label: "Planning",
    icon: "chat",
    color: "text-emerald-500",
    stages: [
      { id: "product-tech-chat", number: "01", label: "Product & Tech Chat", description: "Shape your idea with AI agents", icon: "forum", href: "/" },
    ],
  },
  {
    id: "analysis",
    number: 2,
    label: "Analysis",
    icon: "analytics",
    color: "text-amber-500",
    stages: [
      { id: "requirements", number: "02", label: "Requirements", description: "AI-generated from documentation", icon: "assignment", href: "/analysis" },
    ],
  },
  {
    id: "design",
    number: 3,
    label: "Design",
    icon: "design_services",
    color: "text-orange-500",
    stages: [
      { id: "product-backlog", number: "03", label: "Product Backlog", description: "User stories, estimation & sprint planning", icon: "view_kanban", href: "/design" },
    ],
  },
  {
    id: "implementation",
    number: 4,
    label: "Implementation",
    icon: "code",
    color: "text-red-500",
    stages: [
      { id: "agent-pipeline", number: "04", label: "Agent Pipeline", description: "3-variant AI code generation", icon: "construction", href: "/implementation" },
    ],
  },
  {
    id: "testing",
    number: 5,
    label: "Testing & Integration",
    icon: "integration_instructions",
    color: "text-blue-500",
    stages: [
      { id: "merge-review", number: "05", label: "Merge & Code Review", description: "Merge variants & preview project", icon: "merge_type", href: "/testing" },
    ],
  },
  {
    id: "maintenance",
    number: 6,
    label: "Maintenance",
    icon: "settings_suggest",
    color: "text-sky-500",
    stages: [
      { id: "project-review", number: "06", label: "Security & Review", description: "Security audit & project health", icon: "assessment", href: "/maintenance" },
    ],
  },
]

export { SDLC_PHASES }
export type { SDLCPhase, SDLCStage }

export function SDLCSidebar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activePhaseId = getActivePhaseId(pathname)
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set(activePhaseId ? [activePhaseId] : []))
  const [userEmail, setUserEmail] = useState("Loading account...")
  const [presence, setPresence] = useState<CollaboratorPresence[]>([])
  const [presenceNow, setPresenceNow] = useState(() => Date.now())
  const projectId = searchParams.get("project") ?? ""
  const projectHref = useMemo(() => withOptionalProjectQuery("/projects", projectId), [projectId])
  const storyId = searchParams.get("story") ?? ""
  const currentLocation = useMemo(() => getLocationDetails(pathname, storyId), [pathname, storyId])
  const visiblePresence = projectId ? presence : []

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (payload?.user?.email) {
          setUserEmail(payload.user.email)
        }
      })
      .catch(() => {
        setUserEmail("Signed in")
      })
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPresenceNow(Date.now())
    }, 1_000)

    return () => {
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (!projectId) return

    let cancelled = false

    async function syncPresence() {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return

      const response = await fetch(`/api/project-presence?project=${encodeURIComponent(projectId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          pathname,
          locationLabel: currentLocation.locationLabel,
          menuLabel: currentLocation.menuLabel,
          storyId: currentLocation.storyId,
        }),
      }).catch(() => null)

      if (!response?.ok || cancelled) return
      const payload = (await response.json().catch(() => null)) as { presence?: CollaboratorPresence[] } | null
      if (!cancelled && Array.isArray(payload?.presence)) {
        setPresence(payload.presence)
      }
    }

    void syncPresence()
    const interval = window.setInterval(() => {
      void syncPresence()
    }, 4_000)

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void syncPresence()
      }
    }

    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [currentLocation.locationLabel, currentLocation.menuLabel, currentLocation.storyId, pathname, projectId])

  function togglePhase(phaseId: string) {
    setExpandedPhases((prev) => {
      const next = new Set(prev)
      if (next.has(phaseId)) next.delete(phaseId)
      else next.add(phaseId)
      return next
    })
  }

  return (
    <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-4 no-scrollbar">
      <div className="mb-1 flex items-center gap-2 border-b border-border/30 px-2 pb-3">
        <span className="material-symbols-outlined text-muted-foreground/70" style={{ fontSize: 16 }}>account_tree</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/70">SDLC Pipeline</span>
      </div>

      <div className="space-y-1">
        {SDLC_PHASES.map((phase) => {
          const isExpanded = expandedPhases.has(phase.id) || phase.id === activePhaseId
          const isActivePhase = phase.id === activePhaseId

          return (
            <div key={phase.id}>
              <button
                onClick={() => togglePhase(phase.id)}
                className={cn(
                  "group flex w-full items-center gap-2.5 rounded-[8px] px-2 py-2 text-left transition-all duration-200",
                  isActivePhase
                    ? "bg-primary/8 text-foreground"
                    : "text-muted-foreground/70 hover:bg-card hover:text-foreground"
                )}
              >
                <span
                  className={cn(
                    "grid size-[22px] shrink-0 place-items-center rounded-[6px] border font-mono text-[9px] font-bold transition-all duration-300",
                    isActivePhase
                      ? "border-primary/30 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-[0_1px_5px_rgba(16,185,129,0.3)]"
                      : "border-border/50 bg-muted/40 text-muted-foreground/60 group-hover:bg-muted group-hover:text-foreground"
                  )}
                >
                  {phase.number}
                </span>
                <span className="flex-1 text-[12px] font-semibold uppercase tracking-wide">
                  {phase.label}
                </span>
                <span
                  className={cn(
                    "material-symbols-outlined text-muted-foreground/40 transition-transform duration-200",
                    isExpanded && "rotate-180"
                  )}
                  style={{ fontSize: 14 }}
                >
                  expand_more
                </span>
              </button>

              {isExpanded && (
                <div className="ml-3 mt-0.5 space-y-[2px] border-l border-border/20 pl-3">
                  {phase.stages.map((stage) => {
                    const isActive = isStageActive(stage.href, pathname)

                    return (
                      <Link
                        key={stage.id}
                        href={withOptionalProjectQuery(stage.href, projectId)}
                        className={cn(
                          "flex w-full items-start gap-2 rounded-[6px] px-2 py-1.5 text-left text-[12px] font-medium transition-all duration-200",
                          isActive
                            ? "bg-primary/10 text-primary shadow-sm ring-1 ring-inset ring-primary/20"
                            : "text-muted-foreground/70 hover:bg-card hover:text-foreground hover:shadow-sm"
                        )}
                      >
                        <span className="flex flex-col gap-0.5">
                          <span className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                "material-symbols-outlined",
                                isActive ? "text-primary" : "text-muted-foreground/50"
                              )}
                              style={{ fontSize: 13 }}
                            >
                              {stage.icon}
                            </span>
                            <span className="text-[12px]">{stage.label}</span>
                            <span
                              className="material-symbols-outlined text-muted-foreground/30"
                              style={{ fontSize: 10 }}
                            >
                              open_in_new
                            </span>
                          </span>
                          <span className="ml-[22px] text-[10px] font-normal leading-snug text-muted-foreground/60">
                            {stage.description}
                          </span>
                        </span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-4 border-t border-border/20 pt-3">
        <Link
          href={withOptionalProjectQuery("/code", projectId)}
          className={cn(
            "flex items-center gap-3 rounded-[10px] border px-3 py-3 transition-all duration-200",
            pathname.startsWith("/code")
              ? "border-primary/30 bg-primary/10 text-primary shadow-sm"
              : "border-border/30 bg-card/30 text-muted-foreground hover:border-primary/20 hover:bg-card hover:text-foreground"
          )}
        >
          <div
            className={cn(
              "grid size-9 place-items-center rounded-lg",
              pathname.startsWith("/code") ? "bg-primary/15 text-primary" : "bg-muted/40 text-muted-foreground/70"
            )}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>terminal</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold uppercase tracking-wide">View Code</div>
            <div className="text-[10px] text-muted-foreground/70">VS Code style explorer for AI output</div>
          </div>
          <span className="material-symbols-outlined text-muted-foreground/40" style={{ fontSize: 14 }}>arrow_forward</span>
        </Link>
      </div>

      <div className="mt-auto border-t border-border/20 pt-3 px-4 pb-3">
        <Link
          href={projectHref}
          className={cn(
            "mb-3 flex items-center gap-3 rounded-[10px] border px-3 py-3 transition-all duration-200",
            pathname.startsWith("/projects")
              ? "border-primary/30 bg-primary/10 text-primary shadow-sm"
              : "border-border/30 bg-card/30 text-muted-foreground hover:border-primary/20 hover:bg-card hover:text-foreground"
          )}
        >
          <div
            className={cn(
              "grid size-9 place-items-center rounded-lg",
              pathname.startsWith("/projects") ? "bg-primary/15 text-primary" : "bg-muted/40 text-muted-foreground/70"
            )}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>folder_managed</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold uppercase tracking-wide">Projects</div>
            <div className="text-[10px] text-muted-foreground/70">Manage access, invites and saved work</div>
          </div>
          <span className="material-symbols-outlined text-muted-foreground/40" style={{ fontSize: 14 }}>arrow_forward</span>
        </Link>

        <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-muted/50 transition-colors cursor-pointer">
          <div className="grid size-7 place-items-center rounded-full bg-primary/10">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>person</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">User Account</p>
            <p className="text-[10px] text-muted-foreground/60 truncate">{userEmail}</p>
          </div>
          <span className="material-symbols-outlined text-muted-foreground/40" style={{ fontSize: 14 }}>more_horiz</span>
        </div>

        {projectId ? (
          <div className="mt-3 rounded-[12px] border border-border/30 bg-card/30 p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary/80" style={{ fontSize: 15 }}>groups</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70">Live Collaboration</span>
            </div>

            <div className="space-y-2">
              {visiblePresence.length > 0 ? (
                visiblePresence.map((entry) => {
                  const secondsAgo = Math.max(0, Math.round((presenceNow - new Date(entry.updatedAt).getTime()) / 1000))

                  return (
                    <div key={entry.userId} className="rounded-[10px] border border-border/20 bg-background/70 px-2.5 py-2">
                      <div className="flex items-center gap-2">
                        <div className="grid size-7 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                          {entry.initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-[11px] font-semibold text-foreground">
                              {entry.isCurrentUser ? "You" : entry.name}
                            </span>
                            <span className="inline-flex size-2 rounded-full bg-emerald-500" />
                          </div>
                          <p className="truncate text-[10px] text-muted-foreground/70">{entry.menuLabel}</p>
                        </div>
                      </div>
                      <div className="mt-2 pl-9">
                        <p className="truncate text-[11px] text-foreground/90">{entry.locationLabel}</p>
                        <p className="text-[10px] text-muted-foreground/60">
                          {secondsAgo <= 2 ? "Live now" : `Updated ${secondsAgo}s ago`}
                        </p>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="rounded-[10px] border border-dashed border-border/30 px-3 py-3 text-[11px] text-muted-foreground/70">
                  No active collaborators are visible in this project yet.
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function isStageActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/" || pathname === ""
  return pathname.startsWith(href)
}

function getActivePhaseId(pathname: string): string | undefined {
  for (const phase of SDLC_PHASES) {
    for (const stage of phase.stages) {
      if (isStageActive(stage.href, pathname)) return phase.id
    }
  }
  return undefined
}

function getLocationDetails(pathname: string, storyId: string) {
  if (pathname === "/projects") {
    return {
      menuLabel: "Project Management",
      locationLabel: "Projects Hub",
      storyId: undefined,
    }
  }

  if (pathname === "/code") {
    return {
      menuLabel: "Code Workspace",
      locationLabel: "View Code",
      storyId: undefined,
    }
  }

  if (pathname === "/code/preview") {
    return {
      menuLabel: "Code Workspace",
      locationLabel: "Generated Preview",
      storyId: undefined,
    }
  }

  for (const phase of SDLC_PHASES) {
    for (const stage of phase.stages) {
      if (isStageActive(stage.href, pathname)) {
        return {
          menuLabel: phase.label,
          locationLabel: storyId ? `${stage.label} · ${storyId}` : stage.label,
          storyId: storyId || undefined,
        }
      }
    }
  }

  return {
    menuLabel: "Workspace",
    locationLabel: pathname === "/" ? "Planning" : pathname.replaceAll("/", " ").trim() || "Workspace",
    storyId: storyId || undefined,
  }
}

"use client"

import Link from "next/link"
import { ReactNode, useSyncExternalStore } from "react"
import { usePathname } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/components/theme-provider"
import { cn } from "@/lib/utils"
import { withProjectQuery } from "@/lib/backend/project-url"

const items = [
  {
    id: "planning",
    label: "Planning",
    href: "/",
    number: "01",
    description: "Discovery de produs și documentație tehnică într-un flow de chat.",
  },
  {
    id: "analysis",
    label: "Analysis",
    href: "/analysis",
    number: "02",
    description: "Requirements extrase din documentația aprobată.",
  },
  {
    id: "design",
    label: "Design",
    href: "/design",
    number: "03",
    description: "Backlog, user stories și planning poker cu agenți.",
  },
  {
    id: "implementation",
    label: "Implementation",
    href: "/implementation",
    number: "04",
    description: "3 variante per story, reasoning, cod și security review.",
  },
  {
    id: "testing",
    label: "Testing & Integration",
    href: "/merge",
    number: "05",
    description: "Preview live și browser pentru proiectul rezultat.",
  },
  {
    id: "maintenance",
    label: "Maintenance",
    href: "/maintenance",
    number: "06",
    description: "Scan final de securitate și verificare post-integrare.",
  },
] as const

function ShellIcon() {
  return (
    <div className="grid size-7 place-items-center rounded-[8px] border border-primary/20 bg-gradient-to-br from-primary to-primary/80 shadow-[0_2px_10px_rgba(16,185,129,0.25)]">
      <div className="size-3 rounded-[4px] bg-primary-foreground/90" />
    </div>
  )
}

function subscribeToHydrationChange(callback: () => void) {
  callback()
  return () => {}
}

export function SDLCShell({
  active,
  projectId,
  title,
  subtitle,
  children,
  workspaceFiles,
  selectedFileId,
  onSelectFile,
  previewUrl,
}: {
  active: (typeof items)[number]["id"]
  projectId: string
  title: string
  subtitle: string
  children: ReactNode
  workspaceFiles?: Array<{ id: string; path: string }>
  selectedFileId?: string
  onSelectFile?: (fileId: string) => void
  previewUrl?: string
}) {
  const pathname = usePathname()
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(subscribeToHydrationChange, () => true, () => false)
  const hasWorkspaceFiles = (workspaceFiles?.length ?? 0) > 0
  const themeLabel = !mounted ? "Theme" : resolvedTheme === "dark" ? "White Mode" : "Dark Mode"

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[linear-gradient(180deg,#fffaf5_0%,#fffdf8_55%,#ffffff_100%)] font-sans text-sm text-foreground selection:bg-primary/20 dark:bg-background">
      <header className="relative z-50 flex h-14 w-full shrink-0 items-center justify-between border-b border-border/40 bg-background/85 px-4 shadow-sm backdrop-blur-xl dark:bg-card/80">
        <div className="flex items-center gap-4">
          <Link href={withProjectQuery("/", projectId)} className="flex items-center gap-3">
            <ShellIcon />
            <div className="leading-tight">
              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-primary">AI-Native SDLC</div>
              <div className="text-[12px] font-medium text-foreground/90">Luminescent IDE</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {items.slice(0, 4).map((item) => (
              <Button
                key={item.id}
                size="sm"
                variant="ghost"
                className={cn(
                  "h-8 rounded-[8px] px-3 text-[12px]",
                  active === item.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => {
                  window.location.href = withProjectQuery(item.href, projectId)
                }}
              >
                {item.label}
              </Button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="outline" className="hidden rounded-full border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-widest text-primary sm:inline-flex">
            Userflow First
          </Badge>
          <Button
            size="sm"
            variant="outline"
            className="h-8 rounded-[8px] border-border/40 bg-background/70 px-3 text-[12px] shadow-inner hover:bg-muted dark:bg-muted/30"
            onClick={() => {
              if (!mounted) return
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
            }}
          >
            {themeLabel}
          </Button>
          {previewUrl ? (
            <Button
              size="sm"
              className="h-8 rounded-[8px] bg-primary px-3 text-[12px] font-medium text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_1px_3px_rgba(16,185,129,0.2)] transition-all hover:bg-primary/95"
              onClick={() => {
                window.open(previewUrl, "_blank", "noopener,noreferrer")
              }}
            >
              Preview
            </Button>
          ) : null}
          <Badge variant="outline" className="rounded-full border-border/40 bg-muted/30 px-2.5 py-0.5 text-[10px] uppercase tracking-widest text-foreground/75">
            {pathname}
          </Badge>
          <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[10px] uppercase tracking-widest text-primary">
            {projectId.slice(0, 12)}
          </Badge>
        </div>
      </header>

      <div className="relative flex flex-1 overflow-hidden">
        <div className="pointer-events-none absolute left-1/3 top-1/2 h-[60vw] w-[60vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 opacity-30 blur-[100px] mix-blend-screen" />
        <div className="pointer-events-none absolute right-1/4 top-1/4 h-[40vw] w-[40vw] rounded-full bg-chart-2/5 opacity-20 blur-[100px] mix-blend-screen" />

        <aside className="relative z-10 hidden w-64 shrink-0 flex-col border-r border-border/20 bg-background/50 backdrop-blur-xl lg:flex dark:border-white/5">
          <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
            <div className="mb-1 flex items-center gap-2 border-b border-border/30 px-2 pb-3">
              <div className="size-4 rounded-sm border border-border/40 bg-muted/40" />
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/70">Workflow</span>
            </div>

            <div className="space-y-[3px]">
              {items.map((item) => {
                const isActive = active === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      window.location.href = withProjectQuery(item.href, projectId)
                    }}
                    className={cn(
                      "group flex w-full items-start gap-3 rounded-[8px] px-2 py-2 text-left text-[13px] font-medium transition-all duration-200",
                      isActive ? "bg-primary/10 text-primary shadow-sm ring-1 ring-inset ring-primary/20" : "text-muted-foreground/80 hover:bg-card hover:text-foreground hover:shadow-sm"
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-[22px] shrink-0 place-items-center rounded-[6px] border font-mono text-[9.5px] font-semibold transition-all duration-300",
                        isActive
                          ? "border-primary/20 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-[0_1px_5px_rgba(16,185,129,0.3)]"
                          : "border-border/50 bg-muted/40 text-muted-foreground/70 group-hover:bg-muted group-hover:text-foreground"
                      )}
                    >
                      {item.number}
                    </span>
                    <span className="flex flex-col gap-0.5">
                      <span>{item.label}</span>
                      <span className="text-[11px] font-normal leading-snug text-muted-foreground/75">
                        {item.description}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="mt-4 rounded-[14px] border border-border/40 bg-background/60 p-3">
              <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-primary">Active View</div>
              <div className="mt-2 text-[13px] font-medium text-foreground">{title}</div>
              <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{subtitle}</p>
            </div>
          </div>
        </aside>

        <main className="group relative z-10 flex min-w-0 flex-1 flex-col bg-transparent dark:bg-black/10">
          <div className="border-b border-border/30 bg-card/30 px-4 py-4 backdrop-blur xl:px-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-primary">{items.find((item) => item.id === active)?.label}</div>
                <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-foreground">{title}</h1>
                <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-muted-foreground">{subtitle}</p>
              </div>
            </div>
          </div>

          {hasWorkspaceFiles ? (
            <div className="border-b border-border/30 bg-background/60 px-4 py-2 backdrop-blur xl:px-6">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                <span className="shrink-0 text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">Project Files</span>
                {workspaceFiles?.map((file) => (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => onSelectFile?.(file.id)}
                    className={cn(
                      "shrink-0 rounded-[8px] border px-3 py-1.5 text-[11px] font-mono transition-all",
                      selectedFileId === file.id
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border/40 bg-background/70 text-muted-foreground hover:border-primary/20 hover:text-foreground"
                    )}
                  >
                    {file.path}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</div>
        </main>
      </div>
    </div>
  )
}

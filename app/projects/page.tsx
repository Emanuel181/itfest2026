"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useTheme } from "next-themes"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Project = {
  id: string
  title: string
  status: string
  created_at: string
  user_id: string
}

type PendingInvite = {
  id: string
  team_id: string
  email: string
  teams: { name: string } | null
}

const STATUS_LABEL: Record<string, string> = {
  ideation: "Ideation",
  requirements: "Requirements",
  stories: "User Stories",
  implementation: "Implementation",
  security: "Security",
  merge: "Merge",
  done: "Done",
}

const STATUS_COLOR: Record<string, string> = {
  ideation: "bg-primary/10 text-primary",
  requirements: "bg-blue-500/10 text-blue-500",
  stories: "bg-purple-500/10 text-purple-500",
  implementation: "bg-orange-500/10 text-orange-500",
  security: "bg-red-500/10 text-red-500",
  merge: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  done: "bg-green-600/10 text-green-600 dark:text-green-400",
}

export default function ProjectsPage() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [ready, setReady] = useState(false)

  const [userId, setUserId] = useState("")
  const [userEmail, setUserEmail] = useState("")
  const [userInitial, setUserInitial] = useState("?")
  const [accountOpen, setAccountOpen] = useState(false)
  const accountRef = useRef<HTMLDivElement>(null)

  const [teamId, setTeamId] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [invites, setInvites] = useState<PendingInvite[]>([])

  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [saving, setSaving] = useState(false)
  const [accepting, setAccepting] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false)
      }
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace("/login"); return }

    setUserId(user.id)
    setUserEmail(user.email ?? "")
    setUserInitial((user.email ?? "?")[0].toUpperCase())

    const [{ data: projs }, { data: invs }, { data: membership }] = await Promise.all([
      supabase
        .from("projects")
        .select("id, title, status, created_at, user_id")
        .order("created_at", { ascending: false }),
      supabase
        .from("team_invites")
        .select("id, team_id, email, teams(name)")
        .eq("email", user.email ?? "")
        .is("accepted_at", null),
      supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", user.id)
        .limit(1)
        .single(),
    ])

    setTeamId(membership?.team_id ?? null)

    setProjects(projs ?? [])
    setInvites((invs ?? []) as unknown as PendingInvite[])
    setReady(true)
  }, [router])

  useEffect(() => { loadData() }, [loadData])

  async function handleCreate() {
    if (!newTitle.trim() || saving) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from("projects")
      .insert({ title: newTitle.trim(), user_id: user.id, ...(teamId ? { team_id: teamId } : {}) })
      .select("id")
      .single()

    setSaving(false)
    if (data?.id) router.push(`/projects/${data.id}`)
  }

  async function handleAccept(invite: PendingInvite) {
    setAccepting(invite.id)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setAccepting(null); return }

    const { error: memberErr } = await supabase
      .from("team_members")
      .insert({ team_id: invite.team_id, user_id: user.id, role: "member" })

    if (memberErr && !memberErr.message.includes("duplicate") && !memberErr.message.includes("unique")) {
      console.error("team_members insert:", memberErr.message)
      setAccepting(null)
      return
    }

    const { error: updateErr } = await supabase
      .from("team_invites")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invite.id)

    if (updateErr) console.error("team_invites update:", updateErr.message)

    setAccepting(null)
    await loadData()
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    await supabase.from("projects").delete().eq("id", id)
    setDeletingId(null)
    setProjects((prev) => prev.filter((p) => p.id !== id))
  }

  async function handleRename(id: string) {
    if (!renameValue.trim()) { setRenamingId(null); return }
    await supabase.from("projects").update({ title: renameValue.trim() }).eq("id", id)
    setProjects((prev) => prev.map((p) => p.id === id ? { ...p, title: renameValue.trim() } : p))
    setRenamingId(null)
  }

  if (!ready) return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-background font-sans text-sm text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border/40 bg-card/80 px-6 backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-primary/20 to-transparent" />
        <div className="flex items-center gap-2.5">
          <div className="grid size-7 place-items-center rounded-[8px] border border-primary/20 bg-linear-to-br from-primary to-primary/80 shadow-[0_2px_10px_rgba(16,185,129,0.25)]">
            <svg className="size-4 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <span className="font-brand text-[15px] font-semibold tracking-tight text-foreground">Luminescent</span>
        </div>

        <div className="flex items-center gap-2">
          {mounted && (
            <Button
              size="icon"
              variant="outline"
              className="size-8 rounded-[8px] border-border/40 bg-muted/30 text-foreground/80 shadow-inner hover:bg-muted"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? (
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>
              ) : (
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
              )}
            </Button>
          )}

          <div ref={accountRef} className="relative">
            <button
              onClick={() => setAccountOpen((o) => !o)}
              className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-border/40 bg-muted/30 text-[11px] font-semibold text-foreground shadow-inner hover:bg-muted transition-colors"
              title={userEmail}
            >
              {userInitial}
            </button>
            {accountOpen && (
              <div className="absolute right-0 top-[calc(100%+6px)] z-200 w-52 rounded-[10px] border border-border/60 bg-background py-1 shadow-xl">
                <div className="border-b border-border/50 px-3 pb-2 pt-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-0.5">Account</p>
                  <p className="truncate text-[12px] text-foreground/80">{userEmail}</p>
                </div>
                <div className="p-1">
                  <Link
                    href="/settings"
                    onClick={() => setAccountOpen(false)}
                    className="flex items-center gap-2.5 rounded-[6px] px-2.5 py-1.5 text-[12px] text-foreground/80 hover:bg-muted/60 hover:text-foreground transition-colors"
                  >
                    <svg className="size-3.5 shrink-0 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
                    Settings
                  </Link>
                  <div className="my-1 h-px bg-border/40" />
                  <button
                    onClick={async () => { await supabase.auth.signOut(); router.replace("/login") }}
                    className="flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-1.5 text-[12px] text-red-500 dark:text-red-400 hover:bg-red-500/8 transition-colors"
                  >
                    <svg className="size-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        {/* Pending Invites */}
        {invites.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground/70">
              Pending Invites
            </h2>
            <div className="space-y-2">
              {invites.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between rounded-[10px] border border-primary/20 bg-primary/5 px-4 py-3"
                >
                  <div>
                    <p className="text-[13px] font-semibold text-foreground">
                      {inv.teams?.name ?? "Unknown team"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      You&apos;ve been invited to join this team
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="h-7 rounded-[6px] bg-primary text-[11px] font-medium text-primary-foreground hover:bg-primary/90"
                    onClick={() => handleAccept(inv)}
                    disabled={accepting === inv.id}
                  >
                    {accepting === inv.id ? "Joining…" : "Accept"}
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Projects */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground/70">
              Projects
            </h2>
            {!creating && (
              <Button
                size="sm"
                className="h-7 rounded-[6px] bg-primary text-[11px] font-medium text-primary-foreground hover:bg-primary/90"
                onClick={() => setCreating(true)}
              >
                + New Project
              </Button>
            )}
          </div>

          {creating && (
            <div className="mb-4 flex items-center gap-2 rounded-[10px] border border-border/40 bg-card/60 px-4 py-3 backdrop-blur-sm">
              <Input
                autoFocus
                placeholder="Project name…"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate()
                  if (e.key === "Escape") { setCreating(false); setNewTitle("") }
                }}
                className="h-8 flex-1 rounded-[6px] border-border/40 bg-muted/30 text-[12px]"
              />
              <Button
                size="sm"
                className="h-8 rounded-[6px] bg-primary text-[11px] text-primary-foreground hover:bg-primary/90"
                onClick={handleCreate}
                disabled={saving || !newTitle.trim()}
              >
                {saving ? "Creating…" : "Create"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-[6px] border-border/40 text-[11px]"
                onClick={() => { setCreating(false); setNewTitle("") }}
              >
                Cancel
              </Button>
            </div>
          )}

          {projects.length === 0 && !creating ? (
            <div className="flex flex-col items-center justify-center rounded-[12px] border border-dashed border-border/40 bg-muted/10 py-16 text-center">
              <div className="mb-3 grid size-10 place-items-center rounded-[10px] border border-border/40 bg-muted/30">
                <svg className="size-5 text-muted-foreground/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
              </div>
              <p className="text-[13px] font-medium text-foreground/60">No projects yet</p>
              <p className="mt-1 text-[11px] text-muted-foreground/50">Create your first project to get started</p>
              <Button
                size="sm"
                className="mt-4 h-7 rounded-[6px] bg-primary text-[11px] font-medium text-primary-foreground hover:bg-primary/90"
                onClick={() => setCreating(true)}
              >
                + New Project
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className="group relative flex flex-col gap-3 rounded-[12px] border border-border/40 bg-card/60 p-4 backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-card/80 hover:shadow-[0_4px_16px_rgba(16,185,129,0.08)]"
                >
                  {/* Owner actions */}
                  {p.user_id === userId && (
                    <div className="absolute right-3 top-3 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={(e) => { e.preventDefault(); setRenamingId(p.id); setRenameValue(p.title) }}
                        className="flex size-6 items-center justify-center rounded-[5px] text-muted-foreground/50 hover:bg-muted hover:text-foreground transition-colors"
                        title="Rename"
                      >
                        <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button
                        onClick={(e) => { e.preventDefault(); if (deletingId !== p.id) setDeletingId(p.id + "_confirm") }}
                        className="flex size-6 items-center justify-center rounded-[5px] text-muted-foreground/50 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                        title="Delete"
                      >
                        <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                    </div>
                  )}

                  {/* Rename inline */}
                  {renamingId === p.id ? (
                    <div className="flex items-center gap-2" onClick={(e) => e.preventDefault()}>
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRename(p.id)
                          if (e.key === "Escape") setRenamingId(null)
                        }}
                        className="flex-1 rounded-[6px] border border-primary/30 bg-background px-2 py-1 text-[13px] font-semibold text-foreground outline-none focus:ring-1 focus:ring-primary/40"
                      />
                      <button onClick={() => handleRename(p.id)} className="text-[11px] text-primary hover:opacity-80">Save</button>
                      <button onClick={() => setRenamingId(null)} className="text-[11px] text-muted-foreground hover:opacity-80">Cancel</button>
                    </div>
                  ) : deletingId === p.id + "_confirm" ? (
                    <div className="flex items-center gap-2" onClick={(e) => e.preventDefault()}>
                      <p className="flex-1 text-[12px] text-foreground/70">Delete <span className="font-medium text-foreground">{p.title}</span>?</p>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="text-[11px] font-medium text-red-500 hover:opacity-80"
                      >
                        Delete
                      </button>
                      <button onClick={() => setDeletingId(null)} className="text-[11px] text-muted-foreground hover:opacity-80">Cancel</button>
                    </div>
                  ) : (
                    <Link href={`/projects/${p.id}`} className="flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-2 pr-12">
                        <p className="text-[13px] font-semibold text-foreground leading-snug line-clamp-2">
                          {p.title}
                        </p>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${STATUS_COLOR[p.status] ?? "bg-muted/40 text-muted-foreground"}`}>
                          {STATUS_LABEL[p.status] ?? p.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-[11px] text-muted-foreground/60">
                          {new Date(p.created_at).toLocaleDateString("ro-RO", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                        {p.user_id !== userId && (
                          <span className="flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/8 px-2 py-0.5 text-[10px] font-medium text-blue-500 dark:text-blue-400">
                            <svg className="size-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                            </svg>
                            Shared
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-primary opacity-0 transition-opacity group-hover:opacity-100">
                        <span>Open workspace</span>
                        <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      </div>
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

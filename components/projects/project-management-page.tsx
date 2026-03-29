"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { withProjectQuery } from "@/lib/backend/project-url"

type Collaborator = {
  id?: string
  name: string
  email?: string
  role: string
  initials: string
  status: string
  isOwner?: boolean
  invitePending?: boolean
}

type ProjectSummary = {
  id: string
  title: string
  updatedAt: string
  currentStage: string
  isOwner: boolean
  ownerName: string
  ownerEmail: string
  collaborators: Collaborator[]
}

type ProjectManagementPageProps = {
  initialProjects: ProjectSummary[]
  user: {
    id: string
    name: string
    email: string
  }
}

export function ProjectManagementPage({ initialProjects, user }: ProjectManagementPageProps) {
  const router = useRouter()
  const [projects, setProjects] = useState(initialProjects)
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjects[0]?.id ?? "")
  const [newProjectName, setNewProjectName] = useState("")
  const [inviteEmail, setInviteEmail] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [isInviting, setIsInviting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState("")

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? projects[0] ?? null,
    [projects, selectedProjectId]
  )

  async function refreshProjects(nextSelectedId?: string) {
    const response = await fetch("/api/projects", { cache: "no-store" })
    const data = (await response.json()) as { projects?: ProjectSummary[]; error?: string }
    if (!response.ok || !data.projects) {
      throw new Error(data.error || "Failed to refresh projects.")
    }

    setProjects(data.projects)
    setSelectedProjectId(nextSelectedId ?? data.projects[0]?.id ?? "")
    router.refresh()
  }

  async function handleCreateProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsCreating(true)
    setError("")

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newProjectName }),
      })
      const data = (await response.json()) as { projectId?: string; error?: string }
      if (!response.ok || !data.projectId) {
        throw new Error(data.error || "Project creation failed.")
      }

      setNewProjectName("")
      await refreshProjects(data.projectId)
    } catch (projectError) {
      setError(projectError instanceof Error ? projectError.message : "Project creation failed.")
    } finally {
      setIsCreating(false)
    }
  }

  async function handleInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedProject) return
    setIsInviting(true)
    setError("")

    try {
      const response = await fetch(`/api/projects/${selectedProject.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "invite-collaborator", email: inviteEmail }),
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || "Invitation failed.")
      }

      setInviteEmail("")
      await refreshProjects(selectedProject.id)
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : "Invitation failed.")
    } finally {
      setIsInviting(false)
    }
  }

  async function handleRemoveCollaborator(collaboratorId: string) {
    if (!selectedProject) return
    setError("")

    try {
      const response = await fetch(`/api/projects/${selectedProject.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "remove-collaborator", collaboratorId }),
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || "Failed to remove collaborator.")
      }

      await refreshProjects(selectedProject.id)
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Failed to remove collaborator.")
    }
  }

  async function handleDeleteProject() {
    if (!selectedProject) return
    if (!window.confirm(`Delete "${selectedProject.title}"? This cannot be undone.`)) return

    setIsDeleting(true)
    setError("")

    try {
      const response = await fetch(`/api/projects/${selectedProject.id}`, {
        method: "DELETE",
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete the project.")
      }

      await refreshProjects()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete the project.")
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#102a43,transparent_28%),linear-gradient(180deg,#030712,#0f172a)] text-foreground">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="mb-8 flex flex-col gap-4 rounded-[30px] border border-white/10 bg-white/5 p-6 backdrop-blur-xl md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Project Hub</div>
            <h1 className="font-serif text-3xl font-bold text-white md:text-4xl">Administrează portofoliul de proiecte și colaborarea echipei într-un spațiu controlat.</h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-300">
              Toate proiectele sunt persistate în MongoDB, cu ownership clar, acces controlat și continuitate completă a etapelor SDLC. Owner-ul gestionează colaboratorii și guvernanța proiectului, iar membrii invitați pot contribui în același flux de lucru.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-white">{user.name}</div>
              <div className="text-xs text-slate-400">{user.email}</div>
            </div>
            <Button variant="outline" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
          <section className="space-y-4 rounded-[28px] border border-white/10 bg-black/20 p-5 backdrop-blur-xl">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-white">Create Project</h2>
              <p className="text-sm text-slate-400">Pornești un proiect nou și îl deschizi apoi în workspace.</p>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-3">
              <Input
                value={newProjectName}
                onChange={(event) => setNewProjectName(event.target.value)}
                placeholder="AI-native planning board"
              />
              <Button type="submit" className="w-full" disabled={isCreating}>
                {isCreating ? "Creating..." : "Create project"}
              </Button>
            </form>

            <div className="space-y-2 pt-2">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Your Projects</div>
              <div className="space-y-2">
                {projects.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-400">
                    Nu există încă proiecte. Creează primul proiect ca să pornești flow-ul.
                  </div>
                ) : (
                  projects.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => setSelectedProjectId(project.id)}
                      className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                        selectedProject?.id === project.id
                          ? "border-cyan-300/40 bg-cyan-300/10"
                          : "border-white/10 bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-white">{project.title}</div>
                          <div className="mt-1 text-xs text-slate-400">
                            {project.isOwner ? "Owner" : `Shared by ${project.ownerName}`}
                          </div>
                        </div>
                        <div className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                          {project.currentStage}
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-slate-500">
                        Updated {new Date(project.updatedAt).toLocaleString()}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-black/20 p-6 backdrop-blur-xl">
            {selectedProject ? (
              <div className="space-y-6">
                <div className="flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-semibold text-white">{selectedProject.title}</h2>
                      <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
                        {selectedProject.currentStage}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400">
                      Owner: {selectedProject.ownerName} · {selectedProject.ownerEmail}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={withProjectQuery("/", selectedProject.id)}
                      className="inline-flex items-center justify-center rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                    >
                      Open workspace
                    </Link>
                    {selectedProject.isOwner ? (
                      <Button variant="destructive" onClick={handleDeleteProject} disabled={isDeleting}>
                        {isDeleting ? "Deleting..." : "Delete project"}
                      </Button>
                    ) : null}
                  </div>
                </div>

                {error ? <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-white">Collaborators</h3>
                      <p className="text-sm text-slate-400">Toți membrii și invitațiile active ale proiectului.</p>
                    </div>

                    <div className="space-y-3">
                      {selectedProject.collaborators.map((collaborator) => (
                        <div key={collaborator.id ?? collaborator.email ?? collaborator.name} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="grid h-11 w-11 place-items-center rounded-full bg-cyan-400/10 text-sm font-semibold text-cyan-200">
                              {collaborator.initials}
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-white">{collaborator.name}</div>
                              <div className="text-xs text-slate-400">{collaborator.email || collaborator.status}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">{collaborator.role}</div>
                              <div className="text-xs text-slate-500">{collaborator.status}</div>
                            </div>
                            {selectedProject.isOwner && !collaborator.isOwner ? (
                              <Button
                                variant="outline"
                                onClick={() => handleRemoveCollaborator(collaborator.id || collaborator.email || collaborator.name)}
                              >
                                Remove
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4 rounded-[24px] border border-white/10 bg-black/20 p-5">
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold text-white">Owner Actions</h3>
                      <p className="text-sm text-slate-400">
                        Doar creatorul proiectului poate invita, elimina colaboratori sau șterge proiectul.
                      </p>
                    </div>

                    {selectedProject.isOwner ? (
                      <form onSubmit={handleInvite} className="space-y-3">
                        <Input
                          type="email"
                          value={inviteEmail}
                          onChange={(event) => setInviteEmail(event.target.value)}
                          placeholder="partner@team.dev"
                        />
                        <Button type="submit" className="w-full" disabled={isInviting}>
                          {isInviting ? "Inviting..." : "Invite collaborator"}
                        </Button>
                      </form>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-sm leading-6 text-slate-400">
                        Ești colaborator pe acest proiect. Poți intra în workspace și lucra, dar invitațiile și ștergerea rămân la owner.
                      </div>
                    )}

                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm leading-6 text-slate-400">
                      Link-ul de lucru păstrează `project` în query, iar toate rutele API proiectate pentru workspace sunt acum izolate pe baza membrilor proiectului.
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[420px] items-center justify-center rounded-[24px] border border-dashed border-white/10 text-slate-400">
                Selectează sau creează un proiect ca să vezi gestiunea lui.
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}

import { PlanningPage } from "@/components/planning/planning-page"
import { isValidProjectId } from "@/lib/backend/http"
import { getProject } from "@/lib/backend/service"
import { getCurrentUser } from "@/lib/server/auth"
import { getAccessibleProject } from "@/lib/server/projects"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function Home(props: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/login")
  }

  const searchParams = await props.searchParams
  const projectParam = searchParams?.project
  const projectId = typeof projectParam === "string" ? projectParam : undefined

  if (!isValidProjectId(projectId)) {
    redirect("/projects")
  }

  const access = await getAccessibleProject(projectId, user.id)
  if (!access) {
    redirect("/projects")
  }

  const project = await getProject(projectId)

  return <PlanningPage initialProject={project} initialProjectId={projectId} />
}

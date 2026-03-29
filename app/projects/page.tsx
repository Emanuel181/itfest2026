import { redirect } from "next/navigation"

import { ProjectManagementPage } from "@/components/projects/project-management-page"
import { getCurrentUser } from "@/lib/server/auth"
import { listProjectsForUser } from "@/lib/server/projects"

export const dynamic = "force-dynamic"

export default async function ProjectsPage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/login")
  }

  const projects = await listProjectsForUser(user)

  return <ProjectManagementPage initialProjects={projects} user={user} />
}

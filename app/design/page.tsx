import { DesignWorkspace } from "@/components/design-workspace"
import { createProjectId, isValidProjectId } from "@/lib/backend/http"
import { getProject } from "@/lib/backend/service"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function DesignPage(props: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const searchParams = await props.searchParams
  const projectParam = searchParams?.project
  const projectId = typeof projectParam === "string" ? projectParam : undefined

  if (!isValidProjectId(projectId)) {
    redirect(`/design?project=${createProjectId()}`)
  }

  const project = await getProject(projectId)
  return <DesignWorkspace initialProject={project} projectId={projectId} />
}

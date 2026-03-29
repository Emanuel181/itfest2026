"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { IdeationDashboard } from "@/components/ideation-dashboard"

export default function ProjectPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string

  const [ready, setReady] = useState(false)
  const [projectTitle, setProjectTitle] = useState("")

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace("/login"); return }

      const { data } = await supabase
        .from("projects")
        .select("title")
        .eq("id", projectId)
        .single()

      setProjectTitle(data?.title ?? "")
      setReady(true)
    }
    init()
  }, [router, projectId])

  if (!ready) return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
    </div>
  )

  return <IdeationDashboard projectTitle={projectTitle} />
}

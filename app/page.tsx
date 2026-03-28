"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { IdeationDashboard } from "@/components/ideation-dashboard"

export default function Home() {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace("/login")
      } else {
        setReady(true)
      }
    })
  }, [router])

  if (!ready) return null

  return <IdeationDashboard />
}

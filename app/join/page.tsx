"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

type State = "loading" | "joining" | "success" | "error"

function JoinFlow() {
  const router = useRouter()
  const params = useSearchParams()
  const token  = params.get("token")

  const [state, setState] = useState<State>("loading")
  const [error, setError] = useState<string>("")

  useEffect(() => {
    if (!token) { setError("Invalid invite link."); setState("error"); return }

    async function accept() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace(`/login?next=/join?token=${token}`); return }

      setState("joining")

      const { data: invite, error: invErr } = await supabase
        .from("team_invites")
        .select("id, team_id, email, accepted_at")
        .eq("token", token)
        .single()

      if (invErr || !invite) { setError("Invite not found or expired."); setState("error"); return }
      if (invite.accepted_at) { setError("This invite has already been used."); setState("error"); return }

      const { error: memberErr } = await supabase
        .from("team_members")
        .insert({ team_id: invite.team_id, user_id: user.id, role: "member" })

      if (memberErr && !memberErr.message.includes("duplicate")) {
        setError(memberErr.message); setState("error"); return
      }

      await supabase
        .from("team_invites")
        .update({ accepted_at: new Date().toISOString() })
        .eq("id", invite.id)

      setState("success")
      setTimeout(() => router.replace("/projects"), 1500)
    }

    accept()
  }, [token, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f0e8] dark:bg-[#131313]">
      <div className="bg-white/60 dark:bg-[#201f1f]/70 backdrop-blur-md rounded-2xl p-10 max-w-sm w-full mx-6 text-center shadow-[0_8px_24px_rgba(25,22,21,0.06)] dark:shadow-none">
        <span className="font-brand text-xl font-semibold text-[#10b981] dark:text-[#4edea3] block mb-8">
          luminescent
        </span>

        {(state === "loading" || state === "joining") && (
          <>
            <div className="w-10 h-10 rounded-full border-2 border-[#10b981]/20 dark:border-[#4edea3]/20 border-t-[#10b981] dark:border-t-[#4edea3] animate-spin mx-auto mb-4" />
            <p className="text-sm text-[#72695f] dark:text-[#c8c6c5]/60 font-sans">
              {state === "loading" ? "Verifying invite…" : "Joining team…"}
            </p>
          </>
        )}

        {state === "success" && (
          <>
            <div className="w-12 h-12 rounded-full bg-[#10b981]/10 dark:bg-[#4edea3]/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-[#10b981] dark:text-[#4edea3]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="font-serif text-xl text-[#191615] dark:text-[#e5e2e1] mb-1">You&apos;re in!</h2>
            <p className="text-sm text-[#72695f] dark:text-[#c8c6c5]/60 font-sans">Redirecting to workspace…</p>
          </>
        )}

        {state === "error" && (
          <>
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="font-serif text-xl text-[#191615] dark:text-[#e5e2e1] mb-2">Invalid invite</h2>
            <p className="text-sm text-[#72695f] dark:text-[#c8c6c5]/60 font-sans mb-6">{error}</p>
            <Link href="/projects" className="text-sm text-[#10b981] dark:text-[#4edea3] hover:opacity-80 transition-opacity font-sans">
              Go to workspace
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

export default function JoinPage() {
  return (
    <Suspense>
      <JoinFlow />
    </Suspense>
  )
}

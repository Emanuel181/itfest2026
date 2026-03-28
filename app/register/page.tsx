"use client"

import { useState } from "react"
import Link from "next/link"
import { useTheme } from "next-themes"
import { supabase } from "@/lib/supabase"

export default function RegisterPage() {
  const { resolvedTheme, setTheme } = useTheme()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleRegister(e: { preventDefault(): void }) {
    e.preventDefault()
    if (password !== confirm) {
      setError("Passwords do not match.")
      return
    }
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signUp({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f0e8] dark:bg-[#131313] relative overflow-hidden">
      {/* Theme toggle */}
      <button
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        className="absolute top-5 right-5 w-9 h-9 rounded-xl flex items-center justify-center bg-white/60 dark:bg-[#201f1f]/70 backdrop-blur-md text-[#72695f] dark:text-[#c8c6c5]/60 hover:text-[#191615] dark:hover:text-[#e5e2e1] transition-colors"
        aria-label="Toggle theme"
      >
        {resolvedTheme === "dark" ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
        )}
      </button>

      {/* Ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-150 rounded-full bg-[#10b981]/6 dark:bg-[#4edea3]/4 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-75 h-75 rounded-full bg-[#2c968c]/5 dark:bg-[#4ae176]/3 blur-[100px] pointer-events-none" />

      <div className="relative w-full max-w-md mx-6">
        {/* Brand */}
        <div className="text-center mb-10">
          <span className="font-brand text-2xl font-semibold tracking-tight text-[#10b981] dark:text-[#4edea3]">
            luminescent
          </span>
          <p className="text-[#72695f]/80 dark:text-[#c8c6c5]/60 text-sm mt-1 font-sans">AI-Native IDE</p>
        </div>

        {/* Card */}
        <div className="bg-white/60 dark:bg-[#201f1f]/70 backdrop-blur-md rounded-2xl p-8 shadow-[0_8px_24px_rgba(25,22,21,0.06)] dark:shadow-none">
          {success ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-[#10b981]/10 dark:bg-[#4edea3]/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-[#10b981] dark:text-[#4edea3]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="font-serif text-[1.75rem] text-[#191615] dark:text-[#e5e2e1] mb-2">
                Check your email
              </h2>
              <p className="text-[#72695f] dark:text-[#c8c6c5]/60 text-sm font-sans mb-6">
                We sent a confirmation link to{" "}
                <span className="text-[#191615] dark:text-[#e5e2e1]">{email}</span>
              </p>
              <Link
                href="/login"
                className="text-[#10b981] dark:text-[#4edea3] hover:opacity-80 transition-opacity text-sm font-sans"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <h1 className="font-serif text-[1.75rem] leading-tight text-[#191615] dark:text-[#e5e2e1] mb-1">
                Create account
              </h1>
              <p className="text-[#72695f] dark:text-[#c8c6c5]/60 text-sm font-sans mb-8">
                Join your team&apos;s workspace
              </p>

              <form onSubmit={handleRegister} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[#2f2a27] dark:text-[#c8c6c5] text-[0.8125rem] font-sans block">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="w-full bg-[#fffaf3] dark:bg-[#131313] text-[#191615] dark:text-[#e5e2e1] rounded-xl px-4 py-3 text-sm font-sans placeholder:text-[#72695f]/40 dark:placeholder:text-[#c8c6c5]/30 outline-1 outline-[#cbbfaf]/40 dark:outline-[#3c4a42]/20 focus:outline-2 focus:outline-[#10b981]/40 dark:focus:outline-[#4edea3]/30 transition-all duration-200"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[#2f2a27] dark:text-[#c8c6c5] text-[0.8125rem] font-sans block">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full bg-[#fffaf3] dark:bg-[#131313] text-[#191615] dark:text-[#e5e2e1] rounded-xl px-4 py-3 text-sm font-sans placeholder:text-[#72695f]/40 dark:placeholder:text-[#c8c6c5]/30 outline-1 outline-[#cbbfaf]/40 dark:outline-[#3c4a42]/20 focus:outline-2 focus:outline-[#10b981]/40 dark:focus:outline-[#4edea3]/30 transition-all duration-200"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[#2f2a27] dark:text-[#c8c6c5] text-[0.8125rem] font-sans block">
                    Confirm password
                  </label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full bg-[#fffaf3] dark:bg-[#131313] text-[#191615] dark:text-[#e5e2e1] rounded-xl px-4 py-3 text-sm font-sans placeholder:text-[#72695f]/40 dark:placeholder:text-[#c8c6c5]/30 outline-1 outline-[#cbbfaf]/40 dark:outline-[#3c4a42]/20 focus:outline-2 focus:outline-[#10b981]/40 dark:focus:outline-[#4edea3]/30 transition-all duration-200"
                  />
                </div>

                {error && (
                  <p className="text-red-500/90 dark:text-red-400/90 text-[0.8125rem] font-sans bg-red-500/5 dark:bg-red-400/5 rounded-xl px-4 py-3">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 mt-2 rounded-xl font-sans text-sm font-medium text-[#ecfdf5] bg-linear-to-br from-[#4edea3] to-[#10b981] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] hover:opacity-90 active:scale-[0.99] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Creating account…" : "Create account"}
                </button>
              </form>

              <p className="text-[#72695f]/70 dark:text-[#c8c6c5]/50 text-[0.8125rem] text-center mt-6 font-sans">
                Already have an account?{" "}
                <Link href="/login" className="text-[#10b981] dark:text-[#4edea3] hover:opacity-80 transition-opacity">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

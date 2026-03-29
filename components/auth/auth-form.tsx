"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type AuthFormProps = {
  mode: "login" | "register"
}

export function AuthForm({ mode }: AuthFormProps) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  const isRegister = mode === "register"

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError("")

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          name,
          email,
          password,
        }),
      })

      const data = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || "Authentication failed.")
      }

      window.location.assign("/projects")
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Authentication failed.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {isRegister ? (
        <label className="block space-y-2">
          <span className="text-sm font-medium text-foreground">Name</span>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Alex Chiriac"
            autoComplete="name"
            required
          />
        </label>
      ) : null}

      <label className="block space-y-2">
        <span className="text-sm font-medium text-foreground">Email</span>
        <Input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@team.dev"
          autoComplete="email"
          required
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-foreground">Password</span>
        <Input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="At least 8 characters"
          autoComplete={isRegister ? "new-password" : "current-password"}
          required
        />
      </label>

      {error ? <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p> : null}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Please wait..." : isRegister ? "Create account" : "Sign in"}
      </Button>
    </form>
  )
}

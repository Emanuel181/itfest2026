import Link from "next/link"
import { redirect } from "next/navigation"

import { AuthForm } from "@/components/auth/auth-form"
import { getCurrentUser } from "@/lib/server/auth"

export const dynamic = "force-dynamic"

export default async function RegisterPage() {
  const user = await getCurrentUser()
  if (user) {
    redirect("/projects")
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#7c2d12,transparent_30%),linear-gradient(180deg,#0c0a09,#111827)] text-foreground">
      <div className="mx-auto flex min-h-screen max-w-md items-center px-6 py-12">
        <section className="w-full rounded-[28px] border border-white/10 bg-black/35 p-8 shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-white">Create account</h2>
          </div>

          <AuthForm mode="register" />

          <p className="mt-6 text-sm text-slate-300">
            Ai deja cont?{" "}
            <Link href="/login" className="font-semibold text-orange-200 hover:text-orange-100">
              Autentifică-te
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  )
}

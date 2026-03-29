"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

type Tab = "account" | "team" | "members"

type Profile = { id: string; email: string | null; display_name: string | null }
type Team    = { id: string; name: string; owner_id: string }
type Member  = { id: string; user_id: string; role: string; profiles: Profile | null }
type Invite  = { id: string; email: string; token: string; created_at: string; accepted_at: string | null }

export default function SettingsPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("account")
  const [loading, setLoading] = useState(true)

  // Data
  const [userId, setUserId]           = useState<string>("")
  const [profile, setProfile]         = useState<Profile | null>(null)
  const [team, setTeam]               = useState<Team | null>(null)
  const [members, setMembers]         = useState<Member[]>([])
  const [invites, setInvites]         = useState<Invite[]>([])

  // Form states
  const [displayName, setDisplayName] = useState("")
  const [teamName, setTeamName]       = useState("")
  const [inviteEmail, setInviteEmail] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [inviteLink, setInviteLink]   = useState<string | null>(null)

  // Feedback
  const [saving, setSaving]   = useState(false)
  const [msg, setMsg]         = useState<{ text: string; ok: boolean } | null>(null)

  const flash = (text: string, ok = true) => {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 3500)
  }

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace("/login"); return }
    setUserId(user.id)

    // Profile
    const { data: prof } = await supabase
      .from("profiles").select("*").eq("id", user.id).single()
    setProfile(prof)
    setDisplayName(prof?.display_name ?? "")

    // Team (first team the user is a member of)
    const { data: membership } = await supabase
      .from("team_members").select("team_id").eq("user_id", user.id).limit(1).single()

    if (membership) {
      const { data: t } = await supabase
        .from("teams").select("*").eq("id", membership.team_id).single()
      setTeam(t)
      setTeamName(t?.name ?? "")

      // Members
      const { data: m } = await supabase
        .from("team_members")
        .select("id, user_id, role, profiles(id, email, display_name)")
        .eq("team_id", t.id)
      setMembers((m ?? []) as unknown as Member[])

      // Invites
      const { data: inv } = await supabase
        .from("team_invites")
        .select("id, email, token, created_at, accepted_at")
        .eq("team_id", t.id)
        .is("accepted_at", null)
      setInvites(inv ?? [])
    }

    setLoading(false)
  }, [router])

  useEffect(() => { loadData() }, [loadData])

  async function saveProfile() {
    setSaving(true)
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: userId, display_name: displayName }, { onConflict: "id" })
    setSaving(false)
    if (error) { flash(error.message, false) } else { flash("Profile saved.") }
  }

  async function changePassword() {
    if (!newPassword) return
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSaving(false)
    if (error) { flash(error.message, false) } else { flash("Password updated."); setNewPassword("") }
  }

  async function createTeam() {
    setSaving(true)
    const { data: t, error } = await supabase
      .from("teams").insert({ name: teamName || "My Team", owner_id: userId }).select().single()
    if (error) { flash(error.message, false); setSaving(false); return }
    await supabase.from("team_members").insert({ team_id: t.id, user_id: userId, role: "owner" })
    setSaving(false)
    flash("Team created.")
    loadData()
  }

  async function saveTeamName() {
    if (!team) return
    setSaving(true)
    const { error } = await supabase.from("teams").update({ name: teamName }).eq("id", team.id)
    setSaving(false)
    if (error) { flash(error.message, false) } else { flash("Team name saved.") }
  }

  async function inviteMember() {
    if (!team || !inviteEmail.trim()) return
    setSaving(true)
    setInviteLink(null)
    const token = crypto.randomUUID().replace(/-/g, "")

    const { error } = await supabase.from("team_invites").upsert(
      { team_id: team.id, email: inviteEmail.trim(), token, invited_by: userId, accepted_at: null },
      { onConflict: "team_id,email" }
    )
    if (error) { flash(error.message, false); setSaving(false); return }

    const link = `${window.location.origin}/join?token=${token}`

    // Try to send email via service role API
    let emailSent = false
    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), token, origin: window.location.origin }),
      })
      emailSent = res.ok
    } catch {
      emailSent = false
    }

    setSaving(false)
    setInviteLink(link)
    setInviteEmail("")
    loadData()
    flash(emailSent ? `Invite sent to ${inviteEmail.trim()}` : "Invite created — share the link below.")
  }

  async function revokeInvite(inviteId: string) {
    await supabase.from("team_invites").delete().eq("id", inviteId)
    flash("Invite revoked.")
    loadData()
  }

  async function removeMember(memberId: string, memberUserId: string) {
    if (memberUserId === userId) { flash("You can't remove yourself.", false); return }
    await supabase.from("team_members").delete().eq("id", memberId)
    flash("Member removed.")
    loadData()
  }

  const inputCls = "w-full bg-[#fffaf3] dark:bg-[#131313] text-[#191615] dark:text-[#e5e2e1] rounded-xl px-4 py-3 text-sm font-sans placeholder:text-[#72695f]/40 dark:placeholder:text-[#c8c6c5]/30 outline-1 outline-[#cbbfaf]/40 dark:outline-[#3c4a42]/20 focus:outline-2 focus:outline-[#10b981]/40 dark:focus:outline-[#4edea3]/30 transition-all duration-200"
  const btnPrimary = "px-5 py-2.5 rounded-xl text-sm font-medium font-sans text-[#ecfdf5] bg-linear-to-br from-[#4edea3] to-[#10b981] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] hover:opacity-90 transition-opacity disabled:opacity-50"
  const btnDanger = "px-4 py-2 rounded-xl text-sm font-medium font-sans text-red-500 dark:text-red-400 bg-red-500/5 hover:bg-red-500/10 transition-colors"

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f0e8] dark:bg-[#131313]" />
  )

  const isOwner = team?.owner_id === userId

  return (
    <div className="min-h-screen bg-[#f5f0e8] dark:bg-[#131313] font-sans">
      {/* Header */}
      <div className="border-b border-[#cbbfaf]/20 dark:border-[#3c4a42]/20 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-[#72695f] dark:text-[#c8c6c5]/60 hover:text-[#191615] dark:hover:text-[#e5e2e1] transition-colors text-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
          Back to workspace
        </Link>
        <span className="font-brand text-base font-semibold text-[#10b981] dark:text-[#4edea3]">luminescent</span>
        <Link href="/logout" className="text-sm text-[#72695f]/70 dark:text-[#c8c6c5]/40 hover:text-red-500 dark:hover:text-red-400 transition-colors">
          Sign out
        </Link>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10 flex gap-8">
        {/* Sidebar */}
        <aside className="w-44 shrink-0">
          <p className="text-[0.6875rem] font-medium uppercase tracking-widest text-[#72695f]/60 dark:text-[#c8c6c5]/40 mb-3 px-3">Settings</p>
          {(["account", "team", "members"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`w-full text-left px-3 py-2 rounded-xl text-sm capitalize mb-1 transition-colors ${
                tab === t
                  ? "bg-[#10b981]/10 dark:bg-[#4edea3]/10 text-[#10b981] dark:text-[#4edea3] font-medium"
                  : "text-[#72695f] dark:text-[#c8c6c5]/60 hover:text-[#191615] dark:hover:text-[#e5e2e1]"
              }`}
            >
              {t}
            </button>
          ))}
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0">
          {/* Flash message */}
          {msg && (
            <div className={`mb-6 px-4 py-3 rounded-xl text-sm ${msg.ok ? "bg-[#10b981]/10 text-[#10b981] dark:text-[#4edea3]" : "bg-red-500/10 text-red-500 dark:text-red-400"}`}>
              {msg.text}
            </div>
          )}

          {/* ── Account ── */}
          {tab === "account" && (
            <div className="space-y-8">
              <div>
                <h2 className="font-serif text-[1.75rem] text-[#191615] dark:text-[#e5e2e1] mb-1">Account</h2>
                <p className="text-sm text-[#72695f] dark:text-[#c8c6c5]/60">Your personal details.</p>
              </div>

              <div className="bg-white/60 dark:bg-[#201f1f]/70 backdrop-blur-md rounded-2xl p-6 space-y-5 shadow-[0_8px_24px_rgba(25,22,21,0.06)] dark:shadow-none">
                <div className="space-y-2">
                  <label className="text-[0.8125rem] text-[#2f2a27] dark:text-[#c8c6c5] block">Email</label>
                  <input value={profile?.email ?? ""} disabled className={`${inputCls} opacity-50 cursor-not-allowed`} />
                </div>
                <div className="space-y-2">
                  <label className="text-[0.8125rem] text-[#2f2a27] dark:text-[#c8c6c5] block">Display name</label>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                    className={inputCls}
                  />
                </div>
                <button onClick={saveProfile} disabled={saving} className={btnPrimary}>
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>

              <div className="bg-white/60 dark:bg-[#201f1f]/70 backdrop-blur-md rounded-2xl p-6 space-y-5 shadow-[0_8px_24px_rgba(25,22,21,0.06)] dark:shadow-none">
                <div>
                  <h3 className="text-sm font-medium text-[#191615] dark:text-[#e5e2e1] mb-1">Change password</h3>
                  <p className="text-[0.8125rem] text-[#72695f] dark:text-[#c8c6c5]/60">Leave blank to keep your current password.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-[0.8125rem] text-[#2f2a27] dark:text-[#c8c6c5] block">New password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className={inputCls}
                  />
                </div>
                <button onClick={changePassword} disabled={saving || !newPassword} className={btnPrimary}>
                  {saving ? "Updating…" : "Update password"}
                </button>
              </div>
            </div>
          )}

          {/* ── Team ── */}
          {tab === "team" && (
            <div className="space-y-8">
              <div>
                <h2 className="font-serif text-[1.75rem] text-[#191615] dark:text-[#e5e2e1] mb-1">Team</h2>
                <p className="text-sm text-[#72695f] dark:text-[#c8c6c5]/60">Manage your team settings.</p>
              </div>

              <div className="bg-white/60 dark:bg-[#201f1f]/70 backdrop-blur-md rounded-2xl p-6 space-y-5 shadow-[0_8px_24px_rgba(25,22,21,0.06)] dark:shadow-none">
                {!team ? (
                  <div className="space-y-4">
                    <p className="text-sm text-[#72695f] dark:text-[#c8c6c5]/60">You don&apos;t have a team yet.</p>
                    <div className="space-y-2">
                      <label className="text-[0.8125rem] text-[#2f2a27] dark:text-[#c8c6c5] block">Team name</label>
                      <input
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        placeholder="My Team"
                        className={inputCls}
                      />
                    </div>
                    <button onClick={createTeam} disabled={saving} className={btnPrimary}>
                      {saving ? "Creating…" : "Create team"}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-[0.8125rem] text-[#2f2a27] dark:text-[#c8c6c5] block">Team name</label>
                      <input
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        disabled={!isOwner}
                        className={`${inputCls} ${!isOwner ? "opacity-50 cursor-not-allowed" : ""}`}
                      />
                    </div>
                    {isOwner && (
                      <button onClick={saveTeamName} disabled={saving} className={btnPrimary}>
                        {saving ? "Saving…" : "Save"}
                      </button>
                    )}
                    <div className="pt-2">
                      <p className="text-[0.6875rem] text-[#72695f]/60 dark:text-[#c8c6c5]/40 uppercase tracking-widest">Team ID</p>
                      <p className="text-xs font-mono text-[#72695f] dark:text-[#c8c6c5]/60 mt-1">{team.id}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Members ── */}
          {tab === "members" && (
            <div className="space-y-8">
              <div>
                <h2 className="font-serif text-[1.75rem] text-[#191615] dark:text-[#e5e2e1] mb-1">Members</h2>
                <p className="text-sm text-[#72695f] dark:text-[#c8c6c5]/60">Manage who has access to your team.</p>
              </div>

              {!team ? (
                <p className="text-sm text-[#72695f] dark:text-[#c8c6c5]/60">Create a team first to manage members.</p>
              ) : (
                <>
                  {/* Invite */}
                  {isOwner && (
                    <div className="bg-white/60 dark:bg-[#201f1f]/70 backdrop-blur-md rounded-2xl p-6 space-y-4 shadow-[0_8px_24px_rgba(25,22,21,0.06)] dark:shadow-none">
                      <h3 className="text-sm font-medium text-[#191615] dark:text-[#e5e2e1]">Invite member</h3>
                      <div className="flex gap-3">
                        <input
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="colleague@example.com"
                          className={`${inputCls} flex-1`}
                          onKeyDown={(e) => e.key === "Enter" && inviteMember()}
                        />
                        <button onClick={inviteMember} disabled={saving || !inviteEmail} className={btnPrimary}>
                          {saving ? "…" : "Invite"}
                        </button>
                      </div>
                      {inviteLink && (
                        <div className="bg-[#10b981]/5 dark:bg-[#4edea3]/5 rounded-xl p-4 space-y-2">
                          <p className="text-[0.8125rem] text-[#10b981] dark:text-[#4edea3] font-medium">Invite link generated</p>
                          <div className="flex gap-2 items-center">
                            <p className="text-xs font-mono text-[#72695f] dark:text-[#c8c6c5]/60 truncate flex-1">{inviteLink}</p>
                            <button
                              onClick={() => { navigator.clipboard.writeText(inviteLink); flash("Copied!") }}
                              className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-[#10b981]/10 dark:bg-[#4edea3]/10 text-[#10b981] dark:text-[#4edea3] hover:opacity-80 transition-opacity"
                            >
                              Copy
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Members list */}
                  <div className="bg-white/60 dark:bg-[#201f1f]/70 backdrop-blur-md rounded-2xl overflow-hidden shadow-[0_8px_24px_rgba(25,22,21,0.06)] dark:shadow-none">
                    <div className="px-6 py-4 border-b border-[#cbbfaf]/20 dark:border-[#3c4a42]/20">
                      <h3 className="text-sm font-medium text-[#191615] dark:text-[#e5e2e1]">{members.length} member{members.length !== 1 ? "s" : ""}</h3>
                    </div>
                    <ul>
                      {members.map((m) => (
                        <li key={m.id} className="flex items-center justify-between px-6 py-4 border-b border-[#cbbfaf]/10 dark:border-[#3c4a42]/10 last:border-0">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#10b981]/10 dark:bg-[#4edea3]/10 flex items-center justify-center text-[#10b981] dark:text-[#4edea3] text-xs font-medium">
                              {(m.profiles?.display_name ?? m.profiles?.email ?? "?")[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm text-[#191615] dark:text-[#e5e2e1]">
                                {m.profiles?.display_name ?? m.profiles?.email ?? "Unknown"}
                              </p>
                              {m.profiles?.display_name && (
                                <p className="text-xs text-[#72695f] dark:text-[#c8c6c5]/50">{m.profiles?.email}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${
                              m.role === "owner"
                                ? "bg-[#10b981]/10 dark:bg-[#4edea3]/10 text-[#10b981] dark:text-[#4edea3]"
                                : "bg-[#ece4d8] dark:bg-[#131313] text-[#72695f] dark:text-[#c8c6c5]/60"
                            }`}>
                              {m.role}
                            </span>
                            {isOwner && m.user_id !== userId && (
                              <button onClick={() => removeMember(m.id, m.user_id)} className={btnDanger}>
                                Remove
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Pending invites */}
                  {isOwner && invites.length > 0 && (
                    <div className="bg-white/60 dark:bg-[#201f1f]/70 backdrop-blur-md rounded-2xl overflow-hidden shadow-[0_8px_24px_rgba(25,22,21,0.06)] dark:shadow-none">
                      <div className="px-6 py-4 border-b border-[#cbbfaf]/20 dark:border-[#3c4a42]/20">
                        <h3 className="text-sm font-medium text-[#191615] dark:text-[#e5e2e1]">Pending invites</h3>
                      </div>
                      <ul>
                        {invites.map((inv) => (
                          <li key={inv.id} className="flex items-center justify-between px-6 py-4 border-b border-[#cbbfaf]/10 dark:border-[#3c4a42]/10 last:border-0">
                            <div>
                              <p className="text-sm text-[#191615] dark:text-[#e5e2e1]">{inv.email}</p>
                              <p className="text-xs text-[#72695f] dark:text-[#c8c6c5]/50">
                                Invited {new Date(inv.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/join?token=${inv.token}`); flash("Copied!") }}
                                className="text-xs px-3 py-1.5 rounded-lg bg-[#10b981]/10 dark:bg-[#4edea3]/10 text-[#10b981] dark:text-[#4edea3] hover:opacity-80 transition-opacity"
                              >
                                Copy link
                              </button>
                              <button onClick={() => revokeInvite(inv.id)} className={btnDanger}>
                                Revoke
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

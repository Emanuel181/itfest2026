"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

// ---------------------------------------------------------------------------
// Shared sidebar — same as implementation & merge pages
// ---------------------------------------------------------------------------
function Sidebar() {
  const navItems = [
    { label: "Ideation", icon: "lightbulb", href: "#" },
    { label: "Requirements", icon: "assignment", href: "#" },
    { label: "User Stories", icon: "group", href: "#" },
    { label: "Planning", icon: "event_note", href: "#" },
    { label: "Implementation", icon: "code", href: "/implementation" },
    { label: "Security", icon: "security", href: "#" },
    { label: "Merge", icon: "call_merge", href: "/merge" },
    { label: "Dashboard", icon: "dashboard", href: "/dashboard" },
  ];

  return (
    <aside className="fixed left-0 top-16 h-[calc(100vh-64px)] flex flex-col p-4 z-40 bg-[#201f1f] w-64 border-r border-[#3c4a42]/20">
      <div className="flex items-center gap-3 mb-8 px-2">
        <div className="w-10 h-10 rounded-xl bg-[#353534] flex items-center justify-center text-[#4edea3]">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>terminal</span>
        </div>
        <div>
          <h3 className="text-lg font-bold text-white leading-none font-serif">Core Engine</h3>
          <p className="text-[10px] text-[#4edea3] font-medium tracking-widest uppercase mt-1">v2.4.0-stable</p>
        </div>
      </div>
      <nav className="flex-1 flex flex-col gap-y-1">
        {navItems.map((item) => {
          const isActive = item.label === "Dashboard";
          return (
            <a
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                isActive
                  ? "bg-[#353534] text-[#4edea3] border-l-4 border-[#10b981] translate-x-1"
                  : "text-[#c8c6c5] hover:bg-[#353534]/50"
              )}
            >
              <span className="material-symbols-outlined" style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                {item.icon}
              </span>
              <span className="text-[11px] font-medium uppercase tracking-wider">{item.label}</span>
            </a>
          );
        })}
      </nav>
      <div className="mt-auto pt-6 border-t border-[#3c4a42]/20 flex flex-col gap-1">
        <button className="mb-4 bg-[#4edea3]/10 text-[#4edea3] border border-[#4edea3]/20 py-2 rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-[#4edea3]/20 transition-all">
          New Branch
        </button>
        <a className="flex items-center gap-3 text-[#c8c6c5] px-4 py-2 hover:bg-[#353534]/50 rounded-xl transition-all" href="#">
          <span className="material-symbols-outlined text-sm">help</span>
          <span className="text-[11px] font-medium uppercase tracking-wider">Support</span>
        </a>
        <a className="flex items-center gap-3 text-[#c8c6c5] px-4 py-2 hover:bg-[#353534]/50 rounded-xl transition-all" href="#">
          <span className="material-symbols-outlined text-sm">settings</span>
          <span className="text-[11px] font-medium uppercase tracking-wider">Settings</span>
        </a>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Right panel — Agent Activity Feed (same pattern as implementation page)
// ---------------------------------------------------------------------------
function AgentActivityFeed() {
  const logs = [
    { agent: "REVIEW AGENT", color: "text-[#4edea3]", border: "border-[#4edea3]", msg: "Parsing 5.4GB of post-deploy log data. Identifying outlier spikes in Redis latency.", time: "09:42 AM", progress: 42 },
    { agent: "REVIEW AGENT", color: "text-[#4edea3]", border: "border-[#4edea3]", msg: "Sentiment engine processed 142 reviews. 92% Positive Correlation.", time: "09:38 AM" },
    { agent: "SECURITY AUDITOR", color: "text-[#4ae176]", border: "border-[#4ae176]", msg: "Health Check: All systems nominal.", time: "09:15 AM" },
    { agent: "DEPLOYMENT BOT", color: "text-[#6ffbbe]", border: "border-[#6ffbbe]", msg: "Deployment Completed: Build #8421", time: "08:50 AM", faded: true },
  ];

  return (
    <aside className="fixed right-0 top-16 h-[calc(100vh-64px)] w-80 bg-[#1c1b1b] p-4 flex flex-col border-l border-[#3c4a42]/20">
      <div className="flex items-center justify-between mb-6 px-2">
        <h3 className="text-sm font-bold uppercase tracking-widest text-white">Agent Activity</h3>
        <span className="flex items-center gap-1.5 bg-[#4edea3]/20 px-2 py-0.5 rounded-full text-[10px] text-[#4edea3] font-bold">
          <span className="w-1.5 h-1.5 bg-[#4edea3] rounded-full animate-pulse" />
          Live
        </span>
      </div>
      <ScrollArea className="flex-1 pr-2">
        <div className="space-y-3">
          {logs.map((log, i) => (
            <div key={i} className={cn("p-3 rounded-xl border-l-2 bg-[#2a2a2a]/40", log.border, log.faded && "opacity-50")}>
              <div className="flex justify-between items-start mb-1">
                <span className={cn("text-[10px] font-bold", log.color)}>{log.agent}</span>
                <span className="text-[9px] text-[#c8c6c5]/40 font-mono">{log.time}</span>
              </div>
              <p className="text-xs text-[#e5e2e1] leading-tight">{log.msg}</p>
              {log.progress !== undefined && (
                <div className="mt-2 w-full bg-[#201f1f] h-1 rounded-full overflow-hidden">
                  <div className="bg-[#4edea3] h-full rounded-full" style={{ width: `${log.progress}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
      {/* AI Command box — same as other pages */}
      <div className="mt-4 p-4 bg-[#4edea3]/5 rounded-2xl border border-[#4edea3]/10">
        <div className="flex items-center gap-3 mb-3">
          <span className="material-symbols-outlined text-[#4edea3]">auto_fix_high</span>
          <span className="text-xs font-bold text-[#e5e2e1]">AI Command</span>
        </div>
        <div className="relative">
          <textarea
            className="w-full bg-[#0e0e0e] border-none rounded-xl p-3 text-xs text-[#e5e2e1] resize-none focus:ring-1 focus:ring-[#4edea3]/20 placeholder:text-[#c8c6c5]/30 outline-none"
            placeholder="Ask review agent..."
            rows={2}
          />
          <button className="absolute bottom-2 right-2 p-1.5 bg-[#4edea3] rounded-lg text-[#003824] transition-transform active:scale-90">
            <span className="material-symbols-outlined text-lg">arrow_upward</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Content panels
// ---------------------------------------------------------------------------
const MOCK_REVIEWS = [
  { name: "Alex Rivera", avatar: "AR", sentiment: "Positive", sentimentColor: "bg-[#4edea3]/10 text-[#4edea3]", text: "The telemetry processing speed has improved significantly. Real-time graphs are actually real-time now. Great job on the latency fix!", time: "2 hours ago", likes: 14 },
  { name: "Sarah Chen", avatar: "SC", sentiment: "Neutral", sentimentColor: "bg-[#474746]/50 text-[#c8c6c5]", text: "UI is snappy, but noticed some memory creep when keeping the dashboard open for more than 4 hours. Might need a quick GC tune.", time: "5 hours ago", likes: 3 },
];

function AppReviewPanel() {
  return (
    <section className="bg-[#1c1b1b] rounded-2xl p-6 border border-[#3c4a42]/20">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#4ae176]/10 rounded-xl">
            <span className="material-symbols-outlined text-[#4ae176]">forum</span>
          </div>
          <h3 className="font-serif text-xl text-[#e5e2e1]">App Review</h3>
        </div>
        <div className="flex items-center gap-4 bg-[#0e0e0e] px-4 py-2 rounded-xl">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-[#4edea3]">4.8</span>
            <span className="text-[#c8c6c5] text-xs font-medium">/ 5.0</span>
          </div>
          <span className="text-yellow-400 tracking-tight">★★★★½</span>
        </div>
      </div>
      <div className="space-y-4">
        {MOCK_REVIEWS.map((r) => (
          <div key={r.name} className="bg-[#201f1f] p-5 rounded-2xl flex gap-4 hover:bg-[#2a2a2a] transition-colors">
            <div className="w-10 h-10 rounded-full bg-[#353534] flex items-center justify-center text-[#4edea3] text-xs font-bold shrink-0">{r.avatar}</div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-sm text-[#e5e2e1]">{r.name}</span>
                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded", r.sentimentColor)}>{r.sentiment}</span>
              </div>
              <p className="text-[#c8c6c5] text-sm leading-relaxed mb-3">{r.text}</p>
              <div className="flex items-center gap-4 text-[10px] text-[#86948a]">
                <span>{r.time}</span>
                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-xs">thumb_up</span> {r.likes}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-8 flex justify-center">
        <button className="text-[#4edea3] text-sm font-bold border border-[#4edea3]/20 hover:bg-[#4edea3]/5 px-8 py-3 rounded-xl transition-all flex items-center gap-2">
          Request More Feedback
          <span className="material-symbols-outlined text-lg">send</span>
        </button>
      </div>
    </section>
  );
}

function AgentAuditPanel() {
  return (
    <section className="bg-[#1c1b1b] rounded-2xl overflow-hidden border border-[#3c4a42]/20">
      <div className="p-6 border-b border-[#3c4a42]/20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#4edea3]/10 rounded-xl">
            <span className="material-symbols-outlined text-[#4edea3]">psychology</span>
          </div>
          <h3 className="font-serif text-xl text-[#e5e2e1]">Agent Review Audit</h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#86948a] font-medium">Efficiency Score</span>
          <div className="relative w-16 h-16 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" fill="transparent" stroke="#353534" strokeWidth="4" />
              <circle cx="32" cy="32" r="28" fill="transparent" stroke="#4edea3" strokeWidth="4" strokeDasharray="175.9" strokeDashoffset="10.5" strokeLinecap="round" />
            </svg>
            <span className="absolute text-sm font-black text-[#e5e2e1]">94%</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 divide-x divide-[#3c4a42]/20">
        <div className="p-6 space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-widest text-[#4edea3] flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">bolt</span>
            Optimization Suggestions
          </h4>
          <ul className="space-y-3">
            {[
              { title: "Refactor Memory Management", desc: "Backend Agent is holding large buffers for telemetry chunks. Implement streaming cleanup." },
              { title: "Minimize CSS Bundle", desc: "Found 12 unused component styles. Removal will save ~45KB on initial load." },
            ].map((s) => (
              <li key={s.title} className="bg-[#353534]/30 p-4 rounded-xl border border-[#4edea3]/10">
                <p className="text-sm font-bold text-[#e5e2e1] mb-1">{s.title}</p>
                <p className="text-xs text-[#c8c6c5] leading-relaxed">{s.desc}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="p-6 bg-[#0e0e0e]/50">
          <h4 className="text-xs font-bold uppercase tracking-widest text-[#4ae176] flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-sm">history_edu</span>
            Self-Correction Log
          </h4>
          <div className="space-y-4 font-mono text-[11px] leading-relaxed opacity-80">
            {[
              { time: "14:22:04", tag: "CORRECTION", msg: "Detected circular dependency in ", file: "AuthService.ts", rest: ". Refactored to interface injection." },
              { time: "14:25:31", tag: "REVERT", msg: "Rollback of API schema change on ", file: "v1/telemetry", rest: ". Original schema retained to maintain legacy compat." },
              { time: "14:28:12", tag: "FIX", msg: "Misaligned closing tag in ", file: "DashboardLayout.vue", rest: ". Automatically patched before merge." },
            ].map((l) => (
              <div key={l.time} className="flex gap-3">
                <span className="text-[#86948a] shrink-0">{l.time}</span>
                <p className="text-[#e5e2e1]">
                  <span className="text-[#4edea3]">[{l.tag}]</span>{" "}{l.msg}
                  <span className="text-[#4ae176]">{l.file}</span>{l.rest}
                </p>
              </div>
            ))}
            <div className="flex gap-3">
              <span className="text-[#86948a] shrink-0">14:30:00</span>
              <p className="text-[#4ae176]">All self-corrections verified against CI/CD test suite.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function OverviewPanel({ stories }: { stories: Array<{ id: string; variant: string }> }) {
  const storyTitles: Record<string, string> = { "STORY-102": "Real-time Telemetry", "STORY-105": "Adaptive Load Balancing" };
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Stories Merged", value: stories.length.toString(), icon: "call_merge", color: "text-[#4edea3]" },
          { label: "Compliance Score", value: "94%", icon: "verified_user", color: "text-[#4ae176]" },
          { label: "Conflicts", value: "0", icon: "check_circle", color: "text-[#4edea3]" },
          { label: "Bundle Size", value: "12.4 MB", icon: "storage", color: "text-[#6ffbbe]" },
        ].map((m) => (
          <div key={m.label} className="bg-[#1c1b1b] p-5 rounded-2xl border border-[#3c4a42]/20 flex flex-col gap-2">
            <span className={cn("material-symbols-outlined", m.color)}>{m.icon}</span>
            <span className={cn("text-2xl font-black font-serif", m.color)}>{m.value}</span>
            <span className="text-[10px] text-[#c8c6c5] uppercase tracking-widest">{m.label}</span>
          </div>
        ))}
      </div>
      <div className="bg-[#1c1b1b] rounded-2xl border border-[#3c4a42]/20 overflow-hidden">
        <div className="p-5 border-b border-[#3c4a42]/20">
          <h3 className="text-sm font-bold text-[#e5e2e1] font-serif">Story Status</h3>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#3c4a42]/20">
              {["Story ID", "Title", "Variant", "Security", "Status"].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[#86948a]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stories.map((s) => (
              <tr key={s.id} className="border-b border-[#3c4a42]/10 hover:bg-[#2a2a2a] transition-colors">
                <td className="px-5 py-4 font-mono text-[#10b981] font-bold">{s.id}</td>
                <td className="px-5 py-4 text-[#e5e2e1]">{storyTitles[s.id] ?? s.id}</td>
                <td className="px-5 py-4"><span className="bg-[#4edea3]/10 text-[#4edea3] px-2 py-0.5 rounded font-bold">Variant {s.variant}</span></td>
                <td className="px-5 py-4"><span className="text-[#4ae176] flex items-center gap-1"><span className="material-symbols-outlined text-sm">verified_user</span>Passed</span></td>
                <td className="px-5 py-4"><span className="bg-[#4ae176]/10 text-[#4ae176] px-2 py-0.5 rounded font-bold">Merged</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
type ActiveTab = "overview" | "review" | "agent";

function DashboardInner() {
  const searchParams = useSearchParams();
  const storiesParam = searchParams.get("stories") ?? "STORY-102:B,STORY-105:A";
  const stories = storiesParam.split(",").map((s) => {
    const [id, variant] = s.split(":");
    return { id, variant };
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>("review");
  const firstStory = stories[0] ?? { id: "STORY-102", variant: "B" };
  const storyTitles: Record<string, string> = { "STORY-102": "Real-time Telemetry Processing", "STORY-105": "Adaptive Load Balancing" };

  const tabs: Array<{ id: ActiveTab; label: string; icon: string }> = [
    { id: "overview", label: "Overview", icon: "dashboard" },
    { id: "review", label: "App Review", icon: "rate_review" },
    { id: "agent", label: "Agent Analysis", icon: "psychology" },
  ];

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      <style>{`.material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; font-family: 'Material Symbols Outlined'; }`}</style>

      {/* Top Nav — identical to other pages */}
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-16 bg-[#131313] border-b border-[#3c4a42]/20">
        <div className="flex items-center gap-8">
          <span className="text-xl font-bold text-[#4edea3] tracking-tight font-serif">Luminescent IDE</span>
          <nav className="hidden md:flex gap-6">
            {["Docs", "Architecture", "Logs"].map((l) => (
              <a key={l} className="text-[#c8c6c5] hover:text-white transition-colors duration-200 py-1 text-sm" href="#">{l}</a>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <input className="bg-[#201f1f] border-none rounded-xl px-4 py-2 text-sm text-[#e5e2e1] focus:ring-2 focus:ring-[#4edea3]/30 w-64 outline-none transition-all" placeholder="Search architecture..." type="text" />
            <span className="material-symbols-outlined absolute right-3 top-2 text-[#c8c6c5] text-xl">search</span>
          </div>
          <button className="bg-[#201f1f] text-[#c8c6c5] px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#353534] transition-colors">Share</button>
          <button className="primary-gradient text-[#003824] px-5 py-2 rounded-xl text-sm font-bold shadow-lg shadow-[#4edea3]/10">Run Agents</button>
          <div className="flex gap-2 ml-2">
            <span className="material-symbols-outlined text-[#c8c6c5] cursor-pointer hover:text-[#4edea3] transition-colors">notifications</span>
            <span className="material-symbols-outlined text-[#c8c6c5] cursor-pointer hover:text-[#4edea3] transition-colors">settings</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-[#353534] border border-[#3c4a42]/30 flex items-center justify-center text-[#4edea3] text-xs font-bold">E</div>
        </div>
      </header>

      <div className="flex h-screen pt-16">
        <Sidebar />

        {/* Main content — same ml-64 mr-80 pattern */}
        <main className="ml-64 mr-80 flex-1 p-6 overflow-y-auto bg-[#131313] ide-scroll">
          <div className="max-w-5xl mx-auto space-y-8">

            {/* Page header */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#3c4a42]/20 pb-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="bg-[#4edea3]/10 text-[#4edea3] text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest">{firstStory.id}</span>
                  <span className="text-[#c8c6c5] text-xs">{storyTitles[firstStory.id] ?? firstStory.id}</span>
                </div>
                <h1 className="text-3xl font-bold text-[#e5e2e1] font-serif">Post-Deployment Analysis</h1>
              </div>
              <div className="flex gap-3">
                <button className="bg-[#2a2a2a] text-[#e5e2e1] px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#353534] transition-colors flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg">share</span>
                  Share Report
                </button>
                <button className="primary-gradient text-[#003824] px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 active:scale-95 transition-all shadow-lg shadow-[#4edea3]/10">
                  <span className="material-symbols-outlined text-lg">refresh</span>
                  Rerun Audit
                </button>
              </div>
            </header>

            {/* Inner tab nav */}
            <div className="flex gap-1 bg-[#201f1f] p-1 rounded-xl border border-[#3c4a42]/20 w-fit">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-all",
                    activeTab === t.id
                      ? "bg-[#353534] text-[#4edea3]"
                      : "text-[#c8c6c5] hover:text-[#e5e2e1]"
                  )}
                >
                  <span className="material-symbols-outlined text-sm">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {activeTab === "overview" && <OverviewPanel stories={stories} />}
            {activeTab === "review" && (
              <div className="space-y-6">
                <AppReviewPanel />
                <AgentAuditPanel />
              </div>
            )}
            {activeTab === "agent" && <AgentAuditPanel />}
          </div>
        </main>

        <AgentActivityFeed />
      </div>
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-[#131313] text-[#4edea3] text-sm font-mono">
        Loading project review...
      </div>
    }>
      <DashboardInner />
    </Suspense>
  );
}

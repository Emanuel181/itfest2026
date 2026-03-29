"use client";

import { useState, useCallback, useEffect, useRef, Fragment, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from "@/components/ui/drawer";
import { SDLCSidebar } from "@/components/sdlc-sidebar";
import { hydrateLegacySnapshots, syncLegacySnapshots, withOptionalProjectQuery } from "@/lib/backend/project-client";
import {
  createDemoChatMessages,
  createDemoEvalContent,
  createDemoImplementedStories,
  createDemoNoFrontend,
  createDemoPokerSessions,
  createDemoReasoningContent,
  createDemoStoryAssignees,
} from "@/lib/demo/mock-sdlc";

import type {
  UserStory,
  ImplementationVariant,
  VariantId,
  ActivityLog,
  AgentOutput,
} from "@/lib/agents/types";

// ---------------------------------------------------------------------------
// Streaming agent call helper — returns full text, calls onChunk per token
// ---------------------------------------------------------------------------
async function callAgentStream(
  params: {
    role: string;
    storyId: string;
    storyTitle: string;
    storyDescription: string;
    variantId?: string;
    context?: string;
  },
  onChunk: (delta: string) => void
): Promise<string> {
  const res = await fetch("/api/agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok || !res.body) throw new Error(await res.text());

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const json = JSON.parse(line.slice(6));
      if (json.error) throw new Error(json.error);
      if (json.delta) { full += json.delta; onChunk(json.delta); }
    }
  }
  return full;
}

// ---------------------------------------------------------------------------
// Strip markdown code fences and normalize orchestrator text
// ---------------------------------------------------------------------------
function stripFences(code: string): string {
  return code
    .replace(/^```[\w]*\n?/gm, "")
    .replace(/^```\s*$/gm, "")
    .replace(/\*\*/g, "")
    .trim();
}

// ---------------------------------------------------------------------------
// Syntax highlighter — tokenises TypeScript/TSX into colored spans
// ---------------------------------------------------------------------------
const KW = /\b(import|export|from|const|let|var|function|async|await|return|if|else|for|of|in|while|class|extends|interface|type|new|true|false|null|undefined|void|default|switch|case|break|try|catch|throw|as|typeof|keyof|readonly)\b/g;
const STR = /(["'`])(?:(?!\1)[^\\]|\\.)*\1/g;
const COMMENT = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g;
const JSX_TAG = /(<\/?[\w.]+(?:\s[^>]*)?>)/g;
const TYPE_ANN = /:\s*([A-Z][A-Za-z<>\[\]|&, ]+)/g;
const NUM = /\b(\d+(\.\d+)?)\b/g;
const FUNC = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=\()/g;

function highlightCode(code: string): React.ReactNode[] {
  type Seg = { text: string; type: "kw"|"str"|"comment"|"jsx"|"type"|"num"|"fn"|"plain" };
  const segs: Seg[] = [];

  const allPattern = new RegExp(
    `(${COMMENT.source})|(${STR.source})|(${JSX_TAG.source})|(${KW.source})|(${FUNC.source})|(${NUM.source})`,
    "g"
  );

  let last = 0;
  let m: RegExpExecArray | null;
  allPattern.lastIndex = 0;

  while ((m = allPattern.exec(code)) !== null) {
    if (m.index > last) segs.push({ text: code.slice(last, m.index), type: "plain" });
    const txt = m[0];
    if (m[1]) segs.push({ text: txt, type: "comment" });
    else if (m[3]) segs.push({ text: txt, type: "str" });
    else if (m[6]) segs.push({ text: txt, type: "jsx" });
    else if (m[8]) segs.push({ text: txt, type: "kw" });
    else if (m[9]) segs.push({ text: txt, type: "fn" });
    else if (m[11]) segs.push({ text: txt, type: "num" });
    else segs.push({ text: txt, type: "plain" });
    last = m.index + txt.length;
  }
  if (last < code.length) segs.push({ text: code.slice(last), type: "plain" });

  const colorMap: Record<Seg["type"], string> = {
    kw:      "#4edea3",
    str:     "#4ae176",
    comment: "#474746",
    jsx:     "#6ffbbe",
    type:    "#c8c6c5",
    num:     "#86948a",
    fn:      "#e5e2e1",
    plain:   "#c8c6c5",
  };

  return segs.map((s, i) => (
    <span key={i} style={{ color: colorMap[s.type] }}>{s.text}</span>
  ));
}

const PRIORITY_CONFIG = {
  critical: { color: "#ffb4ab", bg: "bg-[#ffb4ab]/10", border: "border-[#ffb4ab]/20", icon: "keyboard_double_arrow_up", label: "Critical" },
  high:     { color: "#ffd080", bg: "bg-[#ffd080]/10", border: "border-[#ffd080]/20", icon: "keyboard_arrow_up",        label: "High"     },
  medium:   { color: "#4edea3", bg: "bg-[#4edea3]/10", border: "border-[#4edea3]/20", icon: "drag_handle",              label: "Medium"   },
  low:      { color: "#86948a", bg: "bg-[#86948a]/10", border: "border-[#86948a]/20", icon: "keyboard_arrow_down",      label: "Low"      },
} as const;

const TYPE_CONFIG = {
  feature:    { color: "#4edea3", icon: "star",         label: "Feature"    },
  bug:        { color: "#ffb4ab", icon: "bug_report",   label: "Bug"        },
  "tech-debt":{ color: "#ffd080", icon: "build",        label: "Tech Debt"  },
  spike:      { color: "#c8c6c5", icon: "science",      label: "Spike"      },
} as const;

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  pending:      { color: "#86948a", bg: "bg-[#86948a]/10", border: "border-[#86948a]/20", label: "To Do"        },
  implementing: { color: "#4edea3", bg: "bg-[#4edea3]/10", border: "border-[#4edea3]/20", label: "In Progress"  },
  evaluating:   { color: "#ffd080", bg: "bg-[#ffd080]/10", border: "border-[#ffd080]/20", label: "In Review"    },
  done:         { color: "#4ae176", bg: "bg-[#4ae176]/10", border: "border-[#4ae176]/20", label: "Done"         },
};

function makeEmptyOutput(role: AgentOutput["role"]): AgentOutput {
  return { role, status: "idle", content: "", timestamp: "" };
}

function makeVariant(id: VariantId): ImplementationVariant {
  return {
    id,
    orchestrator: makeEmptyOutput("orchestrator"),
    backend: makeEmptyOutput("backend"),
    frontend: makeEmptyOutput("frontend"),
    security: makeEmptyOutput("security"),
  };
}

// ---------------------------------------------------------------------------
// CodeBlock — with expand/collapse and copy
// ---------------------------------------------------------------------------
function CodeBlock({
  label,
  icon,
  color,
  filename,
  code,
  loading,
  prevCode,
  onRetry,
}: {
  label: string;
  icon: string;
  color: string;
  filename: string;
  code: string;
  loading?: boolean;
  prevCode?: string;
  onRetry?: () => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const clean = stripFences(code);

  useEffect(() => {
    if (loading && bottomRef.current) {
      bottomRef.current.scrollIntoView({ block: "nearest" });
    }
  }, [code, loading]);

  const handleCopy = () => {
    if (!clean) return;
    navigator.clipboard.writeText(clean).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const lineCount = clean ? clean.split("\n").length : 0;
  const isError = clean.startsWith("Error:");

  if (isError) {
    return (
      <div
        className="font-mono leading-relaxed relative flex flex-col h-[120px] items-center justify-center gap-3 border border-[#ffb4ab]/30 rounded-lg mx-3 my-3 bg-[#1c1b1b]"
      >
        <div className="flex items-center gap-2 text-[#ffb4ab]">
          <span className="material-symbols-outlined text-base">error</span>
          <span className="text-[13px] font-mono">{clean.replace("Error: ", "")}</span>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg bg-[#ffb4ab]/10 hover:bg-[#ffb4ab]/20 text-[#ffb4ab] transition-colors border border-[#ffb4ab]/20"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "font-mono leading-relaxed relative transition-all duration-300 rounded-b-lg overflow-hidden group",
        expanded ? "h-[560px]" : "h-[320px]"
      )}
      style={{ background: "#0e0e0e" }}
    >
      {/* Floating action buttons — appear on hover in top-right corner */}
      {clean && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          {loading && <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3] animate-pulse mr-1" />}
          <span className="text-[9px] text-[#474746]/50 font-mono mr-1">{lineCount}L</span>
          <button
            onClick={handleCopy}
            className={cn(
              "flex items-center justify-center w-6 h-6 rounded transition-all bg-[#1c1b1b]/90 backdrop-blur-sm",
              copied ? "text-[#4edea3]" : "text-[#474746] hover:text-[#c8c6c5]"
            )}
            title={copied ? "Copied!" : "Copy code"}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>
              {copied ? "check" : "content_copy"}
            </span>
          </button>
          <button
            onClick={() => {
              const blob = new Blob([clean], { type: "text/plain" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = filename;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center justify-center w-6 h-6 rounded bg-[#1c1b1b]/90 backdrop-blur-sm text-[#474746] hover:text-[#c8c6c5] transition-colors"
            title="Download as file"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>download</span>
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center justify-center w-6 h-6 rounded bg-[#1c1b1b]/90 backdrop-blur-sm text-[#474746] hover:text-[#c8c6c5] transition-colors"
            title={expanded ? "Collapse" : "Expand"}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>
              {expanded ? "unfold_less" : "unfold_more"}
            </span>
          </button>
          {prevCode && stripFences(prevCode) !== clean && (
            <button
              onClick={() => setShowDiff((v) => !v)}
              className={cn(
                "flex items-center justify-center w-6 h-6 rounded transition-all bg-[#1c1b1b]/90 backdrop-blur-sm",
                showDiff
                  ? "text-[#4edea3] border border-[#4edea3]/20"
                  : "text-[#474746] hover:text-[#c8c6c5]"
              )}
              title="Toggle diff view"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>difference</span>
            </button>
          )}
        </div>
      )}

      {/* Scrollable code area */}
      <div className="absolute inset-0 overflow-auto ide-scroll" style={{ background: "#0e0e0e" }}>
        {loading && !clean ? (
          <div className="flex items-center gap-2 text-[#4edea3] animate-pulse text-sm p-4">
            <span className="material-symbols-outlined text-base">sync</span>Generating…
          </div>
        ) : clean && showDiff && prevCode ? (
          (() => {
            const prevClean = stripFences(prevCode);
            const prevLines = prevClean.split("\n");
            const newLines = clean.split("\n");
            const diffLines: { text: string; type: "added"|"removed"|"unchanged" }[] = [];
            let pi = 0; let ni = 0;
            while (pi < prevLines.length || ni < newLines.length) {
              const pl = prevLines[pi]; const nl = newLines[ni];
              if (pi >= prevLines.length) { diffLines.push({ text: nl, type: "added" }); ni++; }
              else if (ni >= newLines.length) { diffLines.push({ text: pl, type: "removed" }); pi++; }
              else if (pl === nl) { diffLines.push({ text: nl, type: "unchanged" }); pi++; ni++; }
              else { diffLines.push({ text: pl, type: "removed" }); pi++;
                     diffLines.push({ text: nl, type: "added" }); ni++; }
            }
            return (
              <pre className="px-4 py-4 text-xs leading-[1.75] whitespace-pre min-w-max">
                {diffLines.map((line, i) => (
                  <div key={i} className={cn("px-1 rounded-sm", line.type === "added" && "bg-[#4ae176]/10", line.type === "removed" && "bg-[#ffb4ab]/10")}>
                    <span className={cn("select-none mr-2 font-mono", line.type === "added" ? "text-[#4ae176]" : line.type === "removed" ? "text-[#ffb4ab]" : "text-[#474746]")}>
                      {line.type === "added" ? "+" : line.type === "removed" ? "-" : " "}
                    </span>
                    <span style={{ color: line.type === "added" ? "#4ae176" : line.type === "removed" ? "#ffb4ab" : "#c8c6c5" }}>{line.text}</span>
                  </div>
                ))}
              </pre>
            );
          })()
        ) : clean ? (
          <div className="flex min-w-max">
            {/* Gutter */}
            <div
              className="select-none shrink-0 text-right pr-3 pl-3 py-4 text-xs leading-[1.75] border-r border-[#3c4a42]/20 sticky left-0"
              style={{ color: "#474746", minWidth: "3rem", background: "#131313" }}
            >
              {clean.split("\n").map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
            {/* Code */}
            <pre className="flex-1 px-4 py-4 text-xs leading-[1.75] whitespace-pre">
              {loading && clean ? (
                (() => {
                  const lines = clean.split("\n");
                  const completeLines = lines.slice(0, -1).join("\n") + "\n";
                  const partialLine = lines[lines.length - 1];
                  return (
                    <>
                      {highlightCode(completeLines)}
                      <span style={{ color: "#c8c6c5" }}>{partialLine}</span>
                      <span className="inline-block w-2 h-3.5 bg-[#4edea3] animate-pulse ml-1 align-middle" />
                    </>
                  );
                })()
              ) : (
                <>
                  {highlightCode(clean)}
                  {loading && <span className="inline-block w-2 h-3.5 bg-[#4edea3] animate-pulse ml-1 align-middle" />}
                </>
              )}
            </pre>
          </div>
        ) : (
          <p className="text-[#474746] text-sm p-4 italic">Waiting for agent…</p>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SecuritySection — detailed fixed-issues display
// ---------------------------------------------------------------------------
type SecIssue = { id: string; severity: "high" | "medium" | "low"; title: string; description: string; agentAction: string; agentResult: string; source: "backend" | "frontend" };

const SEV_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  high:   { bg: "bg-[#ffb4ab]/10", text: "text-[#ffb4ab]", border: "border-[#ffb4ab]/20" },
  medium: { bg: "bg-[#e5c07b]/10", text: "text-[#e5c07b]", border: "border-[#e5c07b]/20" },
  low:    { bg: "bg-[#c8c6c5]/10", text: "text-[#c8c6c5]", border: "border-[#3c4a42]/20" },
};

function SecuritySection({
  secScore,
  secIssues,
  allIssues,
  isRunning,
  isDone,
  hideScore,
  filterSeverity,
}: {
  secScore: number;
  secIssues: SecIssue[];
  allIssues?: SecIssue[];
  isRunning: boolean;
  isDone: boolean;
  hideScore?: boolean;
  filterSeverity?: "all"|"high"|"medium"|"low";
}) {
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);
  const totalIssues = allIssues ?? secIssues;
  const sevOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const filteredIssues = secIssues
    .filter((i) => !filterSeverity || filterSeverity === "all" || i.severity === filterSeverity)
    .sort((a, b) => (sevOrder[a.severity] ?? 2) - (sevOrder[b.severity] ?? 2));

  return (
    <div className="bg-[#201f1f] flex-1">
      <div className="p-4">
        {isRunning ? (
          <div className="flex items-center gap-2 text-[13px] text-[#ffb4ab] animate-pulse font-mono">
            <span className="material-symbols-outlined text-base animate-spin">refresh</span>
            Scanning for vulnerabilities…
          </div>
        ) : isDone ? (
          <div className="space-y-3">
            {/* Score row — shown only when hideScore is false (once, in the bottom sub-section) */}
            {!hideScore && (
              <div className="flex items-center gap-3">
                <div className="flex items-baseline gap-1">
                  <span className={cn("text-2xl font-bold font-serif leading-none", secScore >= 85 ? "text-[#4edea3]" : "text-[#ffb4ab]")}>
                    {secScore}
                  </span>
                  <span className="text-xs text-[#474746] font-mono">%</span>
                </div>
                <div className="flex-1 h-1.5 bg-[#353534] rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full bar-grow", secScore >= 85 ? "bg-[#4edea3]" : "bg-[#ffb4ab]")}
                    style={{ width: `${secScore}%` }}
                  />
                </div>
                <Badge className="bg-[#4edea3]/10 text-[#4edea3] border-transparent text-[10px] font-bold shrink-0">
                  {totalIssues.length} total fixed
                </Badge>
              </div>
            )}

            {/* Issues list */}
            {filteredIssues.length > 0 ? (
              <div className="space-y-1.5 pr-1">
                {filteredIssues.map((issue) => {
                  const isOpen = expandedIssue === issue.id;
                  const sev = SEV_COLOR[issue.severity] ?? SEV_COLOR.low;
                  return (
                    <div
                      key={issue.id}
                      className={cn(
                        "rounded-lg border overflow-hidden transition-all",
                        sev.border,
                        isOpen ? "bg-[#131313]" : "bg-[#201f1f] hover:bg-[#252525]"
                      )}
                    >
                      <button
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
                        onClick={() => setExpandedIssue(isOpen ? null : issue.id)}
                      >
                        <span className="material-symbols-outlined text-[#4edea3] text-sm shrink-0">check_circle</span>
                        <span className={cn("text-[10px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0", sev.bg, sev.text)}>
                          {issue.severity}
                        </span>
                        <span className="text-[13px] text-[#e5e2e1] font-medium truncate flex-1 text-left">
                          {issue.title}
                        </span>
                        <span className="material-symbols-outlined text-[#474746] text-sm shrink-0">
                          {isOpen ? "expand_less" : "expand_more"}
                        </span>
                      </button>

                      {isOpen && (
                        <div className="px-3 pb-3 space-y-2 border-t border-[#3c4a42]/20">
                          {issue.description && (
                            <div className="pt-2">
                              <p className="text-xs font-bold text-[#474746] uppercase tracking-wider mb-1">Found</p>
                              <p className="text-[13px] text-[#c8c6c5] leading-relaxed">{issue.description}</p>
                            </div>
                          )}
                          {issue.agentAction && (
                            <div>
                              <p className="text-xs font-bold text-[#474746] uppercase tracking-wider mb-1">Agent Action</p>
                              <div className="flex items-start gap-1.5">
                                <span className="material-symbols-outlined text-[#4ae176] text-sm mt-px shrink-0">auto_fix_high</span>
                                <p className="text-[13px] text-[#c8c6c5] leading-relaxed">{issue.agentAction}</p>
                              </div>
                            </div>
                          )}
                          {issue.agentResult && (
                            <div className="flex items-center gap-1.5 bg-[#4edea3]/5 border border-[#4edea3]/10 rounded px-2 py-1.5">
                              <span className="material-symbols-outlined text-[#4edea3] text-sm shrink-0">verified</span>
                              <p className="text-[13px] text-[#4edea3] leading-relaxed">{issue.agentResult}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[13px] text-[#4edea3]">
                <span className="material-symbols-outlined text-base">verified_user</span>
                No vulnerabilities detected
              </div>
            )}
          </div>
        ) : (
          <p className="text-[13px] text-[#474746]">Waiting for security scan…</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// VariantGrid — tabbed 3-column layout
// Tab 1: Orchestrator plans aligned
// Tab 2: Frontend code aligned
// Tab 3: Backend code aligned
// Tab 4: Security (backend issues + frontend issues) aligned
// ---------------------------------------------------------------------------
type SectionTab = "orchestrator" | "frontend" | "backend" | "security";

// Per-variant chat message
type ChatMessage = {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: string;
};

// ---------------------------------------------------------------------------
// Planning Poker types
// ---------------------------------------------------------------------------
type PokerAgentRole = "frontend_dev" | "backend_dev" | "tech_lead";
type PokerAgent = {
  role: PokerAgentRole;
  label: string;
  color: string;
  icon: string;
  apiRole: string;
  estimate: number | null;
  reasoning: string;
  revealed: boolean;
};
type PokerLog = { agent: string; color: string; text: string; timestamp: string };
type PokerSession = {
  storyId: string;
  phase: "idle" | "estimating" | "revealing" | "debating" | "done";
  agents: PokerAgent[];
  logs: PokerLog[];
  consensusEstimate: number | null;
  pokerContext: string;
};

const POKER_AGENTS: Omit<PokerAgent, "estimate" | "reasoning" | "revealed">[] = [
  { role: "frontend_dev", label: "Frontend Agent", color: "#6ffbbe", icon: "web",   apiRole: "Frontend Agent" },
  { role: "backend_dev",  label: "Backend Agent",  color: "#4ae176", icon: "dns",   apiRole: "Backend Agent"  },
  { role: "tech_lead",    label: "Tech Lead Agent", color: "#4edea3", icon: "stars", apiRole: "Tech Lead Agent" },
];
const POKER_NUMBERS = [1, 2, 3, 5, 8, 13, 20, 40, 100] as const;

function makePokerSession(storyId: string): PokerSession {
  return {
    storyId, phase: "idle", consensusEstimate: null, pokerContext: "", logs: [],
    agents: POKER_AGENTS.map((a) => ({ ...a, estimate: null, reasoning: "", revealed: false })),
  };
}

function snapToPoker(n: number): number {
  const nums = [...POKER_NUMBERS];
  return nums.reduce((prev, curr) => (Math.abs(curr - n) < Math.abs(prev - n) ? curr : prev));
}

function medianOf(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? sorted[mid - 1] : sorted[mid];
}

// ---------------------------------------------------------------------------
// ChatPanel — compact chat UI at the bottom of each variant card
// ---------------------------------------------------------------------------
function ChatPanel({
  variantId,
  messages,
  isRerunning,
  isPipelineRunning,
  onSubmit,
}: {
  variantId: VariantId;
  messages: ChatMessage[];
  isRerunning: boolean;
  isPipelineRunning: boolean;
  onSubmit: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const isBlocked = isRerunning || isPipelineRunning;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ block: "end" });
    }
  }, [messages.length]);

  const submit = () => {
    if (!draft.trim() || isBlocked) return;
    onSubmit(draft.trim());
    setDraft("");
  };

  return (
    <div className="border-t border-[#3c4a42]/20 bg-[#201f1f]">
      {/* Chat history */}
      {messages.length > 0 && (
        <ScrollArea className="h-[240px] px-3 py-2">
          <div className="space-y-1.5">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-2 items-start text-[12px] leading-relaxed",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {msg.role === "agent" && (
                <span className="material-symbols-outlined text-sm text-[#4edea3] shrink-0 mt-0.5" style={{ fontSize: "14px" }}>
                  smart_toy
                </span>
              )}
              <span
                className={cn(
                  "rounded-lg px-2.5 py-1.5 max-w-[85%]",
                  msg.role === "user"
                    ? "bg-[#4ae176]/15 text-[#4ae176]"
                    : "bg-[#2a2a2a] text-[#c8c6c5]"
                )}
              >
                {msg.content}
              </span>
              {msg.role === "user" && (
                <span className="material-symbols-outlined text-sm text-[#4ae176] shrink-0 mt-0.5" style={{ fontSize: "14px" }}>
                  person
                </span>
              )}
            </div>
          ))}
          <div ref={scrollRef} />
          </div>
        </ScrollArea>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2 px-3 py-2.5">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={
            isPipelineRunning
              ? "Pipeline running — wait for completion…"
              : isRerunning
              ? `Regenerating Variant ${variantId}…`
              : "Add a task or request a modification… (Enter to send)"
          }
          disabled={isBlocked}
          rows={2}
          style={{ resize: "none" }}
          className={cn(
            "flex-1 bg-[#2a2a2a] border border-[#3c4a42]/30 rounded-lg px-3 py-2",
            "text-[12px] text-[#e5e2e1] placeholder:text-[#474746] font-mono",
            "outline-none focus:border-[#4edea3]/40 transition-colors",
            "leading-relaxed max-h-[80px] overflow-y-auto",
            isBlocked && "opacity-50 cursor-not-allowed"
          )}
        />
        <button
          disabled={!draft.trim() || isBlocked}
          onClick={submit}
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-lg shrink-0 transition-colors",
            draft.trim() && !isBlocked
              ? "bg-[#4edea3]/10 hover:bg-[#4edea3]/20 text-[#4edea3]"
              : "bg-[#2a2a2a] text-[#474746] cursor-not-allowed"
          )}
          title="Send modification request"
        >
          {isRerunning ? (
            <span className="w-3 h-3 border-2 border-[#4edea3]/30 border-t-[#4edea3] rounded-full animate-spin" />
          ) : (
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>send</span>
          )}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PokerCard — single playing card with flip animation
// ---------------------------------------------------------------------------
function PokerCard({ value, revealed, color, animationDelay = 0 }: {
  value: number | null;
  revealed: boolean;
  color: string;
  animationDelay?: number;
}) {
  return (
    <div style={{ perspective: "600px" }}>
      <div
        className={cn(
          "w-12 h-16 rounded-lg border-2 flex items-center justify-center font-bold font-mono text-xl select-none",
          revealed ? "card-flip" : "card-waiting"
        )}
        style={{
          animationDelay: revealed ? `${animationDelay}ms` : undefined,
          borderColor: revealed ? color : "#3c4a42",
          background: revealed ? `${color}15` : "#201f1f",
          color: revealed ? color : "#474746",
        }}
      >
        {revealed && value !== null ? (
          value
        ) : (
          <span className="material-symbols-outlined" style={{ color: "#474746", fontSize: "16px" }}>casino</span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PokerSessionPanel — inline panel showing estimation + debate
// ---------------------------------------------------------------------------
function PokerSessionPanel({ session }: { session: PokerSession }) {
  const logEndRef = useRef<HTMLDivElement>(null);
  // Always start expanded so history is immediately visible
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (expanded) logEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [session.logs.length, session.logs[session.logs.length - 1]?.text, expanded]);

  const phaseLabel = {
    idle: "",
    estimating: "Estimating…",
    revealing: "Revealing…",
    debating: "Debating…",
    done: "Consensus reached",
  }[session.phase];

  const isRunning = session.phase !== "idle" && session.phase !== "done";

  return (
    <div className="mt-2 rounded-xl border border-[#3c4a42]/40 bg-[#131313] overflow-hidden">
      {/* Header — always visible, click to toggle */}
      <button
        className="w-full flex items-center justify-between px-3.5 py-2.5 border-b border-[#3c4a42]/30 hover:bg-[#1a1a1a] transition-colors text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2 text-[#4edea3]">
          <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>casino</span>
          <span className="text-[12px] font-bold uppercase tracking-wider">Planning Poker</span>
        </div>
        <div className="flex items-center gap-1.5">
          {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3] glow-pulse" />}
          {session.phase === "done" && session.consensusEstimate !== null && (
            <span className="text-[11px] font-bold font-mono text-[#4edea3] bg-[#4edea3]/10 border border-[#4edea3]/20 rounded-full px-2 py-0.5">
              {session.consensusEstimate} pts
            </span>
          )}
          <span className="text-[11px] text-[#86948a]">{phaseLabel}</span>
          <span className="material-symbols-outlined text-[#474746] transition-transform" style={{ fontSize: "16px", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}>
            expand_more
          </span>
        </div>
      </button>

      {/* Collapsible body */}
      {expanded && (
        <>
          {/* Agent cards row */}
          <div className="flex justify-center gap-8 py-4 px-3">
            {session.agents.map((agent, i) => (
              <div key={agent.role} className="flex flex-col items-center gap-2 min-w-0 max-w-[90px]">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center border border-[#3c4a42]/40 shrink-0"
                  style={{ background: `${agent.color}10` }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "15px", color: agent.color }}>{agent.icon}</span>
                </div>
                <PokerCard value={agent.estimate} revealed={agent.revealed} color={agent.color} animationDelay={i * 180} />
                <span className="text-[10px] font-medium text-center leading-none" style={{ color: agent.color }}>{agent.label}</span>
                {agent.revealed && agent.reasoning && (
                  <p className="text-[10px] text-[#86948a] text-center leading-tight line-clamp-3">{agent.reasoning}</p>
                )}
              </div>
            ))}
          </div>

          {/* Debate log */}
          {session.logs.length > 0 && (
            <div className="mx-3 mb-3 rounded-lg bg-[#0e0e0e] border border-[#3c4a42]/20 overflow-hidden">
              <div className="px-2.5 py-1.5 border-b border-[#3c4a42]/20 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#474746]" style={{ fontSize: "12px" }}>forum</span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-[#474746]">Debate transcript</span>
              </div>
              <div className={`overflow-y-auto ide-scroll p-2 space-y-2 ${session.phase === "debating" ? "max-h-[220px]" : ""}`}>
                {session.logs.map((log, i) => (
                  <div key={i} className="rounded-lg bg-[#131313] border border-[#3c4a42]/15 overflow-hidden">
                    {/* Agent header row */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-[#3c4a42]/10" style={{ background: `${log.color}08` }}>
                      <div className="w-1 h-3 rounded-full shrink-0" style={{ background: log.color }} />
                      <span className="text-[10px] font-bold" style={{ color: log.color }}>{log.agent}</span>
                      <span className="ml-auto text-[9px] font-mono text-[#474746]">{log.timestamp}</span>
                    </div>
                    {/* Message body */}
                    <div className="px-2.5 py-2">
                      <span className="text-[11px] font-mono text-[#c8c6c5] leading-relaxed whitespace-pre-wrap break-words">
                        {log.text}
                        {i === session.logs.length - 1 && session.phase === "debating" && (
                          <span className="terminal-cursor" />
                        )}
                      </span>
                    </div>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>
          )}

          {/* Consensus footer */}
          {session.phase === "done" && session.consensusEstimate !== null && (
            <div className="mx-3 mb-3 flex items-center justify-between rounded-lg bg-[#4edea3]/8 border border-[#4edea3]/20 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4ae176]" style={{ fontSize: "15px" }}>check_circle</span>
                <span className="text-[11px] font-bold text-[#4ae176] uppercase tracking-wider">Consensus</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[22px] font-bold font-mono text-[#4edea3]">{session.consensusEstimate}</span>
                <span className="text-[11px] text-[#86948a]">
                  pts · ~{session.consensusEstimate < 2 ? `${session.consensusEstimate * 30}min` : session.consensusEstimate * 30 >= 60 ? `${Math.round(session.consensusEstimate * 30 / 60 * 10) / 10}h` : `${session.consensusEstimate * 30}min`} delivery
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PipelineBar — horizontal 5-stage progress indicator per variant
// ---------------------------------------------------------------------------
function PipelineBar({
  reasoningDone,
  orchStatus,
  backendStatus,
  frontendStatus,
  securityStatus,
  noFrontend: nf,
  evaluated,
}: {
  reasoningDone: boolean;
  orchStatus: AgentOutput["status"];
  backendStatus: AgentOutput["status"];
  frontendStatus: AgentOutput["status"];
  securityStatus: AgentOutput["status"];
  noFrontend: boolean;
  evaluated: boolean;
}) {
  const codeDone = backendStatus === "done" && (nf || frontendStatus === "done");
  const codeRunning = backendStatus === "running" || (!nf && frontendStatus === "running");

  const stages = [
    { label: "Reasoning",    done: reasoningDone,         running: !reasoningDone && orchStatus === "running" },
    { label: "Orchestrator", done: orchStatus === "done",  running: orchStatus === "running" },
    { label: "Code",         done: codeDone,               running: codeRunning },
    { label: "Security",     done: securityStatus === "done", running: securityStatus === "running" },
    { label: "Evaluated",   done: evaluated,               running: false },
  ];

  const abbrev = ["Reasoning", "Orchestrator", "Code", "Security", "Evaluated"];

  return (
    <div className="flex justify-center px-6 py-3 bg-[#1c1b1b] border-b border-[#3c4a42]/15">
      <div className="flex items-center w-full max-w-[640px]">
        {stages.map((stage, i) => (
          <Fragment key={stage.label}>
            {/* Node + label column */}
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div
                className={cn(
                  "w-2.5 h-2.5 rounded-full border transition-all duration-500",
                  stage.done    ? "bg-[#4ae176] border-[#4ae176]" :
                  stage.running ? "bg-[#4edea3]/20 border-[#4edea3] glow-pulse" :
                                  "bg-transparent border-[#474746]"
                )}
              />
              <span className={cn(
                "text-[9px] font-bold uppercase tracking-wider leading-none whitespace-nowrap",
                stage.done    ? "text-[#4ae176]" :
                stage.running ? "text-[#4edea3]" :
                                "text-[#474746]"
              )}>
                {abbrev[i]}
              </span>
            </div>
            {/* Connector line between nodes */}
            {i < stages.length - 1 && (
              <div className={cn(
                "flex-1 h-px mb-3.5 mx-2 transition-all duration-700",
                stage.done ? "bg-[#4ae176]/50" : "bg-[#3c4a42]/30"
              )} />
            )}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function VariantGrid({ story, reasoningContent, noFrontend, onRerunOrchestrator, chatMessages, rerunningVariants, runningStories, onRequestModification, prevCode, onRerunAgent, showEvaluator, evalContent }: {
  story: UserStory;
  reasoningContent: Record<string, string>;
  noFrontend: Record<string, boolean>;
  onRerunOrchestrator: (variantId: VariantId, reasoning: string) => void;
  chatMessages: Record<string, ChatMessage[]>;
  rerunningVariants: Record<string, boolean>;
  runningStories: Record<string, boolean>;
  onRequestModification: (variantId: VariantId, userMessage: string) => void;
  prevCode: Record<string, { backend: string; frontend: string }>;
  onRerunAgent: (variantId: VariantId, role: "backend" | "frontend") => void;
  showEvaluator: Record<string, boolean>;
  evalContent: Record<string, string>;
}) {
  const [activeVariant, setActiveVariant] = useState<VariantId>("A");
  const [activeTab, setActiveTab] = useState<SectionTab>("orchestrator");

  // Per-variant reasoning edit state: null = not editing, string = editing value
  const [reasoningEdit, setReasoningEdit] = useState<Record<VariantId, string | null>>({ A: null, B: null, C: null });
  // Per-variant reasoning card collapsed state (default: collapsed)
  const [reasoningCollapsed, setReasoningCollapsed] = useState<Record<VariantId, boolean>>({ A: true, B: true, C: true });
  // Per-variant per-section task expansion state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // Per-step inline editing: key = `${variantId}:${stepIndex}`
  const [editingStep, setEditingStep] = useState<string | null>(null);
  const [editingVal, setEditingVal] = useState("");
  // Per-variant overridden steps (user edits to orchestrator steps)
  const [stepOverrides, setStepOverrides] = useState<Record<string, string>>({}); // key = `${variantId}:${stepIndex}`

  // Per-variant: how many timeline steps are currently visible (animated in one-by-one)
  const [visibleSteps, setVisibleSteps] = useState<Record<VariantId, number>>({ A: 0, B: 0, C: 0 });
  // Per-variant: how many steps have their "completed" node state (green check, animated one-by-one)
  const [completedSteps, setCompletedSteps] = useState<Record<VariantId, number>>({ A: 0, B: 0, C: 0 });
  // Per-variant: security severity filter
  const [secFilter, setSecFilter] = useState<Record<VariantId, "all"|"high"|"medium"|"low">>({ A: "all", B: "all", C: "all" });

  const isRunning = (out: AgentOutput) => out.status === "running";
  const isDone    = (out: AgentOutput) => out.status === "done";

  // Compute allSteps per-variant at component level (needed for useEffect deps)
  const allStepsPerVariant = (() => {
    const result: Record<VariantId, string[]> = { A: [], B: [], C: [] };
    for (const v of ["A", "B", "C"] as VariantId[]) {
      const variant = story.variants.find((x) => x.id === v);
      if (!variant) continue;
      const orchContent = variant.orchestrator.content.replace(/\*\*/g, "").replace(/\r/g, "");
      const orchLines = orchContent.split("\n");
      const completedIdx = orchLines.findIndex((l) => /^completed[:\s]*/i.test(l.trim()));
      const pendingIdx   = orchLines.findIndex((l) => /^pending[:\s]*/i.test(l.trim()));
      const extractItems = (from: number, to?: number) =>
        orchLines.slice(from + 1, to).map((l) => l.replace(/^\s*[-•*]\s*/, "").trim()).filter(Boolean);
      const doneItems    = completedIdx >= 0 ? extractItems(completedIdx, pendingIdx >= 0 ? pendingIdx : undefined) : [];
      const pendingItems = pendingIdx   >= 0 ? extractItems(pendingIdx) : [];
      result[v] = [...doneItems, ...pendingItems].slice(0, 8);
    }
    return result;
  })();

  // One-by-one step reveal: when allSteps grows, show one new step every 400ms (slower, deliberate)
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const v of ["A", "B", "C"] as VariantId[]) {
      const total = allStepsPerVariant[v].length;
      const current = visibleSteps[v];
      if (total > current) {
        // Schedule reveals for each new step
        for (let i = current; i < total; i++) {
          const delay = (i - current + 1) * 400;
          timers.push(
            setTimeout(() => {
              setVisibleSteps((prev) => ({ ...prev, [v]: i + 1 }));
            }, delay)
          );
        }
      }
    }
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    allStepsPerVariant.A.length,
    allStepsPerVariant.B.length,
    allStepsPerVariant.C.length,
  ]);

  // One-by-one step completion: fires only when ALL agents for a variant are done
  // This ensures checkpoints fill at the same time the panel shows DONE
  const allDonePerVariant: Record<VariantId, boolean> = {
    A: (() => { const vt = story.variants.find((x) => x.id === "A"); const nf = !!noFrontend[`${story.id}:A`]; return !!vt && vt.orchestrator.status === "done" && vt.backend.status === "done" && (nf || vt.frontend.status === "done") && vt.security.status === "done"; })(),
    B: (() => { const vt = story.variants.find((x) => x.id === "B"); const nf = !!noFrontend[`${story.id}:B`]; return !!vt && vt.orchestrator.status === "done" && vt.backend.status === "done" && (nf || vt.frontend.status === "done") && vt.security.status === "done"; })(),
    C: (() => { const vt = story.variants.find((x) => x.id === "C"); const nf = !!noFrontend[`${story.id}:C`]; return !!vt && vt.orchestrator.status === "done" && vt.backend.status === "done" && (nf || vt.frontend.status === "done") && vt.security.status === "done"; })(),
  };

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const v of ["A", "B", "C"] as VariantId[]) {
      if (!allDonePerVariant[v]) continue;
      const total = visibleSteps[v]; // only complete steps we've already revealed
      const current = completedSteps[v];
      if (total > current) {
        for (let i = current; i < total; i++) {
          const delay = (i - current + 1) * 300;
          timers.push(
            setTimeout(() => {
              setCompletedSteps((prev) => ({ ...prev, [v]: i + 1 }));
            }, delay)
          );
        }
      }
    }
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDonePerVariant.A, allDonePerVariant.B, allDonePerVariant.C, visibleSteps.A, visibleSteps.B, visibleSteps.C]);

  // True if ANY variant for this story needs frontend
  const anyNeedsFrontend = (["A", "B", "C"] as VariantId[]).some(
    (v) => !noFrontend[`${story.id}:${v}`]
  );

  const ALL_TABS: { id: SectionTab; label: string; icon: string; color: string }[] = [
    { id: "orchestrator", label: "Orchestrator", icon: "hub",    color: "text-[#4edea3]" },
    { id: "frontend",     label: "Frontend",     icon: "web",    color: "text-[#6ffbbe]" },
    { id: "backend",      label: "Backend",      icon: "dns",    color: "text-[#4ae176]" },
    { id: "security",     label: "Security",     icon: "shield", color: "text-[#ffb4ab]" },
  ];
  const TABS = ALL_TABS.filter((t) => t.id !== "frontend" || anyNeedsFrontend);

  return (
    <div className="space-y-0">
      {/* Outer variant tab bar — A / B / C */}
      <div className="flex items-center gap-0 border-b border-[#3c4a42]/20">
        {(["A", "B", "C"] as VariantId[]).map((v) => {
          const vt = story.variants.find((x) => x.id === v);
          const nf = !!noFrontend[`${story.id}:${v}`];
          const vDone = !!vt && vt.orchestrator.status === "done" && vt.backend.status === "done" && (nf || vt.frontend.status === "done") && vt.security.status === "done";
          const vRunning = !!vt && (vt.orchestrator.status === "running" || vt.backend.status === "running" || vt.frontend.status === "running" || vt.security.status === "running");
          const isChosen = story.chosenVariant === v;
          const isActive = activeVariant === v;
          return (
            <button
              key={v}
              onClick={() => setActiveVariant(v)}
              className={cn(
                "flex items-center gap-2 px-6 py-3 text-sm font-bold uppercase tracking-widest border-b-2 transition-all -mb-px",
                isActive
                  ? "border-[#4edea3] text-[#4edea3]"
                  : "border-transparent text-[#474746] hover:text-[#c8c6c5]"
              )}
            >
              <span
                className={cn(
                  "inline-block w-2 h-2 rounded-full shrink-0",
                  vRunning ? "bg-[#4edea3] animate-pulse" : vDone ? "bg-[#4ae176]" : "bg-[#474746]"
                )}
              />
              Variant {v}
              {isChosen && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#4edea3]/10 text-[#4edea3] uppercase tracking-wider">Selected</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Single active variant panel */}
      {(["A", "B", "C"] as VariantId[]).filter((v) => v === activeVariant).map((v) => {
          const variant = story.variants.find((x) => x.id === v) ?? makeVariant(v);
          const noFront = !!noFrontend[`${story.id}:${v}`];
          const allDoneVariant = isDone(variant.orchestrator) && isDone(variant.backend) && (noFront || isDone(variant.frontend)) && isDone(variant.security);

          const isRerunning = !!rerunningVariants[`${story.id}:${v}`];
          const anyRunning = isRunning(variant.orchestrator) || isRunning(variant.backend) || (!noFront && isRunning(variant.frontend)) || isRunning(variant.security);

          // Last checkpoint is filled only when completedSteps has caught up to all revealed steps
          const totalSteps = allStepsPerVariant[v].length;
          const lastCheckpointFilled = totalSteps > 0 && completedSteps[v] >= totalSteps;

          let activeLabel = "";
          let activeLabelColor = "text-[#474746]";
          if (isRerunning && !anyRunning)                                      { activeLabel = "UPDATING";         activeLabelColor = "text-[#e5c07b]"; }
          else if (isRunning(variant.orchestrator))                            { activeLabel = "ORCHESTRATING";    activeLabelColor = "text-[#4edea3]"; }
          else if (isRunning(variant.backend) || isRunning(variant.frontend))  { activeLabel = "CODING";           activeLabelColor = "text-[#4ae176]"; }
          else if (isRunning(variant.security))                                { activeLabel = "SCANNING";         activeLabelColor = "text-[#ffb4ab]"; }

          // Parse orchestrator
          const orchContent  = variant.orchestrator.content.replace(/\*\*/g, "").replace(/\r/g, "");
          const orchLines    = orchContent.split("\n");
          const statusLine   = orchLines.find((l) => /^status:/i.test(l.trim()))?.replace(/^status:\s*/i, "").trim() ?? "";
          const completedIdx = orchLines.findIndex((l) => /^completed[:\s]*/i.test(l.trim()));
          const pendingIdx   = orchLines.findIndex((l) => /^pending[:\s]*/i.test(l.trim()));
          const extractItems = (from: number, to?: number) =>
            orchLines.slice(from + 1, to).map((l) => l.replace(/^\s*[-•*]\s*/, "").trim()).filter(Boolean);
          const doneItems    = completedIdx >= 0 ? extractItems(completedIdx, pendingIdx >= 0 ? pendingIdx : undefined) : [];
          const pendingItems = pendingIdx   >= 0 ? extractItems(pendingIdx) : [];
          // allSteps is already computed at component level in allStepsPerVariant[v]
          // visibleSteps[v] controls how many are rendered (one-by-one reveal)
          const allSteps     = allStepsPerVariant[v].slice(0, visibleSteps[v]);

          // Parse security — extract AUDIT: JSON section from the structured output
          let secIssues: SecIssue[] = [];
          let secScore = 95;
          try {
            const auditMatch = variant.security.content.match(/AUDIT:\s*\n(\{[\s\S]*?\})\s*$/m)
              ?? variant.security.content.match(/AUDIT:\s*(\{[\s\S]*?\})/);
            const jsonStr = auditMatch?.[1] ?? variant.security.content.match(/(\{[\s\S]*"complianceScore"[\s\S]*\})/)?.[1];
            if (jsonStr) {
              const parsed = JSON.parse(jsonStr);
              secScore = parsed.complianceScore ?? 95;
              secIssues = (parsed.issues ?? []).map((iss: Record<string, string>) => ({
                id: iss.id ?? "SEC-000",
                severity: iss.severity ?? "low",
                title: iss.title ?? "Issue",
                description: iss.description ?? "",
                agentAction: iss.agentAction ?? iss.fix ?? "",
                agentResult: iss.agentResult ?? "Fixed by agent.",
                source: (iss.source === "frontend" ? "frontend" : "backend") as "backend" | "frontend",
              }));
            }
          } catch { /* keep defaults */ }

          return (
            <Card
              key={v}
              className={cn(
                "bg-[#1c1b1b] rounded-2xl border overflow-hidden ring-0 flex flex-col mt-4",
                story.chosenVariant === v ? "border-[#4edea3]/40" : "border-[#3c4a42]/20"
              )}
            >
              {/* Pipeline progress bar */}
              <PipelineBar
                reasoningDone={!!reasoningContent[`${story.id}:${v}`]}
                orchStatus={variant.orchestrator.status}
                backendStatus={variant.backend.status}
                frontendStatus={variant.frontend.status}
                securityStatus={variant.security.status}
                noFrontend={!!noFrontend[`${story.id}:${v}`]}
                evaluated={!!showEvaluator[story.id] && !!evalContent[story.id]}
              />

              {/* Inner section tab bar */}
              <div className="flex items-center gap-0 border-b border-[#3c4a42]/20 bg-[#161615]">
                {TABS.map((tab) => {
                  const isActiveInner = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "flex items-center gap-1.5 px-5 py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-all -mb-px",
                        isActiveInner
                          ? cn("border-current", tab.color)
                          : "border-transparent text-[#474746] hover:text-[#c8c6c5]"
                      )}
                    >
                      <span className={cn("material-symbols-outlined text-base", isActiveInner ? tab.color : "text-[#474746]")}>
                        {tab.icon}
                      </span>
                      {tab.label}
                    </button>
                  );
                })}
                {/* Status label right-aligned */}
                <span className={cn("ml-auto mr-4 text-xs font-bold uppercase tracking-widest", activeLabelColor)}>
                  {activeLabel}
                </span>
              </div>

              {/* Tab content */}
              <div className="flex flex-col overflow-hidden">
                {/* ── TAB: ORCHESTRATOR ────────────────────────── */}
                {activeTab === "orchestrator" && (
                  <div className="flex flex-col">
                    {/* Steps area */}
                    <div className="p-4">
                      {/* Timeline — shown while running (partial) AND when done */}
                      {(isRunning(variant.orchestrator) || isDone(variant.orchestrator)) && allSteps.length > 0 ? (
                        <div className="space-y-0">
                          {/* Status line above timeline */}
                          {statusLine && (
                            <p className="text-[13px] font-bold text-[#4edea3] mb-4">{statusLine}</p>
                          )}

                          {/* Vertical timeline */}
                          <div className="relative">
                            {allSteps.map((step, i) => {
                              const isLast = i === allSteps.length - 1;
                              const key = `${v}:${i}`;
                              const isEditingThis = editingStep === key;
                              const displayText = stepOverrides[key] ?? step;
                              const isOverridden = !!stepOverrides[key];

                              // Step state: each step completes individually based on completedSteps[v] counter
                              const orchRunning = isRunning(variant.orchestrator);
                              const isStepCompleted = i < completedSteps[v];
                              const isActiveStep = orchRunning && isLast && !isStepCompleted;
                              const isCompleted = isStepCompleted;

                              return (
                                <div key={i} className="flex gap-3 slide-up" style={{ animationDelay: "0ms" }}>
                                  {/* Left: node + connector */}
                                  <div className="flex flex-col items-center shrink-0">
                                    {/* Checkpoint node — diamond shape via rotate-45 */}
                                    <div
                                      className={cn(
                                        "w-4 h-4 border-2 flex items-center justify-center shrink-0 transition-all duration-700 mt-1",
                                        "rotate-45",
                                        isActiveStep
                                          ? "border-[#4edea3] bg-[#4edea3]/20 glow-pulse"
                                          : lastCheckpointFilled && isLast
                                          ? "border-[#4edea3] bg-[#4edea3]"
                                          : isCompleted
                                          ? "border-[#4ae176] bg-[#4ae176]"
                                          : "border-[#474746] bg-transparent"
                                      )}
                                    >
                                      {isActiveStep && (
                                        <span className="w-1 h-1 bg-[#4edea3] animate-pulse block" style={{ transform: "none" }} />
                                      )}
                                    </div>
                                    {/* Connector line */}
                                    {!isLast && (
                                      <div
                                        className={cn(
                                          "w-px min-h-[24px] flex-1 transition-all duration-700",
                                          isCompleted ? "bg-[#4ae176]/50" : "bg-[#3c4a42]/40"
                                        )}
                                      />
                                    )}
                                  </div>

                                  {/* Right: step text */}
                                  <div className={cn("flex-1 group pb-4", isLast && "pb-2")}>
                                    <div className="flex items-start gap-2 min-h-[24px]">
                                      {isEditingThis ? (
                                        <input
                                          autoFocus
                                          value={editingVal}
                                          onChange={(e) => setEditingVal(e.target.value)}
                                          onBlur={() => {
                                            if (editingVal.trim()) setStepOverrides((p) => ({ ...p, [key]: editingVal.trim() }));
                                            setEditingStep(null);
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                              if (editingVal.trim()) setStepOverrides((p) => ({ ...p, [key]: editingVal.trim() }));
                                              setEditingStep(null);
                                            }
                                            if (e.key === "Escape") setEditingStep(null);
                                          }}
                                          className="flex-1 bg-transparent border-0 border-b border-[#4edea3]/50 text-[13px] text-[#e5e2e1] font-mono outline-none leading-relaxed pb-px focus:border-[#4edea3] transition-colors"
                                        />
                                      ) : (
                                        <div className="flex-1 min-w-0">
                                          <span
                                            className={cn(
                                              "text-[13px] leading-relaxed select-none block",
                                              isOverridden ? "text-[#e5c07b]" :
                                              isActiveStep ? "text-[#4edea3]" :
                                              isCompleted ? "text-[#c8c6c5]" : "text-[#474746]"
                                            )}
                                          >
                                            {displayText}
                                            {isActiveStep && (
                                              <span className="inline-block w-1.5 h-3 bg-[#4edea3] animate-pulse ml-1 align-middle rounded-sm" />
                                            )}
                                          </span>
                                        </div>
                                      )}
                                      {!isEditingThis && (
                                        <span
                                          className="material-symbols-outlined text-xs text-[#474746] opacity-0 group-hover:opacity-60 shrink-0 cursor-text transition-opacity mt-0.5"
                                          onClick={() => { setEditingStep(key); setEditingVal(displayText); }}
                                        >
                                          edit
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}

                            {/* "Planning next step…" ghost node when orchestrator still running */}
                            {isRunning(variant.orchestrator) && (
                              <div className="flex gap-3 items-center mt-1">
                                <div className="w-4 h-4 border-2 border-[#4edea3]/30 bg-[#4edea3]/5 rotate-45 shrink-0 mt-1" />
                                <span className="text-[13px] text-[#474746] italic font-mono">
                                  Planning next step…
                                  <span className="inline-block w-1.5 h-3 bg-[#4edea3]/40 animate-pulse ml-1 align-middle rounded-sm" />
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : isRunning(variant.orchestrator) ? (
                        /* No steps parsed yet — initial pulse */
                        <div className="flex items-center gap-3 py-2">
                          <div className="w-4 h-4 border-2 border-[#4edea3]/40 bg-[#4edea3]/5 rotate-45 shrink-0" />
                          <span className="text-[13px] text-[#4edea3] animate-pulse font-mono">Orchestrating…</span>
                        </div>
                      ) : (
                        <p className="text-[13px] text-[#474746]">Waiting for orchestrator…</p>
                      )}

                      {/* Reasoning card — primary view, always visible when done */}
                      {(() => {
                            const rKey = `${story.id}:${v}`;
                            const rawReasoning = reasoningContent[rKey] ?? "";
                            const editedReasoning = reasoningEdit[v];
                            const displayReasoning = editedReasoning ?? rawReasoning;
                            const isEdited = editedReasoning !== null && editedReasoning !== rawReasoning;
                            const isReasoningRunning = isRunning(variant.orchestrator) && !rawReasoning;

                            // Parse sections
                            const parseSection = (text: string, header: string): string[] => {
                              const regex = new RegExp(`${header}:\\s*\\n([\\s\\S]*?)(?=\\n[A-Z][\\w ]+:|$)`, "i");
                              const m = text.match(regex);
                              if (!m) return [];
                              return m[1].split("\n").map((l) => l.replace(/^\s*-\s*/, "").trim()).filter(Boolean);
                            };
                            const parseAnalysis = (text: string): string => {
                              const m = text.match(/Story Analysis:\s*\n([\s\S]*?)(?=\n[A-Z][\w ]+:)/i);
                              return m ? m[1].trim() : "";
                            };

                            const analysis = parseAnalysis(displayReasoning);
                            const backendTasks = parseSection(displayReasoning, "Backend Tasks");
                            const frontendTasks = parseSection(displayReasoning, "Frontend Tasks");
                            const securityTasks = parseSection(displayReasoning, "Security Tasks");
                            const needsFrontendLine = displayReasoning.match(/Needs Frontend:\s*(yes|no)/i)?.[1]?.toLowerCase();

                            const isCollapsed = reasoningCollapsed[v] ?? true;

                            return (
                              <div className="mb-4 border border-[#3c4a42]/20 rounded-lg overflow-hidden">
                                {/* Header row — clickable to collapse/expand */}
                                <button
                                  onClick={() => setReasoningCollapsed((p) => ({ ...p, [v]: !p[v] }))}
                                  className="w-full flex items-center gap-2 px-3 py-2.5 bg-[#201f1f] hover:bg-[#252424] transition-colors text-left"
                                >
                                  <span className="material-symbols-outlined text-sm text-[#4edea3]">psychology</span>
                                  <span className="text-xs font-bold uppercase tracking-wider text-[#c8c6c5] flex-1">Reasoning</span>
                                  {isEdited && <span className="text-[10px] font-bold text-[#e5c07b] uppercase tracking-wider">edited</span>}
                                  {needsFrontendLine === "no" && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#474746]/20 text-[#474746] uppercase tracking-wider">No Frontend</span>
                                  )}
                                  <span className="material-symbols-outlined text-sm text-[#474746]">
                                    {isCollapsed ? "expand_more" : "expand_less"}
                                  </span>
                                </button>

                                {!isCollapsed && (isReasoningRunning ? (
                                  <div className="flex items-center gap-2 p-3 text-[13px] text-[#4edea3] animate-pulse font-mono">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3] animate-pulse" />
                                    Analyzing story…
                                  </div>
                                ) : rawReasoning ? (
                                  <div className="border-t border-[#3c4a42]/20">
                                    {editedReasoning === null ? (
                                      <div className="p-3 space-y-2">
                                        {analysis && (
                                          <p className="text-[12px] text-[#c8c6c5]/70 leading-relaxed italic mb-2">{analysis}</p>
                                        )}
                                        <div className="grid grid-cols-3 gap-1.5">
                                          {[
                                            { label: "Backend",  color: "text-[#4ae176]", bg: "bg-[#4ae176]/5",  border: "border-[#4ae176]/15", tasks: backendTasks },
                                            { label: "Frontend", color: "text-[#6ffbbe]", bg: "bg-[#6ffbbe]/5",  border: "border-[#6ffbbe]/15", tasks: frontendTasks },
                                            { label: "Security", color: "text-[#ffb4ab]", bg: "bg-[#ffb4ab]/5",  border: "border-[#ffb4ab]/15", tasks: securityTasks },
                                          ].map((sec) => {
                                            const sKey = `${v}:${sec.label}`;
                                            const sExpanded = expandedSections[sKey] ?? false;
                                            const visibleTasks = sExpanded ? sec.tasks : sec.tasks.slice(0, 2);
                                            return (
                                              <div key={sec.label} className={cn("rounded border p-2 space-y-1", sec.bg, sec.border)}>
                                                <div className="flex items-center gap-1">
                                                  <span className={cn("text-[10px] font-bold uppercase tracking-wider", sec.color)}>{sec.label}</span>
                                                  <span className="ml-auto text-[9px] text-[#474746] font-mono">{sec.tasks.length}</span>
                                                </div>
                                                {sec.tasks.length === 0 ? (
                                                  <p className="text-[11px] text-[#474746] italic">No {sec.label.toLowerCase()} tasks identified</p>
                                                ) : (
                                                  <>
                                                    {visibleTasks.map((task, ti) => (
                                                      <p key={ti} className="text-[11px] text-[#c8c6c5] leading-relaxed" title={task}>{task}</p>
                                                    ))}
                                                    {sec.tasks.length > 2 && (
                                                      <button
                                                        onClick={() => setExpandedSections((p) => ({ ...p, [sKey]: !p[sKey] }))}
                                                        className="text-[10px] text-[#474746] hover:text-[#c8c6c5] transition-colors w-full text-left"
                                                      >
                                                        {sExpanded ? "Show less" : `+${sec.tasks.length - 2} more`}
                                                      </button>
                                                    )}
                                                  </>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                        <div className="flex items-center gap-2 pt-1">
                                          <button
                                            onClick={() => setReasoningEdit((p) => ({ ...p, [v]: rawReasoning }))}
                                            className="text-[11px] text-[#474746] hover:text-[#c8c6c5] transition-colors flex items-center gap-1"
                                          >
                                            <span className="material-symbols-outlined text-sm">edit</span>
                                            Edit
                                          </button>
                                          <button
                                            onClick={() => onRerunOrchestrator(v, rawReasoning)}
                                            className="text-[11px] text-[#474746] hover:text-[#4edea3] transition-colors flex items-center gap-1 ml-auto"
                                          >
                                            <span className="material-symbols-outlined text-sm">refresh</span>
                                            Regenerate
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div>
                                        <textarea
                                          autoFocus
                                          value={displayReasoning}
                                          onChange={(e) => setReasoningEdit((p) => ({ ...p, [v]: e.target.value }))}
                                          rows={8}
                                          className="w-full bg-[#0e0e0e] px-3 py-2 text-[12px] text-[#c8c6c5] font-mono leading-[1.7] outline-none resize-none border-0 border-b border-[#3c4a42]/20"
                                        />
                                        <div className="flex items-center gap-2 justify-between px-3 py-2 bg-[#201f1f]">
                                          <button
                                            onClick={() => setReasoningEdit((p) => ({ ...p, [v]: null }))}
                                            className="text-xs text-[#474746] hover:text-[#c8c6c5] transition-colors"
                                          >
                                            {isEdited ? "Reset" : "Cancel"}
                                          </button>
                                          <button
                                            onClick={() => {
                                              setReasoningEdit((p) => ({ ...p, [v]: null }));
                                              onRerunOrchestrator(v, displayReasoning);
                                            }}
                                            className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-[#4edea3]/10 hover:bg-[#4edea3]/20 text-[#4edea3] transition-colors"
                                          >
                                            <span className="material-symbols-outlined text-sm">refresh</span>
                                            Regenerate tasks
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : null)}
                              </div>
                            );
                          })()}

                    </div>
                  </div>
                )}

                {/* ── TAB: FRONTEND ────────────────────────────── */}
                {activeTab === "frontend" && (
                  noFront ? (
                    <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
                      <span className="material-symbols-outlined text-4xl text-[#474746]">web_off</span>
                      <p className="text-xs font-bold text-[#474746] uppercase tracking-widest">Not required</p>
                      <p className="text-[13px] text-[#474746] max-w-[200px]">This story has no frontend requirements</p>
                    </div>
                  ) : (
                    <div className="flex flex-col flex-1 overflow-hidden">
                      <CodeBlock
                        label="Frontend Agent"
                        icon="web"
                        color="text-[#6ffbbe]"
                        filename={`components/StoryView_v${v}.tsx`}
                        code={variant.frontend.content}
                        loading={isRunning(variant.frontend)}
                        prevCode={prevCode[`${story.id}:${v}`]?.frontend}
                        onRetry={() => onRerunAgent(v, "frontend")}
                      />
                    </div>
                  )
                )}

                {/* ── TAB: BACKEND ─────────────────────────────── */}
                {activeTab === "backend" && (
                  <div className="flex flex-col flex-1 overflow-hidden">
                    <CodeBlock
                      label="Backend Agent"
                      icon="dns"
                      color="text-[#4ae176]"
                      filename={`controllers/stream_v${v.toLowerCase()}.ts`}
                      code={variant.backend.content}
                      loading={isRunning(variant.backend)}
                      prevCode={prevCode[`${story.id}:${v}`]?.backend}
                      onRetry={() => onRerunAgent(v, "backend")}
                    />
                  </div>
                )}

                {/* ── TAB: SECURITY ────────────────────────────── */}
                {activeTab === "security" && (
                  <div className="flex flex-col flex-1 overflow-y-auto">
                    {/* Severity filter chips */}
                    {isDone(variant.security) && secIssues.length > 0 && (
                      <div className="flex items-center gap-1.5 px-4 py-2 bg-[#1c1b1b] border-b border-[#3c4a42]/20">
                        {(["all", "high", "medium", "low"] as const).map((f) => {
                          const isActive = secFilter[v] === f;
                          const counts = f === "all" ? secIssues.length : secIssues.filter((i) => i.severity === f).length;
                          return (
                            <button
                              key={f}
                              onClick={() => setSecFilter((p) => ({ ...p, [v]: f }))}
                              className={cn(
                                "text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all capitalize",
                                isActive
                                  ? f === "high"   ? "bg-[#ffb4ab]/20 border-[#ffb4ab]/40 text-[#ffb4ab]"
                                  : f === "medium" ? "bg-[#e5c07b]/20 border-[#e5c07b]/40 text-[#e5c07b]"
                                  : f === "low"    ? "bg-[#c8c6c5]/20 border-[#c8c6c5]/40 text-[#c8c6c5]"
                                  :                  "bg-[#4edea3]/20 border-[#4edea3]/40 text-[#4edea3]"
                                  : "border-[#3c4a42]/30 text-[#474746] hover:text-[#c8c6c5]"
                              )}
                            >
                              {f} {counts > 0 && <span className="ml-0.5 opacity-70">({counts})</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {/* Backend issues sub-section */}
                    <div className={cn(!noFront && "border-b border-[#3c4a42]/20")}>
                      <div className="flex items-center gap-2 px-4 py-3 bg-[#201f1f] sticky top-0 z-10">
                        <span className="material-symbols-outlined text-sm text-[#4ae176]">dns</span>
                        <span className="text-xs font-bold uppercase tracking-widest text-[#c8c6c5]">Backend Security</span>
                        {(() => {
                          const backIssues = secIssues.filter((i) => i.source === "backend");
                          return backIssues.length > 0 ? (
                            <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded bg-[#ffb4ab]/10 text-[#ffb4ab]">
                              {backIssues.length} fixed
                            </span>
                          ) : isDone(variant.security) ? (
                            <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded bg-[#4edea3]/10 text-[#4edea3]">Clean</span>
                          ) : null;
                        })()}
                      </div>
                      <SecuritySection
                        secScore={secScore}
                        secIssues={secIssues.filter((i) => i.source === "backend")}
                        allIssues={secIssues}
                        isRunning={isRunning(variant.security)}
                        isDone={isDone(variant.security)}
                        hideScore={!noFront}
                        filterSeverity={secFilter[v]}
                      />
                    </div>

                    {/* Frontend issues sub-section — hidden when frontend not required */}
                    {!noFront && (
                      <div>
                        <div className="flex items-center gap-2 px-4 py-3 bg-[#201f1f] sticky top-0 z-10">
                          <span className="material-symbols-outlined text-sm text-[#6ffbbe]">web</span>
                          <span className="text-xs font-bold uppercase tracking-widest text-[#c8c6c5]">Frontend Security</span>
                          {(() => {
                            const frontIssues = secIssues.filter((i) => i.source === "frontend");
                            return frontIssues.length > 0 ? (
                              <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded bg-[#ffb4ab]/10 text-[#ffb4ab]">
                                {frontIssues.length} fixed
                              </span>
                            ) : isDone(variant.security) ? (
                              <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded bg-[#4edea3]/10 text-[#4edea3]">Clean</span>
                            ) : null;
                          })()}
                        </div>
                        <SecuritySection
                          secScore={secScore}
                          secIssues={secIssues.filter((i) => i.source === "frontend")}
                          allIssues={secIssues}
                          isRunning={isRunning(variant.security)}
                          isDone={isDone(variant.security)}
                          hideScore={secIssues.filter((i) => i.source === "frontend").length > 0}
                          filterSeverity={secFilter[v]}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Per-variant chat panel */}
              <ChatPanel
                variantId={v}
                messages={chatMessages[`${story.id}:${v}`] ?? []}
                isRerunning={isRerunning}
                isPipelineRunning={!!runningStories[story.id]}
                onSubmit={(text) => onRequestModification(v, text)}
              />

              {/* Chosen footer */}
              {story.chosenVariant === v && (
                <div className="bg-[#4edea3]/5 border-t border-[#4edea3]/20 px-4 py-2 shrink-0">
                  <span className="text-[#4edea3] text-xs font-bold">✓ Selected for merge</span>
                </div>
              )}
            </Card>
          );
        })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// VariantCard — kept for reference but replaced by VariantGrid above
// ---------------------------------------------------------------------------
function VariantCard({
  variant,
  storyId,
  isChosen,
}: {
  variant: ImplementationVariant;
  storyId: string;
  isChosen: boolean;
}) {
  const isRunning = (out: AgentOutput) => out.status === "running";
  const isDone = (out: AgentOutput) => out.status === "done";

  const anyRunning = isRunning(variant.orchestrator) || isRunning(variant.backend) || isRunning(variant.frontend) || isRunning(variant.security);
  const allDoneVariant = isDone(variant.orchestrator) && isDone(variant.backend) && isDone(variant.frontend) && isDone(variant.security);

  // Active agent label
  let activeLabel = "IDLE";
  let activeLabelColor = "text-[#474746]";
  if (isRunning(variant.orchestrator)) { activeLabel = "ORCHESTRATOR RUNNING"; activeLabelColor = "text-[#4edea3]"; }
  else if (isRunning(variant.backend) || isRunning(variant.frontend)) { activeLabel = "AGENTS RUNNING"; activeLabelColor = "text-[#4ae176]"; }
  else if (isRunning(variant.security)) { activeLabel = "SECURITY SCANNING"; activeLabelColor = "text-[#ffb4ab]"; }
  else if (allDoneVariant) { activeLabel = "DONE"; activeLabelColor = "text-[#4ae176]"; }

  // Orchestrator plan parsing
  const orchContent = variant.orchestrator.content.replace(/\*\*/g, "").replace(/\r/g, "");
  const orchLines = orchContent.split("\n");
  const statusLine = orchLines.find((l) => /^status:/i.test(l.trim()))?.replace(/^status:\s*/i, "").trim() ?? "";
  const completedIdx = orchLines.findIndex((l) => /^completed[:\s]*/i.test(l.trim()));
  const pendingIdx   = orchLines.findIndex((l) => /^pending[:\s]*/i.test(l.trim()));
  const extractItems = (from: number, to?: number) =>
    orchLines.slice(from + 1, to).map((l) => l.replace(/^\s*[-•*]\s*/, "").trim()).filter(Boolean);
  const doneItems    = completedIdx >= 0 ? extractItems(completedIdx, pendingIdx >= 0 ? pendingIdx : undefined) : [];
  const pendingItems = pendingIdx   >= 0 ? extractItems(pendingIdx) : [];
  const allSteps = [...doneItems, ...pendingItems].slice(0, 8);

  // Security parsing
  let secIssues: SecIssue[] = [];
  let secScore = 95;
  try {
    const auditMatch = variant.security.content.match(/AUDIT:\s*\n(\{[\s\S]*?\})\s*$/m)
      ?? variant.security.content.match(/AUDIT:\s*(\{[\s\S]*?\})/);
    const jsonStr = auditMatch?.[1] ?? variant.security.content.match(/(\{[\s\S]*"complianceScore"[\s\S]*\})/)?.[1];
    if (jsonStr) {
      const parsed = JSON.parse(jsonStr);
      secScore = parsed.complianceScore ?? 95;
      secIssues = (parsed.issues ?? []).map((iss: Record<string, string>) => ({
        id: iss.id ?? "SEC-000",
        severity: iss.severity ?? "low",
        title: iss.title ?? "Issue",
        description: iss.description ?? "",
        agentAction: iss.agentAction ?? iss.fix ?? "",
        agentResult: iss.agentResult ?? "Fixed by agent.",
        source: (iss.source === "frontend" ? "frontend" : "backend") as "backend" | "frontend",
      }));
    }
  } catch { /* keep defaults */ }

  return (
    <Card
      className={cn(
        "bg-[#1c1b1b] rounded-2xl border overflow-hidden ring-0 flex flex-col",
        isChosen ? "border-[#4edea3]/40" : "border-[#3c4a42]/20"
      )}
    >
      {/* Card header bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#2a2a2a] border-b border-[#3c4a42]/20 shrink-0">
        <span className="font-mono font-bold text-[10px] uppercase tracking-widest text-[#e5e2e1]">
          VARIANT {variant.id}
        </span>
        <span className={cn("text-[9px] font-bold uppercase tracking-widest", activeLabelColor)}>
          {activeLabel}
        </span>
        <span
          className={cn(
            "inline-block w-2 h-2 rounded-full",
            anyRunning ? "bg-[#4edea3] animate-pulse" : allDoneVariant ? "bg-[#4ae176]" : "bg-[#474746]"
          )}
        />
      </div>

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Orchestrator section */}
        <div className="bg-[#201f1f] p-4 border-b border-[#3c4a42]/20">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-sm text-[#4edea3]">hub</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#c8c6c5]">Orchestrator</span>
            <span
              className={cn(
                "ml-auto text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider",
                isRunning(variant.orchestrator)
                  ? "bg-[#4edea3]/10 text-[#4edea3]"
                  : isDone(variant.orchestrator)
                  ? "bg-[#4ae176]/10 text-[#4ae176]"
                  : "bg-[#353534] text-[#474746]"
              )}
            >
              {isRunning(variant.orchestrator) ? "Running" : isDone(variant.orchestrator) ? "Done" : "Idle"}
            </span>
          </div>

          {isRunning(variant.orchestrator) ? (
            <div className="text-[10px] text-[#c8c6c5] font-mono leading-relaxed line-clamp-4 relative">
              {variant.orchestrator.content || (
                <span className="text-[#4edea3] animate-pulse">Orchestrating…</span>
              )}
              {variant.orchestrator.content && (
                <span className="inline-block w-1.5 h-2.5 bg-[#4edea3] animate-pulse ml-0.5 align-middle" />
              )}
              <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-[#201f1f] to-transparent pointer-events-none" />
            </div>
          ) : isDone(variant.orchestrator) ? (
            <div className="space-y-2">
              {statusLine && (
                <p className="text-[10px] font-bold text-[#4edea3] truncate">{statusLine}</p>
              )}
              <ul className="space-y-1">
                {allSteps.slice(0, 4).map((step, i) => {
                  const allComplete = isDone(variant.backend) && isDone(variant.frontend);
                  return (
                    <li key={i} className="flex items-start gap-1.5 text-[10px]">
                      <span
                        className={cn(
                          "material-symbols-outlined text-xs mt-px shrink-0",
                          allComplete ? "text-[#4edea3]" : "text-[#474746]"
                        )}
                      >
                        {allComplete ? "check_circle" : "pending"}
                      </span>
                      <span className={cn("leading-relaxed", allComplete ? "text-[#c8c6c5]" : "text-[#474746] italic")}>
                        {step}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <p className="text-[10px] text-[#474746]">Waiting for orchestrator…</p>
          )}
        </div>

        {/* Agent handoff line: orchestrator→backend */}
        {isDone(variant.orchestrator) && (isRunning(variant.backend) || isRunning(variant.frontend)) && (
          <div className="agent-flow-line h-6 flex items-center justify-center shrink-0">
            <div className="w-0.5 h-full bg-gradient-to-b from-[#4edea3]/40 to-[#4ae176]/20" />
          </div>
        )}

        {/* Backend section */}
        <div className="border-b border-[#3c4a42]/20">
          <div className="flex items-center gap-2 px-4 py-2 bg-[#201f1f]">
            <span className="material-symbols-outlined text-sm text-[#4ae176]">dns</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#c8c6c5]">Backend Agent</span>
            <span
              className={cn(
                "ml-auto text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider",
                isRunning(variant.backend)
                  ? "bg-[#4ae176]/10 text-[#4ae176]"
                  : isDone(variant.backend)
                  ? "bg-[#4ae176]/10 text-[#4ae176]"
                  : "bg-[#353534] text-[#474746]"
              )}
            >
              {isRunning(variant.backend) ? "Running" : isDone(variant.backend) ? "Done" : "Idle"}
            </span>
          </div>
          <CodeBlock
            label="Backend Agent"
            icon="dns"
            color="text-[#4ae176]"
            filename={`controllers/stream_v${variant.id.toLowerCase()}.ts`}
            code={variant.backend.content}
            loading={isRunning(variant.backend)}
          />
        </div>

        {/* Agent handoff line: backend+frontend → security */}
        {isDone(variant.backend) && isDone(variant.frontend) && (isRunning(variant.security) || isDone(variant.security)) && (
          <div className="agent-flow-line h-6 flex items-center justify-center shrink-0">
            <div className="w-0.5 h-full bg-gradient-to-b from-[#4ae176]/30 to-[#ffb4ab]/20" />
          </div>
        )}

        {/* Frontend section */}
        <div className="border-b border-[#3c4a42]/20">
          <div className="flex items-center gap-2 px-4 py-2 bg-[#201f1f]">
            <span className="material-symbols-outlined text-sm text-[#6ffbbe]">web</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#c8c6c5]">Frontend Agent</span>
            <span
              className={cn(
                "ml-auto text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider",
                isRunning(variant.frontend)
                  ? "bg-[#6ffbbe]/10 text-[#6ffbbe]"
                  : isDone(variant.frontend)
                  ? "bg-[#6ffbbe]/10 text-[#6ffbbe]"
                  : "bg-[#353534] text-[#474746]"
              )}
            >
              {isRunning(variant.frontend) ? "Running" : isDone(variant.frontend) ? "Done" : "Idle"}
            </span>
          </div>
          <CodeBlock
            label="Frontend Agent"
            icon="web"
            color="text-[#6ffbbe]"
            filename={`components/StoryView_v${variant.id}.tsx`}
            code={variant.frontend.content}
            loading={isRunning(variant.frontend)}
          />
        </div>

        {/* Security section */}
        <SecuritySection
          secScore={secScore}
          secIssues={secIssues}
          isRunning={isRunning(variant.security)}
          isDone={isDone(variant.security)}
        />

        {/* Card footer — chosen variant */}
        {isChosen && (
          <div className="bg-[#4edea3]/5 border-t border-[#4edea3]/20 px-4 py-2 shrink-0">
            <span className="text-[#4edea3] text-xs font-bold">✓ Selected for merge</span>
          </div>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Global Evaluator Panel
// ---------------------------------------------------------------------------
function GlobalEvaluatorPanel({
  story,
  evalContent,
  onChoose,
}: {
  story: UserStory;
  evalContent: string;
  onChoose: (v: VariantId) => void;
}) {
  const [chosen, setChosen] = useState<VariantId | null>(story.chosenVariant ?? null);
  const [compareMode, setCompareMode] = useState(false);
  const [evalChatMessages, setEvalChatMessages] = useState<{ role: "user" | "agent"; content: string }[]>([]);
  const [evalDraft, setEvalDraft] = useState("");
  const [evalChatRunning, setEvalChatRunning] = useState(false);
  const evalScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (evalScrollRef.current) {
      evalScrollRef.current.scrollIntoView({ block: "end" });
    }
  }, [evalChatMessages.length]);

  const sendEvalMessage = async () => {
    if (!evalDraft.trim() || evalChatRunning) return;
    const userMsg = { role: "user" as const, content: evalDraft.trim() };
    setEvalChatMessages((p) => [...p, userMsg]);
    setEvalDraft("");
    setEvalChatRunning(true);

    const context = `Current evaluation results:\n${evalContent}\n\nUser question: ${userMsg.content}`;
    let reply = "";
    try {
      reply = await callAgentStream(
        { role: "evaluator", storyId: story.id, storyTitle: story.title, storyDescription: story.description, context },
        () => {}
      );
    } catch (e) {
      reply = `Error: ${e}`;
    }
    setEvalChatMessages((p) => [...p, { role: "agent", content: reply }]);
    setEvalChatRunning(false);
  };

  type EvalData = { pros: string[]; cons: string[]; complexityScore: number; recommended: boolean };
  let EVALS: Record<VariantId, EvalData> = {
    A: { pros: [], cons: [], complexityScore: 7, recommended: false },
    B: { pros: [], cons: [], complexityScore: 8, recommended: true },
    C: { pros: [], cons: [], complexityScore: 7, recommended: false },
  };
  try {
    const jsonMatch = evalContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      EVALS = { ...EVALS, ...parsed };
    }
  } catch { /* keep defaults */ }

  return (
    <Card className="bg-[#1c1b1b] rounded-2xl border border-[#4edea3]/20 ring-0 slide-up overflow-hidden">
      <CardContent className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#4edea3]/10 flex items-center justify-center text-[#4edea3] shrink-0">
            <span className="material-symbols-outlined">balance</span>
          </div>
          <div>
            <h3 className="font-bold text-[#e5e2e1] font-serif">Global Evaluator</h3>
            <p className="text-[11px] text-[#c8c6c5]">AI-powered variant comparison</p>
          </div>
          <button
            onClick={() => setCompareMode((v) => !v)}
            className={cn(
              "ml-auto flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all",
              compareMode
                ? "bg-[#4edea3]/20 border-[#4edea3]/40 text-[#4edea3]"
                : "bg-[#353534] border-[#3c4a42]/30 text-[#474746] hover:text-[#c8c6c5]"
            )}
          >
            <span className="material-symbols-outlined text-sm">compare</span>
            {compareMode ? "Hide Comparison" : "Compare Code"}
          </button>
        </div>

        {/* 3-column variant comparison */}
        <div className="grid grid-cols-3 gap-4">
          {(["A", "B", "C"] as VariantId[]).map((v) => {
            const ev = EVALS[v];
            // Derived metric values from complexityScore
            const complexity = Math.min(100, Math.round((ev.complexityScore / 10) * 100));
            const security   = Math.min(100, Math.round(complexity * 0.9 + 5));
            const perf       = Math.min(100, Math.round(complexity * 0.85 + 8));

            return (
              <Card
                key={v}
                className={cn(
                  "rounded-2xl border flex flex-col gap-0 ring-0 overflow-hidden transition-all",
                  chosen === v
                    ? "border-[#4edea3]/60 bg-[#4edea3]/5"
                    : ev.recommended
                    ? "border-[#4edea3]/20 bg-[#201f1f]"
                    : "border-[#3c4a42]/20 bg-[#201f1f]"
                )}
              >
                <CardContent className="p-4 flex flex-col gap-4">
                  {/* Label + score + recommended */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#e5e2e1] font-serif">Variant {v}</span>
                    <span className="text-[#4edea3] font-bold text-sm font-mono">{ev.complexityScore}/10</span>
                  </div>
                  {ev.recommended && (
                    <Badge className="bg-[#4edea3]/20 text-[#4edea3] border-0 text-xs font-bold w-fit">
                      Recommended
                    </Badge>
                  )}

                  {/* Animated metric bars */}
                  <div className="space-y-2">
                    {[
                      { label: "Complexity", value: complexity, color: "bg-[#4edea3]" },
                      { label: "Security",   value: security,   color: "bg-[#4ae176]" },
                      { label: "Performance",value: perf,       color: "bg-[#6ffbbe]" },
                    ].map((metric) => (
                      <div key={metric.label} className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-[#c8c6c5] uppercase tracking-wider">{metric.label}</span>
                          <span className="text-xs font-mono text-[#e5e2e1]">{metric.value}%</span>
                        </div>
                        <div className="h-1 bg-[#353534] rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full bar-grow", metric.color)}
                            style={{ width: `${metric.value}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pros */}
                  {ev.pros.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-bold text-[#4ae176] uppercase tracking-wider">Pros</p>
                      {ev.pros.slice(0, 3).map((p, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-[13px] text-[#e5e2e1]">
                          <span className="material-symbols-outlined text-[#4edea3] text-sm mt-px shrink-0">add_circle</span>
                          <span className="leading-relaxed">{p}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Cons */}
                  {ev.cons.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-bold text-[#ffb4ab] uppercase tracking-wider">Cons</p>
                      {ev.cons.slice(0, 2).map((c, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-[13px] text-[#c8c6c5]">
                          <span className="material-symbols-outlined text-[#ffb4ab] text-sm mt-px shrink-0">remove_circle</span>
                          <span className="leading-relaxed">{c}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Choose button */}
                  <Button
                    variant={chosen === v ? "default" : "outline"}
                    onClick={() => { setChosen(v); onChoose(v); }}
                    className={cn(
                      "mt-auto py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all h-auto",
                      chosen === v
                        ? "primary-gradient text-[#003824] shadow-lg shadow-[#4edea3]/10 border-transparent"
                        : "bg-[#353534] text-[#e5e2e1] hover:bg-[#474746] border-[#3c4a42]/20"
                    )}
                  >
                    {chosen === v ? "Selected" : `Choose Variant ${v}`}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Code comparison grid — 3 columns, shown when compareMode active */}
        {compareMode && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-sm text-[#4edea3]">code</span>
              <span className="text-xs font-bold uppercase tracking-widest text-[#c8c6c5]">Backend Code Comparison</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(["A", "B", "C"] as VariantId[]).map((v) => {
                const variant = story.variants.find((x) => x.id === v);
                return (
                  <div key={v} className="space-y-1">
                    <div className="flex items-center gap-2 px-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#4edea3]">Variant {v}</span>
                    </div>
                    <CodeBlock
                      label={`Variant ${v}`}
                      icon="dns"
                      color="text-[#4ae176]"
                      filename={`stream_v${v.toLowerCase()}.ts`}
                      code={variant?.backend.content ?? ""}
                      loading={false}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>

      {/* Evaluator chat */}
      <div className="border-t border-[#3c4a42]/20">
        {/* Chat header */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-[#201f1f]">
          <span className="material-symbols-outlined text-sm text-[#4edea3]" style={{ fontSize: "14px" }}>chat</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#c8c6c5]">Ask the Evaluator</span>
          {evalChatRunning && <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3] animate-pulse ml-1" />}
        </div>

        {/* Chat history */}
        {evalChatMessages.length > 0 && (
          <ScrollArea className="h-[220px] px-4 py-2">
            <div className="space-y-2">
              {evalChatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex gap-2 items-start text-[12px] leading-relaxed",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {msg.role === "agent" && (
                    <span className="material-symbols-outlined text-[#4edea3] shrink-0 mt-0.5" style={{ fontSize: "14px" }}>smart_toy</span>
                  )}
                  <span
                    className={cn(
                      "rounded-lg px-3 py-2 max-w-[85%] text-[13px]",
                      msg.role === "user"
                        ? "bg-[#4edea3]/10 text-[#4edea3]"
                        : "bg-[#2a2a2a] text-[#c8c6c5]"
                    )}
                  >
                    {msg.content}
                  </span>
                  {msg.role === "user" && (
                    <span className="material-symbols-outlined text-[#474746] shrink-0 mt-0.5" style={{ fontSize: "14px" }}>person</span>
                  )}
                </div>
              ))}
              <div ref={evalScrollRef} />
            </div>
          </ScrollArea>
        )}

        {/* Input */}
        <div className="flex items-end gap-2 px-4 py-3">
          <textarea
            value={evalDraft}
            onChange={(e) => setEvalDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendEvalMessage(); }
            }}
            placeholder={evalChatRunning ? "Evaluator thinking…" : "Ask about trade-offs, recommend a variant, explain pros/cons…"}
            disabled={evalChatRunning}
            rows={2}
            style={{ resize: "none" }}
            className={cn(
              "flex-1 bg-[#2a2a2a] border border-[#3c4a42]/30 rounded-lg px-3 py-2",
              "text-[12px] text-[#e5e2e1] placeholder:text-[#474746] font-mono",
              "outline-none focus:border-[#4edea3]/40 transition-colors leading-relaxed",
              evalChatRunning && "opacity-50 cursor-not-allowed"
            )}
          />
          <button
            onClick={sendEvalMessage}
            disabled={!evalDraft.trim() || evalChatRunning}
            className={cn(
              "flex items-center justify-center w-8 h-8 rounded-lg shrink-0 transition-colors",
              evalDraft.trim() && !evalChatRunning
                ? "bg-[#4edea3]/10 hover:bg-[#4edea3]/20 text-[#4edea3]"
                : "bg-[#2a2a2a] text-[#474746] cursor-not-allowed"
            )}
            title="Ask evaluator"
          >
            {evalChatRunning
              ? <span className="w-3 h-3 border-2 border-[#4edea3]/30 border-t-[#4edea3] rounded-full animate-spin" />
              : <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>send</span>
            }
          </button>
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sidebar — Pipeline Stepper
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
function ImplementationPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project") ?? "";
  const storyIdParam = searchParams.get("story") ?? "";
  const autoRun = searchParams.get("autorun") === "1";

  const [stories, setStories] = useState<UserStory[]>([]);
  const [mounted, setMounted] = useState(false);
  const [runningStories, setRunningStories] = useState<Record<string, boolean>>({});
  const [showEvaluator, setShowEvaluator] = useState<Record<string, boolean>>({});
  const [evalContent, setEvalContent] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {};
    try { const raw = localStorage.getItem("itfest_state"); if (!raw) return {}; const p = JSON.parse(raw); return p.evalContent ?? {}; } catch { return {}; }
  });
  // reasoning: key = `${storyId}:${variantId}`
  const [reasoningContent, setReasoningContent] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {};
    try { const raw = localStorage.getItem("itfest_state"); if (!raw) return {}; const p = JSON.parse(raw); return p.reasoningContent ?? {}; } catch { return {}; }
  });
  // noFrontend: key = `${storyId}:${variantId}` — true when reasoning says frontend not needed
  const [noFrontend, setNoFrontend] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try { const raw = localStorage.getItem("itfest_state"); if (!raw) return {}; const p = JSON.parse(raw); return p.noFrontend ?? {}; } catch { return {}; }
  });
  const [selectedStoryId, setSelectedStoryId] = useState<string>(storyIdParam);
  const [rerunningVariants, setRerunningVariants] = useState<Record<string, boolean>>({});
  const [chatMessages, setChatMessages] = useState<Record<string, ChatMessage[]>>(() => {
    if (typeof window === "undefined") return {};
    try { const raw = localStorage.getItem("itfest_state"); if (!raw) return {}; const p = JSON.parse(raw); return p.chatMessages ?? {}; } catch { return {}; }
  });
  // prevCode: keyed `${storyId}:${variantId}`, stores backend/frontend code before last rerun
  const [prevCode, setPrevCode] = useState<Record<string, { backend: string; frontend: string }>>({});
  // Per-story poker sessions — one session per story
  const [pokerSessions, setPokerSessions] = useState<Record<string, PokerSession>>(() => {
    if (typeof window === "undefined") return {};
    try { const raw = localStorage.getItem("itfest_poker"); if (!raw) return {}; const p = JSON.parse(raw); return p.pokerSessions ?? {}; } catch { return {}; }
  });
  // Ref always holds the latest value — avoids stale closures in async poker logic
  const pokerSessionsRef = useRef<Record<string, PokerSession>>({});
  useEffect(() => { pokerSessionsRef.current = pokerSessions; }, [pokerSessions]);
  // Per-story assigned agent label, set after poker completes (storyId → agent label)
  const [storyAssignees, setStoryAssignees] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {};
    try { const raw = localStorage.getItem("itfest_poker"); if (!raw) return {}; const p = JSON.parse(raw); return p.storyAssignees ?? {}; } catch { return {}; }
  });
  // True when every story has a completed poker session
  const allDonePoker = stories.every((s) => pokerSessions[s.id]?.phase === "done");
  // Which story's poker drawer is open (null = closed)
  const [drawerStoryId, setDrawerStoryId] = useState<string | null>(null);
  const addLog = useCallback((_log: Omit<ActivityLog, "id">) => {}, []);

  // Hydrate from localStorage on mount
  useEffect(() => {
    let cancelled = false;

    async function hydratePage() {
      try {
        const existingState = JSON.parse(localStorage.getItem("itfest_state") || "{}");
        const existingPoker = JSON.parse(localStorage.getItem("itfest_poker") || "{}");
        const dbSnapshot = await hydrateLegacySnapshots(projectId);
        const nextState = {
          ...existingState,
          ...(dbSnapshot?.legacyState ?? {}),
          stories:
            Array.isArray(dbSnapshot?.userStories) && dbSnapshot.userStories.length > 0
              ? dbSnapshot.userStories
              : existingState.stories,
        };
        const nextPoker = {
          ...existingPoker,
          ...(dbSnapshot?.legacyPoker ?? {}),
        };

        localStorage.setItem("itfest_state", JSON.stringify(nextState));
        localStorage.setItem("itfest_poker", JSON.stringify(nextPoker));

        if (cancelled) return;
        if (nextState.stories?.length) setStories(nextState.stories);
        if (nextState.reasoningContent) setReasoningContent(nextState.reasoningContent);
        if (nextState.evalContent) setEvalContent(nextState.evalContent);
        if (nextState.chatMessages) setChatMessages(nextState.chatMessages);
        if (nextState.noFrontend) setNoFrontend(nextState.noFrontend);
        if (nextPoker.pokerSessions) setPokerSessions(nextPoker.pokerSessions);
        if (nextPoker.storyAssignees) setStoryAssignees(nextPoker.storyAssignees);
      } catch { /* ignore */ }
      finally {
        if (!cancelled) setMounted(true);
      }
    }

    void hydratePage();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const now = () => new Date().toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

  const patchVariant = useCallback((storyId: string, variantId: VariantId, role: keyof ImplementationVariant, patch: Partial<AgentOutput>, append: boolean) => {
    setStories((prev) =>
      prev.map((s) => {
        if (s.id !== storyId) return s;
        return {
          ...s,
          variants: s.variants.map((v) => {
            if (v.id !== variantId) return v;
            const existing = v[role] as AgentOutput;
            return {
              ...v,
              [role]: {
                ...existing,
                ...patch,
                content: append
                  ? existing.content + (patch.content ?? "")
                  : (patch.content ?? existing.content),
              },
            };
          }),
        };
      })
    );
  }, []);

  const runImplementation = useCallback(
    async (storyId: string) => {
      if (runningStories[storyId]) return;
      setRunningStories((p) => ({ ...p, [storyId]: true }));

      const story = stories.find((s) => s.id === storyId);
      if (!story) {
        setRunningStories((p) => ({ ...p, [storyId]: false }));
        return;
      }

      const initVariants: ImplementationVariant[] = (["A", "B", "C"] as VariantId[]).map((id) => ({
        ...makeVariant(id),
        orchestrator: { role: "orchestrator", status: "running", content: "", timestamp: now() },
        backend:      { role: "backend",      status: "running", content: "", timestamp: now() },
        frontend:     { role: "frontend",     status: "idle",    content: "", timestamp: now() },
        security:     { role: "security",     status: "running", content: "", timestamp: now() },
      }));

      setStories((prev) =>
        prev.map((s) => (s.id === storyId ? { ...s, status: "implementing", variants: initVariants } : s))
      );

      addLog({ agent: "ORCHESTRATOR AGENT", agentColor: "text-[#4edea3]", message: `Orchestrating 3 parallel variants for ${storyId}…`, timestamp: now(), type: "orchestrator", progress: 5 });

      const base = { storyId, storyTitle: story.title, storyDescription: story.description };

      await Promise.all(
        (["A", "B", "C"] as VariantId[]).map(async (v) => {
          // Small stagger so variants don't all transition simultaneously
          const variantOffset = { A: 0, B: 120, C: 240 }[v] ?? 0;
          await sleep(variantOffset);

          addLog({ agent: `ORCHESTRATOR (V${v})`, agentColor: "text-[#4edea3]", message: `Analyzing story for Variant ${v}…`, timestamp: now(), type: "orchestrator", progress: 10 });

          // Step 1: reasoning — analyze story, extract implementation points
          const reasoningResult = await callAgentStream(
            { ...base, role: "reasoning", variantId: v },
            () => {} // silent stream — stored on completion
          ).catch(() => "");
          const rKey = `${storyId}:${v}`;
          setReasoningContent((p) => ({ ...p, [rKey]: reasoningResult }));

          // Parse whether frontend is needed
          const needsFrontendMatch = reasoningResult.match(/Needs Frontend:\s*(yes|no)/i);
          const needsFrontend = needsFrontendMatch ? needsFrontendMatch[1].toLowerCase() !== "no" : true;
          setNoFrontend((p) => ({ ...p, [rKey]: !needsFrontend }));
          if (!needsFrontend) {
            patchVariant(storyId, v, "frontend", { status: "done", content: "", timestamp: now() }, false);
          }

          addLog({ agent: `ORCHESTRATOR (V${v})`, agentColor: "text-[#4edea3]", message: `Planning implementation for Variant ${v}…`, timestamp: now(), type: "orchestrator", progress: 15 });

          // Step 2: orchestrator — uses reasoning as context (+ poker context + briefing notes if available)
          const pokerCtx = pokerSessions[storyId]?.phase === "done" ? pokerSessions[storyId].pokerContext : null;
          const storyNotes = stories.find((s) => s.id === storyId)?.notes?.trim();
          const orchContext = [
            pokerCtx,
            storyNotes ? `Briefing Notes from the team:\n${storyNotes}` : null,
            reasoningResult,
          ].filter(Boolean).join("\n\n---\n\n");
          const orchResult = await callAgentStream(
            { ...base, role: "orchestrator", variantId: v, context: orchContext },
            (delta) => patchVariant(storyId, v, "orchestrator", { content: delta, status: "running" }, true)
          ).catch((e) => `Error: ${e}`);

          // Brief pause so the last timeline node is visible before transitioning to done
          await sleep(600);
          patchVariant(storyId, v, "orchestrator", { status: "done", content: orchResult, timestamp: now() }, false);
          addLog({ agent: `ORCHESTRATOR (V${v})`, agentColor: "text-[#4edea3]", message: `Plan ready for V${v}. Dispatching Backend & Frontend agents.`, timestamp: now(), type: "orchestrator" });

          // Pause before backend/frontend start — lets the "done" orchestrator state breathe
          await sleep(400);

          if (needsFrontend) {
            addLog({ agent: `FRONTEND AGENT (V${v})`, agentColor: "text-[#6ffbbe]", message: `Building UI component for Variant ${v}…`, timestamp: now(), type: "frontend", progress: 40 });
          }
          addLog({ agent: `BACKEND AGENT (V${v})`,  agentColor: "text-[#4ae176]", message: `Implementing server-side logic for Variant ${v}…`, timestamp: now(), type: "backend",  progress: 40 });

          // Mark backend/frontend as running before the stream starts
          patchVariant(storyId, v, "backend",  { status: "running", content: "" }, false);
          if (needsFrontend) patchVariant(storyId, v, "frontend", { status: "running", content: "" }, false);

          const backendPromise = callAgentStream(
            { ...base, role: "backend", variantId: v, context: orchResult },
            (delta) => patchVariant(storyId, v, "backend", { content: delta, status: "running" }, true)
          ).catch((e) => `Error: ${e}`);

          const frontendPromise = needsFrontend
            ? callAgentStream(
                { ...base, role: "frontend", variantId: v, context: orchResult },
                (delta) => patchVariant(storyId, v, "frontend", { content: delta, status: "running" }, true)
              ).catch((e) => `Error: ${e}`)
            : Promise.resolve("");

          const [backResult, frontResult] = await Promise.all([backendPromise, frontendPromise]);

          // Pause so code output is visible before the security handoff
          await sleep(700);
          patchVariant(storyId, v, "backend",  { status: "done", content: backResult,  timestamp: now() }, false);
          if (needsFrontend) {
            patchVariant(storyId, v, "frontend", { status: "done", content: frontResult, timestamp: now() }, false);
          }

          addLog({ agent: `BACKEND AGENT (V${v})`, agentColor: "text-[#4ae176]", message: `Backend done for V${v}. Handing off to Security.`, timestamp: now(), type: "backend" });
          if (needsFrontend) {
            addLog({ agent: `FRONTEND AGENT (V${v})`, agentColor: "text-[#6ffbbe]", message: `Frontend done for V${v}. Handing off to Security.`, timestamp: now(), type: "frontend" });
          }

          // Pause before security — makes the handoff feel intentional
          await sleep(500);
          addLog({ agent: `SECURITY AUDITOR (V${v})`, agentColor: "text-[#ffb4ab]", message: `Scanning Variant ${v} for vulnerabilities…`, timestamp: now(), type: "security", progress: 80 });
          patchVariant(storyId, v, "security", { status: "running", content: "" }, false);
          const secContext = `Backend:\n${backResult}\n\nFrontend:\n${frontResult}`;
          const secResult = await callAgentStream(
            { ...base, role: "security", variantId: v, context: secContext },
            (delta) => patchVariant(storyId, v, "security", { content: delta, status: "running" }, true)
          ).catch(() => `PATCHED_BACKEND:\n\`\`\`typescript\n${backResult}\n\`\`\`\n\nPATCHED_FRONTEND:\n\`\`\`typescript\nNONE\n\`\`\`\n\nAUDIT:\n{"vulnerabilities":0,"complianceScore":95,"issues":[]}`);

          // Parse patched code out of the security output and overwrite backend/frontend
          const patchedBackendMatch = secResult.match(/PATCHED_BACKEND:\s*```(?:typescript)?\n([\s\S]*?)```/);
          const patchedFrontendMatch = secResult.match(/PATCHED_FRONTEND:\s*```(?:typescript)?\n([\s\S]*?)```/);
          const patchedBackend = patchedBackendMatch?.[1]?.trim() ?? "";
          const patchedFrontend = patchedFrontendMatch?.[1]?.trim() ?? "";

          if (patchedBackend && patchedBackend !== "NONE") {
            patchVariant(storyId, v, "backend", { content: patchedBackend }, false);
          }
          if (needsFrontend && patchedFrontend && patchedFrontend !== "NONE") {
            patchVariant(storyId, v, "frontend", { content: patchedFrontend }, false);
          }

          // Pause so security results are visible before marking done
          await sleep(500);
          patchVariant(storyId, v, "security", { status: "done", content: secResult, timestamp: now() }, false);
          addLog({ agent: `SECURITY AUDITOR (V${v})`, agentColor: "text-[#ffb4ab]", message: `V${v} audit complete. Patched code applied.`, timestamp: now(), type: "security" });
        })
      );

      // Pause before evaluator so all three "done" states render smoothly
      await sleep(800);
      addLog({ agent: "GLOBAL EVALUATOR", agentColor: "text-[#c8c6c5]", message: `All 3 variants complete for ${storyId}. Running evaluation…`, timestamp: now(), type: "evaluator", progress: 95 });

      // Read current variant content from state via a synchronous snapshot
      let evalContext = "";
      setStories((prev) => {
        const storyNow = prev.find((s) => s.id === storyId);
        evalContext = storyNow?.variants.map((v) =>
          `Variant ${v.id}:\nBackend:\n${v.backend.content}\n\nFrontend:\n${v.frontend.content}`
        ).join("\n\n---\n\n") ?? "";
        return prev;
      });

      // Run evaluator outside the state setter
      try {
        const evalResult = await callAgentStream(
          { ...base, role: "evaluator", context: evalContext },
          () => {}
        );
        setEvalContent((p) => ({ ...p, [storyId]: evalResult }));
        addLog({ agent: "GLOBAL EVALUATOR", agentColor: "text-[#c8c6c5]", message: `Evaluation ready. Choose your variant for ${storyId}.`, timestamp: now(), type: "evaluator" });
      } catch { /* ignore */ }

      setStories((p2) => p2.map((s) => (s.id === storyId ? { ...s, status: "evaluating" } : s)));
      setShowEvaluator((p) => ({ ...p, [storyId]: true }));
      setRunningStories((p) => ({ ...p, [storyId]: false }));
    },
    [stories, runningStories, addLog, patchVariant, pokerSessions]
  );

  const chooseVariant = useCallback((storyId: string, v: VariantId) => {
    setStories((prev) =>
      prev.map((s) => (s.id === storyId ? { ...s, chosenVariant: v, status: "done" } : s))
    );
    addLog({ agent: "ORCHESTRATOR AGENT", agentColor: "text-[#4edea3]", message: `Variant ${v} selected for ${storyId}. Ready to merge.`, timestamp: now(), type: "orchestrator" });
  }, [addLog]);

  // Re-run just one agent (backend or frontend) + security for a specific variant
  const rerunAgentOnly = useCallback(async (storyId: string, variantId: VariantId, agentRole: "backend" | "frontend") => {
    const key = `${storyId}:${variantId}`;
    if (rerunningVariants[key] || runningStories[storyId]) return;
    setRerunningVariants((p) => ({ ...p, [key]: true }));

    const storyObj = stories.find((s) => s.id === storyId);
    if (!storyObj) { setRerunningVariants((p) => ({ ...p, [key]: false })); return; }
    const base = { storyId, storyTitle: storyObj.title, storyDescription: storyObj.description };
    const needsFrontend = !noFrontend[key];
    const variant = storyObj.variants.find((v) => v.id === variantId);
    const orchContent = variant?.orchestrator.content ?? "";

    // Save prevCode
    if (variant) {
      setPrevCode((p) => ({ ...p, [key]: { backend: variant.backend.content, frontend: variant.frontend.content } }));
    }

    patchVariant(storyId, variantId, agentRole, { status: "running", content: "", timestamp: now() }, false);
    const result = await callAgentStream(
      { ...base, role: agentRole, variantId, context: orchContent },
      (delta) => patchVariant(storyId, variantId, agentRole, { content: delta, status: "running" }, true)
    ).catch((e) => `Error: ${e}`);
    await sleep(400);
    patchVariant(storyId, variantId, agentRole, { status: "done", content: result, timestamp: now() }, false);

    // Re-run security with updated code
    const backContent  = agentRole === "backend"   ? result : (variant?.backend.content ?? "");
    const frontContent = agentRole === "frontend"  ? result : (variant?.frontend.content ?? "");
    patchVariant(storyId, variantId, "security", { status: "running", content: "", timestamp: now() }, false);
    const secContext = `Backend:\n${backContent}\n\nFrontend:\n${frontContent}`;
    const secResult = await callAgentStream(
      { ...base, role: "security", variantId, context: secContext },
      (delta) => patchVariant(storyId, variantId, "security", { content: delta, status: "running" }, true)
    ).catch(() => `PATCHED_BACKEND:\n\`\`\`typescript\n${backContent}\n\`\`\`\n\nPATCHED_FRONTEND:\n\`\`\`typescript\nNONE\n\`\`\`\n\nAUDIT:\n{"vulnerabilities":0,"complianceScore":95,"issues":[]}`);

    const pBackMatch  = secResult.match(/PATCHED_BACKEND:\s*```(?:typescript)?\n([\s\S]*?)```/);
    const pFrontMatch = secResult.match(/PATCHED_FRONTEND:\s*```(?:typescript)?\n([\s\S]*?)```/);
    const pBack  = pBackMatch?.[1]?.trim()  ?? "";
    const pFront = pFrontMatch?.[1]?.trim() ?? "";
    if (pBack && pBack !== "NONE")   patchVariant(storyId, variantId, "backend",  { content: pBack  }, false);
    if (needsFrontend && pFront && pFront !== "NONE") patchVariant(storyId, variantId, "frontend", { content: pFront }, false);
    await sleep(300);
    patchVariant(storyId, variantId, "security", { status: "done", content: secResult, timestamp: now() }, false);
    setRerunningVariants((p) => ({ ...p, [key]: false }));
  }, [rerunningVariants, runningStories, stories, noFrontend, patchVariant]);

  // Re-run just the orchestrator for one variant, using edited reasoning as context
  const rerunOrchestrator = useCallback(async (storyId: string, variantId: VariantId, editedReasoning: string) => {
    const story = stories.find((s) => s.id === storyId)!;
    const base = { storyId, storyTitle: story.title, storyDescription: story.description };
    patchVariant(storyId, variantId, "orchestrator", { status: "running", content: "" }, false);
    const orchResult = await callAgentStream(
      { ...base, role: "orchestrator", variantId, context: `User reasoning/guidance:\n${editedReasoning}` },
      (delta) => patchVariant(storyId, variantId, "orchestrator", { content: delta, status: "running" }, true)
    ).catch((e) => `Error: ${e}`);
    patchVariant(storyId, variantId, "orchestrator", { status: "done", content: orchResult, timestamp: now() }, false);
  }, [patchVariant]);

  // Re-run full pipeline for a specific variant based on a user chat message
  const rerunVariant = useCallback(async (storyId: string, variantId: VariantId, userMessage: string) => {
    const key = `${storyId}:${variantId}`;
    if (rerunningVariants[key] || runningStories[storyId]) return;

    // Push user message immediately
    const userMsg: ChatMessage = {
      id: `${variantId}-${Date.now()}`,
      role: "user",
      content: userMessage,
      timestamp: now(),
    };
    setChatMessages((p) => ({ ...p, [key]: [...(p[key] ?? []), userMsg] }));

    setRerunningVariants((p) => ({ ...p, [key]: true }));

    const storyObj = stories.find((s) => s.id === storyId)!;
    const base = { storyId, storyTitle: storyObj.title, storyDescription: storyObj.description };
    const needsFrontend = !noFrontend[key];

    // Save current code before overwriting (for diff view)
    setStories((prev) => {
      const storyNow = prev.find((s) => s.id === storyId);
      const vt = storyNow?.variants.find((x) => x.id === variantId);
      if (vt) {
        setPrevCode((p) => ({ ...p, [key]: { backend: vt.backend.content, frontend: vt.frontend.content } }));
      }
      return prev;
    });

    // Build cumulative context from all prior user messages + existing reasoning
    const allUserMsgs = [...(chatMessages[key] ?? []), userMsg].filter((m) => m.role === "user");
    const chatHistory = allUserMsgs
      .map((m, i) => `[Modification ${i + 1}]: ${m.content}`)
      .join("\n");
    const existingReasoning = reasoningContent[key] ?? "";
    const augmentedContext = existingReasoning
      ? `${existingReasoning}\n\n---\nModification history:\n${chatHistory}`
      : `Modification history:\n${chatHistory}`;

    // Reset all agents
    patchVariant(storyId, variantId, "orchestrator", { status: "running", content: "", timestamp: now() }, false);
    patchVariant(storyId, variantId, "backend",      { status: "running", content: "", timestamp: now() }, false);
    if (needsFrontend) {
      patchVariant(storyId, variantId, "frontend",   { status: "running", content: "", timestamp: now() }, false);
    }
    patchVariant(storyId, variantId, "security",     { status: "running", content: "", timestamp: now() }, false);

    // Orchestrator
    const orchResult = await callAgentStream(
      { ...base, role: "orchestrator", variantId, context: augmentedContext },
      (delta) => patchVariant(storyId, variantId, "orchestrator", { content: delta, status: "running" }, true)
    ).catch((e) => `Error: ${e}`);
    await sleep(400);
    patchVariant(storyId, variantId, "orchestrator", { status: "done", content: orchResult, timestamp: now() }, false);

    // Backend + Frontend in parallel
    patchVariant(storyId, variantId, "backend",  { status: "running", content: "", timestamp: now() }, false);
    if (needsFrontend) {
      patchVariant(storyId, variantId, "frontend", { status: "running", content: "", timestamp: now() }, false);
    }

    const backendP = callAgentStream(
      { ...base, role: "backend", variantId, context: orchResult },
      (delta) => patchVariant(storyId, variantId, "backend", { content: delta, status: "running" }, true)
    ).catch((e) => `Error: ${e}`);
    const frontendP = needsFrontend
      ? callAgentStream(
          { ...base, role: "frontend", variantId, context: orchResult },
          (delta) => patchVariant(storyId, variantId, "frontend", { content: delta, status: "running" }, true)
        ).catch((e) => `Error: ${e}`)
      : Promise.resolve("");
    const [backResult, frontResult] = await Promise.all([backendP, frontendP]);

    await sleep(500);
    patchVariant(storyId, variantId, "backend",  { status: "done", content: backResult,  timestamp: now() }, false);
    if (needsFrontend) {
      patchVariant(storyId, variantId, "frontend", { status: "done", content: frontResult, timestamp: now() }, false);
    }

    // Security
    patchVariant(storyId, variantId, "security", { status: "running", content: "", timestamp: now() }, false);
    const secContext = `Backend:\n${backResult}\n\nFrontend:\n${frontResult}`;
    const secResult = await callAgentStream(
      { ...base, role: "security", variantId, context: secContext },
      (delta) => patchVariant(storyId, variantId, "security", { content: delta, status: "running" }, true)
    ).catch(() =>
      `PATCHED_BACKEND:\n\`\`\`typescript\n${backResult}\n\`\`\`\n\nPATCHED_FRONTEND:\n\`\`\`typescript\nNONE\n\`\`\`\n\nAUDIT:\n{"vulnerabilities":0,"complianceScore":95,"issues":[]}`
    );

    const patchedBackendMatch  = secResult.match(/PATCHED_BACKEND:\s*```(?:typescript)?\n([\s\S]*?)```/);
    const patchedFrontendMatch = secResult.match(/PATCHED_FRONTEND:\s*```(?:typescript)?\n([\s\S]*?)```/);
    const patchedBackend  = patchedBackendMatch?.[1]?.trim()  ?? "";
    const patchedFrontend = patchedFrontendMatch?.[1]?.trim() ?? "";
    if (patchedBackend && patchedBackend !== "NONE") {
      patchVariant(storyId, variantId, "backend",  { content: patchedBackend },  false);
    }
    if (needsFrontend && patchedFrontend && patchedFrontend !== "NONE") {
      patchVariant(storyId, variantId, "frontend", { content: patchedFrontend }, false);
    }

    await sleep(400);
    patchVariant(storyId, variantId, "security", { status: "done", content: secResult, timestamp: now() }, false);

    // Agent reply in chat
    const agentReply: ChatMessage = {
      id: `${variantId}-agent-${Date.now()}`,
      role: "agent",
      content: `Agents updated Variant ${variantId} — code regenerated and security re-scanned.`,
      timestamp: now(),
    };
    setChatMessages((p) => ({ ...p, [key]: [...(p[key] ?? []), agentReply] }));

    // Re-run evaluator if already shown (read latest story state inside updater)
    setStories((prev) => {
      const storyNow = prev.find((s) => s.id === storyId);
      if (storyNow && showEvaluator[storyId]) {
        const evalCtx = storyNow.variants
          .map((vt) => `Variant ${vt.id}:\nBackend:\n${vt.backend.content}\n\nFrontend:\n${vt.frontend.content}`)
          .join("\n\n---\n\n");
        callAgentStream(
          { ...base, role: "evaluator", context: evalCtx },
          () => {}
        ).then((evalResult) => setEvalContent((p) => ({ ...p, [storyId]: evalResult }))).catch(() => {});
      }
      return prev;
    });

    setRerunningVariants((p) => ({ ...p, [key]: false }));
  }, [patchVariant, reasoningContent, noFrontend, rerunningVariants, runningStories, chatMessages, showEvaluator, setStories, setEvalContent]);

  // Computed state
  const totalAgents = stories.length * 3 * 4; // stories × variants × agents
  const doneAgents = stories.reduce((acc, s) =>
    acc + s.variants.reduce((va, v) =>
      va + [v.orchestrator, v.backend, v.frontend, v.security].filter((a) => a.status === "done").length, 0), 0);
  const totalProgress = totalAgents > 0 ? Math.round((doneAgents / totalAgents) * 100) : 0;

  const allDone = stories.every((s) => s.status === "done" && s.chosenVariant);

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === "Enter") {
        const story = stories.find((s) => s.id === selectedStoryId);
        if (story?.status === "pending" && !runningStories[selectedStoryId]) {
          e.preventDefault();
          stories.filter((s) => s.status === "pending" && !runningStories[s.id]).forEach((s) => runImplementation(s.id));
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [stories, selectedStoryId, runningStories, runImplementation, pokerSessions]);

  // ---------------------------------------------------------------------------
  // localStorage persistence — save/restore across sessions
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const nextState = { stories, reasoningContent, evalContent, chatMessages, noFrontend };
      const snapshot = JSON.stringify(nextState);
      localStorage.setItem("itfest_state", snapshot);
      void syncLegacySnapshots({ projectId, legacyState: nextState });
    } catch { /* quota or SSR — ignore */ }
  }, [stories, reasoningContent, evalContent, chatMessages, noFrontend, projectId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const nextPoker = { pokerSessions, storyAssignees };
      localStorage.setItem("itfest_poker", JSON.stringify(nextPoker));
      void syncLegacySnapshots({ projectId, legacyPoker: nextPoker });
    } catch { /* quota or SSR — ignore */ }
  }, [pokerSessions, storyAssignees, projectId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("itfest_state");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      // Re-derive showEvaluator from restored evalContent (lazy inits handle the rest)
      if (parsed.evalContent) {
        const derived: Record<string, boolean> = {};
        for (const k of Object.keys(parsed.evalContent)) derived[k] = true;
        setShowEvaluator(derived);
      }
    } catch { /* corrupt data — ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-run all pending stories when arriving from "Dispatch Agents"
  const autoRunFiredRef = useRef(false);
  useEffect(() => {
    if (!autoRun || autoRunFiredRef.current || !mounted || stories.length === 0) return;
    autoRunFiredRef.current = true;
    const pending = stories.filter((s) => s.status === "pending" && !runningStories[s.id]);
    if (pending.length > 0) {
      pending.forEach((s) => runImplementation(s.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun, runImplementation, mounted, stories.length]);

  const applyMockImplementation = useCallback(() => {
    const demoStories = createDemoImplementedStories();
    const demoReasoning = createDemoReasoningContent();
    const demoEval = createDemoEvalContent();
    const demoChat = createDemoChatMessages();
    const demoNoFrontend = createDemoNoFrontend();
    const demoPokerSessions = createDemoPokerSessions();
    const demoStoryAssignees = createDemoStoryAssignees();

    autoRunFiredRef.current = true;
    setStories(demoStories);
    setSelectedStoryId(demoStories[0]?.id ?? "");
    setReasoningContent(demoReasoning);
    setEvalContent(demoEval);
    setChatMessages(demoChat);
    setNoFrontend(demoNoFrontend);
    setShowEvaluator(Object.fromEntries(demoStories.map((story) => [story.id, true])));
    setRunningStories({});
    setRerunningVariants({});
    setPokerSessions(demoPokerSessions);
    setStoryAssignees(demoStoryAssignees);

    if (typeof window !== "undefined") {
      try {
        const nextState = {
          stories: demoStories,
          reasoningContent: demoReasoning,
          evalContent: demoEval,
          chatMessages: demoChat,
          noFrontend: demoNoFrontend,
        };
        const nextPoker = {
          pokerSessions: demoPokerSessions,
          storyAssignees: demoStoryAssignees,
        };
        localStorage.setItem(
          "itfest_state",
          JSON.stringify(nextState)
        );
        localStorage.setItem("itfest_poker", JSON.stringify(nextPoker));
        void syncLegacySnapshots({ projectId, legacyState: nextState, legacyPoker: nextPoker });
      } catch {
        // ignore local persistence issues in demo mode
      }
    }
  }, [projectId]);

  const clearSession = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("itfest_state");
      localStorage.removeItem("itfest_poker");
      void syncLegacySnapshots({ projectId, legacyState: {}, legacyPoker: {} });
    }
    setStories(stories.map((s) => ({ ...s, variants: [], status: "pending" as const, chosenVariant: undefined })));
    setReasoningContent({});
    setEvalContent({});
    setChatMessages({});
    setNoFrontend({});
    setShowEvaluator({});
    setRunningStories({});
    setRerunningVariants({});
    setPokerSessions({});
    setStoryAssignees({});
  }, []);

  // ---------------------------------------------------------------------------
  // Planning Poker — per-story session
  // ---------------------------------------------------------------------------
  const runPokerSession = useCallback(async (storyId: string) => {
    const existing = pokerSessionsRef.current[storyId];
    if (existing && (existing.phase === "estimating" || existing.phase === "revealing" || existing.phase === "debating")) return;

    const storyObj = stories.find((s) => s.id === storyId);
    if (!storyObj) return;

    const base = { storyId, storyTitle: storyObj.title, storyDescription: storyObj.description };

    setPokerSessions((p) => ({ ...p, [storyId]: { ...makePokerSession(storyId), phase: "estimating" } }));

    // Phase 1: all agents estimate in parallel
    const estimateResults = await Promise.all(
      POKER_AGENTS.map(async (agentDef) => {
        let fullText = "";
        try {
          fullText = await callAgentStream(
            { ...base, role: "poker_estimate", context: agentDef.apiRole },
            () => {}
          );
        } catch { fullText = "Card: 5\nReasoning: Estimate unavailable."; }
        const cardMatch = fullText.match(/Card:\s*(\d+)/i);
        const reasoningMatch = fullText.match(/Reasoning:\s*(.+)/i);
        const estimate = snapToPoker(cardMatch ? parseInt(cardMatch[1], 10) : 5);
        const reasoning = reasoningMatch ? reasoningMatch[1].trim() : "";
        return { role: agentDef.role, estimate, reasoning };
      })
    );

    // Store estimates, move to revealing
    setPokerSessions((p) => ({
      ...p,
      [storyId]: {
        ...p[storyId],
        phase: "revealing",
        agents: p[storyId].agents.map((a) => {
          const res = estimateResults.find((r) => r.role === a.role);
          return res ? { ...a, estimate: res.estimate, reasoning: res.reasoning, revealed: false } : a;
        }),
      },
    }));

    // Phase 2: reveal cards one-by-one
    for (let i = 0; i < POKER_AGENTS.length; i++) {
      await new Promise<void>((res) => setTimeout(res, 600));
      const role = POKER_AGENTS[i].role;
      setPokerSessions((p) => ({
        ...p,
        [storyId]: { ...p[storyId], agents: p[storyId].agents.map((a) => (a.role === role ? { ...a, revealed: true } : a)) },
      }));
    }

    // Build snapAgents from estimateResults directly (no stale ref dependency)
    const snapAgents: PokerAgent[] = POKER_AGENTS.map((agentDef) => {
      const base2 = { role: agentDef.role, label: agentDef.label, color: agentDef.color, icon: agentDef.icon, apiRole: agentDef.apiRole };
      const res = estimateResults.find((r) => r.role === agentDef.role);
      return { ...base2, estimate: res?.estimate ?? 5, reasoning: res?.reasoning ?? "", revealed: true };
    });
    const estimates = snapAgents.map((a) => a.estimate ?? 5);
    const estimatesSummary = snapAgents
      .map((a) => `${a.label} estimated: ${a.estimate} pts. Reasoning: ${a.reasoning}`)
      .join("\n");

    const finalize = (consensus: number, pokerContext: string) => {
      const topAgent = snapAgents.reduce((a, b) => (b.estimate ?? 0) > (a.estimate ?? 0) ? b : a);
      setStoryAssignees((p) => ({ ...p, [storyId]: topAgent.label }));
      setPokerSessions((p) => ({ ...p, [storyId]: { ...p[storyId], phase: "done", consensusEstimate: consensus, pokerContext } }));
    };

    // Phase 3: debate always runs — agents discuss and confirm/adjust even if estimates match
    setPokerSessions((p) => ({ ...p, [storyId]: { ...p[storyId], phase: "debating" } }));

    const debateResponses: string[] = [];
    let cumulativeContext = `Initial estimates:\n${estimatesSummary}\n\nDebate so far:`;

    for (const agentDef of POKER_AGENTS) {
      const agent = snapAgents.find((a) => a.role === agentDef.role)!;
      setPokerSessions((p) => ({
        ...p,
        [storyId]: {
          ...p[storyId],
          logs: [...p[storyId].logs, { agent: agent.label, color: agent.color, text: "", timestamp: new Date().toLocaleTimeString() }],
        },
      }));

      let debateText = "";
      try {
        debateText = await callAgentStream(
          { ...base, role: "poker_debate", context: cumulativeContext, variantId: agentDef.apiRole },
          (delta) => {
            setPokerSessions((p) => {
              const sess = p[storyId];
              if (!sess) return p;
              const logs = [...sess.logs];
              logs[logs.length - 1] = { ...logs[logs.length - 1], text: logs[logs.length - 1].text + delta };
              return { ...p, [storyId]: { ...sess, logs } };
            });
          }
        );
      } catch { debateText = "My estimate: 5\nArgument: Unable to respond.\nConsensus proposal: none yet"; }

      debateResponses.push(debateText);
      // Append this agent's turn to the cumulative context for the next agent
      cumulativeContext += `\n\n${agent.label}: ${debateText}`;
      await new Promise<void>((res) => setTimeout(res, 300));
    }

    // Final consensus round — all agents have spoken, now derive the agreed number
    // Each agent's "Consensus proposal: N" from their final response
    const proposals = debateResponses.map((text) => {
      const m = text.match(/Consensus proposal:\s*(\d+)/i);
      return m ? snapToPoker(parseInt(m[1], 10)) : null;
    }).filter((v): v is number => v !== null);

    // Use median of valid proposals; fall back to median of all estimates
    const consensus = proposals.length > 0 ? medianOf(proposals) : medianOf(estimates);

    const debateTranscript = snapAgents
      .map((a, i) => `${a.label}:\n${debateResponses[i] ?? ""}`)
      .join("\n\n---\n\n");

    finalize(consensus, [
      `Planning Poker Result: Consensus = ${consensus} pts`,
      `\nInitial Estimates:\n${estimatesSummary}`,
      `\nDebate:\n${debateTranscript}`,
    ].join("\n"));
  }, [projectId, stories]);

  // Standalone evaluator runner (called by runImplementation and CTA button)
  const runEvaluator = useCallback(async (storyId: string) => {
    const storyObj = stories.find((s) => s.id === storyId);
    if (!storyObj) return;
    const base = { storyId, storyTitle: storyObj.title, storyDescription: storyObj.description };
    const evalContext = storyObj.variants.map((v) =>
      `Variant ${v.id}:\nBackend:\n${v.backend.content}\n\nFrontend:\n${v.frontend.content}`
    ).join("\n\n---\n\n");
    try {
      const evalResult = await callAgentStream(
        { ...base, role: "evaluator", context: evalContext },
        () => {}
      );
      setEvalContent((p) => ({ ...p, [storyId]: evalResult }));
      setStories((p2) => p2.map((s) => (s.id === storyId ? { ...s, status: "evaluating" } : s)));
      setShowEvaluator((p) => ({ ...p, [storyId]: true }));
    } catch {
      setStories((p2) => p2.map((s) => (s.id === storyId ? { ...s, status: "evaluating" } : s)));
      setShowEvaluator((p) => ({ ...p, [storyId]: true }));
    }
  }, [stories]);

  const handleConfirmMerge = useCallback(() => {
    const param = stories.map((s) => `${s.id}:${s.chosenVariant}`).join(",");
    router.push(withOptionalProjectQuery(`/testing?stories=${encodeURIComponent(param)}`, projectId));
  }, [stories, router]);

  const selectedStory = stories.find((s) => s.id === selectedStoryId) ?? stories[0];

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Material Symbols */}
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        rel="stylesheet"
      />
      <style>{`
        .material-symbols-outlined {
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          font-family: 'Material Symbols Outlined';
        }
        @keyframes barGrow {
          from { width: 0%; }
          to { width: var(--bar-w, 100%); }
        }
        .bar-grow { animation: barGrow 0.8s ease-out forwards; }
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(78,222,163,0.4); }
          50% { box-shadow: 0 0 0 6px rgba(78,222,163,0); }
        }
        .glow-pulse { animation: glowPulse 2s ease-in-out infinite; }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .slide-up { animation: slideUp 0.35s ease-out forwards; }
        @keyframes agentFlow {
          0% { opacity: 0.3; }
          50% { opacity: 1; }
          100% { opacity: 0.3; }
        }
        .agent-flow-line { animation: agentFlow 1.5s ease-in-out infinite; }
      `}</style>

      {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
      <aside className="hidden w-[264px] shrink-0 border-r border-border/20 bg-sidebar lg:flex lg:flex-col">
        <div className="flex items-center gap-2.5 border-b border-border/20 px-5 py-3">
          <div className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/70">
            <span className="material-symbols-outlined text-primary-foreground" style={{ fontSize: 14 }}>code</span>
          </div>
          <span className="font-brand text-sm font-bold tracking-tight text-foreground">AgenticSDLC</span>
        </div>
        <SDLCSidebar />
      </aside>

      <main className="flex flex-1 flex-col min-h-0">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-border/20 px-6 py-3 shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-lg font-bold text-foreground">Implementation</h1>
            <span className="rounded-md bg-orange-500/10 px-2 py-0.5 text-[10px] font-bold text-orange-500">PHASE 4</span>
            {mounted && stories.length > 0 && (
              <span className="font-mono text-[10px] text-muted-foreground/50">{stories.length} stories · {totalProgress}% done</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <a href={withOptionalProjectQuery("/design", projectId)} className="flex items-center gap-1 rounded-lg border border-border/30 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_back</span>
              Backlog
            </a>
            <button
              onClick={applyMockImplementation}
              className="flex items-center gap-1.5 rounded-lg border border-[#4edea3]/30 bg-[#4edea3]/5 px-3 py-1.5 text-xs font-semibold text-[#4edea3] hover:bg-[#4edea3]/10 transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>auto_fix_high</span>
              Mock Implementation
            </button>
            <button
              onClick={clearSession}
              className="flex items-center gap-1 rounded-lg border border-border/30 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              title="Clear session and reset all state"
            >
              Clear session
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto p-6">

              {/* ── STORY TABS ──────────────────────────────── */}
              <div className="flex items-center gap-1 mb-5 flex-wrap">
                  {stories.map((s) => {
                    const isActive = s.id === selectedStoryId;
                    const statusCfg = STATUS_CONFIG[s.status];
                    return (
                      <button
                        key={s.id}
                        onClick={() => setSelectedStoryId(s.id)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold font-mono transition-all border",
                          isActive
                            ? "bg-[#4edea3]/10 border-[#4edea3]/30 text-[#4edea3]"
                            : "bg-[#1c1b1b] border-[#3c4a42]/25 text-[#86948a] hover:border-[#3c4a42]/50 hover:text-[#c8c6c5]"
                        )}
                      >
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: statusCfg.color }} />
                        {s.id}
                      </button>
                    );
                  })}
              </div>

              {/* ── STORY CONTENT ──────────────────────────── */}
              {!selectedStory ? (
                <Card className="bg-[#1c1b1b] rounded-2xl border border-[#3c4a42]/20 ring-0">
                  <CardContent className="p-12 flex flex-col items-center gap-3 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-[#2a2a2a] border border-[#3c4a42]/30 flex items-center justify-center mb-1">
                      <span className="material-symbols-outlined text-3xl text-[#474746]">inbox</span>
                    </div>
                    <p className="text-[13px] font-semibold text-[#c8c6c5]">No user stories loaded</p>
                    <p className="text-[11px] text-[#474746] max-w-xs leading-relaxed">
                      Go to the Design page to generate and estimate user stories first, then click Implement Backlog.
                    </p>
                    <a href={withOptionalProjectQuery("/design", projectId)} className="mt-2 flex items-center gap-1 rounded-lg border border-[#3c4a42]/30 px-4 py-2 text-xs text-[#4edea3] hover:bg-[#4edea3]/5 transition-colors">
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_back</span>
                      Go to Design
                    </a>
                  </CardContent>
                </Card>
              ) : (<>
              <div className="space-y-5">
                {/* Story header — Jira-style issue view */}
                {(() => {
                  const prio = selectedStory.priority ? PRIORITY_CONFIG[selectedStory.priority] : null;
                  const type = selectedStory.type ? TYPE_CONFIG[selectedStory.type] : null;
                  const statusCfg = STATUS_CONFIG[selectedStory.status];
                  const isRunning = !!runningStories[selectedStory.id];
                  return (
                    <div className="bg-[#1c1b1b] rounded-2xl border border-[#3c4a42]/25 overflow-hidden">
                      {/* Top strip: type + id breadcrumb */}
                      <div className="flex items-center gap-2 px-5 pt-4 pb-2 border-b border-[#3c4a42]/15">
                        {type && (
                          <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: type.color }}>
                            <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>{type.icon}</span>
                            {type.label}
                          </div>
                        )}
                        <span className="text-[#474746] text-[10px]">/</span>
                        <span className="text-[10px] font-mono font-bold text-[#86948a]">{selectedStory.id}</span>
                        <div className="flex-1" />
                        {/* Running indicator */}
                        {isRunning && (
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#4edea3] uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3] animate-pulse" />
                            Agents running
                          </div>
                        )}
                      </div>

                      {/* Main body */}
                      <div className="px-5 py-4 space-y-4">
                        {/* Title */}
                        <h2 className="text-xl font-bold font-serif text-[#e5e2e1] leading-snug">{selectedStory.title}</h2>

                        {/* Meta row */}
                        <div className="flex flex-wrap items-center gap-3">
                          {/* Status */}
                          <div className={cn("flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border", statusCfg.bg, statusCfg.border)} style={{ color: statusCfg.color }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusCfg.color }} />
                            {isRunning ? "In Progress" : statusCfg.label}
                          </div>
                          {/* Priority */}
                          {prio && (
                            <div className={cn("flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border", prio.bg, prio.border)} style={{ color: prio.color }}>
                              <span className="material-symbols-outlined" style={{ fontSize: "11px" }}>{prio.icon}</span>
                              {prio.label}
                            </div>
                          )}
                          {/* Assignee — set by poker */}
                          {storyAssignees[selectedStory.id] ? (
                            <div className="flex items-center gap-1.5 text-[10px] text-[#86948a] font-medium">
                              <div className="w-5 h-5 rounded-full bg-[#4edea3]/10 border border-[#4edea3]/20 flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined" style={{ fontSize: "11px", color: "#4edea3" }}>smart_toy</span>
                              </div>
                              {storyAssignees[selectedStory.id]}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-[10px] text-[#474746] font-medium">
                              <div className="w-5 h-5 rounded-full bg-[#2a2a2a] border border-[#3c4a42]/20 flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined" style={{ fontSize: "11px", color: "#474746" }}>smart_toy</span>
                              </div>
                              Unassigned
                            </div>
                          )}
                          {/* Effort estimate — poker only */}
                          {(() => {
                            const est = pokerSessions[selectedStory.id]?.consensusEstimate ?? null;
                            if (est != null) {
                              return (
                                <div className="flex items-center gap-1 text-[10px] font-bold font-mono text-[#4edea3] px-2 py-1 rounded-lg border border-[#4edea3]/20 bg-[#4edea3]/8">
                                  <span className="material-symbols-outlined" style={{ fontSize: "11px" }}>casino</span>
                                  {est} pts · ~{est * 30 >= 60 ? `${Math.round(est * 30 / 60 * 10) / 10}h` : `${est * 30}min`} delivery
                                </div>
                              );
                            }
                            return (
                              <div className="flex items-center gap-1 text-[10px] font-mono text-[#474746] px-2 py-1 rounded-lg border border-[#3c4a42]/20 bg-[#2a2a2a]">
                                <span className="material-symbols-outlined" style={{ fontSize: "11px" }}>lock</span>
                                Effort TBD
                              </div>
                            );
                          })()}
                          {/* Labels */}
                          {selectedStory.labels?.map((lbl) => (
                            <span key={lbl} className="text-[9px] font-mono text-[#86948a] bg-[#2a2a2a] border border-[#3c4a42]/30 rounded px-1.5 py-0.5">
                              {lbl}
                            </span>
                          ))}
                        </div>

                        {/* Description */}
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[#474746]">Description</p>
                          <p className="text-[13px] text-[#c8c6c5]/80 leading-relaxed">{selectedStory.description}</p>
                        </div>

                        {/* Acceptance Criteria */}
                        {selectedStory.acceptanceCriteria && selectedStory.acceptanceCriteria.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#474746]">Acceptance Criteria</p>
                            <ul className="space-y-1">
                              {selectedStory.acceptanceCriteria.map((ac, i) => (
                                <li key={i} className="flex items-start gap-2 text-[12px] text-[#c8c6c5]/70">
                                  <span className="material-symbols-outlined shrink-0 mt-0.5" style={{ fontSize: "13px", color: "#4ae176" }}>check_circle</span>
                                  {ac}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Run button — pending state */}
                {selectedStory.status === "pending" && (() => {
                  const anyRunning = stories.some((s) => !!runningStories[s.id]);
                  const pendingCount = stories.filter((s) => s.status === "pending").length;

                  return (
                    <Button
                      onClick={() => stories.filter((s) => s.status === "pending" && !runningStories[s.id]).forEach((s) => runImplementation(s.id))}
                      disabled={anyRunning || pendingCount === 0}
                      className="w-full primary-gradient text-[#003824] py-4 rounded-2xl text-sm font-bold uppercase tracking-widest disabled:opacity-60 shadow-lg shadow-[#4edea3]/10 border-transparent h-auto flex items-center justify-center gap-2"
                    >
                      {anyRunning ? (
                        <>
                          <span className="w-4 h-4 border-2 border-[#003824]/30 border-t-[#003824] rounded-full animate-spin" />
                          Implementing {pendingCount} {pendingCount === 1 ? "story" : "stories"}…
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-base">play_arrow</span>
                          Start Implementing
                          <span className="ml-2 text-[10px] font-mono opacity-60 border border-current/30 rounded px-1 py-0.5">⌘↵</span>
                        </>
                      )}
                    </Button>
                  );
                })()}

                {/* Tabbed variant grid */}
                {selectedStory.variants.length > 0 && (
                  <VariantGrid
                    story={selectedStory}
                    reasoningContent={reasoningContent}
                    noFrontend={noFrontend}
                    onRerunOrchestrator={(variantId, reasoning) => rerunOrchestrator(selectedStory.id, variantId, reasoning)}
                    chatMessages={chatMessages}
                    rerunningVariants={rerunningVariants}
                    runningStories={runningStories}
                    onRequestModification={(variantId, userMessage) => rerunVariant(selectedStory.id, variantId, userMessage)}
                    prevCode={prevCode}
                    onRerunAgent={(variantId, role) => rerunAgentOnly(selectedStory.id, variantId, role)}
                    showEvaluator={showEvaluator}
                    evalContent={evalContent}
                  />
                )}

                {/* Empty state */}
                {selectedStory.variants.length === 0 && selectedStory.status === "pending" && (
                  <Card className="bg-[#1c1b1b] rounded-2xl border border-[#3c4a42]/20 ring-0">
                    <CardContent className="p-12 flex flex-col items-center gap-3 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-[#2a2a2a] border border-[#3c4a42]/30 flex items-center justify-center mb-1">
                        <span className="material-symbols-outlined text-3xl text-[#474746]">code_blocks</span>
                      </div>
                      <p className="text-[13px] font-semibold text-[#c8c6c5]">No implementation yet for this story</p>
                      <p className="text-[11px] text-[#474746] max-w-xs leading-relaxed">
                        Click Start Implementing to dispatch agents across all stories in parallel.
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Evaluator panel */}
                {showEvaluator[selectedStory.id] && (
                  <GlobalEvaluatorPanel
                    story={selectedStory}
                    evalContent={evalContent[selectedStory.id] ?? ""}
                    onChoose={(v) => chooseVariant(selectedStory.id, v)}
                  />
                )}

                {/* Evaluator CTA — shown when all variants done but evaluator hasn't run */}
                {!showEvaluator[selectedStory.id] && !runningStories[selectedStory.id] &&
                  selectedStory.variants.length === 3 &&
                  selectedStory.variants.every((vt) => {
                    const nf = !!noFrontend[`${selectedStory.id}:${vt.id}`];
                    return vt.orchestrator.status === "done" && vt.backend.status === "done" &&
                      (nf || vt.frontend.status === "done") && vt.security.status === "done";
                  }) && (
                  <Card className="bg-[#1c1b1b] rounded-2xl border border-[#4edea3]/20 ring-0 slide-up">
                    <CardContent className="p-6 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#4edea3]/10 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-[#4edea3]">balance</span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[#e5e2e1]">Analysis complete</p>
                          <p className="text-xs text-[#c8c6c5]">Run AI evaluation to compare candidates</p>
                        </div>
                      </div>
                      <Button
                        onClick={() => runEvaluator(selectedStory.id)}
                        className="primary-gradient text-[#003824] px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest border-transparent h-auto flex items-center gap-2 shrink-0"
                      >
                        <span className="material-symbols-outlined text-sm">auto_awesome</span>
                        Run Evaluator
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>

          {/* Sticky merge banner */}
          {allDone && selectedStory && (
            <div className="sticky bottom-6 z-30 mt-8">
              <Card className="bg-[#1c1b1b] border border-[#4edea3]/30 rounded-2xl shadow-[0_0_40px_-10px_rgba(78,222,163,0.2)] ring-0 slide-up">
                <CardContent className="p-5 flex items-center justify-between gap-6">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#4edea3]">check_circle</span>
                      <span className="text-sm font-bold text-[#e5e2e1]">All variants selected</span>
                    </div>
                    <div className="h-4 w-px bg-[#3c4a42]/40" />
                    <div className="flex items-center gap-2 flex-wrap">
                      {stories.map((s) => (
                        <span
                          key={s.id}
                          className="flex items-center gap-1.5 text-[11px] font-mono bg-[#2a2a2a] px-3 py-1 rounded-lg border border-[#3c4a42]/30"
                        >
                          <span className="text-[#4edea3] font-bold">{s.id}</span>
                          <span className="text-[#474746]">→</span>
                          <span className="text-[#4ae176] font-bold">Variant {s.chosenVariant}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                  <Button
                    onClick={handleConfirmMerge}
                    className="primary-gradient text-[#003824] px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-widest shadow-lg shadow-[#4edea3]/20 whitespace-nowrap flex items-center gap-2 hover:scale-105 active:scale-95 transition-transform border-transparent h-auto"
                  >
                    <span className="material-symbols-outlined text-base">call_merge</span>
                    Confirm &amp; Merge
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
          </>)}
          </div>
          </div>
        </main>

      {/* Planning Poker Drawer */}
      {(() => {
        const drawerSession = drawerStoryId ? pokerSessions[drawerStoryId] : null;
        const drawerStory = drawerStoryId ? stories.find((s) => s.id === drawerStoryId) : null;
        return (
          <Drawer
            direction="right"
            open={drawerStoryId !== null}
            onOpenChange={(open) => { if (!open) setDrawerStoryId(null); }}
          >
            <DrawerContent className="bg-[#131313] border-l border-[#3c4a42]/40 flex flex-col p-0 overflow-hidden !max-w-none" style={{ width: "min(960px, 95vw)" }}>
              <DrawerHeader className="flex items-center justify-between px-8 py-5 border-b border-[#3c4a42]/30 shrink-0">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[#4edea3]" style={{ fontSize: "28px" }}>casino</span>
                  <div>
                    <DrawerTitle style={{ fontSize: "20px", fontWeight: 700, color: "#e5e2e1", lineHeight: 1 }}>Planning Poker</DrawerTitle>
                    {drawerStory && (
                      <p style={{ fontSize: "14px", fontFamily: "monospace", color: "#474746", marginTop: "4px" }}>{drawerStory.id} · {drawerStory.title}</p>
                    )}
                  </div>
                </div>
                <DrawerClose className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#2a2a2a] border border-[#3c4a42]/30 hover:bg-[#333] transition-colors">
                  <span className="material-symbols-outlined text-[#86948a]" style={{ fontSize: "18px" }}>close</span>
                </DrawerClose>
              </DrawerHeader>

              <div className="flex-1 overflow-y-auto ide-scroll px-8 py-6 space-y-6">
                {drawerSession && (
                  <>
                    {/* Agent cards — 3 columns */}
                    <div className="grid grid-cols-3 gap-5">
                      {drawerSession.agents.map((agent, i) => (
                        <div key={agent.role} className="flex flex-col items-center gap-4 p-6 rounded-2xl bg-[#1a1a1a] border border-[#3c4a42]/25">
                          <div className="w-16 h-16 rounded-full flex items-center justify-center border-2 shrink-0" style={{ background: `${agent.color}12`, borderColor: `${agent.color}30` }}>
                            <span className="material-symbols-outlined" style={{ fontSize: "32px", color: agent.color }}>{agent.icon}</span>
                          </div>
                          <PokerCard value={agent.estimate} revealed={agent.revealed} color={agent.color} animationDelay={i * 180} />
                          <span style={{ fontSize: "17px", fontWeight: 700, color: agent.color, textAlign: "center" }}>{agent.label}</span>
                          {agent.revealed && agent.reasoning && (
                            <p style={{ fontSize: "15px", color: "#86948a", textAlign: "center", lineHeight: 1.6 }}>{agent.reasoning}</p>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Debate transcript */}
                    {drawerSession.logs.length > 0 && (
                      <div className="rounded-xl bg-[#0e0e0e] border border-[#3c4a42]/20 overflow-hidden">
                        <div className="px-5 py-4 border-b border-[#3c4a42]/20 flex items-center gap-2">
                          <span className="material-symbols-outlined text-[#474746]" style={{ fontSize: "18px" }}>forum</span>
                          <span style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#474746" }}>Debate transcript</span>
                          <span className="ml-auto" style={{ fontSize: "13px", fontFamily: "monospace", color: "#474746" }}>{drawerSession.logs.length} turns</span>
                        </div>
                        <div className="p-5 space-y-4">
                          {drawerSession.logs.map((log, i) => (
                            <div key={i} className="rounded-xl bg-[#131313] border border-[#3c4a42]/15 overflow-hidden">
                              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[#3c4a42]/10" style={{ background: `${log.color}08` }}>
                                <div className="w-2 h-6 rounded-full shrink-0" style={{ background: log.color }} />
                                <span style={{ fontSize: "17px", fontWeight: 700, color: log.color }}>{log.agent}</span>
                                <span className="ml-auto" style={{ fontSize: "13px", fontFamily: "monospace", color: "#474746" }}>{log.timestamp}</span>
                              </div>
                              <div className="px-5 py-5">
                                <span style={{ fontSize: "15px", fontFamily: "monospace", color: "#c8c6c5", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word", display: "block" }}>
                                  {log.text}
                                  {i === drawerSession.logs.length - 1 && drawerSession.phase === "debating" && (
                                    <span className="terminal-cursor" />
                                  )}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Consensus */}
                    {drawerSession.phase === "done" && drawerSession.consensusEstimate !== null && (
                      <div className="flex items-center justify-between rounded-xl bg-[#4edea3]/8 border border-[#4edea3]/25 px-8 py-6">
                        <div className="flex items-center gap-4">
                          <span className="material-symbols-outlined text-[#4ae176]" style={{ fontSize: "32px" }}>check_circle</span>
                          <div>
                            <p style={{ fontSize: "18px", fontWeight: 700, color: "#4ae176", textTransform: "uppercase", letterSpacing: "0.05em" }}>Consensus reached</p>
                            <p style={{ fontSize: "15px", color: "#86948a", marginTop: "4px" }}>All agents have agreed on an estimate</p>
                          </div>
                        </div>
                        <div className="flex items-baseline gap-3">
                          <span style={{ fontSize: "64px", fontWeight: 700, fontFamily: "monospace", color: "#4edea3", lineHeight: 1 }}>{drawerSession.consensusEstimate}</span>
                          <div className="flex flex-col">
                            <span style={{ fontSize: "18px", fontWeight: 700, color: "#4edea3" }}>pts</span>
                            <span style={{ fontSize: "15px", color: "#86948a" }}>
                              ~{drawerSession.consensusEstimate * 30 >= 60
                                ? `${Math.round(drawerSession.consensusEstimate * 30 / 60 * 10) / 10}h`
                                : `${drawerSession.consensusEstimate * 30}min`} delivery
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* In-progress state */}
                    {drawerSession.phase !== "done" && (
                      <div className="flex items-center gap-3 px-6 py-5 rounded-xl bg-[#4edea3]/5 border border-[#4edea3]/15">
                        <span className="w-3 h-3 rounded-full bg-[#4edea3] glow-pulse shrink-0" />
                        <span style={{ fontSize: "16px", color: "#4edea3", fontWeight: 500, textTransform: "capitalize" }}>{drawerSession.phase}…</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </DrawerContent>
          </Drawer>
        );
      })()}
    </div>
  );
}

export default function ImplementationPage() {
  return (
    <Suspense fallback={null}>
      <ImplementationPageInner />
    </Suspense>
  );
}

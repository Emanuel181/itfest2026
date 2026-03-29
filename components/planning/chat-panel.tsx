"use client"

import { useRef, useEffect, useState } from "react"
import ReactMarkdown from "react-markdown"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card } from "@/components/ui/card"

export type ChatMessage = {
  id: string
  author: string
  role: "human" | "ai"
  text: string
}

type ChatPanelProps = {
  messages: ChatMessage[]
  onSend: (text: string) => void
  isSending: boolean
  placeholder?: string
  agentName?: string
  agentIcon?: string
  starterPrompts?: string[]
  currentTopic?: string
}

export function ChatPanel({
  messages,
  onSend,
  isSending,
  placeholder = "Type your message...",
  agentName = "AI Assistant",
  agentIcon = "smart_toy",
  starterPrompts,
  currentTopic,
}: ChatPanelProps) {
  const [composer, setComposer] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 140) + "px"
    }
  }, [composer])

  function handleSend() {
    const trimmed = composer.trim()
    if (!trimmed || isSending) return
    onSend(trimmed)
    setComposer("")
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <ScrollArea className="flex-1 overflow-hidden">
        <div className="mx-auto max-w-2xl px-6 py-6">
          {/* Empty state with starters */}
          {messages.length === 0 && starterPrompts && (
            <div className="flex flex-col items-center justify-center gap-5 py-20">
              <div className="grid size-14 place-items-center rounded-2xl bg-primary/10">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 28 }}>{agentIcon}</span>
              </div>
              <div className="text-center space-y-1.5">
                <h3 className="text-base font-semibold text-foreground">{agentName}</h3>
                <p className="text-sm text-muted-foreground">Start a conversation to begin building your documentation</p>
              </div>
              <div className="grid grid-cols-2 gap-2.5 mt-3 w-full max-w-md">
                {starterPrompts.map((prompt, i) => (
                  <Card
                    key={i}
                    onClick={() => onSend(prompt)}
                    className="cursor-pointer rounded-xl border-border/40 bg-card/60 px-4 py-3 text-sm text-muted-foreground hover:bg-card hover:text-foreground hover:border-primary/30 transition-all"
                  >
                    {prompt}
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="space-y-5">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-3",
                  msg.role === "human" ? "justify-end" : "justify-start"
                )}
              >
                {msg.role === "ai" && (
                  <Avatar size="sm" className="mt-1">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{agentIcon}</span>
                    </AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                    msg.role === "human"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 text-foreground border border-border/30"
                  )}
                >
                  {msg.role === "ai" ? (
                    <div className="prose prose-sm prose-invert max-w-none [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1 [&>h1]:text-base [&>h2]:text-sm [&>h3]:text-sm [&>h4]:text-xs [&_strong]:text-foreground [&_em]:text-foreground/80 [&_code]:rounded [&_code]:bg-muted/60 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_a]:text-primary [&_a]:underline">
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  )}
                </div>
                {msg.role === "human" && (
                  <Avatar size="sm" className="mt-1">
                    <AvatarFallback className="bg-secondary text-secondary-foreground">
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>account_circle</span>
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {isSending && !messages.find(m => m.id === "ai-streaming") && (
              <div className="flex gap-3">
                <Avatar size="sm" className="mt-1">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{agentIcon}</span>
                  </AvatarFallback>
                </Avatar>
                <div className="rounded-2xl bg-muted/50 border border-border/30 px-4 py-3.5">
                  <div className="flex gap-1.5">
                    <span className="size-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="size-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="size-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Composer */}
      <div className="border-t border-border/30 bg-background/80 backdrop-blur-sm p-4">
        <div className="mx-auto max-w-2xl">
          {/* Current topic indicator */}
          {currentTopic && messages.length > 0 && (
            <div className="flex items-center gap-2 mb-2.5 px-1">
              <span className="material-symbols-outlined text-primary/60" style={{ fontSize: 14 }}>topic</span>
              <span className="text-[11px] text-muted-foreground/60">
                Currently discussing: <span className="font-semibold text-foreground/70">{currentTopic}</span>
              </span>
            </div>
          )}
          <div className="flex items-end gap-3 rounded-2xl border border-border/40 bg-card/60 px-4 py-3 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
            <textarea
              ref={textareaRef}
              value={composer}
              onChange={(e) => setComposer(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
              style={{ maxHeight: 140 }}
            />
            <Button
              onClick={handleSend}
              disabled={!composer.trim() || isSending}
              size="icon-sm"
              variant={composer.trim() && !isSending ? "default" : "ghost"}
              className="shrink-0"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>send</span>
            </Button>
          </div>
          <p className="mt-2 text-center text-[10px] text-muted-foreground/40">
            {agentName} has web search access for research
          </p>
        </div>
      </div>
    </div>
  )
}

"use client"

import { useEffect, useRef, useState } from "react"

type MermaidRendererProps = {
  chart: string
  className?: string
}

export function MermaidRenderer({ chart, className }: MermaidRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState<string>("")
  const [error, setError] = useState<string>("")

  useEffect(() => {
    if (!chart.trim()) return

    let cancelled = false

    async function render() {
      try {
        const mermaid = (await import("mermaid")).default
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          securityLevel: "strict",
          fontFamily: "inherit",
        })

        const id = `mermaid-${Date.now()}`
        const { svg: rendered } = await mermaid.render(id, chart.trim())

        if (!cancelled) {
          setSvg(rendered)
          setError("")
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to render diagram")
          setSvg("")
        }
      }
    }

    render()
    return () => { cancelled = true }
  }, [chart])

  if (!chart.trim()) return null

  if (error) {
    return (
      <div className={className}>
        <p className="text-[10px] text-destructive/60">Diagram error: {error}</p>
      </div>
    )
  }

  if (!svg) {
    return (
      <div className={className}>
        <p className="text-[10px] text-muted-foreground/60">Rendering diagram...</p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={className}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

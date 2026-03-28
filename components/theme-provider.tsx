"use client"

import * as React from "react"

type ThemeMode = "light" | "dark" | "system"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: ThemeMode
  enableSystem?: boolean
  attribute?: "class"
  disableTransitionOnChange?: boolean
}

type ThemeContextValue = {
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
  resolvedTheme: "light" | "dark"
  systemTheme: "light" | "dark"
  themes: ThemeMode[]
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined)
const STORAGE_KEY = "theme"

function getSystemTheme() {
  if (typeof window === "undefined") {
    return "light" as const
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function applyThemeToDocument(theme: ThemeMode, enableSystem: boolean) {
  const root = document.documentElement
  const resolvedTheme = theme === "system" && enableSystem ? getSystemTheme() : theme === "system" ? "light" : theme

  root.classList.remove("light", "dark")
  root.classList.add(resolvedTheme)
  root.style.colorScheme = resolvedTheme

  return resolvedTheme
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  enableSystem = true,
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<ThemeMode>(defaultTheme)
  const [systemTheme, setSystemTheme] = React.useState<"light" | "dark">("light")
  const [resolvedTheme, setResolvedTheme] = React.useState<"light" | "dark">("light")

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")

    const syncTheme = () => {
      const nextSystemTheme = mediaQuery.matches ? "dark" : "light"
      setSystemTheme(nextSystemTheme)
    }

    syncTheme()
    mediaQuery.addEventListener("change", syncTheme)

    return () => mediaQuery.removeEventListener("change", syncTheme)
  }, [])

  React.useEffect(() => {
    try {
      const storedTheme = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null
      if (storedTheme === "light" || storedTheme === "dark" || storedTheme === "system") {
        setThemeState(storedTheme)
      }
    } catch {
      setThemeState(defaultTheme)
    }
  }, [defaultTheme])

  React.useEffect(() => {
    const nextResolvedTheme = applyThemeToDocument(theme, enableSystem)
    setResolvedTheme(nextResolvedTheme)

    try {
      window.localStorage.setItem(STORAGE_KEY, theme)
    } catch {}
  }, [enableSystem, theme, systemTheme])

  const setTheme = React.useCallback((nextTheme: ThemeMode) => {
    setThemeState(nextTheme)
  }, [])

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      resolvedTheme,
      systemTheme,
      themes: enableSystem ? ["light", "dark", "system"] : ["light", "dark"],
    }),
    [enableSystem, resolvedTheme, setTheme, systemTheme, theme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = React.useContext(ThemeContext)

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider")
  }

  return context
}

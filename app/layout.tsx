import type { Metadata } from "next"
import { Inter, Roboto_Slab, Space_Grotesk } from "next/font/google"
import "./globals.css"
import { cn } from "@/lib/utils"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

const robotoSlab = Roboto_Slab({ subsets: ["latin"], variable: "--font-serif" })

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-brand",
})

export const metadata: Metadata = {
  title: "Luminescent IDE",
  description: "Responsive ideation dashboard integrated in Next.js",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(
        "dark h-full antialiased",
        inter.variable,
        robotoSlab.variable,
        spaceGrotesk.variable
      )}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}

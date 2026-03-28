import type { Metadata } from "next";
import { Geist, Geist_Mono, Roboto_Slab, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const robotoSlab = Roboto_Slab({subsets:['latin'],variable:'--font-serif'});
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Luminescent IDE",
  description: "AI-Native IDE for collaborative SDLC",
};

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
              geistSans.variable,
              geistMono.variable,
              inter.variable
            , "font-serif", robotoSlab.variable)}
    >
      <body className="min-h-full flex flex-col bg-[#131313] text-[#e5e2e1]">
        {children}
      </body>
    </html>
  );
}

import { NextRequest } from "next/server"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const { POST: handlePost } = await import("@/app/api/messages/route")
  return handlePost(request)
}

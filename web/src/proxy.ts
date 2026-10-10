import { NextResponse, type NextRequest } from "next/server"

import slugs from "../content/decision-slugs.json"

const KNOWN = new Set<string>(slugs)

/**
 * A real 404 for unknown decision records. The record page is prerendered with Cache Components,
 * so for a slug it doesn't know, the static shell (status 200) is already streaming when
 * notFound() runs. Checking the slug here, before the page renders, sends unknown ones to the
 * not-found page with a 404 status instead. The list is written by tools/sync-docs.mjs.
 */
export function proxy(request: NextRequest) {
  const slug = request.nextUrl.pathname.split("/")[3] ?? ""
  if (KNOWN.has(slug)) return NextResponse.next()
  return NextResponse.rewrite(new URL("/_unknown-decision-record", request.url))
}

export const config = {
  matcher: "/methods/decisions/:slug",
}

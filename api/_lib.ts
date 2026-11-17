// Shared bits for the API routes. Files starting with "_" aren't routes.
//
// Both routes call Google Gemini 2.5 Flash through Vercel AI Gateway. Auth is
// Vercel OIDC (VERCEL_OIDC_TOKEN on deployments; `vercel env pull` locally),
// so there's no provider key anywhere. The site is public and the gateway
// bills this project, so every route validates its input tightly and is rate
// limited per IP.

export const MODEL = "google/gemini-2.5-flash"

/** Gemini 2.5 Flash thinks by default; translation and UI tweaks don't need it. */
export const NO_THINKING = { google: { thinkingConfig: { thinkingBudget: 0 } } }

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  })
}

// Per-instance, best effort: enough to stop a casual loop from running up the
// bill. A Vercel Firewall rate-limit rule is the durable version.
const hits = new Map<string, { count: number; reset: number }>()

export function rateLimited(req: Request, bucket: string, perMinute: number): boolean {
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim()
  const key = `${bucket}:${ip}`
  const now = Date.now()
  const entry = hits.get(key)
  if (!entry || entry.reset < now) {
    hits.set(key, { count: 1, reset: now + 60_000 })
    return false
  }
  entry.count++
  return entry.count > perMinute
}

export async function readJson(req: Request, maxBytes: number): Promise<unknown> {
  const text = await req.text()
  if (text.length > maxBytes) throw new Error("Request too large")
  return JSON.parse(text)
}

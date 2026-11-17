import type { Translations } from "../content"
import type { LensSettings } from "../settings"

/** Translate the page via /api/translate (Gemini through Vercel AI Gateway). */
export async function translatePage(s: LensSettings): Promise<Translations> {
  const res = await fetch("/api/translate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ language: s.language, tone: s.tone, keep: s.keep }),
  })
  const data = (await res.json().catch(() => ({}))) as { translations?: Translations; error?: string }
  if (!res.ok || !data.translations) throw new Error(data.error ?? `Translation failed (${res.status})`)
  return data.translations
}

export type Tone = "neutral" | "formal" | "casual"

export const LANGUAGES = {
  "fr-CA": "French (Canada)",
  "es-419": "Spanish (Latin America)",
  "de-DE": "German",
  "pt-BR": "Portuguese (Brazil)",
  "it-IT": "Italian",
  "ja-JP": "Japanese",
} as const

export type Language = keyof typeof LANGUAGES

export type LensSettings = {
  language: Language
  tone: Tone
  /** Comma-separated terms to leave in English. */
  keep: string
  /** Lens radius in CSS px. */
  size: number
  magnify: number
  /** Bulged rim bands (canvas renderer only). */
  refraction: boolean
  /** Where the lamp sits, degrees clockwise from screen-right (225 = upper left). */
  lightAngle: number
}

export const DEFAULT_SETTINGS: LensSettings = {
  language: "fr-CA",
  tone: "neutral",
  keep: "Harbourside Paddle Co.",
  size: 150,
  magnify: 1.12,
  refraction: true,
  lightAngle: 225,
}

/** The settings that change the translation itself, as a cache key. */
export function translationKey(s: LensSettings) {
  return `${s.language}|${s.tone}|${s.keep.trim().toLowerCase()}`
}

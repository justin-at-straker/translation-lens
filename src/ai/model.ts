// BYOK: OpenAI called straight from the browser with the user's own key.
import { createOpenAI } from "@ai-sdk/openai"

declare const __DEV_OPENAI_KEY__: string

export const MODEL = "gpt-6-luna"
const KEY_STORAGE = "lens.openaiKey"

export function readKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) || __DEV_OPENAI_KEY__ || ""
  } catch {
    return __DEV_OPENAI_KEY__ || ""
  }
}

export function saveKey(key: string) {
  try {
    localStorage.setItem(KEY_STORAGE, key)
  } catch {
    /* private mode: the key lives for this tab only */
  }
}

/** The Responses API: newer OpenAI models require it. OpenAI allows browser (CORS) calls. */
export function model(apiKey: string) {
  return createOpenAI({ apiKey }).responses(MODEL)
}

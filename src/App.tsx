import { useCallback, useEffect, useRef, useState } from "react"
import { readKey, saveKey } from "./ai/model"
import { translatePage } from "./ai/translate"
import { Chat } from "./Chat"
import { BUILT_IN_FR_CA, type Translations } from "./content"
import { canvasSupported, LensStage } from "./LensStage"
import { Panel } from "./Panel"
import { BUILT_IN_KEY, DEFAULT_SETTINGS, LANGUAGES, translationKey, type LensSettings } from "./settings"

type Shown = { key: string; lang: string; t: Translations }

export function App() {
  const [settings, setSettings] = useState<LensSettings>(DEFAULT_SETTINGS)
  const [apiKey, setApiKey] = useState(readKey)
  const [shown, setShown] = useState<Shown>({ key: BUILT_IN_KEY, lang: "fr-CA", t: BUILT_IN_FR_CA })
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState("")
  const [forceCss, setForceCss] = useState(false)
  const cache = useRef(new Map<string, Translations>([[BUILT_IN_KEY, BUILT_IN_FR_CA]]))

  const onChange = useCallback((patch: Partial<LensSettings>) => setSettings((s) => ({ ...s, ...patch })), [])
  const onKey = useCallback((k: string) => {
    setApiKey(k)
    saveKey(k)
  }, [])

  // Re-translate when language, tone or the keep list changes (debounced).
  const key = translationKey(settings)
  useEffect(() => {
    if (key === shown.key) return
    const hit = cache.current.get(key)
    if (hit) {
      setShown({ key, lang: settings.language, t: hit })
      setNote("")
      return
    }
    if (!apiKey) {
      setNote(`Add an OpenAI key to translate into ${LANGUAGES[settings.language]}.`)
      return
    }
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setBusy(true)
      setNote("")
      try {
        const t = await translatePage(apiKey, settings)
        cache.current.set(key, t)
        if (!cancelled) setShown({ key, lang: settings.language, t })
      } catch (e) {
        if (!cancelled) setNote(`Translation failed: ${(e as Error).message}`)
      } finally {
        if (!cancelled) setBusy(false)
      }
    }, 500)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
    // settings is read through key; the other fields don't affect translation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, apiKey])

  const renderer = canvasSupported && !forceCss ? "canvas" : "css"

  return (
    <div className="app">
      <main className="viewport">
        <LensStage translated={shown.t} lang={shown.lang} settings={settings} busy={busy} renderer={renderer} />
      </main>
      <aside className="sidebar">
        <Panel settings={settings} onChange={onChange} />
        <Chat apiKey={apiKey} onKey={onKey} />
        <div className="status" data-agent-hidden>
          <span className={`badge ${renderer}`}>
            {renderer === "canvas" ? "HTML-in-Canvas" : "CSS fallback"}
          </span>
          {canvasSupported ? (
            <button className="link" onClick={() => setForceCss((v) => !v)}>
              {forceCss ? "Use canvas" : "Compare with CSS"}
            </button>
          ) : (
            <span className="muted">Enable chrome://flags/#canvas-draw-element for the canvas renderer</span>
          )}
          {busy && <span className="muted">Translating…</span>}
          {note && <span className="warn">{note}</span>}
        </div>
      </aside>
    </div>
  )
}

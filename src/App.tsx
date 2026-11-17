import { useCallback, useEffect, useRef, useState } from "react"
import { readKey, saveKey } from "./ai/model"
import { translatePage } from "./ai/translate"
import { Chat } from "./Chat"
import { ENGLISH, type Translations } from "./content"
import { webglSupported } from "./glass"
import { canvasSupported, LensStage, type Renderer } from "./LensStage"
import { Panel } from "./Panel"
import { Scene } from "./Scene"
import { DEFAULT_SETTINGS, LANGUAGES, translationKey, type LensSettings } from "./settings"

const RENDERER_LABELS: Record<Renderer, string> = {
  webgl: "HTML-in-Canvas · WebGL glass",
  canvas: "HTML-in-Canvas · 2D",
  css: "CSS fallback",
}

type Shown = { key: string; lang: string; t: Translations }

export function App() {
  const [settings, setSettings] = useState<LensSettings>(DEFAULT_SETTINGS)
  const [apiKey, setApiKey] = useState(readKey)
  const [shown, setShown] = useState<Shown>({ key: "", lang: "en", t: ENGLISH })
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState("")
  const [rendererIndex, setRendererIndex] = useState(0)
  const cache = useRef(new Map<string, Translations>())

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

  const available: Renderer[] = [
    ...(webglSupported ? (["webgl"] as const) : []),
    ...(canvasSupported ? (["canvas"] as const) : []),
    "css",
  ]
  const renderer = available[rendererIndex % available.length]

  const sidebar = (
    <>
      <Panel settings={settings} onChange={onChange} />
      <Chat apiKey={apiKey} onKey={onKey} />
      <div className="status" data-agent-hidden>
        <span className={`badge ${renderer === "css" ? "css" : "canvas"}`}>{RENDERER_LABELS[renderer]}</span>
        {available.length > 1 ? (
          <button className="link" onClick={() => setRendererIndex((i) => i + 1)}>
            Switch to {RENDERER_LABELS[available[(rendererIndex + 1) % available.length]]}
          </button>
        ) : (
          <span className="muted">Enable chrome://flags/#canvas-draw-element for the canvas renderer</span>
        )}
        {busy && <span className="muted">Translating…</span>}
        {note && <span className="warn">{note}</span>}
      </div>
    </>
  )

  // WebGL: the whole app, controls included, is one HTML-in-Canvas scene.
  if (renderer === "webgl") {
    return (
      <Scene translated={shown.t} lang={shown.lang} settings={settings} busy={busy}>
        {sidebar}
      </Scene>
    )
  }

  return (
    <div className="app">
      <main className="viewport">
        <LensStage translated={shown.t} lang={shown.lang} settings={settings} busy={busy} renderer={renderer} />
      </main>
      <aside className="sidebar">{sidebar}</aside>
    </div>
  )
}

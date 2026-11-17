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

const REPO_URL = "https://github.com/justin-at-straker/translation-lens"

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
      <a className="source-link" href={REPO_URL} target="_blank" rel="noreferrer" data-agent-hidden>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
        </svg>
        <span>View source on GitHub</span>
      </a>
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

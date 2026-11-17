// The WebGL renderer: the whole app is one HTML-in-Canvas scene.
//
//   <canvas layoutsubtree content="drawable">        full window
//     <div drawable class="scene-root">              the app, transparent background
//       <div class="scene-scroll">                   the page scrolls natively
//         English page
//       <aside class="scene-panel">                  settings + chat
//     <div drawable class="scene-tr">               translated page, its own snapshot
//
// The root sits at the canvas origin with an identity transform, so every
// control keeps its real DOM position: clicks, focus, scrolling and ui-sdk
// popups all work as normal. The shader draws the desk, the cards' shadows
// and the loupe; the loupe shows the translated page over the page and a
// magnified view of anything else, including the controls.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { ENGLISH, type Translations } from "./content"
import { GlassRenderer } from "./glass"
import { alignBlocks } from "./LensStage"
import { Page } from "./Page"
import type { LensSettings } from "./settings"

type DrawableCanvas = HTMLCanvasElement & {
  requestPaint?: () => void
  onpaint?: (() => void) | null
  updateElementGeometry?: (el: Element, opts: { canvasClip?: DOMRectInit; canvasTransform?: DOMMatrixInit }) => void
}

type Props = {
  translated: Translations
  lang: string
  settings: LensSettings
  busy: boolean
  /** The settings panel, chat and status: drawn as a card on the desk. */
  children: ReactNode
}

function useWindowSize() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight })
  useEffect(() => {
    const on = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener("resize", on)
    return () => window.removeEventListener("resize", on)
  }, [])
  return size
}

export function Scene({ translated, lang, settings, busy, children }: Props) {
  const canvasRef = useRef<DrawableCanvas>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pageWrapRef = useRef<HTMLDivElement>(null)
  const enRef = useRef<HTMLDivElement>(null)
  const trRef = useRef<HTMLDivElement>(null)
  const glassRef = useRef<GlassRenderer | null>(null)
  const [glEpoch, setGlEpoch] = useState(0)
  const size = useWindowSize()
  const [lens, setLens] = useState({ x: 420, y: 380 })

  // Line the translated page up with the English one, block by block.
  useLayoutEffect(() => {
    const en = enRef.current
    const tr = trRef.current
    if (!en || !tr) return
    alignBlocks(en, tr)
    document.fonts?.ready.then(() => alignBlocks(en, tr))
    // Re-capture a couple of times after new copy lands, in case the first
    // snapshot was taken before the new text had painted.
    const canvas = canvasRef.current
    const timers = [120, 600].map((ms) => window.setTimeout(() => canvas?.requestPaint?.(), ms))
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [translated])

  const stateRef = useRef({ lens, settings, busy, size })
  stateRef.current = { lens, settings, busy, size }

  /** Where the page (and so the translated page) sits on screen right now. */
  const pageOrigin = () => {
    const sc = scrollRef.current
    const pw = pageWrapRef.current
    if (!sc || !pw) return { x: 0, y: 0 }
    return { x: sc.offsetLeft + pw.offsetLeft, y: sc.offsetTop + pw.offsetTop - sc.scrollTop }
  }

  const draw = useCallback(() => {
    const g = glassRef.current
    const canvas = canvasRef.current
    const root = rootRef.current
    const tr = trRef.current
    // Never draw before both layers have been captured: that would be black.
    if (!g || !canvas || !root || !tr || !g.ready) return
    const { lens: L, settings: s, busy: b, size: z } = stateRef.current
    const a = (s.lightAngle * Math.PI) / 180
    const lamp = { x: z.w / 2 + Math.cos(a) * 900, y: z.h / 2 + Math.sin(a) * 900, z: 700 }
    const o = pageOrigin()
    g.draw({ lens: L, lamp, trOrigin: o, radius: s.size, magnify: s.magnify, refraction: s.refraction, busy: b })

    // Hit testing: the app is drawn 1:1; the translated page is drawn scaled
    // about the lens centre and only takes clicks inside the lens.
    const m = s.magnify
    const R = s.size
    try {
      canvas.updateElementGeometry?.(root, { canvasTransform: new DOMMatrix() })
      canvas.updateElementGeometry?.(tr, {
        canvasTransform: new DOMMatrix([m, 0, 0, m, L.x + (o.x - L.x) * m, L.y + (o.y - L.y) * m]),
        canvasClip: { x: L.x - o.x - R / m, y: L.y - o.y - R / m, width: (2 * R) / m, height: (2 * R) / m },
      })
    } catch {
      tr.style.pointerEvents = "none"
    }
  }, [])

  // Create the renderer and re-snapshot on every paint event (any change in
  // the app: typing, scrolling, a new translation).
  useEffect(() => {
    const canvas = canvasRef.current
    const root = rootRef.current
    const tr = trRef.current
    if (!canvas || !root || !tr) return
    let g: GlassRenderer
    try {
      g = new GlassRenderer(canvas)
    } catch (e) {
      console.error(e)
      return
    }
    glassRef.current = g
    let retry = 0
    let retries = 0
    canvas.onpaint = () => {
      const okScene = g.upload("scene", root)
      const okTr = g.upload("tr", tr)
      const ok = okScene && okTr
      if (import.meta.env.DEV) {
        const dbg = ((window as unknown as { __lens?: Record<string, number> }).__lens ??= {})
        dbg.paints = (dbg.paints ?? 0) + 1
        dbg.sceneFail = (dbg.sceneFail ?? 0) + (okScene ? 0 : 1)
        dbg.trFail = (dbg.trFail ?? 0) + (okTr ? 0 : 1)
      }
      draw()
      cancelAnimationFrame(retry)
      // A snapshot can lag a frame behind a layout change: keep the last good
      // textures and try again next frame.
      if (!ok && retries++ < 30) retry = requestAnimationFrame(() => canvas.requestPaint?.())
      if (ok) retries = 0
    }
    const onLost = (e: Event) => e.preventDefault()
    const onRestored = () => setGlEpoch((n) => n + 1)
    canvas.addEventListener("webglcontextlost", onLost)
    canvas.addEventListener("webglcontextrestored", onRestored)
    canvas.requestPaint?.()
    return () => {
      cancelAnimationFrame(retry)
      canvas.onpaint = null
      canvas.removeEventListener("webglcontextlost", onLost)
      canvas.removeEventListener("webglcontextrestored", onRestored)
      g.dispose()
      glassRef.current = null
    }
  }, [draw, glEpoch])

  // Match the backing store to the window.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(size.w * dpr)
    canvas.height = Math.round(size.h * dpr)
    draw() // resizing clears the canvas
    canvas.requestPaint?.()
  }, [size, draw])

  // The translated page sits under the pointer (inside the lens) but outside
  // the scroll area: pass its wheel events on so the page still scrolls.
  useEffect(() => {
    const tr = trRef.current
    if (!tr) return
    const on = (e: WheelEvent) => scrollRef.current?.scrollBy({ left: e.deltaX, top: e.deltaY })
    tr.addEventListener("wheel", on, { passive: true })
    return () => tr.removeEventListener("wheel", on)
  }, [])

  // The loupe follows the pointer anywhere in the window.
  useEffect(() => {
    const on = (e: PointerEvent) => setLens({ x: e.clientX, y: e.clientY })
    window.addEventListener("pointermove", on)
    return () => window.removeEventListener("pointermove", on)
  }, [])

  useEffect(() => draw(), [lens, settings, draw])

  // Animate the bezel while a translation is in flight.
  useEffect(() => {
    if (!busy) {
      draw()
      return
    }
    let id = 0
    const loop = () => {
      draw()
      id = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(id)
  }, [busy, draw])

  return (
    <canvas
      ref={canvasRef}
      className="scene-canvas"
      {...{ layoutsubtree: "", content: "drawable" }}
      style={{ width: size.w, height: size.h }}
    >
      <div ref={rootRef} className="scene-root" style={{ width: size.w, height: size.h }} {...{ drawable: "" }}>
        <div ref={scrollRef} className="scene-scroll">
          <div ref={pageWrapRef} className="scene-pagewrap">
            <div ref={enRef}>
              <Page t={ENGLISH} lang="en" />
            </div>
          </div>
        </div>
        <aside className="scene-panel">{children}</aside>
      </div>
      {/* A direct drawable child, so it's a separate snapshot from the app.
          Its layout position doesn't matter: the shader and the hit-test
          geometry place it over the English page. */}
      <div ref={trRef} className="scene-tr" {...{ drawable: "" }}>
        <Page t={translated} lang={lang} variant="lens" hidden />
      </div>
    </canvas>
  )
}

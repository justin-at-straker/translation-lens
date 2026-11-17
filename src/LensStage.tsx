// The page with a translation lens over it. Three renderers:
//  - "webgl": HTML-in-Canvas into WebGL textures, drawn by the glass shader in
//    glass.ts (real refraction, steel bezel, wooden handle).
//  - "canvas": HTML-in-Canvas 2D. Both pages are live DOM children of a drawable
//    canvas; each frame draws the English page, then the translated page
//    through a circular clip with magnified rim bands (fake refraction) and a
//    glass rim. Text under the lens stays hit-testable via element geometry.
//  - "css": fallback for browsers without the API. Same idea with clip-path.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { ENGLISH, type Translations } from "./content"
import { GlassRenderer } from "./glass"
import { Page } from "./Page"
import type { LensSettings } from "./settings"

export const PAGE_WIDTH = 960
/** Desk around the page in the WebGL renderer, so the loupe can hang off the edge. */
const DESK_MARGIN = 200

type Canvas2D = CanvasRenderingContext2D & {
  drawElementImage?: (el: Element, dx: number, dy: number, dw: number, dh: number) => DOMMatrix | undefined
}
type DrawableCanvas = HTMLCanvasElement & {
  requestPaint?: () => void
  onpaint?: (() => void) | null
  updateElementGeometry?: (el: Element, opts: { canvasClip?: DOMRectInit; canvasTransform?: DOMMatrixInit }) => void
}

export type Renderer = "webgl" | "canvas" | "css"

export const canvasSupported =
  typeof window !== "undefined" &&
  typeof (CanvasRenderingContext2D.prototype as Canvas2D).drawElementImage === "function"

type Props = {
  translated: Translations
  lang: string
  settings: LensSettings
  busy: boolean
  renderer: Renderer
}

/** Give each pair of matching blocks the taller of the two heights, so the
 *  translated page lines up with the English one block by block. */
function alignBlocks(a: HTMLElement, b: HTMLElement) {
  const pairs: [HTMLElement, HTMLElement][] = []
  a.querySelectorAll<HTMLElement>("[data-seg]").forEach((el) => {
    const other = b.querySelector<HTMLElement>(`[data-seg="${el.dataset.seg}"]`)
    if (other) pairs.push([el, other])
  })
  for (const [x, y] of pairs) x.style.minHeight = y.style.minHeight = ""
  const heights = pairs.map(([x, y]) => Math.max(x.offsetHeight, y.offsetHeight))
  pairs.forEach(([x, y], i) => (x.style.minHeight = y.style.minHeight = `${heights[i]}px`))
}

export function LensStage({ translated, lang, settings, busy, renderer }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<DrawableCanvas>(null)
  const enRef = useRef<HTMLDivElement>(null)
  const trRef = useRef<HTMLDivElement>(null)
  const [lens, setLens] = useState({ x: 330, y: 300 })
  const [height, setHeight] = useState(1200)

  // Align block heights whenever the copy changes, then size the stage.
  useLayoutEffect(() => {
    const en = enRef.current
    const tr = trRef.current
    if (!en || !tr) return
    const run = () => {
      alignBlocks(en, tr)
      setHeight(en.offsetHeight)
    }
    run()
    // Web fonts land after first layout and change line breaks.
    document.fonts?.ready.then(run)
  }, [translated, renderer])

  // ---- Canvas renderer -------------------------------------------------
  const M = renderer === "webgl" ? DESK_MARGIN : 0
  const stateRef = useRef({ lens, settings, busy, height, M })
  stateRef.current = { lens, settings, busy, height, M }

  const paint = useCallback(() => {
    const canvas = canvasRef.current
    const en = enRef.current
    const tr = trRef.current
    if (!canvas || !en || !tr) return
    const ctx = canvas.getContext("2d") as Canvas2D | null
    if (!ctx?.drawElementImage) return
    const { lens: L, settings: s, busy: isBusy } = stateRef.current
    const dpr = window.devicePixelRatio || 1
    const W = PAGE_WIDTH
    const R = s.size
    const m = s.magnify

    ctx.reset()
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    try {
      ctx.drawElementImage(en, 0, 0, W, en.offsetHeight)
    } catch {
      return // no snapshot yet; the next paint event will draw
    }

    // Drop shadow under the glass.
    ctx.save()
    ctx.shadowColor = "rgba(20, 24, 40, 0.32)"
    ctx.shadowBlur = 44
    ctx.shadowOffsetY = 20
    ctx.beginPath()
    ctx.arc(L.x, L.y, R, 0, Math.PI * 2)
    ctx.fillStyle = "#EEF1FB"
    ctx.fill()
    ctx.restore()

    // Translated page through the lens. Outer bands are magnified more, which
    // reads as the glass bulging at its edge.
    // Many thin bands, magnified more towards the rim: reads as glass bulging
    // at its edge. Drawn outermost first; each inner band covers the last.
    const bands: [number, number][] = [[R, m]]
    if (s.refraction) {
      bands.length = 0
      const steps = 14
      for (let i = 0; i <= steps; i++) {
        const f = i / steps // 0 at the rim, 1 at the inner edge of the bulge
        bands.push([R * (1 - 0.22 * f), m * (1 + 0.16 * (1 - f) ** 2)])
      }
    }
    for (const [r, mm] of bands) {
      ctx.save()
      ctx.beginPath()
      ctx.arc(L.x, L.y, r, 0, Math.PI * 2)
      ctx.clip()
      ctx.fillStyle = "#EEF1FB"
      ctx.fillRect(L.x - r, L.y - r, r * 2, r * 2)
      ctx.translate(L.x, L.y)
      ctx.scale(mm, mm)
      ctx.translate(-L.x, -L.y)
      ctx.drawElementImage(tr, 0, 0, W, tr.offsetHeight)
      ctx.restore()
    }

    // Only the part of the translated page inside the lens takes clicks.
    if (canvas.updateElementGeometry) {
      try {
        canvas.updateElementGeometry(tr, {
          canvasClip: { x: L.x - R / m, y: L.y - R / m, width: (2 * R) / m, height: (2 * R) / m },
        })
      } catch {
        tr.style.pointerEvents = "none"
      }
    } else {
      tr.style.pointerEvents = "none"
    }

    // Glass: a faint tint, a white inner rim, chromatic fringes, a highlight.
    ctx.save()
    ctx.beginPath()
    ctx.arc(L.x, L.y, R, 0, Math.PI * 2)
    ctx.fillStyle = "rgba(47, 91, 255, 0.035)"
    ctx.fill()
    ctx.lineWidth = 8
    ctx.strokeStyle = "rgba(255, 255, 255, 0.55)"
    ctx.beginPath()
    ctx.arc(L.x, L.y, R - 4, 0, Math.PI * 2)
    ctx.stroke()
    ctx.lineWidth = 2
    ctx.strokeStyle = "rgba(255, 40, 100, 0.35)"
    ctx.beginPath()
    ctx.arc(L.x - 1.5, L.y, R - 1, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = "rgba(30, 110, 255, 0.4)"
    ctx.beginPath()
    ctx.arc(L.x + 1.5, L.y, R - 1, 0, Math.PI * 2)
    ctx.stroke()
    ctx.lineWidth = 1
    ctx.strokeStyle = "rgba(20, 24, 40, 0.3)"
    ctx.beginPath()
    ctx.arc(L.x, L.y, R + 0.5, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)"
    ctx.beginPath()
    ctx.ellipse(L.x - R * 0.32, L.y - R * 0.56, R * 0.34, R * 0.12, -0.42, 0, Math.PI * 2)
    ctx.fill()
    // Handle.
    ctx.lineCap = "round"
    ctx.lineWidth = 16
    ctx.strokeStyle = "#1B1B1A"
    ctx.beginPath()
    ctx.moveTo(L.x + R * 0.72, L.y + R * 0.72)
    ctx.lineTo(L.x + R * 0.72 + 64, L.y + R * 0.72 + 64)
    ctx.stroke()
    // Working: a sweeping arc while a translation is in flight.
    if (isBusy) {
      const t = performance.now() / 400
      ctx.lineWidth = 3
      ctx.strokeStyle = "#2F5BFF"
      ctx.beginPath()
      ctx.arc(L.x, L.y, R + 6, t, t + 1.4)
      ctx.stroke()
    }
    ctx.restore()

    if (isBusy) requestAnimationFrame(() => canvas.requestPaint?.() ?? paint())
  }, [])

  // Size the canvas backing store to the page, and hook the paint event.
  useEffect(() => {
    if (renderer !== "canvas") return
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(PAGE_WIDTH * dpr)
    canvas.height = Math.round(height * dpr)
    canvas.onpaint = paint
    canvas.requestPaint?.()
    return () => {
      canvas.onpaint = null
    }
  }, [renderer, height, paint])

  // Repaint on anything that changes the drawing.
  useEffect(() => {
    if (renderer !== "canvas") return
    const canvas = canvasRef.current
    if (canvas?.requestPaint) canvas.requestPaint()
    else paint()
  }, [renderer, lens, settings, busy, translated, paint])

  // ---- WebGL glass renderer ---------------------------------------------
  const glassRef = useRef<GlassRenderer | null>(null)

  const drawGlass = useCallback(() => {
    const g = glassRef.current
    const canvas = canvasRef.current
    const en = enRef.current
    const tr = trRef.current
    if (!g || !canvas || !en || !tr) return
    const { lens: L, settings: s, busy: b, M: margin } = stateRef.current
    // The lamp hangs 700px out from the middle of what's on screen, 650px up,
    // so scrolling and moving the loupe both change how the light falls.
    const wrap = wrapRef.current
    const vp = wrap?.closest(".viewport") as HTMLElement | null
    const midY = vp && wrap ? vp.scrollTop + vp.clientHeight / 2 - wrap.offsetTop - margin : 400
    const a = (s.lightAngle * Math.PI) / 180
    const lamp = { x: PAGE_WIDTH / 2 + Math.cos(a) * 700, y: midY + Math.sin(a) * 700, z: 650 }
    g.draw({ lens: L, lamp, margin, radius: s.size, magnify: s.magnify, refraction: s.refraction, busy: b }, en, tr)
    // WebGL can't infer where elements were drawn, so tell the canvas: the
    // English page sits as-is; the translated page is scaled about the lens
    // centre and only takes clicks inside the lens.
    const m = s.magnify
    const R = s.size
    try {
      canvas.updateElementGeometry?.(en, { canvasTransform: new DOMMatrix([1, 0, 0, 1, margin, margin]) })
      canvas.updateElementGeometry?.(tr, {
        canvasTransform: new DOMMatrix([m, 0, 0, m, margin + L.x * (1 - m), margin + L.y * (1 - m)]),
        canvasClip: { x: L.x - R / m, y: L.y - R / m, width: (2 * R) / m, height: (2 * R) / m },
      })
    } catch {
      tr.style.pointerEvents = "none"
    }
  }, [])

  useEffect(() => {
    if (renderer !== "webgl") return
    const canvas = canvasRef.current
    const en = enRef.current
    const tr = trRef.current
    if (!canvas || !en || !tr) return
    let g: GlassRenderer
    try {
      g = new GlassRenderer(canvas)
    } catch (e) {
      console.error(e)
      return
    }
    glassRef.current = g
    // The paint event fires when either page's rendering changes: re-snapshot both.
    canvas.onpaint = () => {
      if (g.upload("en", en) && g.upload("tr", tr)) drawGlass()
    }
    canvas.requestPaint?.()
    return () => {
      canvas.onpaint = null
      g.dispose()
      glassRef.current = null
    }
  }, [renderer, drawGlass])

  useEffect(() => {
    if (renderer !== "webgl") return
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round((PAGE_WIDTH + 2 * DESK_MARGIN) * dpr)
    canvas.height = Math.round((height + 2 * DESK_MARGIN) * dpr)
    canvas.requestPaint?.()
  }, [renderer, height])

  // Scrolling moves the lamp relative to the page.
  useEffect(() => {
    if (renderer !== "webgl") return
    const vp = wrapRef.current?.closest(".viewport")
    if (!vp) return
    const onScroll = () => drawGlass()
    vp.addEventListener("scroll", onScroll, { passive: true })
    return () => vp.removeEventListener("scroll", onScroll)
  }, [renderer, drawGlass])

  // Lens moves and setting changes only need a redraw, not a re-snapshot.
  useEffect(() => {
    if (renderer === "webgl") drawGlass()
  }, [renderer, lens, settings, drawGlass])

  // Animate the bezel while a translation is in flight.
  useEffect(() => {
    if (renderer !== "webgl" || !busy) {
      if (renderer === "webgl") drawGlass()
      return
    }
    let id = 0
    const loop = () => {
      drawGlass()
      id = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(id)
  }, [renderer, busy, drawGlass])

  const onPointerMove = (e: React.PointerEvent) => {
    const rect = wrapRef.current!.getBoundingClientRect()
    setLens({ x: e.clientX - rect.left - M, y: e.clientY - rect.top - M })
  }

  const R = settings.size
  const m = settings.magnify

  if (renderer !== "css") {
    return (
      <div
        ref={wrapRef}
        className={M ? "stage stage-free" : "stage"}
        onPointerMove={onPointerMove}
        style={{ width: PAGE_WIDTH + 2 * M, height: height + 2 * M, margin: `${-M}px 0 ${-M}px max(${-M}px, calc((100% - ${PAGE_WIDTH}px) / 2 - ${M}px))` }}
      >
        <canvas
          // A canvas holds one context type: remount when switching 2D <-> WebGL.
          key={renderer}
          ref={canvasRef}
          className="stage-canvas"
          // Both spellings: the shipped origin trial and the current explainer.
          {...{ layoutsubtree: "", content: "drawable" }}
          style={{ width: PAGE_WIDTH + 2 * M, height: height + 2 * M }}
        >
          <div ref={enRef} style={{ width: PAGE_WIDTH }} {...{ drawable: "" }}>
            <Page t={ENGLISH} lang="en" />
          </div>
          <div ref={trRef} style={{ width: PAGE_WIDTH }} {...{ drawable: "" }}>
            <Page t={translated} lang={lang} variant="lens" hidden />
          </div>
        </canvas>
      </div>
    )
  }

  return (
    <div ref={wrapRef} className="stage" onPointerMove={onPointerMove} style={{ width: PAGE_WIDTH, height }}>
      <div ref={enRef}>
        <Page t={ENGLISH} lang="en" />
      </div>
      <div
        ref={trRef}
        className="lens-css"
        style={{
          clipPath: `circle(${R / m}px at ${lens.x}px ${lens.y}px)`,
          transform: `scale(${m})`,
          transformOrigin: `${lens.x}px ${lens.y}px`,
        }}
      >
        <Page t={translated} lang={lang} variant="lens" hidden />
      </div>
      <div
        className={`lens-rim${busy ? " busy" : ""}`}
        aria-hidden="true"
        style={{ left: lens.x - R, top: lens.y - R, width: R * 2, height: R * 2 }}
      />
    </div>
  )
}

// Fallback renderers for browsers without WebGL HTML-in-Canvas (the WebGL
// scene lives in Scene.tsx):
//  - "canvas": HTML-in-Canvas 2D. Both pages are live DOM children of a drawable
//    canvas; each frame draws the English page, then the translated page
//    through a circular clip with magnified rim bands and a glass rim.
//  - "css": no HTML-in-Canvas at all. Same idea with clip-path.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { ENGLISH, type Translations } from "./content"
import { Page } from "./Page"
import type { LensSettings } from "./settings"

export const PAGE_WIDTH = 960

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
  renderer: "canvas" | "css"
}

/** Give each pair of matching blocks the taller of the two heights, so the
 *  translated page lines up with the English one block by block. */
export function alignBlocks(a: HTMLElement, b: HTMLElement) {
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

  useLayoutEffect(() => {
    const en = enRef.current
    const tr = trRef.current
    if (!en || !tr) return
    const run = () => {
      alignBlocks(en, tr)
      setHeight(en.offsetHeight)
    }
    run()
    document.fonts?.ready.then(run)
  }, [translated, renderer])

  const stateRef = useRef({ lens, settings, busy })
  stateRef.current = { lens, settings, busy }

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

    ctx.save()
    ctx.shadowColor = "rgba(20, 24, 40, 0.32)"
    ctx.shadowBlur = 44
    ctx.shadowOffsetY = 20
    ctx.beginPath()
    ctx.arc(L.x, L.y, R, 0, Math.PI * 2)
    ctx.fillStyle = "#EEF1FB"
    ctx.fill()
    ctx.restore()

    // Many thin bands, magnified more towards the rim: reads as glass bulging
    // at its edge. Drawn outermost first; each inner band covers the last.
    const bands: [number, number][] = [[R, m]]
    if (s.refraction) {
      bands.length = 0
      const steps = 14
      for (let i = 0; i <= steps; i++) {
        const f = i / steps
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
    ctx.lineCap = "round"
    ctx.lineWidth = 16
    ctx.strokeStyle = "#1B1B1A"
    ctx.beginPath()
    ctx.moveTo(L.x + R * 0.72, L.y + R * 0.72)
    ctx.lineTo(L.x + R * 0.72 + 64, L.y + R * 0.72 + 64)
    ctx.stroke()
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

  useEffect(() => {
    if (renderer !== "canvas") return
    const canvas = canvasRef.current
    if (canvas?.requestPaint) canvas.requestPaint()
    else paint()
  }, [renderer, lens, settings, busy, translated, paint])

  const onPointerMove = (e: React.PointerEvent) => {
    const rect = wrapRef.current!.getBoundingClientRect()
    setLens({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  const R = settings.size
  const m = settings.magnify

  if (renderer === "canvas") {
    return (
      <div ref={wrapRef} className="stage" onPointerMove={onPointerMove} style={{ width: PAGE_WIDTH, height }}>
        <canvas
          ref={canvasRef}
          className="stage-canvas"
          {...{ layoutsubtree: "", content: "drawable" }}
          style={{ width: PAGE_WIDTH, height }}
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

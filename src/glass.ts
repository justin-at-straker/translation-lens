// WebGL loupe. Both pages are live DOM children of the canvas; on each paint
// event they're uploaded as textures with texElementSubImage2D (HTML-in-Canvas),
// then one full-screen shader draws the English page with the loupe on top:
// a domed glass lens (refraction, dispersion, fresnel, speculars), a brushed
// steel bezel, a wooden handle, and the loupe's shadow and caustic.

type GLWithElements = WebGL2RenderingContext & {
  texElementSubImage2D?: (
    target: number,
    level: number,
    x: number,
    y: number,
    el: Element,
  ) => void
}

type DrawableCanvas = HTMLCanvasElement & {
  getElementImageDefaultSize?: (el: Element) => { width: number; height: number }
}

export const webglSupported =
  typeof window !== "undefined" &&
  typeof (WebGL2RenderingContext.prototype as GLWithElements).texElementSubImage2D === "function"

export type GlassState = {
  lens: { x: number; y: number }
  radius: number
  magnify: number
  refraction: boolean
  busy: boolean
}

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`

const FRAG = `#version 300 es
precision highp float;
uniform sampler2D uEn;
uniform sampler2D uTr;
uniform vec2 uRes;      // backing store px
uniform float uDpr;
uniform vec2 uEnSize;   // CSS px
uniform vec2 uTrSize;
uniform vec2 uL;        // lens centre, CSS px
uniform float uR, uM, uRefr, uTime, uBusy;
out vec4 outColor;

// Light from the upper left (CSS space: +y is down).
const vec3 LIGHT = vec3(-0.42, -0.62, 0.66);

vec3 en(vec2 p) { return texture(uEn, p / uEnSize).rgb; }
vec3 tr(vec2 p) { return texture(uTr, clamp(p / uTrSize, 0.0, 1.0)).rgb; }

float sdSeg(vec2 p, vec2 a, vec2 b, out float h) {
  vec2 pa = p - a, ba = b - a;
  h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  vec3 L3 = normalize(LIGHT);
  vec3 H = normalize(L3 + vec3(0.0, 0.0, 1.0));
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
  vec2 d = p - uL;
  float dist = length(d);
  float aa = 0.8;
  float bw = max(9.0, uR * 0.085);   // bezel width
  float ro = uR + bw;
  vec3 col = en(p);

  // ---- Shadow and caustic on the page ----
  vec2 so = vec2(16.0, 30.0) * (0.6 + uR / 300.0);
  float sd = length(p - uL - so) - ro;
  float shadow = 1.0 - smoothstep(-uR * 0.25, uR * 0.6, sd);
  col *= 1.0 - 0.32 * shadow;
  float cd = length(p - uL - so * 0.75);
  float caustic = exp(-pow((cd - uR * 0.42) / (uR * 0.09), 2.0)) * 0.6
                + exp(-pow(cd / (uR * 0.16), 2.0));
  col += 0.16 * caustic * vec3(1.0, 0.96, 0.86) * shadow;

  // ---- Handle: steel collar then walnut grip ----
  vec2 dir = normalize(vec2(1.0, 1.0));
  vec2 a = uL + dir * (ro - 3.0);
  vec2 b = a + dir * max(120.0, uR * 0.95);
  float hw = max(11.0, uR * 0.085);
  float ht;
  float hsd = sdSeg(p - so * 0.55, a, b, ht) - hw;
  col *= 1.0 - 0.25 * (1.0 - smoothstep(-4.0, 22.0, hsd));
  float t;
  float hd = sdSeg(p, a, b, t) - hw;
  if (hd < aa) {
    vec2 perp = vec2(-dir.y, dir.x);
    float across = clamp(dot(p - a, perp) / hw, -1.0, 1.0);
    float along = t * length(b - a);
    vec3 n = normalize(vec3(perp * across, sqrt(max(0.0, 1.0 - across * across))));
    float diff = 0.3 + 0.8 * max(dot(n, L3), 0.0);
    vec3 c;
    if (along < 30.0) {
      float spec = pow(max(dot(n, H), 0.0), 50.0);
      float ridge = smoothstep(0.0, 2.0, abs(along - 15.0) - 4.0);
      c = vec3(0.66, 0.67, 0.70) * diff * mix(0.75, 1.0, ridge) + spec;
    } else {
      float grain = 0.5 + 0.5 * sin(along * 0.32 + across * 2.5 + sin(along * 0.045) * 5.0);
      vec3 wood = mix(vec3(0.20, 0.11, 0.06), vec3(0.38, 0.22, 0.12), grain);
      float spec = pow(max(dot(n, H), 0.0), 26.0) * 0.35;
      c = wood * diff + spec;
      // Rounded end cap.
      c *= 1.0 - 0.35 * smoothstep(0.92, 1.0, t);
    }
    col = mix(col, c, 1.0 - smoothstep(-aa, aa, hd));
  }

  // ---- Bezel: brushed steel torus ----
  if (dist < ro + aa && dist > uR - aa) {
    float rt = clamp((dist - uR) / bw, 0.0, 1.0);
    vec2 rd = d / max(dist, 1e-3);
    float prof = rt * 2.0 - 1.0;
    vec3 n = normalize(vec3(rd * prof * 0.92, sqrt(max(0.0, 1.0 - prof * prof * 0.85))));
    float diff = 0.4 + 0.65 * max(dot(n, L3), 0.0);
    float spec = pow(max(dot(n, H), 0.0), 70.0);
    float ang = atan(d.y, d.x);
    float brushed = 0.035 * sin(ang * 140.0) + 0.02 * sin(ang * 53.0 + 1.3);
    vec3 steel = vec3(0.68, 0.69, 0.72) * diff + spec * 1.1 + brushed;
    steel *= 0.7 + 0.3 * smoothstep(0.0, 0.15, rt) * smoothstep(1.0, 0.82, rt);
    if (uBusy > 0.5) {
      float s = fract(ang / 6.28318 - uTime * 0.6);
      steel += vec3(0.18, 0.32, 1.0) * smoothstep(0.82, 1.0, s) * 0.9;
    }
    float m = smoothstep(uR - aa, uR + aa, dist) * (1.0 - smoothstep(ro - aa, ro + aa, dist));
    col = mix(col, steel, m);
  }

  // ---- Glass ----
  if (dist < uR + aa) {
    float r = clamp(dist / uR, 0.0, 1.0);
    float h = sqrt(max(0.0, 1.0 - r * r));
    // Barrel bulge: towards the rim, sample closer to the centre.
    float bulge = uRefr * 0.26 * pow(1.0 - h, 1.5);
    float sc = (1.0 / uM) * (1.0 - bulge);
    float ca = uRefr * 0.012 * pow(1.0 - h, 1.3);
    vec3 g;
    g.r = tr(uL + d * sc * (1.0 + ca)).r;
    g.g = tr(uL + d * sc).g;
    g.b = tr(uL + d * sc * (1.0 - ca)).b;

    // Thickness tint at the edge, like the green of real glass.
    g *= mix(vec3(1.0), vec3(0.88, 0.96, 0.95), pow(1.0 - h, 1.6));

    vec3 n = normalize(vec3(d / uR * 0.85, h + 0.12));
    float fres = pow(1.0 - max(n.z, 0.0), 3.0);
    g = mix(g, vec3(0.97, 0.99, 1.0), fres * 0.5);

    // The bezel shades the glass on the side away from the light.
    vec2 ld = normalize(L3.xy);
    float away = 0.5 + 0.5 * dot(normalize(d + 1e-4), -ld);
    g *= 1.0 - 0.24 * smoothstep(0.78, 1.0, r) * away;
    // ...and the lit side catches a thin bright rim.
    g += 0.18 * smoothstep(0.9, 1.0, r) * (1.0 - away);

    // Speculars, kept near the rim so they don't sit on the text: a flatter
    // normal pushes the hot spot outwards. A sharp key glint upper left and a
    // faint back glint lower right.
    vec3 ns = normalize(vec3(d / uR * 0.3, h));
    g += pow(max(dot(ns, H), 0.0), 260.0) * 0.75;
    vec3 H2 = normalize(normalize(vec3(0.55, 0.6, 0.6)) + vec3(0.0, 0.0, 1.0));
    g += pow(max(dot(ns, H2), 0.0), 420.0) * 0.35;

    // A soft window reflection, upper left.
    vec2 q = d / uR;
    float c0 = cos(0.6), s0 = sin(0.6);
    vec2 wq = mat2(c0, -s0, s0, c0) * (q - vec2(-0.42, -0.62));
    vec2 wb = abs(wq) - vec2(0.26, 0.035);
    float wd = length(max(wb, 0.0)) + min(max(wb.x, wb.y), 0.0) - 0.05;
    g = mix(g, vec3(1.0), (1.0 - smoothstep(-0.02, 0.05, wd)) * 0.4);

    float m = 1.0 - smoothstep(uR - aa, uR + aa, dist);
    col = mix(col, g, m);
  }

  outColor = vec4(col, 1.0);
}
`

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader error")
  return s
}

export class GlassRenderer {
  private gl: GLWithElements
  private prog: WebGLProgram
  private tex: { en: WebGLTexture; tr: WebGLTexture }
  private texSize = { en: [0, 0], tr: [0, 0] }
  private u: Record<string, WebGLUniformLocation | null> = {}
  private canvas: DrawableCanvas

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const gl = canvas.getContext("webgl2", { alpha: false, antialias: false }) as GLWithElements | null
    if (!gl) throw new Error("WebGL2 unavailable")
    this.gl = gl
    const prog = gl.createProgram()!
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? "link error")
    this.prog = prog
    gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, "aPos")
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

    for (const name of ["uEn", "uTr", "uRes", "uDpr", "uEnSize", "uTrSize", "uL", "uR", "uM", "uRefr", "uTime", "uBusy"])
      this.u[name] = gl.getUniformLocation(prog, name)
    this.tex = { en: this.makeTexture(), tr: this.makeTexture() }
    gl.uniform1i(this.u.uEn, 0)
    gl.uniform1i(this.u.uTr, 1)
  }

  private makeTexture() {
    const gl = this.gl
    const t = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return t
  }

  /** Snapshot a drawable child into its texture. Returns false if no snapshot yet. */
  upload(which: "en" | "tr", el: HTMLElement): boolean {
    const gl = this.gl
    const size = this.canvas.getElementImageDefaultSize?.(el) ?? {
      width: Math.round(el.offsetWidth * devicePixelRatio),
      height: Math.round(el.offsetHeight * devicePixelRatio),
    }
    const w = Math.max(1, Math.round(size.width))
    const h = Math.max(1, Math.round(size.height))
    gl.activeTexture(which === "en" ? gl.TEXTURE0 : gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.tex[which])
    const [cw, ch] = this.texSize[which]
    if (cw !== w || ch !== h) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
      this.texSize[which] = [w, h]
    }
    try {
      gl.texElementSubImage2D!(gl.TEXTURE_2D, 0, 0, 0, el)
      return true
    } catch {
      return false
    }
  }

  draw(s: GlassState, en: HTMLElement, tr: HTMLElement) {
    const gl = this.gl
    const c = this.canvas
    gl.viewport(0, 0, c.width, c.height)
    gl.useProgram(this.prog)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.tex.en)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.tex.tr)
    gl.uniform2f(this.u.uRes, c.width, c.height)
    gl.uniform1f(this.u.uDpr, c.width / c.clientWidth || devicePixelRatio)
    gl.uniform2f(this.u.uEnSize, en.offsetWidth, en.offsetHeight)
    gl.uniform2f(this.u.uTrSize, tr.offsetWidth, tr.offsetHeight)
    gl.uniform2f(this.u.uL, s.lens.x, s.lens.y)
    gl.uniform1f(this.u.uR, s.radius)
    gl.uniform1f(this.u.uM, s.magnify)
    gl.uniform1f(this.u.uRefr, s.refraction ? 1 : 0)
    gl.uniform1f(this.u.uTime, performance.now() / 1000)
    gl.uniform1f(this.u.uBusy, s.busy ? 1 : 0)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  dispose() {
    const gl = this.gl
    gl.deleteTexture(this.tex.en)
    gl.deleteTexture(this.tex.tr)
    gl.deleteProgram(this.prog)
  }
}

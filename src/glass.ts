// WebGL scene renderer. The whole app is one full-window canvas whose drawable
// children are uploaded as textures with texElementSubImage2D (HTML-in-Canvas):
//  - "scene": the app itself (scrolling page + settings/chat panel) with a
//    transparent background, so the shader draws the desk underneath
//  - "tr": the translated page, a separate drawable child of the canvas, drawn
//    exactly over the English page
//
// One point light (a lamp above the desk) lights everything: the cards cast
// shadows, highlights slide, and the loupe on top has
//  - glass: a dome that refracts (bulge + dispersion) and reflects the room
//  - bezel: a half-round brushed-steel ring with anisotropic highlights
//  - handle: a knurled steel collar and a varnished walnut grip
// Inside the lens you see the translated page over the page, and a magnified
// view of everything else (the panel, the desk).

type GLWithElements = WebGL2RenderingContext & {
  texElementSubImage2D?: (target: number, level: number, x: number, y: number, el: Element) => void
}

type DrawableCanvas = HTMLCanvasElement & {
  getElementImageDefaultSize?: (el: Element) => { width: number; height: number }
}

export const webglSupported =
  typeof window !== "undefined" &&
  typeof (WebGL2RenderingContext.prototype as GLWithElements).texElementSubImage2D === "function"

export type GlassState = {
  /** Lens centre, screen CSS px. */
  lens: { x: number; y: number }
  /** Lamp position, screen CSS px; z is its height above the desk. */
  lamp: { x: number; y: number; z: number }
  /** Where the translated page's top-left currently is on screen. */
  trOrigin: { x: number; y: number }
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
uniform sampler2D uScene;
uniform sampler2D uTr;
uniform vec2 uRes;        // backing store px
uniform float uDpr;
uniform vec2 uSceneSize;  // CSS px
uniform vec2 uTrOrigin;   // CSS px, screen
uniform vec2 uTrSize;
uniform vec2 uL;          // lens centre, CSS px
uniform vec3 uLamp;       // lamp position, CSS px (z = height above the desk)
uniform float uR, uM, uRefr, uTime, uBusy;
out vec4 outColor;

// Heights above the desk, CSS px.
const float Z_CARD = 18.0;
const float Z_GLASS = 34.0;
const float Z_HANDLE = 26.0;
const vec3 V = vec3(0.0, 0.0, 1.0); // orthographic viewer, looking down
const vec3 DESK = vec3(0.894, 0.882, 0.851);

vec2 shadowOffset(vec2 at, float z) { return (at - uLamp.xy) * z / max(uLamp.z - z, 1.0); }

// Gentle falloff away from the lamp, so the whole desk reads as lit.
float lampLight(vec2 p) { return 1.05 - 0.15 * smoothstep(300.0, 2600.0, length(p - uLamp.xy)); }

vec4 sceneAt(vec2 p) { return texture(uScene, p / uSceneSize); }

// Soft shadow of the cards (page, panel), projected from the lamp, from the
// scene's alpha.
float cardShadow(vec2 p) {
  vec2 q = p - shadowOffset(p, Z_CARD);
  float s = sceneAt(q).a * 2.0;
  float w = 2.0;
  for (int i = 0; i < 12; i++) {
    float a = float(i) * 0.5236;
    s += sceneAt(q + vec2(cos(a), sin(a)) * 9.0).a;
    s += sceneAt(q + vec2(cos(a + 0.26), sin(a + 0.26)) * 22.0).a * 0.6;
    w += 1.6;
  }
  return s / w;
}

// What's on the desk at p: the app's cards over the shadowed desk.
vec3 base(vec2 p) {
  vec4 s = sceneAt(p);
  vec3 desk = DESK * (1.0 - 0.18 * cardShadow(p));
  return mix(desk, s.rgb, s.a) * lampLight(p);
}

// What the lens sees at q: the translated page where the page is, else the scene.
vec3 lensView(vec2 q) {
  vec2 t = q - uTrOrigin;
  if (t.x >= 0.0 && t.y >= 0.0 && t.x < uTrSize.x && t.y < uTrSize.y) {
    vec4 tc = texture(uTr, t / uTrSize);
    // An empty capture is transparent black: show the page itself, never black.
    return mix(base(q), tc.rgb * lampLight(q), smoothstep(0.3, 0.7, tc.a));
  }
  return base(q);
}

float sdSeg(vec2 p, vec2 a, vec2 b, out float h) {
  vec2 pa = p - a, ba = b - a;
  h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

vec3 toLamp(vec3 P) { return normalize(uLamp - P); }

// A small studio: warm room below the horizon, a cool ceiling, a big softbox
// where the lamp is, and a dark patch straight up where the viewer stands.
vec3 env(vec3 r, vec3 l) {
  vec3 room = vec3(0.42, 0.39, 0.35);
  vec3 ceiling = vec3(0.86, 0.88, 0.92);
  vec3 e = mix(room, ceiling, smoothstep(-0.15, 0.75, r.z));
  float ld = max(dot(r, l), 0.0);
  e += pow(ld, 90.0) * 4.0 + pow(ld, 10.0) * 0.35;
  e *= 1.0 - 0.45 * smoothstep(0.9, 1.0, r.z);
  return e;
}

float fresnel(float cosT, float f0) { return f0 + (1.0 - f0) * pow(1.0 - cosT, 5.0); }

// Brushed metal: environment reflection plus a highlight stretched across
// the brushing direction T.
vec3 brushedMetal(vec3 n, vec3 T, vec3 l, vec3 tint, float brush) {
  vec3 r = reflect(-V, n);
  vec3 c = tint * env(r, l);
  vec3 h = normalize(l + V);
  float th = dot(T, h);
  float aniso = pow(sqrt(max(0.0, 1.0 - th * th)), 160.0) * max(dot(n, l), 0.0);
  c += aniso * 1.4 * (0.92 + 0.12 * brush);
  c *= 0.96 + 0.06 * brush;
  return c;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
  vec2 d = p - uL;
  float dist = length(d);
  float aa = 0.8;
  float bw = max(10.0, uR * 0.09);   // bezel width
  float ro = uR + bw;
  vec3 col = base(p);

  // ---- The loupe's shadows, projected from the lamp ----
  vec2 sc = uL + shadowOffset(uL, Z_GLASS);
  float sdl = length(p - sc);
  float blur = 6.0 + Z_GLASS * 0.5;
  float ring = 1.0 - smoothstep(0.0, blur, abs(sdl - (uR + bw * 0.5)) - bw * 0.5);
  float inside = 1.0 - smoothstep(uR - blur, uR + blur * 0.3, sdl);
  float caustic = exp(-pow(sdl / (uR * 0.2), 2.0)) + 0.35 * exp(-pow((sdl - uR * 0.55) / (uR * 0.07), 2.0));
  float ao = 1.0 - smoothstep(-uR * 0.1, uR * 0.6, sdl - ro);

  vec2 dir = normalize(vec2(1.0, 1.0));
  vec2 a = uL + dir * (ro - 4.0);
  vec2 b = a + dir * max(130.0, uR * 1.0);
  float hw = max(11.0, uR * 0.085);
  vec2 hoff = shadowOffset((a + b) * 0.5, Z_HANDLE);
  float hs;
  float hsd = sdSeg(p - hoff, a, b, hs) - hw;
  float handleShadow = 1.0 - smoothstep(-2.0, 14.0, hsd);

  float shade = 1.0 - 0.42 * ring - 0.10 * inside * (1.0 - ring) - 0.12 * ao - 0.38 * handleShadow;
  col *= max(shade, 0.35);
  col += 0.22 * caustic * inside * vec3(1.0, 0.96, 0.85);

  // ---- Handle: capsule with a knurled steel collar and a walnut grip ----
  float t;
  float hd = sdSeg(p, a, b, t) - hw;
  if (hd < aa) {
    vec2 c = a + (b - a) * t;
    vec2 dv = p - c;
    float dd = length(dv);
    float z = sqrt(max(hw * hw - dd * dd, 0.0));
    vec3 n = normalize(vec3(dv, z));
    vec3 P = vec3(p, Z_HANDLE + z);
    vec3 l = toLamp(P);
    float along = t * length(b - a);
    vec3 axis = vec3(dir, 0.0);
    vec3 hc;
    if (along < 34.0) {
      float ridge = sin(along * 2.4);
      vec3 nk = normalize(n + axis * ridge * 0.35);
      float groove = smoothstep(0.0, 1.5, abs(along - 4.0) - 1.0) * smoothstep(0.0, 1.5, abs(along - 30.0) - 1.0);
      hc = brushedMetal(nk, axis, l, vec3(0.70, 0.71, 0.74), 0.5 + 0.5 * ridge) * mix(0.55, 1.0, groove);
    } else {
      float g1 = sin(along * 0.30 + dv.x * 0.08 + sin(along * 0.045) * 5.0);
      float g2 = sin(along * 1.7 + g1 * 2.0);
      vec3 wood = mix(vec3(0.17, 0.09, 0.05), vec3(0.40, 0.23, 0.12), 0.5 + 0.35 * g1 + 0.15 * g2);
      float diff = max(dot(n, l), 0.0);
      float amb = 0.18 + 0.12 * n.z;
      hc = wood * (diff * 0.95 + amb);
      vec3 r = reflect(-V, n);
      float f = fresnel(max(n.z, 0.0), 0.05);
      hc += env(r, l) * f * 0.55;
      hc += pow(max(dot(n, normalize(l + V)), 0.0), 120.0) * 0.8;
    }
    hc *= mix(0.55, 1.0, smoothstep(0.0, 14.0, along));
    col = mix(col, hc, 1.0 - smoothstep(-aa, aa, hd));
  }

  // ---- Bezel: half-round brushed steel ----
  if (dist < ro + aa && dist > uR - aa) {
    float rt = clamp((dist - uR) / bw, 0.0, 1.0);
    vec2 rd = d / max(dist, 1e-3);
    float prof = rt * 2.0 - 1.0;
    float nz = sqrt(max(0.0, 1.0 - prof * prof));
    vec3 n = normalize(vec3(rd * prof, nz * 0.85 + 0.15));
    vec3 P = vec3(p, Z_GLASS + nz * bw * 0.5);
    vec3 l = toLamp(P);
    float ang = atan(d.y, d.x);
    float brush = 0.5 + 0.5 * sin(ang * 70.0 + sin(ang * 11.0) * 3.0);
    vec3 T = vec3(-rd.y, rd.x, 0.0);
    vec3 steel = brushedMetal(n, T, l, vec3(0.74, 0.75, 0.78), brush);
    steel *= 0.6 + 0.4 * smoothstep(0.0, 0.14, rt) * smoothstep(1.0, 0.86, rt);
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
    float bulge = uRefr * 0.26 * pow(1.0 - h, 1.5);
    float sc2 = (1.0 / uM) * (1.0 - bulge);
    float ca = uRefr * 0.012 * pow(1.0 - h, 1.3);
    vec3 g;
    g.r = lensView(uL + d * sc2 * (1.0 + ca)).r;
    g.g = lensView(uL + d * sc2).g;
    g.b = lensView(uL + d * sc2 * (1.0 - ca)).b;
    g *= mix(vec3(1.0), vec3(0.88, 0.96, 0.95), pow(1.0 - h, 1.6));

    vec3 n = normalize(vec3(d / uR * 0.55, h + 0.25));
    vec3 P = vec3(p, Z_GLASS + h * 10.0);
    vec3 l = toLamp(P);
    vec3 rr = reflect(-V, n);
    float f = fresnel(max(n.z, 0.0), 0.04);
    g = mix(g, env(rr, l), clamp(f, 0.0, 1.0) * 0.65);

    vec2 ld = normalize(uLamp.xy - uL);
    float away = 0.5 + 0.5 * dot(normalize(d + 1e-4), -ld);
    g *= 1.0 - 0.22 * smoothstep(0.8, 1.0, r) * away;
    g += 0.16 * smoothstep(0.92, 1.0, r) * (1.0 - away);

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

const UNIFORMS = [
  "uScene", "uTr", "uRes", "uDpr", "uSceneSize", "uTrOrigin", "uTrSize",
  "uL", "uLamp", "uR", "uM", "uRefr", "uTime", "uBusy",
]

type Slot = "scene" | "tr"

export class GlassRenderer {
  private gl: GLWithElements
  private prog: WebGLProgram
  private tex: Record<Slot, WebGLTexture>
  private texSize: Record<Slot, [number, number]> = { scene: [0, 0], tr: [0, 0] }
  /** CSS size of each element when its texture was captured, so sampling matches the texture. */
  private cssSize: Record<Slot, [number, number]> = { scene: [1, 1], tr: [1, 1] }
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

    for (const name of UNIFORMS) this.u[name] = gl.getUniformLocation(prog, name)
    this.tex = { scene: this.makeTexture(), tr: this.makeTexture() }
    gl.uniform1i(this.u.uScene, 0)
    gl.uniform1i(this.u.uTr, 1)
  }

  private unit(slot: Slot) {
    return slot === "scene" ? this.gl.TEXTURE0 : this.gl.TEXTURE1
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

  /**
   * Snapshot a drawable element into its texture. Returns false if the
   * snapshot isn't ready, in which case the previous texture is kept so we
   * never draw a blank (black) frame. On a size change the copy goes into a
   * fresh texture that only replaces the old one once it succeeds.
   */
  upload(slot: Slot, el: HTMLElement): boolean {
    const gl = this.gl
    const size = this.canvas.getElementImageDefaultSize?.(el) ?? {
      width: el.offsetWidth * devicePixelRatio,
      height: el.offsetHeight * devicePixelRatio,
    }
    // Fractional at non-integer display scales (e.g. 249.75 at 125%):
    // rounding down makes the copy fail with INVALID_VALUE, so round up.
    const w = Math.max(1, Math.ceil(size.width))
    const h = Math.max(1, Math.ceil(size.height))
    gl.activeTexture(this.unit(slot))
    const [cw, ch] = this.texSize[slot]
    const resize = cw !== w || ch !== h
    const target = resize ? this.makeTexture() : this.tex[slot]
    gl.bindTexture(gl.TEXTURE_2D, target)
    if (resize) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    while (gl.getError() !== gl.NO_ERROR) {
      /* clear stale errors so the check below is about this copy */
    }
    let ok = true
    try {
      gl.texElementSubImage2D!(gl.TEXTURE_2D, 0, 0, 0, el)
      if (gl.getError() !== gl.NO_ERROR) ok = false
    } catch {
      ok = false
    }
    if (resize) {
      if (ok) {
        gl.deleteTexture(this.tex[slot])
        this.tex[slot] = target
        this.texSize[slot] = [w, h]
      } else {
        gl.deleteTexture(target)
      }
    }
    if (ok) this.cssSize[slot] = [el.offsetWidth, el.offsetHeight]
    gl.bindTexture(gl.TEXTURE_2D, this.tex[slot])
    return ok
  }

  /** True once both elements have been captured at least once. */
  get ready() {
    return this.texSize.scene[0] > 0 && this.texSize.tr[0] > 0
  }

  draw(s: GlassState) {
    const gl = this.gl
    const c = this.canvas
    gl.viewport(0, 0, c.width, c.height)
    gl.useProgram(this.prog)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.tex.scene)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.tex.tr)
    gl.uniform2f(this.u.uRes, c.width, c.height)
    gl.uniform1f(this.u.uDpr, c.width / c.clientWidth || devicePixelRatio)
    gl.uniform2f(this.u.uSceneSize, this.cssSize.scene[0], this.cssSize.scene[1])
    gl.uniform2f(this.u.uTrSize, this.cssSize.tr[0], this.cssSize.tr[1])
    gl.uniform2f(this.u.uTrOrigin, s.trOrigin.x, s.trOrigin.y)
    gl.uniform2f(this.u.uL, s.lens.x, s.lens.y)
    gl.uniform3f(this.u.uLamp, s.lamp.x, s.lamp.y, s.lamp.z)
    gl.uniform1f(this.u.uR, s.radius)
    gl.uniform1f(this.u.uM, s.magnify)
    gl.uniform1f(this.u.uRefr, s.refraction ? 1 : 0)
    gl.uniform1f(this.u.uTime, performance.now() / 1000)
    gl.uniform1f(this.u.uBusy, s.busy ? 1 : 0)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  dispose() {
    const gl = this.gl
    gl.deleteTexture(this.tex.scene)
    gl.deleteTexture(this.tex.tr)
    gl.deleteProgram(this.prog)
  }
}

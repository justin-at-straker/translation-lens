import type { IncomingMessage } from "node:http"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv, type Plugin } from "vite"

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(c as Buffer)
  return Buffer.concat(chunks)
}

// Dev only: serve the Vercel Functions in /api from the Vite dev server, so
// `pnpm dev` works without `vercel dev`. Each request loads api/<name>.ts and
// calls its exported POST(Request) handler, exactly as Vercel does.
// Auth for AI Gateway comes from .env.local (`vercel env pull` writes a
// short-lived VERCEL_OIDC_TOKEN there).
function devApi(): Plugin {
  return {
    name: "lens-dev-api",
    config(_, { command, mode }) {
      if (command === "serve") Object.assign(process.env, loadEnv(mode, process.cwd(), ""))
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const match = req.url?.match(/^\/api\/([a-z-]+)(?:\?|$)/)
        if (!match) return next()
        try {
          const mod = (await server.ssrLoadModule(`/api/${match[1]}.ts`)) as Record<string, unknown>
          const handler = mod[req.method ?? "GET"] as ((r: Request) => Promise<Response>) | undefined
          if (!handler) {
            res.statusCode = 405
            return res.end()
          }
          const headers = new Headers()
          for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v)
          const body = req.method === "GET" || req.method === "HEAD" ? undefined : new Uint8Array(await readBody(req))
          const response = await handler(new Request(`http://localhost${req.url}`, { method: req.method, headers, body }))
          res.statusCode = response.status
          response.headers.forEach((v, k) => res.setHeader(k, v))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (e) {
          server.ssrFixStacktrace(e as Error)
          console.error(e)
          res.statusCode = 500
          res.end(JSON.stringify({ error: "Dev API error" }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), devApi()],
})

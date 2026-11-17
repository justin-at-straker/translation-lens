import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv, type Plugin } from "vite"

// Dev-only BYOK convenience: `pnpm dev` seeds the OpenAI key from
// .env.local (OPENAI_API_KEY, no VITE_ prefix so Vite never exposes it on
// its own). Builds always define it as "", so a key can't reach a bundle.
function devOpenAiKey(): Plugin {
  return {
    name: "lens-dev-openai-key",
    config(_, { command, mode }) {
      const key = command === "serve" ? loadEnv(mode, process.cwd(), "").OPENAI_API_KEY : ""
      return { define: { __DEV_OPENAI_KEY__: JSON.stringify(key ?? "") } }
    },
  }
}

export default defineConfig({
  plugins: [react(), devOpenAiKey()],
})

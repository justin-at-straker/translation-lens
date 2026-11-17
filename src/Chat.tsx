// Talk to the lens. Inside data-agent-hidden so the agent can't type into its
// own prompt.
import type { ModelMessage } from "ai"
import { useState } from "react"
import { runAgent } from "./ai/agent"

type Line = { role: "user" | "assistant" | "error"; text: string }

export function Chat() {
  const [history, setHistory] = useState<ModelMessage[]>([])
  const [lines, setLines] = useState<Line[]>([])
  const [prompt, setPrompt] = useState("")
  const [busy, setBusy] = useState(false)

  const send = async () => {
    const text = prompt.trim().slice(0, 500)
    if (!text || busy) return
    setPrompt("")
    setBusy(true)
    setLines((l) => [...l, { role: "user", text }])
    const next: ModelMessage[] = [...history, { role: "user", content: text }]
    try {
      const res = await runAgent(next)
      // Keep the conversation short: the server caps how much it accepts.
      setHistory([...next, ...res.messages].slice(-40))
      setLines((l) => [...l, { role: "assistant", text: res.text || "Done." }])
    } catch (e) {
      setLines((l) => [...l, { role: "error", text: (e as Error).message }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="chat" data-agent-hidden aria-label="Ask the lens">
      <div className="chat-log" aria-live="polite">
        {lines.length === 0 && (
          <p className="chat-hint">Try: “Switch to Japanese, casual tone, and make the lens bigger”</p>
        )}
        {lines.map((l, i) => (
          <p key={i} className={`chat-line ${l.role}`}>
            {l.text}
          </p>
        ))}
        {busy && <p className="chat-line busy">Working…</p>}
      </div>
      <form
        className="chat-form"
        onSubmit={(e) => {
          e.preventDefault()
          void send()
        }}
      >
        <input
          className="chat-input"
          aria-label="Ask the lens"
          value={prompt}
          maxLength={500}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask the lens…"
          disabled={busy}
        />
      </form>
    </section>
  )
}

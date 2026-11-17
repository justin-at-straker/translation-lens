// The chat agent. The model runs on the server (/api/agent, Gemini through
// Vercel AI Gateway); its tools are the ui-sdk bridge (snapshot / act / query
// over every control on the page), which can only run here in the browser.
// So: ask the server for one step, run any tool calls against the live UI,
// send the results back, repeat until the model answers in text.
import { createAgent } from "@ui-sdk/react/agent"
import type { ModelMessage } from "ai"

// Created at import time, before React renders, so it hears every component.
export const uiAgent = createAgent()

type ToolCall = { toolCallId: string; toolName: string; input: unknown }
type Step = { messages: ModelMessage[]; toolCalls: ToolCall[]; text: string; error?: string }

const MAX_STEPS = 8

async function runTool(call: ToolCall): Promise<unknown> {
  const method = uiAgent[call.toolName as "snapshot" | "act" | "query"] as ((i: unknown) => unknown) | undefined
  if (!method) return { error: `Unknown tool ${call.toolName}` }
  try {
    return await method.call(uiAgent, call.input)
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function runAgent(history: ModelMessage[]) {
  const messages = [...history]
  for (let i = 0; i < MAX_STEPS; i++) {
    const res = await fetch("/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages }),
    })
    const step = (await res.json().catch(() => ({}))) as Partial<Step>
    if (!res.ok || !step.messages) throw new Error(step.error ?? `The assistant failed (${res.status})`)
    messages.push(...step.messages)
    if (!step.toolCalls?.length) return { text: step.text ?? "", messages: messages.slice(history.length) }
    for (const call of step.toolCalls) {
      const value = await runTool(call)
      messages.push({
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: call.toolCallId,
            toolName: call.toolName,
            output: { type: "json", value: JSON.parse(JSON.stringify(value ?? null)) },
          },
        ],
      })
    }
  }
  return { text: "I ran out of steps; check the settings panel.", messages: messages.slice(history.length) }
}

// Dev-only handle for poking the bridge from the console or a test script.
if (import.meta.env.DEV) (window as unknown as { uiAgent: typeof uiAgent }).uiAgent = uiAgent

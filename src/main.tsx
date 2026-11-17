// The agent bridge must exist before React renders so it registers every control.
import "./ai/agent"
import { createRoot } from "react-dom/client"
import { App } from "./App"
import "@ui-sdk/core/web.css"
import "./styles.css"

createRoot(document.getElementById("root")!).render(<App />)

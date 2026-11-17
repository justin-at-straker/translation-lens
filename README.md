# Translation Lens

A magnifying glass you move over a web page. Under the glass, the page is translated.

It's an experiment with three newer browser APIs:

- **HTML-in-Canvas.** The whole app (the page, the settings panel, the chat) is real DOM drawn into one WebGL canvas with `texElementSubImage2D`. The DOM is still live, so clicks, focus, scrolling and screen readers keep working. The translated page is a second drawable layer, and only the part under the lens takes clicks.
- **A WebGL glass shader.** One point light lights the scene. The lens is a domed glass that refracts with edge dispersion, Fresnel reflection and room reflections. It has a brushed-steel bezel and a varnished walnut handle, and the shadows are cast from the lamp. The page and panel are cards on a desk.
- **[UI SDK](https://ui-sdk.dev) agent bridge.** Every setting is a UI SDK control, and the chat agent reads and changes them through `snapshot`/`act`, just as a person would. Controls the agent changes light up briefly.

Translation and the agent use OpenAI (`gpt-6-luna`), called straight from the browser with **your own API key**. The key is stored in your browser's local storage and only ever sent to OpenAI. The page re-translates in one call whenever you change the language, tone or do-not-translate list, and results are cached.

## Browser support

- **WebGL glass scene:** needs `texElementSubImage2D`. It's available in Edge 157 and Chrome with HTML-in-Canvas; see the [explainer](https://github.com/WICG/html-in-canvas).
- **2D canvas lens:** used when only `drawElementImage` is available.
- **CSS fallback:** a `clip-path` lens that works everywhere.

The link under the panel switches between whichever renderers your browser supports.

## Develop

```sh
pnpm install
echo "OPENAI_API_KEY=sk-..." > .env.local   # optional: the dev server seeds the key field with it
pnpm dev
```

`.env.local` is only read by the dev server. Production builds never include a key; visitors paste their own.

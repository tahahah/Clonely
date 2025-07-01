# Clonely – Developer Handoff Summary

> Last updated: 2025-06-30

This document gives any new engineer (agent or human) a concise but complete picture of the current Clonely codebase, recent feature additions, and key concepts you’ll need before picking up the next tasks.

---

## 1. Project Purpose
Clonely is an Electron-based desktop assistant that:

* Captures the user’s **screen** (periodic screenshots)
* Listens to **microphone / system loopback audio** (optional live mode)
* Streams the context to **Google Gemini** (REST & Live APIs)
* Presents answers in a minimalist chat/voice UI that can be hidden from screen-capture tools

---

## 2. High-Level Architecture
```
┌───────────────┐                 IPC                 ┌─────────────────┐
│  Renderer UI  │  <––– preload (contextBridge) –––>  │ Main Process    │
│  (Vite + React│                                   │  (Node + TS)    │
└───────────────┘                                     │                │
        ▲                                             │  Electron APIs │
        │                                             └─────────────────┘
        │HTTP/WebSocket                                         ▲
        │                                                      │
┌──────────────────────────────────────────────────────────────┴────┐
│ Google Generative AI (Gemini) – REST & Live Audio endpoints       │
└───────────────────────────────────────────────────────────────────┘
```

* **Renderer** (`app/`) – React components, shadcn/ui, manages chat, voice UI, buttons.
* **Preload** (`lib/preload/`) – thin `api` wrapper exposing `send`, `receive`, `invoke`.
* **Main** (`lib/main/`) – Electron windows, IPC routing, state machine, audio helpers.
* **LLM** (`lib/llm/`) – `GeminiHelper` (REST chat) and `GeminiLiveHelper` (live stream).
* **State** (`lib/state/`) – lightweight finite state machine driving UI transitions.

---

## 3. Key Modules
| Path | Responsibility |
|------|----------------|
| `lib/main/app.ts` | Creates **main** & **chat** `BrowserWindow`s. Applies capture-protection or not based on `isInvisible` flag. |
| `lib/main/main.ts` | App entry: window lifecycle, IPC wiring, shortcut helper, Gemini helpers. |
| `lib/main/shortcuts.ts` | Registers **global shortcuts**. After latest change only `Ctrl+Space` is always global; `Ctrl+Enter` & `Esc` register **only when windows are visible**. |
| `lib/state/AppStateMachine.ts` | 4-state machine (Idle → ReadyChat → Loading → Error). Emits `stateChange` events for renderer sync. |
| `lib/llm/GeminiHelper.ts` | Traditional REST chat with screenshot + optional audio. Resets chat history on Idle. |
| `lib/llm/GeminiLiveHelper.ts` | Handles Gemini **live audio** session: start, stream, finish turn, text routing. |

---

## 4. Recent Feature Highlights
1. **Invisibility Mode**
   * Toggle via UI eye icon or `window.api.send('toggle-invisibility')` (main process recreates windows with/without capture-protection).
   * Global shortcut **Ctrl + Space** hides/shows all windows; this shortcut is *always* active.
2. **Gemini Live Integration (Voice Mode)**
   * Mic button starts/stops live session (`live-audio-start`, `live-audio-chunk`, `live-audio-done`).
   * Live mode pipes audio + screenshots; if user types while live session is open, text is routed to live session instead of REST call.
3. **Global Shortcut Rework**
   * `Ctrl + Enter` – Opens chat or submits message **only while windows visible**.
   * `Esc` – Cancels/ closes chat **only while windows visible**.
   * Both are unregistered when windows hidden so other apps regain normal behaviour.
4. **Quit Button** – Single X icon in the main bar triggers `window.api.send('quit-app')` handled in main process.
5. **README Enhancements** – Features, keyboard shortcuts table, Chat vs Voice comparison, build steps.

---

## 5. Build & Run
```
# Dev (hot-reload):
npm run dev

# Production builds:
npm run build:win   # Windows exe (electron-builder)
# … build:mac, build:linux, build:unpack
```
Icons must reside in `resources/build/icon.ico|icns` per `electron-builder.yml`.

---

## 6. Environment Variables
| Variable | Purpose | Where to set |
|----------|---------|--------------|
| `VITE_GEMINI_API_KEY` | Gemini REST & Live API key (forwarded into renderer via Vite) | `.env` during dev, or system env. |
| `GEMINI_API_KEY` | Same key, read in main/Node context | Runtime environment or `.env` |

---

## 7. State Machine Cheat-Sheet
```
Idle  ← ESC / finish ─  ReadyChat  ─ SUBMIT →  Loading  ─ API_SUCCESS → ReadyChat
 ^                 \                               \─ API_ERROR →  Error
 |                  \                                                   |
 +-------------------+---- OPEN_CHAT / Ctrl+Enter ----------------------+
```
* Voice mode piggybacks on **Loading**; live sessions send `API_SUCCESS` immediately after routing.

---

## 8. Testing Tips
* Run `npm run dev` and use the X quit button to test `quit-app` IPC.
* Toggle invisibility and verify capture-protection via OBS or Teams.
* Validate shortcut behaviour while other apps are focused – only Ctrl+Space should trigger.

---

## 9. Where To Start Next
* New features should hook into the main process via IPC and update the state machine where appropriate.
* For adding a **transcriber** (next task) you’ll likely integrate audio streaming transcription alongside `GeminiLiveHelper` or as a separate helper.

Happy hacking!

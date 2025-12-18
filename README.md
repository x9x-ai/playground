# Love ASCII Show

A Tailwind-inspired, offline-first Love ASCII Show. Build-time assets live in `src/`, and the final portable deliverable is a single HTML file at `dist/love.html` that runs over `file://` with no external dependencies.

## Recommended project structure
- `src/` — editable HTML shell, CSS, and JS (non-inlined) for development.
- `scripts/build.js` — inlines CSS + JS into a single page.
- `dist/love.html` — final, portable artifact (open directly).
- `assets/` — optional local ASCII/audio you can reference during dev (listed in `manifest.json`).
- `config.json` — sample dev config with seconds/playlist hints.

## Build steps (outputs only `dist/love.html`)
1. `node scripts/build.js`
2. Open `dist/love.html` directly (double-click) or host via any static server.

## Dev workflow
- Edit `src/styles.css` or `src/app.js`, then re-run `node scripts/build.js`.
- For testing URL-based loads locally, start a static server (e.g., `python -m http.server 8000`) and visit `http://localhost:8000/dist/love.html`.
- Use `assets/ascii` and `manifest.json` as quick local sources when served over HTTP.

## How to use (runtime)
1. Open `dist/love.html` (works via `file://`).
2. Click **Start** (unblocks audio) to run animation + music.
3. Optional inputs:
   - Drag/drop or pick ASCII `.txt` files to replace art (file picker works offline).
   - Drag/drop or pick audio (`.mp3/.wav/.m4a/.ogg`) to replace the synth.
   - Query params (URL examples):
     - `dist/love.html?ascii=I%20love%20you`
     - `dist/love.html?asciiSrc=https://example.com/heart.txt`
     - `dist/love.html?asciiList=https://a.txt,https://b.txt`
     - `dist/love.html?music=https://example.com/song.mp3`
     - `dist/love.html?playlist=https://a.mp3,https://b.mp3`
     - `dist/love.html?playlistUrl=https://example.com/list.json&seconds=120`

## Features
- Embedded love-themed ASCII library with multi-frame support (`-----FRAME-----`).
- Auto-rotate toggle, manual “Next art,” wave/bob/sparkle micro-animations, and dual wipe transitions.
- Countdown overlay (`seconds`, default 60).
- Offline WebAudio synth pad by default; URL/file playlists with next/prev + loop.
- Status chips for ASCII/Music sources; keyboard shortcuts (Space, N, M).
- Friendly error panel for CORS/autoplay guidance; drag-and-drop + pickers.

## Limitations & notes
- `file://` cannot fetch arbitrary local paths; use the pickers/drag-drop or serve via HTTP for URL fetches.
- Remote URLs may be blocked by CORS. Errors surface in the panel; synth/embedded ASCII continue to work.
- Audio playback depends on a user gesture (Start button) per browser autoplay policies.

## Preview
```
+----------------------------------------------------------+
| Love ASCII Show   [Start][Stop][Next][Auto-rotate  ✓ ]   |
| ASCII source: Embedded   Music source: Synth   60s left  |
|                                                          |
|  (large <pre> with animated hearts, wipes, wave, sparkle)|
|                                                          |
+----------------------------------------------------------+
| Playback: Playing   [Mute][volume slider]  chips: Synth  |
| ASCII: Embedded defaults          Music: Synth pad       |
| [Pick ASCII] [Pick music] [Prev][Next][Loop ✓]           |
+----------------------------------------------------------+
| Errors panel + tips (CORS/file:// guidance)              |
+----------------------------------------------------------+
```

Sample animated frames (embedded):
```
  ***     ***
 *****   *****
******* *******
****************
 "I LOVE YOU"
****************
 ******* *******
 *****   *****
   ***     ***
-----FRAME-----
.-''''-.   .-''''-.
/  .-.  \/  .-.  \
| |  | |  | |  | |
\ \_/ /  \ \_/ /
 '.   ;    '.   ;
   ) (        ) (
 .'   '.    .'   '.
/ love  \  / you   \
'-------'  '-------'
```

Example status lines:
- ASCII source: Inline (`ascii=`) — Auto-rotate off (toggle to re-enable)
- ASCII source: URL (`asciiList=`) — rotating playlist
- Music source: URL (`playlist=`) or Synth (default)

Example query scenarios:
- `dist/love.html?ascii=LOVE%20FOREVER` — Inline override, no rotation unless toggled
- `dist/love.html?asciiSrc=https://example.com/heart.txt&music=https://example.com/song.mp3`
- `dist/love.html?asciiList=https://a.txt,https://b.txt&playlistUrl=https://example.com/love.json&seconds=180`

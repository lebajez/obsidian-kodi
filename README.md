# AGENTS.md

This is a scratch/tutorial workspace: keep experiments in subdirectories (e.g. `kodi/`, `calibre-bridge/`, `kodi-bridge/`), do not pollute root. Repo root has no build/test/lint/CI config; `kodi-bridge/` has its own (see below). Do not invent root-level commands.

## Build (kodi-bridge)

- Working dir: `kodi-bridge/`
- Install: `npm install`
- Typecheck+build: `npm run build` (runs `tsc -noEmit -skipLibCheck` then esbuild production -> `main.js`)
- Dev watch: `npm run dev`
- No tests configured.

## Repo contents

- `kodi/` — standalone Python JSON-RPC exporter (`obsidian_exporter.py`) that fetches Kodi library items and writes Obsidian markdown notes.
- `calibre-bridge/` — a shipped (compiled) Obsidian plugin snapshot, used as the structural template to adapt for Kodi access.
- `kodi-bridge/` — new TypeScript Obsidian plugin being adapted to Kodi. Source under `src/`, build output `main.js`. Verified to load in Obsidian (smoke-tested in `/home/rufus/owncloud/Projects/DevVault`).

## Kodi (verified)

- JSON-RPC endpoint: `http://192.168.1.19:8080/jsonrpc`, Basic auth `kodi:telefonMann`.
- Movies: `VideoLibrary.GetMovies` with properties `MOVIE_PROPS` works.
- Music/TV methods (`MusicLibrary.GetSongs`/`GetAlbums`, `TVLibrary.GetSeries`) returned "Method not found" on this instance; treat as optional/unverified.
- Plugin adaptation should POST the same JSON-RPC envelope (`{"jsonrpc":"2.0","method":...,"params":...,"id":1}`), not use Calibre's GET `/ajax/*` REST.
- Image fields are `fanart`/`poster`/`thumbnail`/`cover`/`backdrop`; `image://` prefixes must be stripped + URL-decoded. Exporter embeds these URLs directly (does not download). Remote fanart.tv URLs work; local `image://` availability in Obsidian is unverified.

## `kodi/obsidian_exporter.py` gotchas

- Constants at top drive behavior: `KODI_URL`, `KODI_USER`, `KODI_PASS`, `OBSIDIAN_DIR` (must point at the Obsidian vault, not this repo), `SEARCH_QUERY`, `EXPORT_TYPE` (`movies|songs|albums|series`), `DRY_RUN` (default `True`).
- `OBSIDIAN_DIR` is hardcoded to `/home/rufus/owncloud/obsidian`.
- Outputs relative to `OBSIDIAN_DIR`: `Movies/`, `Music/`, `Music/Albums/`, `TV/`.
- `kodi()` raises `RuntimeError` on Kodi JSON-RPC `error`.
- Search: normalized-whitespace case-insensitive substring; if none, difflib fallback at threshold `0.6`, returns best single item.
- List-safe field handling required: `studio`, `genre`, `cast`, `artist` etc. may be arrays or strings.
- Sample generated notes: `kodi/Movies/dark_star_1974.md`, `kodi/Music/Albums/after_hours_2020.md`, `kodi/TV/the_twilight_zone_1959.md`.

## `calibre-bridge/` snapshot (compiled, no source)

- Files: `manifest.json` (id `calibre-bridge`, minAppVersion `1.6.0`), `data.json` sample settings, `main.js` bundle, `styles.css`.
- No `package.json`, `tsconfig`, build pipeline, tests, or CI. To adapt, scaffold a fresh TypeScript Obsidian plugin and port logic from `main.js` (it keeps `src/*.ts` path comments). Do not patch the minified bundle except for trivial changes.
- Plugin conventions worth reusing (all encoded in `main.js`):
  - Settings keys: `serverUrl`, `libraryId`, `username`, `password`, `bookFolder`, `coverFolder`, `downloadCovers`, `filenameFormat` (`title` or `author-title`).
  - Commands: "Import books from Calibre", "Create library overview", "Sync all imported books".
  - Note identity via `calibre_uuid` + `calibre_id` frontmatter; `buildUuidMap` maps existing notes.
  - Managed section markers `<!-- calibre:begin -->` / `<!-- calibre:end -->`; content outside is preserved on reimport; frontmatter updated via `processFrontMatter`.
  - Covers saved as `{coverFolder}/{uuid}.jpg` and embedded as `![[...]]`.
  - Library overview is an Obsidian Bases file at `{bookFolder}/Library.base`.
  - Auth header is Basic when username+password set.
- Calibre data shapes are REST (`/ajax/library-info`, `/ajax/search`, `/ajax/books`, `/get/cover/{id}`); all of these need replacement for Kodi.

## Adaptation direction

Replace the Calibre REST client with a Kodi JSON-RPC client; replace REST metadata mappings with Kodi fields (title/originaltitle/year/plot/tagline/userrating/imdbnumber/studio/uniqueid/genre/fanart, plus music/TV fields); keep the import modal, managed-section writer, UUID-based sync, optional cover handling, and settings pattern. Decide image policy: remote embed vs local download; `image://` handling is unresolved. Keep movie import as the first verified slice; music/TV are experimental.
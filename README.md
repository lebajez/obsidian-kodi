Inspired by https://github.com/caioniehues/obsidian-calibre-bridge/tree/main which interface I appreciated.
This is my first opencode project and also my first productive repo.

# AGENTS.md

TypeScript Obsidian plugin project (source under `src/`, dev/test runtime in Obsidian DevVault). There is no root build/test/lint config; all commands run from `src/`.

## Build (from `src/`)

```sh
npm install
chmod +x node_modules/@esbuild/linux-x64/bin/esbuild
node node_modules/typescript/bin/tsc -noEmit -skipLibCheck
node esbuild.config.mjs production
```

- Dev watch: `node esbuild.config.mjs`
- Lint: `npm run lint`
- No tests are configured.
- Gotcha: npm's `.bin/tsc`/`esbuild` may lack execute bits in this environment; use the `node .../bin` invocations above.
- Build artifact is `src/main.js`, deployed by copying `main.js`, `manifest.json`, and `styles.css` into `<Vault>/.obsidian/plugins/kodi-bridge/`, then reloading Obsidian.

## Repository layout

- `src/` - Obsidian plugin source, package, build config, artifact.
- `src/src/*.ts` - TypeScript source modules.
- `src/src/typePickerModal.ts` - unified media-type chooser used by `kodi-import`.
- `calibre-bridge/` and `kodi-bridge/` - compiled plugin snapshots / installed test artifacts, not source.
- `scripts/obsidian_exporter.py` - standalone Python JSON-RPC exporter; vault path and media type are constants.
- `AGENTS.md` only: do not put experiments in the repository root.

## Verified Kodi JSON-RPC behavior

Endpoint: `http://192.168.1.19:8080/jsonrpc`, Basic auth `kodi:telefonMann`. Always POST `{ "jsonrpc": "2.0", "method": ..., "params": ..., "id": 1 }`.

Valid methods/property fields for this instance:
- `JSONRPC.Ping` -> `"pong"`
- `VideoLibrary.GetMovies` properties: use `title`, `originaltitle`, `year`, `plot`, `tagline`, `userrating`, `imdbnumber`, `studio`, `uniqueid`, `genre`, `fanart`, `thumbnail`, `runtime`, `director`, `cast`, `art`, `file`.
  - Do **not** use `poster` or `path`; `poster` is under `art`, and the actual path field is `file`.
  - Both invalid fields cause `-32602 Invalid params`.
- `AudioLibrary.GetAlbums` properties: `title`, `artist`, `year`, `genre`, `thumbnail`, `fanart`, `art`.
- `AudioLibrary.GetSongs` properties: `title`, `album`, `artist`, `year`, `track`, `duration`, `userrating`, `playcount`, `lastplayed`, `genre`.
- `VideoLibrary.GetTVShows` properties: `title`, `originaltitle`, `year`, `plot`, `genre`, `studio`, `fanart`, `thumbnail`, `art`.
  - Use `plot`, not `overview`; `poster` is under `art`.
- Do not use `MusicLibrary.*` or `TVLibrary.*`; this instance does not implement them.

Image handling: top-level `fanart`/`thumbnail`, and `image://...` values under `art` must be stripped of `image://` and URL-decoded. The plugin's `cleanUrl` already handles this.

## Plugin commands

- `kodi-import` -> type picker, then `runImport(type)`: `movie`, `series`, `album`, `song`.
- `kodi-import-movies`, `kodi-import-songs`, `kodi-import-albums`, `kodi-import-series`
- `kodi-sync` -> refreshes notes identified by `kodi_type:kodi_id` frontmatter.
- `kodi-overview` -> creates `Library.base` in the movie folder.

## Plugin data flow

1. Create `KodiApi(this.settings)`.
2. `fetchByType` selects the method.
3. `mediaId` maps `movieid`, `songid`, `albumid`, `tvshowid`.
4. The import modal searches `title`/`subtitle`.
5. Notes use managed markers `<!-- kodi:begin -->` / `<!-- kodi:end -->`; frontmatter is written with `kodi_id` and `kodi_type` for sync.
6. Covers are downloaded only when `downloadCovers` is on and the poster URL is HTTP.

## Operational notes

- No automated tests; test by building, copying artifacts into `<Vault>/.obsidian/plugins/kodi-bridge/`, running `(vault) reload`, and enabling in **Settings -> Community plugins**.
- The sample test vault is `/home/rufus/owncloud/Projects/DevVault`; its data.json already contains the verified Kodilibrary credentials and folders.
- Do not commit generated `main.js` or `node_modules`; build them on deployment.
- Zero-byte `.ts?` artifacts should not be reintroduced.

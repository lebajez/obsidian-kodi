import { App, Plugin, Notice, TFile, normalizePath, requestUrl } from "obsidian";
import { KodiSettings, DEFAULT_SETTINGS, SelectedItem } from "./types";
import { KodiApi } from "./api";
import { KodiSettingTab } from "./settings";
import { KodiImportModal } from "./importModal";
import { KodiTypePickerModal } from "./typePickerModal";
import { frontmatterFor, bodyFor, subtitleFor } from "./mapper";
import {
  ensureFolder, saveCover, createKodiNote, updateKodiNote, buildKodiMap, serializeFrontmatter,
} from "./noteWriter";
import { extractImage, isHttpUrl, mediaId, kodiTypeFolder } from "./utils";

interface ItemWithType { type: string; item: any; }

export default class KodiBridgePlugin extends Plugin {
  settings!: KodiSettings;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.registerPropertyTypes();
    this.addSettingTab(new KodiSettingTab(this.app, this));

    this.addCommand({ id: "kodi-import", name: "Import media from Kodi (choose type)", callback: () => new KodiTypePickerModal(this.app, (type: string) => void this.runImport(type)).open() });
    this.addCommand({ id: "kodi-import-movies", name: "Import movies from Kodi", callback: () => void this.runImport("movie") });
    this.addCommand({ id: "kodi-import-songs", name: "Import songs from Kodi", callback: () => void this.runImport("song") });
    this.addCommand({ id: "kodi-import-albums", name: "Import albums from Kodi", callback: () => void this.runImport("album") });
    this.addCommand({ id: "kodi-import-series", name: "Import TV series from Kodi", callback: () => void this.runImport("series") });
    this.addCommand({ id: "kodi-sync", name: "Sync all imported Kodi notes", callback: () => void this.runSync() });
    this.addCommand({ id: "kodi-overview", name: "Create Kodi library overview (movies)", callback: () => void this.createOverview() });
  }

  registerPropertyTypes(): void {
    const mgr = (this.app as any).metadataTypeManager;
    if (!mgr) return;
    const register = (prop: string, type: string) => {
      if (!mgr.getPropertyInfo?.(prop)?.type) mgr.setType?.(prop, type);
    };
    for (const p of ["year", "playcount", "track", "duration", "runtime"]) register(p, "number");
    for (const p of ["rating"]) register(p, "number");
    for (const p of ["lastplayed"]) register(p, "date");
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private async fetchByType(type: string, api: KodiApi): Promise<any[]> {
    if (type === "movie") return api.getMovies();
    if (type === "song") return api.getSongs();
    if (type === "album") return api.getAlbums();
    return api.getSeries();
  }

  private typeKey(type: string): string {
    return type === "movie" ? "movie" : type === "song" ? "song" : type === "album" ? "album" : "series";
  }

  private toItems(type: string, items: any[]): SelectedItem[] {
    return items.map((it) => ({
      id: mediaId(it, type),
      title: it?.title ?? it?.originaltitle ?? "(no title)",
      subtitle: subtitleFor(it, type),
    })).sort((a, b) => a.title.localeCompare(b.title));
  }

  async runImport(type: string): Promise<void> {
    if (!this.settings.serverUrl) {
      new Notice("Kodi Bridge: Please enter a server URL in settings.");
      return;
    }
    const api = new KodiApi(this.settings);
    const notice = new Notice(`Kodi: Fetching ${type}s…`, 0);
    try {
      const items = await this.fetchByType(type, api);
      notice.hide();
      if (!items || items.length === 0) {
        new Notice(`Kodi: No ${type}s found.`);
        return;
      }
      const list = this.toItems(type, items);
      const allMap = new Map<number, any>();
      for (const it of items) allMap.set(mediaId(it, type), it);

      new KodiImportModal(this.app, list, (selectedIds) => {
        void this.importItems(type, api, allMap, selectedIds);
      }).open();
    } catch (e) {
      notice.hide();
    }
  }

  async importItems(type: string, api: KodiApi, allMap: Map<number, any>, selectedIds: number[]): Promise<void> {
    const folder = kodiTypeFolder(type, this.settings);
    const kodiMap = buildKodiMap(this.app);
    let created = 0, updated = 0, failed = 0;
    const progress = new Notice(`Kodi: Importing 0 / ${selectedIds.length}…`, 0);
    await ensureFolder(this.app, folder);
    await ensureFolder(this.app, this.settings.coverFolder);

    for (let i = 0; i < selectedIds.length; i++) {
      const id = selectedIds[i];
      progress.setMessage(`Kodi: Importing ${i + 1} / ${selectedIds.length}…`);
      try {
        const item = allMap.get(id);
        if (!item) { failed++; continue; }

        let hasCover = false;
        let coverName = `${type}-${id}.jpg`;
        const posterUrl = extractImage(item, imageKeysFor(type));
        let coverEmbed = "";
        if (posterUrl && isHttpUrl(posterUrl)) {
          coverEmbed = `![${item?.title ?? type}](${posterUrl})`;
        }
        if (this.settings.downloadCovers && posterUrl && isHttpUrl(posterUrl)) {
          const coverPath = normalizePath(`${this.settings.coverFolder}/${coverName}`);
          const exists = await this.app.vault.adapter.exists(coverPath);
          if (exists) {
            hasCover = true;
          } else {
            try {
              const res = await requestUrl({ url: posterUrl, method: "GET" });
              await saveCover(this.app, this.settings, coverName, res.arrayBuffer);
              hasCover = true;
            } catch {
              hasCover = false;
            }
          }
          if (hasCover) coverEmbed = `![[${this.settings.coverFolder}/${coverName}]]`;
        }

        const typeKey = this.typeKey(type);
        const fm = frontmatterFor(item, type, this.settings, hasCover);
        const managed = bodyFor(item, type);
        const existing = kodiMap.get(`${typeKey}:${id}`);

        if (existing) {
          await updateKodiNote(this.app, existing, fm, managed, coverEmbed, hasCover);
          updated++;
        } else {
          const fname = (this.settings.filenameFormat === "title-year" && item?.year)
            ? `${item?.title ?? "Untitled"} (${item.year})`
            : (item?.title ?? "Untitled");
          await createKodiNote(this.app, fname, fm, managed, coverEmbed, folder, this.settings.filenameFormat);
          created++;
        }
      } catch (e) {
        console.error(`Kodi Bridge: failed to import ${type} ${id}:`, e);
        failed++;
      }
    }
    progress.hide();
    const failMsg = failed > 0 ? `, ${failed} failed` : "";
    new Notice(`Kodi import done: ${created} created, ${updated} updated${failMsg}.`);
  }

  async runSync(): Promise<void> {
    if (!this.settings.serverUrl) {
      new Notice("Kodi Bridge: Please enter a server URL in settings.");
      return;
    }
    const kodiMap = buildKodiMap(this.app);
    if (kodiMap.size === 0) {
      new Notice("Kodi Bridge: No imported notes found in vault.");
      return;
    }
    // group types
    const byType = new Map<string, number[]>();
    for (const key of kodiMap.keys()) {
      const [type, idStr] = key.split(":");
      const id = Number(idStr);
      if (!byType.has(type)) byType.set(type, []);
      byType.get(type)!.push(id);
    }
    const api = new KodiApi(this.settings);
    for (const [type, ids] of byType) {
      const progress = new Notice(`Kodi: Syncing ${type}s…`, 0);
      try {
        const items = await this.fetchByType(type, api);
        const map = new Map<number, any>();
        for (const it of items) map.set(mediaId(it, type), it);
        for (const id of ids) {
          const item = map.get(id);
          const file = kodiMap.get(`${type}:${id}`);
          if (!item || !file) continue;
          let hasCover = false;
          let coverEmbed = "";
          const posterUrl = extractImage(item, imageKeysFor(type));
          if (posterUrl && isHttpUrl(posterUrl)) coverEmbed = `![${item?.title ?? type}](${posterUrl})`;
          const coverName = `${type}-${id}.jpg`;
          const coverPath = normalizePath(`${this.settings.coverFolder}/${coverName}`);
          if (this.settings.downloadCovers && posterUrl && isHttpUrl(posterUrl)) {
            const exists = await this.app.vault.adapter.exists(coverPath);
            if (exists || await this.tryDownloadCover(posterUrl, coverPath)) {
              hasCover = true;
              coverEmbed = `![[${this.settings.coverFolder}/${coverName}]]`;
            }
          }
          const fm = frontmatterFor(item, type, this.settings, hasCover);
          await updateKodiNote(this.app, file as TFile, fm, bodyFor(item, type), coverEmbed, hasCover);
        }
        progress.hide();
      } catch (e) {
        progress.hide();
      }
    }
    new Notice("Kodi sync done.");
  }

  private async tryDownloadCover(url: string, path: string): Promise<boolean> {
    try {
      const res = await requestUrl({ url, method: "GET" });
      await this.app.vault.adapter.writeBinary(path, res.arrayBuffer);
      return true;
    } catch {
      return false;
    }
  }

  async createOverview(): Promise<void> {
    const folder = this.settings.movieFolder;
    const path = normalizePath(`${folder}/Library.base`);
    const content = `views:
  - type: table
    name: All Movies
    filters:
      and:
        - file.folder == "${folder}"
    order:
      - cover
      - title
      - year
      - rating
      - genre
`;
    try {
      await ensureFolder(this.app, folder);
      const existing = this.app.vault.getAbstractFileByPath(path);
      if (existing) await this.app.vault.modify(existing as TFile, content);
      else await this.app.vault.create(path, content);
      new Notice(`Kodi Bridge: overview created at ${path}`);
    } catch (e) {
      new Notice(`Kodi Bridge: could not create overview — ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

function imageKeysFor(type: string): string[] {
  if (type === "movie") return ["fanart", "poster", "thumbnail", "cover", "backdrop"];
  if (type === "album") return ["thumbnail", "cover", "fanart", "poster"];
  if (type === "series") return ["fanart", "poster", "thumbnail"];
  return ["thumbnail", "cover", "fanart", "poster"];
}

import { App, TFile, Notice, normalizePath } from "obsidian";
import { KodiSettings } from "./types";
import { sanitizeFilename } from "./utils";

const BEGIN_MARKER = "<!-- kodi:begin -->";
const END_MARKER = "<!-- kodi:end -->";

export function resolveNewFilePath(app: App, title: string, settings: KodiSettings, folder: string, filenameFormat: string): string {
  const safe = sanitizeFilename(title);
  const tryPath = (name: string) => normalizePath(`${folder}/${name}.md`);
  if (filenameFormat === "title-year") {
    // year appended by caller if desired; keep simple
  }
  if (!app.vault.getAbstractFileByPath(tryPath(safe))) return tryPath(safe);
  for (let n = 2; n < 100; n++) {
    const s = `${safe} ${n}`;
    if (!app.vault.getAbstractFileByPath(tryPath(s))) return tryPath(s);
  }
  return tryPath(`${safe}-${Date.now()}`);
}

export function serializeFrontmatter(fm: Record<string, any>): string {
  const lines = ["---"];
  for (const [k, v] of Object.entries(fm)) {
    if (v === null || v === undefined) {
      lines.push(`${k}:`);
      continue;
    }
    if (Array.isArray(v)) {
      lines.push(`${k}:`);
      for (const item of v) lines.push(`  - ${JSON.stringify(item)}`);
    } else if (typeof v === "string") {
      if (v.startsWith("[[") || v.includes(":") || v.includes("#") || v.includes('"')) {
        lines.push(`${k}: "${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`);
      } else {
        lines.push(`${k}: ${v}`);
      }
    } else {
      lines.push(`${k}: ${v}`);
    }
  }
  lines.push("---");
  return lines.join("\n");
}

function buildManagedSection(content: string): string {
  const inner = content.trim();
  if (!inner) return `${BEGIN_MARKER}\n${END_MARKER}`;
  return `${BEGIN_MARKER}\n${inner}\n${END_MARKER}`;
}

export async function ensureFolder(app: App, folder: string): Promise<void> {
  const path = normalizePath(folder);
  try {
    if (!app.vault.getAbstractFileByPath(path)) await app.vault.createFolder(path);
  } catch {
    // ignore
  }
}

export async function saveCover(app: App, settings: KodiSettings, name: string, data: ArrayBuffer): Promise<void> {
  await ensureFolder(app, settings.coverFolder);
  const path = normalizePath(`${settings.coverFolder}/${name}`);
  await app.vault.adapter.writeBinary(path, data);
}

// Keep it simple: provide a variant that accepts settings for filename format.
export async function createKodiNote(
  app: App,
  itemTitle: string,
  fm: Record<string, any>,
  managedContent: string,
  coverEmbed: string,
  folder: string,
  filenameFormat: string
): Promise<TFile> {
  const filePath = resolveNewFilePathWithFormat(app, itemTitle, folder, filenameFormat);
  const fmStr = serializeFrontmatter(fm);
  const body = [
    fmStr,
    "",
    (coverEmbed ? coverEmbed + "\n\n" : "") + buildManagedSection(managedContent),
    "",
    "<!-- everything below this line is yours; it is never touched on re-import -->",
  ].join("\n");
  await ensureFolder(app, folder);
  return app.vault.create(filePath, body);
}

export function resolveNewFilePathWithFormat(app: App, title: string, folder: string, filenameFormat: string): string {
  const safe = sanitizeFilename(title);
  const tryPath = (name: string) => normalizePath(`${folder}/${name}.md`);
  if (filenameFormat === "title-year") {
    // caller may include year in title passed; no special handling
  }
  if (!app.vault.getAbstractFileByPath(tryPath(safe))) return tryPath(safe);
  for (let n = 2; n < 100; n++) {
    const s = `${safe} ${n}`;
    if (!app.vault.getAbstractFileByPath(tryPath(s))) return tryPath(s);
  }
  return tryPath(`${safe}-${Date.now()}`);
}

const IMAGE_EMBED_RE = /^(!\[\[.*?\]\]|!\[.*?\]\(.*?\))\s*$/;

export async function updateKodiNote(
  app: App,
  file: TFile,
  fmPatch: Record<string, any>,
  managedContent: string,
  coverEmbed: string,
  hasCover: boolean
): Promise<void> {
  await app.fileManager.processFrontMatter(file, (fm: any) => {
    for (const [k, v] of Object.entries(fmPatch)) fm[k] = v;
    if (!hasCover) delete fm.cover;
  });
  const content = await app.vault.read(file);
  const updated = updateBody(content, managedContent, coverEmbed, hasCover);
  if (updated !== content) await app.vault.modify(file, updated);
}

function updateBody(content: string, managedContent: string, coverEmbed: string, hasCover: boolean): string {
  const beginIdx = content.indexOf(BEGIN_MARKER);
  const endIdx = content.indexOf(END_MARKER);
  const newSection = buildManagedSection(managedContent);
  if (beginIdx !== -1 && endIdx !== -1 && endIdx > beginIdx) {
    const before = content.slice(0, beginIdx);
    const after = content.slice(endIdx + END_MARKER.length);
    const beforeFixed = syncCoverEmbed(before, coverEmbed, hasCover);
    return beforeFixed + newSection + after;
  }
  const coverLine = hasCover || coverEmbed ? `\n${coverEmbed}\n\n` : "\n\n";
  return content.trimEnd() + coverLine + newSection + "\n";
}

function syncCoverEmbed(before: string, coverEmbed: string, hasCover: boolean): string {
  const trimmed = before.trimEnd();
  const lines = trimmed.split("\n");
  const lastIdx = lines.length - 1;
  const hasExisting = lastIdx >= 0 && IMAGE_EMBED_RE.test((lines[lastIdx] ?? "").trim());
  if (hasCover || coverEmbed) {
    if (hasExisting) {
      lines[lastIdx] = coverEmbed;
      return lines.join("\n") + "\n\n";
    }
    return trimmed + "\n\n" + coverEmbed + "\n\n";
  }
  if (hasExisting) {
    lines.pop();
    return lines.join("\n").trimEnd() + "\n\n";
  }
  return before;
}

export function buildKodiMap(app: App): Map<string, TFile> {
  const map = new Map<string, TFile>();
  for (const file of app.vault.getMarkdownFiles()) {
    const fm = (app.metadataCache.getFileCache(file) as any)?.frontmatter;
    const id = fm?.kodi_id;
    const type = fm?.kodi_type;
    if (id !== undefined && id !== null && type) map.set(`${type}:${id}`, file);
  }
  return map;
}

// end

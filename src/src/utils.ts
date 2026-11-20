import { KodiSettings } from "./types";

export function joinList(v: any): string {
  if (Array.isArray(v)) {
    return v.map((x) => {
      if (x && typeof x === "object") return String(x.name ?? x.title ?? x.label ?? "");
      return String(x ?? "");
    }).filter(Boolean).join(", ");
  }
  if (v === null || v === undefined) return "";
  return String(v);
}

export function asArray(v: any): string[] {
  if (Array.isArray(v)) return v.map((x) => (x && typeof x === "object" ? String(x.name ?? x.title ?? "") : String(x))).filter(Boolean);
  if (v === null || v === undefined || v === "") return [];
  return [String(v)];
}

export function cleanUrl(v: any): string {
  let s = joinList(v).trim();
  if (!s) return "";
  try {
    if (s.startsWith("image://")) s = decodeURIComponent(s.slice("image://".length)).replace(/\/$/, "");
  } catch {
    // leave as-is
  }
  return s;
}

export function extractImage(item: any, keys: string[]): string {
  for (const k of keys) {
    const u = cleanUrl(item?.[k]);
    if (u) return u;
  }
  // Kodi may nest art under "art"
  if (item?.art && typeof item.art === "object") {
    for (const k of keys) {
      const u = cleanUrl(item.art[k]);
      if (u) return u;
    }
  }
  return "";
}

export function isHttpUrl(u: string): boolean {
  return /^https?:\/\//i.test(u);
}

export function sanitizeFilename(name: string): string {
  return String(name ?? "Untitled").replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim().slice(0, 100) || "Untitled";
}

export function mediaId(item: any, type: string): number {
  const key = type === "movie" ? "movieid" : type === "song" ? "songid" : type === "album" ? "albumid" : "tvshowid";
  const v = item?.[key];
  return typeof v === "number" ? v : Number(v ?? 0);
}

export function kodiTypeFolder(type: string, settings: KodiSettings): string {
  if (type === "movie") return settings.movieFolder;
  if (type === "song") return settings.musicFolder;
  if (type === "album") return settings.albumFolder;
  return settings.tvFolder;
}

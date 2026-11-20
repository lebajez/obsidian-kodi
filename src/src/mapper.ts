import { KodiSettings } from "./types";
import { joinList, asArray, extractImage } from "./utils";

function isoYear(v: any): string {
  if (v === null || v === undefined || v === "") return "";
  return String(v);
}

export function frontmatterFor(item: any, type: string, settings: KodiSettings, hasCover: boolean): Record<string, any> {
  const out: Record<string, any> = {};
  const id = (type === "movie" ? item?.movieid : type === "song" ? item?.songid : type === "album" ? item?.albumid : item?.tvshowid);

  if (type === "movie") {
    out.type = "movie";
    out.title = item?.title ?? item?.originaltitle ?? "Untitled";
    if (item?.year) out.year = item.year;
    if (item?.userrating) out.rating = item.userrating;
    if (item?.imdbnumber) out.imdb = String(item.imdbnumber);
    const studio = joinList(item?.studio);
    if (studio) out.studio = studio;
    const genre = joinList(item?.genre);
    if (genre) out.genre = genre;
    const cast = Array.isArray(item?.cast) ? item.cast.map((c: any) => (c && typeof c === "object" ? c.name : String(c))).filter(Boolean).join(", ") : joinList(item?.cast);
    if (cast) out.cast = cast;
    if (item?.runtime) out.runtime = item.runtime;
    if (item?.director) out.director = joinList(item?.director);
    const poster = extractImage(item, ["fanart", "poster", "thumbnail", "cover", "backdrop"]);
    if (poster) out.poster = poster;
    if (item?.path) out.path = item.path;
    out.kodi_id = id;
    out.kodi_type = "movie";
    if (hasCover) {
      out.cover = `[[${settings.coverFolder}/${coverName(type, id)}]]`;
    }
    return out;
  }

  if (type === "song") {
    out.type = "song";
    out.title = item?.title ?? "Unknown";
    const album = joinList(item?.album);
    if (album) out.album = album;
    const artist = joinList(item?.artist);
    if (artist) out.artist = artist;
    if (item?.track) out.track = item.track;
    if (item?.year) out.year = item.year;
    if (item?.userrating) out.rating = item.userrating;
    if (item?.playcount !== undefined && item?.playcount !== null) out.playcount = item.playcount;
    if (item?.lastplayed) out.lastplayed = item.lastplayed;
    const genre = joinList(item?.genre);
    if (genre) out.genre = genre;
    if (item?.duration) out.duration = item.duration;
    out.kodi_id = id;
    out.kodi_type = "song";
    return out;
  }

  if (type === "album") {
    out.type = "album";
    out.title = item?.title ?? "Unknown";
    if (item?.year) out.year = item.year;
    const artist = joinList(item?.artist);
    if (artist) out.artist = artist;
    const genre = joinList(item?.genre);
    if (genre) out.genre = genre;
    const poster = extractImage(item, ["thumbnail", "cover", "fanart", "poster"]);
    if (poster) out.poster = poster;
    out.kodi_id = id;
    out.kodi_type = "album";
    if (hasCover) {
      out.cover = `[[${settings.coverFolder}/${coverName(type, id)}]]`;
    }
    return out;
  }

  // series
  out.type = "tvseries";
  out.title = item?.title ?? item?.originaltitle ?? "Unknown";
  if (item?.year) out.year = item.year;
  const poster = extractImage(item, ["fanart", "poster", "thumbnail"]);
  if (poster) out.poster = poster;
  out.kodi_id = id;
  out.kodi_type = "series";
  if (hasCover) {
    out.cover = `[[${settings.coverFolder}/${coverName(type, id)}]]`;
  }
  return out;
}

function coverName(type: string, id: any): string {
  return `${type}-${id}.jpg`;
}

export function bodyFor(item: any, type: string): string {
  if (type === "movie") {
    const title = item?.title ?? item?.originaltitle ?? "Untitled";
    const year = item?.year ?? "";
    const rating = item?.userrating ?? "";
    const runtime = item?.runtime ?? "";
    const genre = joinList(item?.genre);
    const studio = joinList(item?.studio);
    const cast = Array.isArray(item?.cast) ? item.cast.map((c: any) => (c && typeof c === "object" ? c.name : String(c))).filter(Boolean).join(", ") : joinList(item?.cast);
    const lines: string[] = [`# ${title}`, ""];
    if (year) lines.push(`**Year:** ${year}`);
    if (rating) lines.push(`**Rating:** ${rating}`);
    if (runtime) lines.push(`**Runtime (s):** ${runtime}`);
    if (genre) lines.push(`**Genres:** ${genre}`);
    if (studio) lines.push(`**Studio:** ${studio}`);
    if (cast) lines.push(`**Cast:** ${cast}`);
    if (item?.tagline) lines.push(`**Tagline:** ${item.tagline}`);
    if (item?.plot) lines.push("", "## Plot", "", String(item.plot));
    if (item?.path) lines.push("", "---", "", `**File:** \`${item.path}\``);
    return lines.join("\n");
  }

  if (type === "song") {
    const title = item?.title ?? "Unknown";
    const album = joinList(item?.album);
    const artist = joinList(item?.artist);
    const track = item?.track ?? "";
    const year = item?.year ?? "";
    const rating = item?.userrating ?? "";
    const playcount = item?.playcount ?? "";
    const lastplayed = item?.lastplayed ?? "";
    const genre = joinList(item?.genre);
    const duration = item?.duration ?? "";
    const lines: string[] = [`# ${title}`, ""];
    if (artist) lines.push(`**Artist:** ${artist}`);
    if (album) lines.push(`**Album:** ${album}`);
    if (track) lines.push(`**Track:** ${track}`);
    if (year) lines.push(`**Year:** ${year}`);
    if (rating) lines.push(`**Rating:** ${rating}`);
    if (duration) lines.push(`**Duration (s):** ${duration}`);
    if (playcount) lines.push(`**Play count:** ${playcount}`);
    if (lastplayed) lines.push(`**Last played:** ${lastplayed}`);
    if (genre) lines.push(`**Genre:** ${genre}`);
    return lines.join("\n");
  }

  if (type === "album") {
    const title = item?.title ?? "Unknown";
    const year = item?.year ?? "";
    const artist = joinList(item?.artist);
    const genre = joinList(item?.genre);
    const lines: string[] = [`# ${title}`, ""];
    if (artist) lines.push(`**Artist:** ${artist}`);
    if (year) lines.push(`**Year:** ${year}`);
    if (genre) lines.push(`**Genres:** ${genre}`);
    return lines.join("\n");
  }

  // series
  const title = item?.title ?? item?.originaltitle ?? "Unknown";
  const year = item?.year ?? "";
  const overview = item?.overview ?? "";
  const lines: string[] = [`# ${title}`, ""];
  if (year) lines.push(`**Year:** ${year}`);
  if (overview) lines.push("", "## Overview", "", String(overview));
  return lines.join("\n");
}

export function subtitleFor(item: any, type: string): string {
  if (type === "movie") return [item?.year, joinList(item?.genre)].filter(Boolean).join(" · ");
  if (type === "song") return [joinList(item?.artist), joinList(item?.album)].filter(Boolean).join(" · ");
  if (type === "album") return [joinList(item?.artist), item?.year].filter(Boolean).join(" · ");
  return item?.year ? String(item.year) : "";
}

export { asArray };

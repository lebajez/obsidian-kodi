#!/usr/bin/env python3
"""Export Kodi JSON-RPC library data into individual Obsidian markdown notes.

- Fetches movies / songs from the Kodi JSON-RPC API (internal library metadata).
- Applies a search mask (SEARCH_QUERY) as a substring filter on titles.
- Writes one Obsidian markdown note per item with YAML frontmatter.
"""

import base64
import difflib
import json
import os
import re
import urllib.request
from urllib.parse import unquote

KODI_URL = "http://192.168.1.19:8080/jsonrpc"
KODI_USER = "kodi"
KODI_PASS = "telefonMann"
OBSIDIAN_DIR = "/home/rufus/owncloud/obsidian"  # <-- set this to your Obsidian vault root

MOVIE_PROPS = [
    "title", "originaltitle", "sorttitle", "year", "plot", "tagline",
    "userrating", "imdbnumber", "studio", "uniqueid", "genre", "fanart",
]

SONG_PROPS = [
    "title", "album", "artist", "year", "track",
    "userrating", "playcount", "lastplayed", "genre",
]

SEARCH_QUERY = ""  # search mask, e.g. "matrix"

EXPORT_TYPE = "movies"  # "movies", "songs", "albums", or "series"

DRY_RUN = True  # set to False to actually write files to the vault


def kodi(method, params=None):
    payload = json.dumps(
        {"jsonrpc": "2.0", "method": method, "params": params or {}, "id": 1}
    ).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if KODI_USER and KODI_PASS:
        token = base64.b64encode(f"{KODI_USER}:{KODI_PASS}".encode()).decode("ascii")
        headers["Authorization"] = f"Basic {token}"
    req = urllib.request.Request(
        KODI_URL, data=payload, headers=headers, method="POST"
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    if "error" in data:
        raise RuntimeError(f"Kodi error: {data.get('error')}")
    return data.get("result") or {}


def get_image(item, keys=("fanart", "poster", "thumbnail", "cover", "backdrop")):
    for k in keys:
        raw = item.get(k)
        v = ""
        if isinstance(raw, list):
            v = ", ".join(str(x) for x in raw if x)
        elif raw is not None:
            v = str(raw)
        if v:
            if v.startswith("image://"):
                v = v[len("image://"):].rstrip("/")
            return unquote(v)
    return ""


def apply_search_mask(items, keys):
    if not SEARCH_QUERY:
        return items
    q = "".join(SEARCH_QUERY.split()).lower()
    masked = []
    for it in items:
        haystack = "".join(" ".join(str(it.get(k) or "") for k in keys).split()).lower()
        if q in haystack:
            masked.append(it)
    if masked:
        return masked
    scored = []
    for it in items:
        hay = "".join(" ".join(str(it.get(k) or "") for k in keys).split()).lower()
        if not hay:
            continue
        score = difflib.SequenceMatcher(None, q, hay).ratio()
        if score >= 0.6:
            scored.append((score, it))
    if scored:
        scored.sort(key=lambda x: x[0], reverse=True)
        return [scored[0][1]]
    return []


def fetch_movies():
    movies = kodi("VideoLibrary.GetMovies", {"properties": MOVIE_PROPS}).get("movies") or []
    return apply_search_mask(movies, ["title", "originaltitle", "sorttitle"])


def fetch_songs():
    songs = kodi("MusicLibrary.GetSongs", {"properties": SONG_PROPS}).get("songs") or []
    return apply_search_mask(songs, ["title", "album", "artist"])


def slugify(title, year=None):
    base = f"{title or 'Untitled'} {year or ''}".lower()
    base = re.sub(r"[^a-z0-9]+", "_", base).strip("_")
    return base or "untitled"


def write_markdown(rel_dir, filename, frontmatter_lines, body):
    content = "---\n" + "\n".join(frontmatter_lines) + "\n---\n\n" + body.strip() + "\n"
    if DRY_RUN:
        print(f"[DRY RUN] {os.path.join(rel_dir, filename)}\n{content}")
        return os.path.join(rel_dir, filename)
    folder = os.path.join(OBSIDIAN_DIR, rel_dir)
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, filename)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    return path


def movie_note(m):
    title = m.get("title") or m.get("originaltitle") or "Untitled"
    year = m.get("year") or m.get("originalrelease") or ""
    rating = m.get("userrating") or ""
    uniqueid = m.get("uniqueid") or {}
    imdb = m.get("imdbnumber") or (uniqueid.get("imdb") if isinstance(uniqueid, dict) else uniqueid) or ""

    studio_raw = m.get("studio") or ""
    studio = ""
    if isinstance(studio_raw, list):
        studio = ", ".join(str(s) for s in studio_raw if s) or ""
    elif studio_raw:
        studio = str(studio_raw)

    genre_raw = m.get("genre") or ""
    genre = ""
    if isinstance(genre_raw, list):
        genre = ", ".join(str(g) for g in genre_raw if g) or ""
    elif genre_raw:
        genre = str(genre_raw)

    cast_raw = m.get("cast") or m.get("actors") or ""
    cast = ""
    if isinstance(cast_raw, list):
        cast = ", ".join(str(c) for c in cast_raw if c) or ""
    elif cast_raw:
        cast = str(cast_raw)

    runtime = m.get("runtime") or ""

    poster = get_image(m, ("fanart", "poster", "thumbnail"))

    fm = ["type: movie", f"title: {json.dumps(str(title))}", f"year: {year}"]
    if rating:
        fm.append(f"rating: {rating}")
    if imdb:
        fm.append(f"imdb: {json.dumps(str(imdb))}")
    if studio:
        fm.append(f"studio: {json.dumps(str(studio))}")
    if genre:
        fm.append(f"genre: {json.dumps(str(genre))}")
    if cast:
        fm.append(f"cast: {json.dumps(str(cast))}")
    if runtime:
        fm.append(f"runtime: {runtime}")
    if poster:
        fm.append(f"poster: {json.dumps(str(poster))}")

    body = [f"# {title}", ""]
    if year:
        body.append(f"**Year:** {year}")
    if rating:
        body.append(f"**Rating:** {rating}")
    if runtime:
        body.append(f"**Runtime:** {runtime}")
    if genre:
        body.append(f"**Genres:** {genre}")
    if cast:
        body.append(f"**Cast:** {cast}")
    if m.get("tagline"):
        body.append(f"**Tagline:** {m.get('tagline')}")
    if poster:
        body += ["", f"![{title}]({poster})"]
    if m.get("plot"):
        body += ["", "## Plot", "", m.get("plot")]
    if m.get("path"):
        body += ["", "---", "", f"**File:** `{m.get('path')}`"]

    filename = f"{slugify(title, year)}.md"
    return write_markdown("Movies", filename, fm, "\n".join(body))


def song_note(s):
    title = s.get("title") or "Unknown"
    album_raw = s.get("album") or ""
    artist_raw = s.get("artist") or ""
    track = s.get("track") or ""
    year = s.get("year") or ""
    rating = s.get("userrating") or ""
    playcount = s.get("playcount") or ""
    lastplayed = s.get("lastplayed") or ""
    genre_raw = s.get("genre") or ""

    def _join(v):
        if isinstance(v, list):
            return ", ".join(str(x) for x in v if x) or ""
        return str(v) if v else ""

    album = _join(album_raw)
    artist = _join(artist_raw)
    genre = _join(genre_raw)

    fm = ["type: song", f"title: {json.dumps(str(title))}"]
    if album:
        fm.append(f"album: {json.dumps(str(album))}")
    if artist:
        fm.append(f"artist: {json.dumps(str(artist))}")
    if track:
        fm.append(f"track: {track}")
    if year:
        fm.append(f"year: {year}")
    if rating:
        fm.append(f"rating: {rating}")
    if playcount:
        fm.append(f"playcount: {playcount}")
    if lastplayed:
        fm.append(f"lastplayed: {json.dumps(str(lastplayed))}")
    if genre:
        fm.append(f"genre: {json.dumps(str(genre))}")

    body = [f"# {title}", ""]
    if artist:
        body.append(f"**Artist:** {artist}")
    if album:
        body.append(f"**Album:** {album}")
    if track:
        body.append(f"**Track:** {track}")
    if year:
        body.append(f"**Year:** {year}")
    if rating:
        body.append(f"**Rating:** {rating}")
    if playcount:
        body.append(f"**Play count:** {playcount}")
    if lastplayed:
        body.append(f"**Last played:** {lastplayed}")
    if genre:
        body.append(f"**Genre:** {genre}")

    filename = f"{slugify(title, year)}.md"
    return write_markdown("Music", filename, fm, "\n".join(body))


ALBUM_PROPS = ["title", "artist", "year", "genre", "thumbnail"]


def fetch_albums():
    albums = kodi("MusicLibrary.GetAlbums", {"properties": ALBUM_PROPS}).get("albums") or []
    return apply_search_mask(albums, ["title", "artist"])


def album_note(a):
    title = a.get("title") or "Unknown"
    year = a.get("year") or ""
    artist_raw = a.get("artist") or ""
    genre_raw = a.get("genre") or ""
    artist = ", ".join(str(x) for x in artist_raw if x) if isinstance(artist_raw, list) else str(artist_raw or "")
    genre = ", ".join(str(x) for x in genre_raw if x) if isinstance(genre_raw, list) else str(genre_raw or "")
    cover = get_image(a, ("thumbnail", "cover", "fanart", "poster"))

    fm = ["type: album", f"title: {json.dumps(str(title))}"]
    if year:
        fm.append(f"year: {year}")
    if artist:
        fm.append(f"artist: {json.dumps(str(artist))}")
    if genre:
        fm.append(f"genre: {json.dumps(str(genre))}")
    if cover:
        fm.append(f"poster: {json.dumps(str(cover))}")

    body = [f"# {title}", ""]
    if artist:
        body.append(f"**Artist:** {artist}")
    if year:
        body.append(f"**Year:** {year}")
    if genre:
        body.append(f"**Genres:** {genre}")
    if cover:
        body += ["", f"![{title}]({cover})"]

    filename = f"{slugify(title, year)}.md"
    return write_markdown("Music/Albums", filename, fm, "\n".join(body))


TV_PROPS = ["title", "originaltitle", "year", "overview"]


def fetch_series():
    series = kodi("TVLibrary.GetSeries", {"properties": TV_PROPS}).get("series") or []
    return apply_search_mask(series, ["title", "originaltitle"])


def series_note(t):
    title = t.get("title") or t.get("originaltitle") or "Unknown"
    year = t.get("year") or ""
    overview = t.get("overview") or ""
    poster = get_image(t, ("fanart", "poster", "thumbnail"))

    fm = ["type: tvseries", f"title: {json.dumps(str(title))}"]
    if year:
        fm.append(f"year: {year}")
    if poster:
        fm.append(f"poster: {json.dumps(str(poster))}")

    body = [f"# {title}", ""]
    if year:
        body.append(f"**Year:** {year}")
    if overview:
        body += ["", "## Overview", "", overview]
    if poster:
        body += ["", f"![{title}]({poster})"]

    filename = f"{slugify(title, year)}.md"
    return write_markdown("TV", filename, fm, "\n".join(body))


def main():
    if EXPORT_TYPE == "movies":
        handler, fetcher, rel_dir = movie_note, fetch_movies, "Movies"
    elif EXPORT_TYPE == "songs":
        handler, fetcher, rel_dir = song_note, fetch_songs, "Music"
    elif EXPORT_TYPE == "albums":
        handler, fetcher, rel_dir = album_note, fetch_albums, "Music/Albums"
    elif EXPORT_TYPE == "series":
        handler, fetcher, rel_dir = series_note, fetch_series, "TV"
    else:
        raise ValueError(f"Unknown EXPORT_TYPE: {EXPORT_TYPE}")

    for item in fetcher():
        path = handler(item)
        print(f"Wrote {path}")


if __name__ == "__main__":
    main()

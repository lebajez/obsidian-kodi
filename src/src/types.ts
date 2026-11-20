export type MediaType = "movie" | "song" | "album" | "series";

export interface KodiSettings {
  serverUrl: string;
  username: string;
  password: string;
  movieFolder: string;
  musicFolder: string;
  albumFolder: string;
  tvFolder: string;
  coverFolder: string;
  downloadCovers: boolean;
  filenameFormat: "title" | "title-year";
}

export interface SelectedItem {
  id: number;
  title: string;
  subtitle?: string;
}

export const DEFAULT_SETTINGS: KodiSettings = {
  serverUrl: "http://192.168.1.19:8080/jsonrpc",
  username: "",
  password: "",
  movieFolder: "Kodi/Movies",
  musicFolder: "Kodi/Music",
  albumFolder: "Kodi/Music/Albums",
  tvFolder: "Kodi/TV",
  coverFolder: "Kodi/covers",
  downloadCovers: true,
  filenameFormat: "title",
};

export const MOVIE_PROPS = [
  "title", "originaltitle", "year", "plot", "tagline",
  "userrating", "imdbnumber", "studio", "uniqueid", "genre",
  "fanart", "poster", "thumbnail", "runtime", "director", "cast", "path",
];

export const SONG_PROPS = [
  "title", "album", "artist", "year", "track", "duration",
  "userrating", "playcount", "lastplayed", "genre",
];

export const ALBUM_PROPS = ["title", "artist", "year", "genre", "thumbnail", "fanart"];

export const SERIES_PROPS = ["title", "originaltitle", "year", "overview", "fanart", "poster", "thumbnail"];

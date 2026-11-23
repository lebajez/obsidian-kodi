import { requestUrl, Notice } from "obsidian";
import { KodiSettings, MOVIE_PROPS, SONG_PROPS, ALBUM_PROPS, SERIES_PROPS } from "./types";

export class KodiApi {
  constructor(private s: KodiSettings) {}

  private authHeaders(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.s.username && this.s.password) {
      h.Authorization = "Basic " + btoa(`${this.s.username}:${this.s.password}`);
    }
    return h;
  }

  async rpc(method: string, params: Record<string, unknown> = {}): Promise<any> {
    try {
      const res = await requestUrl({
        url: this.s.serverUrl,
        method: "POST",
        headers: this.authHeaders(),
        body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
      });
      const data = res.json;
      if (data?.error) throw new Error(JSON.stringify(data.error));
      return data?.result ?? {};
    } catch (e: any) {
      const status = e?.status;
      if (status === 401) {
        new Notice("Kodi: Unauthorized (401). Check username/password.");
      } else {
        new Notice(`Kodi: Request failed — ${e instanceof Error ? e.message : String(e)}`);
      }
      throw e;
    }
  }

  async ping(): Promise<boolean> {
    try {
      const r = await this.rpc("JSONRPC.Ping");
      return r === "pong";
    } catch {
      return false;
    }
  }

  async getMovies(): Promise<any[]> {
    const r = await this.rpc("VideoLibrary.GetMovies", { properties: MOVIE_PROPS });
    return r?.movies ?? [];
  }

  async getSongs(): Promise<any[]> {
    const r = await this.rpc("AudioLibrary.GetSongs", { properties: SONG_PROPS });
    return r?.songs ?? [];
  }

  async getAlbums(): Promise<any[]> {
    const r = await this.rpc("AudioLibrary.GetAlbums", { properties: ALBUM_PROPS });
    return r?.albums ?? [];
  }

  async getSeries(): Promise<any[]> {
    const r = await this.rpc("VideoLibrary.GetTVShows", { properties: SERIES_PROPS });
    return r?.tvshows ?? [];
  }
}

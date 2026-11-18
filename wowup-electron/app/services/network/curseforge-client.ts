import type {
  CF2GetFingerprintMatchesResponse,
  CF2GetAddonResponse,
  CF2GetFeaturedModsRequest,
  CF2GetFeaturedModsResponse,
  CF2GetFingerprintMatchesRequest,
  CF2GetModDescriptionResponse,
  CF2GetModFileChangelogResponse,
  CF2GetModFileResponse,
  CF2GetModsRequest,
  CF2GetModsResponse,
  CF2SearchModsParams,
  CF2SearchModsResponse,
} from "curseforge-v2/lib/curseforge-api-v2";

import { HttpClient, HttpError } from "./http-client";

const CURSEFORGE_API_URL = "https://api.curseforge.com";

/** What every call returns. Like curseforge-v2's client, an http error is a result, not a rejection. */
export interface CurseForgeResponse<T> {
  data?: T;
  message: string;
  statusCode: number;
}

/**
 * The CurseForge v2 endpoints the Curse provider uses, on main's `HttpClient` so the requests go
 * through Chromium's network stack (system proxy, certificates). Replaces curseforge-v2's
 * `CFV2Client`, which runs on axios and so in main would skip the proxy; its types still come from
 * the package.
 */
export class CurseForgeClient {
  public constructor(
    private readonly _http: HttpClient,
    /** Also sent with Curse downloads (`CurseAddonProvider.getDownloadAuth`) */
    public readonly apiKey: string,
    private readonly _httpTimeoutMs: number,
  ) {}

  public getMod(modId: number): Promise<CurseForgeResponse<CF2GetAddonResponse>> {
    return this.get(`/v1/mods/${modId}`);
  }

  public getMods(request: CF2GetModsRequest): Promise<CurseForgeResponse<CF2GetModsResponse>> {
    return this.post("/v1/mods", request);
  }

  public getModDescription(modId: number): Promise<CurseForgeResponse<CF2GetModDescriptionResponse>> {
    return this.get(`/v1/mods/${modId}/description`);
  }

  public getFeaturedMods(request: CF2GetFeaturedModsRequest): Promise<CurseForgeResponse<CF2GetFeaturedModsResponse>> {
    return this.post("/v1/mods/featured", request);
  }

  public searchMods(params: CF2SearchModsParams): Promise<CurseForgeResponse<CF2SearchModsResponse>> {
    // Same as curseforge-v2: leave out what isn't set
    const query: Record<string, string> = {};
    for (const [key, value] of Object.entries(params) as [string, unknown][]) {
      if (value === null || value === undefined || (typeof value === "number" && isNaN(value))) {
        continue;
      }
      query[key] = String(value);
    }
    return this.get(`/v1/mods/search?${new URLSearchParams(query).toString()}`);
  }

  public getModFile(modId: number, fileId: number): Promise<CurseForgeResponse<CF2GetModFileResponse>> {
    return this.get(`/v1/mods/${modId}/files/${fileId}`);
  }

  public getModFileChangelog(
    modId: number,
    fileId: number,
  ): Promise<CurseForgeResponse<CF2GetModFileChangelogResponse>> {
    return this.get(`/v1/mods/${modId}/files/${fileId}/changelog`);
  }

  public getFingerprintMatches(
    request: CF2GetFingerprintMatchesRequest,
  ): Promise<CurseForgeResponse<CF2GetFingerprintMatchesResponse>> {
    return this.post("/v1/fingerprints", request);
  }

  private get<T>(path: string): Promise<CurseForgeResponse<T>> {
    return this.send(() => this._http.getJson<T>(`${CURSEFORGE_API_URL}${path}`, this.headers(), this._httpTimeoutMs));
  }

  private post<T>(path: string, body: unknown): Promise<CurseForgeResponse<T>> {
    return this.send(() =>
      this._http.postJson<T>(`${CURSEFORGE_API_URL}${path}`, body, this.headers(), this._httpTimeoutMs),
    );
  }

  private headers(): Record<string, string> {
    return { "x-api-key": this.apiKey };
  }

  private async send<T>(request: () => Promise<T>): Promise<CurseForgeResponse<T>> {
    try {
      return { data: await request(), message: "OK", statusCode: 200 };
    } catch (e) {
      if (e instanceof HttpError) {
        return { data: undefined, message: e.statusText, statusCode: e.status };
      }
      throw e;
    }
  }
}

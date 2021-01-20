import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable, of } from "rxjs";
import { tap } from "rxjs/operators";
import { AppConfig } from "../../../environments/environment";
import { BlockListRepresentation } from "../../models/wowup-api/block-list";
import { CachingService } from "../caching/caching-service";

const API_URL = AppConfig.wowUpApiUrl;
const BLOCKLIST_CACHE_KEY = "wowup-blocklist";

@Injectable({
  providedIn: "root",
})
export class WowUpApiService {
  constructor(private _httpClient: HttpClient, private _cacheService: CachingService) {}

  public getBlockList(): Observable<BlockListRepresentation> {
    const cached = this._cacheService.get<BlockListRepresentation>(BLOCKLIST_CACHE_KEY);
    if (cached) {
      return of(cached);
    }

    const url = new URL(`${API_URL}/blocklist`);

    return this._httpClient.get<BlockListRepresentation>(url.toString()).pipe(
      tap((response) => {
        console.log("BlockList", response);
        this._cacheService.set(BLOCKLIST_CACHE_KEY, response);
      })
    );
  }
}

import { Injectable } from "@angular/core";
import { from, Observable, of } from "rxjs";
import { tap } from "rxjs/operators";
import { AppConfig } from "../../../environments/environment";
import { BlockListRepresentation } from "../../models/wowup-api/block-list";
import { CachingService } from "../caching/caching-service";
import { CircuitBreakerWrapper, NetworkService } from "../network/network.service";

const API_URL = AppConfig.wowUpApiUrl;
const BLOCKLIST_CACHE_KEY = "wowup-blocklist";

@Injectable({
  providedIn: "root",
})
export class WowUpApiService {
  private readonly _circuitBreaker: CircuitBreakerWrapper;

  constructor(private _networkService: NetworkService, private _cacheService: CachingService) {
    this._circuitBreaker = this._networkService.getCircuitBreaker(`WowUpApiService_main`);
    this.getBlockList().subscribe();
  }

  public getBlockList(): Observable<BlockListRepresentation> {
    const cached = this._cacheService.get<BlockListRepresentation>(BLOCKLIST_CACHE_KEY);
    if (cached) {
      return of(cached);
    }

    const url = new URL(`${API_URL}/blocklist`);

    return from(this._circuitBreaker.getJson<BlockListRepresentation>(url)).pipe(
      tap((response) => {
        this._cacheService.set(BLOCKLIST_CACHE_KEY, response);
      })
    );
  }
}

import { Injectable } from "@angular/core";
import { WowUpGetAccountResponse } from "wowup-lib-core";
import { AppConfig } from "../../../environments/environment";
import { CachingService } from "../caching/caching-service";
import { CircuitBreakerWrapper, NetworkService } from "../network/network.service";

const API_URL = AppConfig.wowUpApiUrl;

@Injectable({
  providedIn: "root",
})
export class WowUpApiService {
  private readonly _circuitBreaker: CircuitBreakerWrapper;

  public constructor(private _networkService: NetworkService, private _cacheService: CachingService) {
    this._circuitBreaker = this._networkService.getCircuitBreaker(`WowUpApiService_main`);
  }

  public async getAccount(authToken: string): Promise<WowUpGetAccountResponse> {
    const url = new URL(`${API_URL}/account`);
    return await this._circuitBreaker.getJson<WowUpGetAccountResponse>(
      url,
      this.getAuthorizationHeader(authToken),
      5000
    );
  }

  public async registerPushToken(authToken: string, pushToken: string, deviceType: string): Promise<any> {
    const url = new URL(`${API_URL}/account/push`);
    url.searchParams.set("push_token", pushToken);
    url.searchParams.set("os", deviceType);

    return this._circuitBreaker.postJson<any>(url, {}, this.getAuthorizationHeader(authToken));
  }

  public async removePushToken(authToken: string, pushToken: string): Promise<any> {
    const url = new URL(`${API_URL}/account/push/${pushToken}`);
    return this._circuitBreaker.deleteJson<any>(url, this.getAuthorizationHeader(authToken));
  }

  private getAuthorizationHeader(authToken: string): { Authorization: string } {
    return {
      Authorization: `Bearer ${authToken}`,
    };
  }
}

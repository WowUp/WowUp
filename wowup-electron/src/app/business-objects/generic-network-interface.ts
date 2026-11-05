import { GetConfig, NetworkInterface, PostConfig } from "wowup-lib-core";
import { CircuitBreakerWrapper } from "../services/network/network.service";
import * as memcache from "../business-objects/mem-cache";

export class GenericNetworkInterface implements NetworkInterface {
  public constructor(
    private _circuitBreaker: CircuitBreakerWrapper,
    private _defaultHeaders?: Record<string, string>,
  ) {}

  private mergeHeaders(headers?: { [header: string]: string | string[] }) {
    if (!this._defaultHeaders) return headers;
    return { ...this._defaultHeaders, ...headers };
  }

  public async getJson<T>(url: string | URL, config?: GetConfig | undefined): Promise<T> {
    return await memcache.transaction(
      url.toString(),
      () => this._circuitBreaker.getJson<T>(url, this.mergeHeaders(config?.headers), config?.timeoutMs),
      30
    );
  }

  public async getText(url: string | URL, config?: GetConfig | undefined): Promise<string> {
    return await memcache.transaction(url.toString(), () => this._circuitBreaker.getText(url, config?.timeoutMs), 30);
  }

  public async postJson<T>(url: string | URL, config: PostConfig): Promise<T> {
    const headers = this.mergeHeaders(config.headers);
    if (config.cache === true) {
      const key = `${url.toString()}-${JSON.stringify(config.body).length.toString()}`;
      return await memcache.transaction(
        key,
        () => this._circuitBreaker.postJson<T>(url, config.body, headers, config.timeoutMs),
        30
      );
    }
    return await this._circuitBreaker.postJson<T>(url, config.body, headers, config.timeoutMs);
  }
}

import NodeCache = require("node-cache");
import { GetConfig, NetworkInterface, PostConfig } from "./network-interface";

import { HttpCircuitBreaker } from "./circuit-breaker";

const CACHE_TTL_SEC = 30;

/**
 * The `NetworkInterface` the hub, WowInterface and TukUI providers make their requests through. Port of the renderer's `GenericNetworkInterface`: one breaker per service, default
 * headers, and a 30 s cache so the same request from several places in a sync goes out once.
 */
export class ProviderNetworkInterface implements NetworkInterface {
  public constructor(
    private readonly _breaker: HttpCircuitBreaker,
    private readonly _cache: NodeCache,
    private readonly _defaultHeaders: Record<string, string> = {},
  ) {}

  public getJson<T>(url: string | URL, config?: GetConfig): Promise<T> {
    return this.cached(url.toString(), () =>
      this._breaker.getJson<T>(url, this.mergeHeaders(config?.headers), config?.timeoutMs),
    );
  }

  public getText(url: string | URL, config?: GetConfig): Promise<string> {
    return this.cached(url.toString(), () => this._breaker.getText(url, config?.timeoutMs));
  }

  public postJson<T>(url: string | URL, config: PostConfig): Promise<T> {
    const headers = this.mergeHeaders(config.headers);
    const post = () => this._breaker.postJson<T>(url, config.body, headers, config.timeoutMs);
    if (config.cache === true) {
      // Keyed on the body's length, as before: cheap, and good enough for the repeat it's there to catch
      return this.cached(`${url.toString()}-${JSON.stringify(config.body).length.toString()}`, post);
    }
    return post();
  }

  private mergeHeaders(headers?: { [header: string]: string | string[] }) {
    return { ...this._defaultHeaders, ...headers };
  }

  private async cached<T>(key: string, missing: () => Promise<T>): Promise<T> {
    const hit = this._cache.get<T>(key);
    if (hit !== undefined && hit !== null) {
      return hit;
    }

    const result = await missing();
    if (result !== undefined && result !== null) {
      this._cache.set(key, result, CACHE_TTL_SEC);
    }
    return result;
  }
}

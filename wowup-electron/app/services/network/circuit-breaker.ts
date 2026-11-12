import CircuitBreaker = require("opossum");

import { HttpClient, HttpHeaders } from "./http-client";

export interface CircuitBreakerOptions {
  name: string;
  resetTimeoutMs: number;
  httpTimeoutMs: number;
  log: { info(...args: unknown[]): void };
}

/**
 * Port of the renderer's `CircuitBreakerWrapper`: every request to one service goes through one
 * breaker, so a service that keeps failing is left alone for `resetTimeoutMs` (calls fail fast with
 * opossum's `EOPENBREAKER` code) instead of each caller waiting out its own timeout.
 */
export class HttpCircuitBreaker {
  private readonly _cb: CircuitBreaker;
  private readonly _httpTimeoutMs: number;
  private _state: "open" | "closed" = "closed";

  public constructor(
    private readonly _http: HttpClient,
    options: CircuitBreakerOptions,
  ) {
    this._httpTimeoutMs = options.httpTimeoutMs;
    this._cb = new CircuitBreaker((action: () => Promise<unknown>) => action(), {
      timeout: options.httpTimeoutMs,
      resetTimeout: options.resetTimeoutMs,
      // Same as before: opossum's errorFilter returning true means "don't count this one", so a 404
      // doesn't trip the breaker
      errorFilter: (err: { status?: number }) => err?.status === 404,
    });
    this._cb.on("open", () => {
      options.log.info(`${options.name} circuit breaker open`);
      this._state = "open";
    });
    this._cb.on("close", () => {
      options.log.info(`${options.name} circuit breaker close`);
      this._state = "closed";
    });
  }

  public isOpen(): boolean {
    return this._state === "open";
  }

  public close(): void {
    this._cb.close();
  }

  public async fire<T>(action: () => Promise<T>): Promise<T> {
    return (await this._cb.fire(action)) as T;
  }

  public getJson<T>(url: URL | string, headers: HttpHeaders = {}, timeoutMs?: number): Promise<T> {
    return this.fire(() => this._http.getJson<T>(url, headers, timeoutMs ?? this._httpTimeoutMs));
  }

  public getText(url: URL | string, timeoutMs?: number): Promise<string> {
    return this.fire(() => this._http.getText(url, {}, timeoutMs ?? this._httpTimeoutMs));
  }

  public postJson<T>(url: URL | string, body: unknown, headers: HttpHeaders = {}, timeoutMs?: number): Promise<T> {
    return this.fire(() => this._http.postJson<T>(url, body, headers, timeoutMs ?? this._httpTimeoutMs));
  }
}

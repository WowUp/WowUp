import * as CircuitBreaker from "opossum";
import { firstValueFrom, Subject } from "rxjs";
import { first, timeout } from "rxjs/operators";

import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";

import { AppConfig } from "../../../environments/environment";

export interface CircuitBreakerChangeEvent {
  state: "open" | "closed";
}

const CACHE_CONTROL_HEADERS = { "Cache-Control": "no-cache", Pragma: "no-cache" };

export class CircuitBreakerWrapper {
  private readonly _name: string;
  private readonly _cb: CircuitBreaker;
  private readonly _httpClient: HttpClient;
  private readonly _defaultTimeoutMs: number;

  private _state = "closed";

  public constructor(
    name: string,
    httpClient: HttpClient,
    resetTimeoutMs = AppConfig.defaultHttpResetTimeoutMs,
    httpTimeoutMs = AppConfig.defaultHttpTimeoutMs
  ) {
    this._name = name;
    this._httpClient = httpClient;
    this._defaultTimeoutMs = httpTimeoutMs;
    this._cb = new CircuitBreaker(this.internalAction, {
      timeout: httpTimeoutMs,
      resetTimeout: resetTimeoutMs,
      errorFilter: (err) => {
        // Don't trip the breaker on a 404
        return err.status === 404;
      },
    });
    this._cb.on("open", () => {
      console.log(`${name} circuit breaker open`);
      this._state = "open";
    });
    this._cb.on("close", () => {
      console.log(`${name} circuit breaker close`);
      this._state = "closed";
    });
  }

  public isOpen() {
    return this._state === "open";
  }

  public async fire<TOUT>(action: () => Promise<TOUT>): Promise<TOUT> {
    return (await this._cb.fire(action)) as TOUT;
  }

  public getJson<T>(
    url: URL | string,
    headers: {
      [header: string]: string | string[];
    } = {},
    timeoutMs?: number
  ): Promise<T> {
    return this.fire(() =>
      firstValueFrom(
        this._httpClient
          .get<T>(url.toString(), { headers: { ...CACHE_CONTROL_HEADERS, ...headers } })
          .pipe(first(), timeout(timeoutMs ?? this._defaultTimeoutMs))
      )
    );
  }

  public getText(url: URL | string, timeoutMs?: number): Promise<string> {
    return this.fire(() =>
      firstValueFrom(
        this._httpClient
          .get(url.toString(), { responseType: "text", headers: { ...CACHE_CONTROL_HEADERS } })
          .pipe(first(), timeout(timeoutMs ?? this._defaultTimeoutMs))
      )
    );
  }

  public postJson<T>(
    url: URL | string,
    body: unknown,
    headers: {
      [header: string]: string | string[];
    } = {},
    timeoutMs?: number
  ): Promise<T> {
    const cheaders = headers || {};
    const ctimeout = timeoutMs ?? this._defaultTimeoutMs;

    return this.fire<T>(() =>
      firstValueFrom(
        this._httpClient.post<T>(url.toString(), body, { headers: { ...cheaders } }).pipe(
          first(),
          // switchMap((r) => mockTimeout<T>(r, 30000)),
          timeout(ctimeout)
        )
      )
    );
  }

  public deleteJson<T>(
    url: URL | string,
    headers: {
      [header: string]: string | string[];
    } = {},
    timeoutMs?: number
  ): Promise<T> {
    const cheaders = headers || {};
    return this.fire<T>(() =>
      firstValueFrom(
        this._httpClient
          .delete<T>(url.toString(), { headers: { ...cheaders } })
          .pipe(first(), timeout(timeoutMs ?? this._defaultTimeoutMs))
      )
    );
  }

  private internalAction = (action: () => Promise<any>) => {
    return action?.call(this);
  };
}
/** Useful when wanting to test HTTP timeout conditions */
// function mockTimeout<T>(data?: T, timeout = 10000): Observable<T> {
//   console.debug("mockTimeout", timeout);
//   const prom = new Promise<T>((resolve, reject) => {
//     setTimeout(() => {
//       resolve(data);
//     }, timeout);
//   });

//   return from(prom);
// }

@Injectable({
  providedIn: "root",
})
export class NetworkService {
  private _breakerChangedSrc = new Subject<string>();

  public breakerChanged$ = this._breakerChangedSrc.asObservable();

  public constructor(private _httpClient: HttpClient) {}

  public getCircuitBreaker(
    name: string,
    resetTimeoutMs: number = AppConfig.defaultHttpResetTimeoutMs,
    httpTimeoutMs: number = AppConfig.defaultHttpTimeoutMs
  ): CircuitBreakerWrapper {
    console.debug("Create circuit breaker", name, resetTimeoutMs, httpTimeoutMs);
    return new CircuitBreakerWrapper(name, this._httpClient, resetTimeoutMs, httpTimeoutMs);
  }

  public getJson<T>(url: URL | string, timeoutMs?: number): Promise<T> {
    return firstValueFrom(
      this._httpClient
        .get<T>(url.toString(), { headers: { ...CACHE_CONTROL_HEADERS } })
        .pipe(first(), timeout(timeoutMs ?? AppConfig.defaultHttpTimeoutMs))
    );
  }

  public getText(url: URL | string, timeoutMs?: number): Promise<string> {
    return firstValueFrom(
      this._httpClient
        .get(url.toString(), { responseType: "text", headers: { ...CACHE_CONTROL_HEADERS } })
        .pipe(first(), timeout(timeoutMs ?? AppConfig.defaultHttpTimeoutMs))
    );
  }
}

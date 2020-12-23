import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { AppConfig } from "environments/environment";
import * as CircuitBreaker from "opossum";
import { Subject } from "rxjs";
import { first, tap, timeout } from "rxjs/operators";

export interface CircuitBreakerChangeEvent {
  state: "open" | "closed";
}

export class CircuitBreakerWrapper {
  private readonly _name: string;
  private readonly _cb: CircuitBreaker;
  private readonly _httpClient: HttpClient;
  private readonly _defaultTimeoutMs: number;

  constructor(
    name: string,
    httpClient: HttpClient,
    resetTimeoutMs = AppConfig.defaultHttpResetTimeoutMs,
    httpTimeoutMs = AppConfig.defaultHttpTimeoutMs
  ) {
    this._name = name;
    this._httpClient = httpClient;
    this._defaultTimeoutMs = httpTimeoutMs;
    this._cb = new CircuitBreaker(this.internalAction, {
      resetTimeout: resetTimeoutMs,
    });
    this._cb.on("open", () => {
      console.log(`${name} circuit breaker open`);
    });
    this._cb.on("close", () => {
      console.log(`${name} circuit breaker close`);
    });
  }

  public async fire<TOUT>(action: () => Promise<TOUT>): Promise<TOUT> {
    return (await this._cb.fire(action)) as TOUT;
  }

  public getJson<T>(url: URL | string, timeoutMs?: number): Promise<T> {
    return this.fire(() =>
      this._httpClient
        .get<T>(url.toString())
        .pipe(first(), timeout(timeoutMs ?? this._defaultTimeoutMs))
        .toPromise()
    );
  }

  public getText(url: URL | string, timeoutMs?: number): Promise<string> {
    return this.fire(() =>
      this._httpClient
        .get(url.toString(), { responseType: "text" })
        .pipe(first(), timeout(timeoutMs ?? this._defaultTimeoutMs))
        .toPromise()
    );
  }

  public postJson<T>(url: URL | string, body: any, timeoutMs?: number): Promise<T> {
    return this.fire<T>(() =>
      this._httpClient
        .post<T>(url.toString(), body)
        .pipe(first(), timeout(timeoutMs ?? this._defaultTimeoutMs))
        .toPromise()
    );
  }

  private internalAction = (action: () => Promise<any>) => {
    return action?.call(this);
  };
}

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
    return new CircuitBreakerWrapper(name, this._httpClient, resetTimeoutMs, httpTimeoutMs);
  }
}

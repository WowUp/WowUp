import { Injectable } from "@angular/core";
import * as CircuitBreaker from "opossum";
import { Subject } from "rxjs";

export interface CircuitBreakerChangeEvent {
  state: "open" | "closed";
}

const DEFAULT_RESET_TIMEOUT_MS = 60 * 1000;

@Injectable({
  providedIn: "root",
})
export class NetworkService {
  private _breakerChangedSrc = new Subject<string>();

  public breakerChanged$ = this._breakerChangedSrc.asObservable();

  public getCircuitBreaker<TI extends unknown[] = unknown[], TR = unknown>(
    name: string,
    action: (...args: TI) => Promise<TR>,
    resetTimeoutMs: number = DEFAULT_RESET_TIMEOUT_MS
  ): CircuitBreaker<TI, TR> {
    const cb = new CircuitBreaker(action, {
      resetTimeout: resetTimeoutMs,
    });
    cb.on("open", () => {
      console.log(`${name} circuit breaker open`);
    });
    cb.on("close", () => {
      console.log(`${name} circuit breaker close`);
    });

    return cb;
  }
}

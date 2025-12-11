/**
 * Network Service for Main Process
 *
 * Provides HTTP client functionality with circuit breaker pattern for resilience.
 * Matches the API surface of the renderer NetworkService for compatibility.
 *
 * Uses axios instead of Angular HttpClient since this runs in the main process.
 */

import * as CircuitBreaker from "opossum";
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import * as log from "electron-log/main";

export interface CircuitBreakerChangeEvent {
  state: "open" | "closed";
}

const CACHE_CONTROL_HEADERS = { "Cache-Control": "no-cache", Pragma: "no-cache" };

// Default timeouts (from environment.ts)
const DEFAULT_HTTP_TIMEOUT_MS = 10000; // 10 seconds
const DEFAULT_HTTP_RESET_TIMEOUT_MS = 30000; // 30 seconds

export class CircuitBreakerWrapper {
  private readonly _name: string;
  private readonly _cb: CircuitBreaker;
  private readonly _axiosInstance: AxiosInstance;
  private readonly _defaultTimeoutMs: number;
  private _state = "closed";

  public constructor(
    name: string,
    axiosInstance: AxiosInstance,
    resetTimeoutMs = DEFAULT_HTTP_RESET_TIMEOUT_MS,
    httpTimeoutMs = DEFAULT_HTTP_TIMEOUT_MS
  ) {
    this._name = name;
    this._axiosInstance = axiosInstance;
    this._defaultTimeoutMs = httpTimeoutMs;

    this._cb = new CircuitBreaker(this.internalAction, {
      timeout: httpTimeoutMs,
      resetTimeout: resetTimeoutMs,
      errorFilter: (err) => {
        // Don't trip the breaker on a 404
        return err.response?.status === 404;
      },
    });

    this._cb.on("open", () => {
      log.warn(`[CircuitBreaker] ${name} circuit breaker OPEN`);
      this._state = "open";
    });

    this._cb.on("close", () => {
      log.info(`[CircuitBreaker] ${name} circuit breaker CLOSED`);
      this._state = "closed";
    });

    this._cb.on("halfOpen", () => {
      log.info(`[CircuitBreaker] ${name} circuit breaker HALF-OPEN`);
    });
  }

  public isOpen(): boolean {
    return this._state === "open";
  }

  public enable(): void {
    this._cb.enable();
  }

  public close(): void {
    this._cb.close();
  }

  public async fire<TOUT>(action: () => Promise<TOUT>): Promise<TOUT> {
    return (await this._cb.fire(action)) as TOUT;
  }

  /**
   * GET request returning JSON
   */
  public async getJson<T>(
    url: URL | string,
    headers: Record<string, string | string[]> = {},
    timeoutMs?: number
  ): Promise<T> {
    return this.fire(async () => {
      const config: AxiosRequestConfig = {
        headers: { ...CACHE_CONTROL_HEADERS, ...headers },
        timeout: timeoutMs ?? this._defaultTimeoutMs,
      };

      const response: AxiosResponse<T> = await this._axiosInstance.get(url.toString(), config);
      return response.data;
    });
  }

  /**
   * GET request returning text
   */
  public async getText(url: URL | string, timeoutMs?: number): Promise<string> {
    return this.fire(async () => {
      const config: AxiosRequestConfig = {
        headers: { ...CACHE_CONTROL_HEADERS },
        timeout: timeoutMs ?? this._defaultTimeoutMs,
        responseType: "text",
      };

      const response: AxiosResponse<string> = await this._axiosInstance.get(url.toString(), config);
      return response.data;
    });
  }

  /**
   * POST request with JSON body
   */
  public async postJson<T>(
    url: URL | string,
    body: unknown,
    headers: Record<string, string | string[]> = {},
    timeoutMs?: number
  ): Promise<T> {
    return this.fire(async () => {
      const config: AxiosRequestConfig = {
        headers: { ...headers },
        timeout: timeoutMs ?? this._defaultTimeoutMs,
      };

      const response: AxiosResponse<T> = await this._axiosInstance.post(url.toString(), body, config);
      return response.data;
    });
  }

  /**
   * DELETE request returning JSON
   */
  public async deleteJson<T>(
    url: URL | string,
    headers: Record<string, string | string[]> = {},
    timeoutMs?: number
  ): Promise<T> {
    return this.fire(async () => {
      const config: AxiosRequestConfig = {
        headers: { ...headers },
        timeout: timeoutMs ?? this._defaultTimeoutMs,
      };

      const response: AxiosResponse<T> = await this._axiosInstance.delete(url.toString(), config);
      return response.data;
    });
  }

  private internalAction = (action: () => Promise<any>) => {
    return action?.call(this);
  };
}

export class NetworkService {
  private readonly _axiosInstance: AxiosInstance;

  public constructor() {
    // Create axios instance with sensible defaults
    this._axiosInstance = axios.create({
      validateStatus: (status) => status >= 200 && status < 300, // Default
    });

    // Add response interceptor for logging
    this._axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          log.error(`[NetworkService] HTTP Error ${error.response.status}: ${error.config?.url}`);
        } else if (error.request) {
          log.error(`[NetworkService] No response received: ${error.config?.url}`);
        } else {
          log.error(`[NetworkService] Request setup error: ${error.message}`);
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Create a circuit breaker for a named service
   */
  public getCircuitBreaker(
    name: string,
    resetTimeoutMs: number = DEFAULT_HTTP_RESET_TIMEOUT_MS,
    httpTimeoutMs: number = DEFAULT_HTTP_TIMEOUT_MS
  ): CircuitBreakerWrapper {
    log.debug(`[NetworkService] Creating circuit breaker: ${name} (reset: ${resetTimeoutMs}ms, timeout: ${httpTimeoutMs}ms)`);
    return new CircuitBreakerWrapper(name, this._axiosInstance, resetTimeoutMs, httpTimeoutMs);
  }

  /**
   * Direct GET request for JSON (without circuit breaker)
   */
  public async getJson<T>(url: URL | string, timeoutMs?: number): Promise<T> {
    const config: AxiosRequestConfig = {
      headers: { ...CACHE_CONTROL_HEADERS },
      timeout: timeoutMs ?? DEFAULT_HTTP_TIMEOUT_MS,
    };

    const response: AxiosResponse<T> = await this._axiosInstance.get(url.toString(), config);
    return response.data;
  }

  /**
   * Direct GET request for text (without circuit breaker)
   */
  public async getText(url: URL | string, timeoutMs?: number): Promise<string> {
    const config: AxiosRequestConfig = {
      headers: { ...CACHE_CONTROL_HEADERS },
      timeout: timeoutMs ?? DEFAULT_HTTP_TIMEOUT_MS,
      responseType: "text",
    };

    const response: AxiosResponse<string> = await this._axiosInstance.get(url.toString(), config);
    return response.data;
  }
}

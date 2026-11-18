export type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

export type HttpHeaders = Record<string, string | string[]>;

export interface HttpClientDeps {
  /** Electron's `net.fetch` in the app, so requests go through Chromium's network stack like the renderer's did */
  fetch: FetchFn;
  log: { info(...args: unknown[]): void };
  now?: () => number;
}

/** A response outside 2xx. Carries the status, as the circuit breaker and callers branch on it. */
export class HttpError extends Error {
  public constructor(
    public readonly status: number,
    public readonly url: string,
    public readonly statusText: string,
    /** The response headers, e.g. for GitHub's rate-limit headers */
    public readonly headers: Headers = new Headers(),
  ) {
    super(`Http failure response for ${url}: ${status} ${statusText}`);
    this.name = "HttpError";
  }
}

const CACHE_CONTROL_HEADERS = { "Cache-Control": "no-cache", Pragma: "no-cache" };

/**
 * The main process' HTTP, standing in for Angular's `HttpClient`: json and text bodies, a timeout
 * per request, and the same `[GET] url status ms` log line the renderer's interceptor wrote.
 */
export class HttpClient {
  private readonly _now: () => number;

  public constructor(private readonly _deps: HttpClientDeps) {
    this._now = _deps.now ?? (() => Date.now());
  }

  public async getJson<T>(url: URL | string, headers: HttpHeaders = {}, timeoutMs?: number): Promise<T> {
    const response = await this.send("GET", url, { ...CACHE_CONTROL_HEADERS, ...headers }, undefined, timeoutMs);
    return (await response.json()) as T;
  }

  public async getText(url: URL | string, headers: HttpHeaders = {}, timeoutMs?: number): Promise<string> {
    const response = await this.send("GET", url, { ...CACHE_CONTROL_HEADERS, ...headers }, undefined, timeoutMs);
    return await response.text();
  }

  public async postJson<T>(
    url: URL | string,
    body: unknown,
    headers: HttpHeaders = {},
    timeoutMs?: number,
  ): Promise<T> {
    const response = await this.send(
      "POST",
      url,
      { "Content-Type": "application/json", ...headers },
      JSON.stringify(body),
      timeoutMs,
    );
    return (await response.json()) as T;
  }

  public async deleteJson<T>(url: URL | string, headers: HttpHeaders = {}, timeoutMs?: number): Promise<T> {
    const response = await this.send("DELETE", url, headers, undefined, timeoutMs);
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  /** Just the response headers, e.g. to check what a url serves before downloading it */
  public async head(url: URL | string, timeoutMs?: number): Promise<Headers> {
    const response = await this.send("HEAD", url, {}, undefined, timeoutMs);
    return response.headers;
  }

  private async send(
    method: string,
    url: URL | string,
    headers: HttpHeaders,
    body: string | undefined,
    timeoutMs: number | undefined,
  ): Promise<Response> {
    const urlStr = url.toString();
    const start = this._now();
    const response = await this._deps.fetch(urlStr, {
      method,
      headers: flattenHeaders(headers),
      body,
      signal: timeoutMs !== undefined ? AbortSignal.timeout(timeoutMs) : undefined,
    });

    this._deps.log.info(`[${method}] ${urlStr} ${response.status} ${this._now() - start}ms`);

    if (!response.ok) {
      throw new HttpError(response.status, urlStr, response.statusText, response.headers);
    }
    return response;
  }
}

/** fetch wants one value per header; Angular joined repeats with a comma, so do the same */
function flattenHeaders(headers: HttpHeaders): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    flat[name] = Array.isArray(value) ? value.join(",") : value;
  }
  return flat;
}

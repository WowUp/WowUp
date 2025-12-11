import { Injectable } from "@angular/core";
import { from, Observable } from "rxjs";

/**
 * HTTP-like methods for IPC routing
 */
export type IpcMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Standard response format from IpcRouter
 */
export interface IpcResponseData<TData = any> {
  success: boolean;
  data?: TData;
  error?: {
    message: string;
    code?: number;
    details?: any;
  };
}

/**
 * Options for IPC calls
 */
export interface IpcCallOptions {
  params?: Record<string, any>;
  query?: Record<string, any>;
}

/**
 * Angular service for making REST-like IPC calls to the main process
 *
 * This service works with the IpcRouter in the main process to provide
 * a clean, REST-like API for communication between renderer and main processes.
 *
 * @example
 * ```typescript
 * // In your component or service
 * constructor(private ipcClient: IpcRouterClientService) {}
 *
 * async loadAddons() {
 *   const addons = await this.ipcClient.get('/api/addons/list');
 *   console.log(addons);
 * }
 *
 * async createAddon(addon: Addon) {
 *   const result = await this.ipcClient.post('/api/addons', addon);
 *   return result;
 * }
 * ```
 */
@Injectable({
  providedIn: "root",
})
export class IpcRouterClientService {
  /**
   * Make a generic IPC call using REST-like method and path
   *
   * @param method - HTTP-like method (GET, POST, PUT, PATCH, DELETE)
   * @param path - The route path (e.g., '/api/addons/list')
   * @param body - Optional request body
   * @param options - Optional params and query parameters
   * @returns Promise with the response data
   */
  public async call<TResponse = any, TBody = any>(
    method: IpcMethod,
    path: string,
    body?: TBody,
    options?: IpcCallOptions
  ): Promise<TResponse> {
    const channel = this.pathToChannel(method, path);

    const payload = {
      body: body ?? {},
      params: options?.params ?? {},
      query: options?.query ?? {},
    };

    try {
      const response: IpcResponseData<TResponse> = await window.wowup.rendererInvoke(channel, payload);

      if (!response.success) {
        const error = new Error(response.error?.message || "IPC call failed");
        (error as any).code = response.error?.code;
        (error as any).details = response.error?.details;
        throw error;
      }

      return response.data as TResponse;
    } catch (error: any) {
      console.error(`[IpcRouter] ${method} ${path} failed:`, error);
      throw error;
    }
  }

  /**
   * Make a generic IPC call and return as Observable
   *
   * @param method - HTTP-like method (GET, POST, PUT, PATCH, DELETE)
   * @param path - The route path (e.g., '/api/addons/list')
   * @param body - Optional request body
   * @param options - Optional params and query parameters
   * @returns Observable with the response data
   */
  public call$<TResponse = any, TBody = any>(
    method: IpcMethod,
    path: string,
    body?: TBody,
    options?: IpcCallOptions
  ): Observable<TResponse> {
    return from(this.call<TResponse, TBody>(method, path, body, options));
  }

  /**
   * Make a GET request
   *
   * @param path - The route path (e.g., '/api/addons/list')
   * @param query - Optional query parameters
   * @returns Promise with the response data
   */
  public get<TResponse = any>(path: string, query?: Record<string, any>): Promise<TResponse> {
    return this.call<TResponse>("GET", path, undefined, { query });
  }

  /**
   * Make a GET request and return as Observable
   *
   * @param path - The route path (e.g., '/api/addons/list')
   * @param query - Optional query parameters
   * @returns Observable with the response data
   */
  public get$<TResponse = any>(path: string, query?: Record<string, any>): Observable<TResponse> {
    return from(this.get<TResponse>(path, query));
  }

  /**
   * Make a POST request
   *
   * @param path - The route path (e.g., '/api/addons')
   * @param body - Request body
   * @returns Promise with the response data
   */
  public post<TResponse = any, TBody = any>(path: string, body?: TBody): Promise<TResponse> {
    return this.call<TResponse, TBody>("POST", path, body);
  }

  /**
   * Make a POST request and return as Observable
   *
   * @param path - The route path (e.g., '/api/addons')
   * @param body - Request body
   * @returns Observable with the response data
   */
  public post$<TResponse = any, TBody = any>(path: string, body?: TBody): Observable<TResponse> {
    return from(this.post<TResponse, TBody>(path, body));
  }

  /**
   * Make a PUT request
   *
   * @param path - The route path (e.g., '/api/addons/123')
   * @param body - Request body
   * @returns Promise with the response data
   */
  public put<TResponse = any, TBody = any>(path: string, body?: TBody): Promise<TResponse> {
    return this.call<TResponse, TBody>("PUT", path, body);
  }

  /**
   * Make a PUT request and return as Observable
   *
   * @param path - The route path (e.g., '/api/addons/123')
   * @param body - Request body
   * @returns Observable with the response data
   */
  public put$<TResponse = any, TBody = any>(path: string, body?: TBody): Observable<TResponse> {
    return from(this.put<TResponse, TBody>(path, body));
  }

  /**
   * Make a PATCH request
   *
   * @param path - The route path (e.g., '/api/addons/123')
   * @param body - Request body
   * @returns Promise with the response data
   */
  public patch<TResponse = any, TBody = any>(path: string, body?: TBody): Promise<TResponse> {
    return this.call<TResponse, TBody>("PATCH", path, body);
  }

  /**
   * Make a PATCH request and return as Observable
   *
   * @param path - The route path (e.g., '/api/addons/123')
   * @param body - Request body
   * @returns Observable with the response data
   */
  public patch$<TResponse = any, TBody = any>(path: string, body?: TBody): Observable<TResponse> {
    return from(this.patch<TResponse, TBody>(path, body));
  }

  /**
   * Make a DELETE request
   *
   * @param path - The route path (e.g., '/api/addons/123')
   * @returns Promise with the response data
   */
  public delete<TResponse = any>(path: string): Promise<TResponse> {
    return this.call<TResponse>("DELETE", path);
  }

  /**
   * Make a DELETE request and return as Observable
   *
   * @param path - The route path (e.g., '/api/addons/123')
   * @returns Observable with the response data
   */
  public delete$<TResponse = any>(path: string): Observable<TResponse> {
    return from(this.delete<TResponse>(path));
  }

  /**
   * Convert REST path and method to IPC channel name
   * Example: GET /api/addons/list -> api:addons:list:get
   */
  private pathToChannel(method: IpcMethod, path: string): string {
    return `${path.replace(/^\//, "").replace(/\//g, ":")}:${method.toLowerCase()}`;
  }
}

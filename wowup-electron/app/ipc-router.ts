import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from "electron";
import * as log from "electron-log/main";

/**
 * HTTP-like methods for IPC routing
 */
export type IpcMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Request context passed to route handlers, similar to Express req/res
 */
export interface IpcRequest<TBody = any, TParams = any> {
  /** The original IPC event */
  event: IpcMainInvokeEvent;
  /** Request body (payload) */
  body: TBody;
  /** Route parameters extracted from the path */
  params: TParams;
  /** Query parameters */
  query: Record<string, any>;
  /** The matched route path */
  path: string;
  /** The HTTP-like method */
  method: IpcMethod;
}

/**
 * Response helper for sending data back to renderer
 */
export interface IpcResponse<TData = any> {
  /** Send a successful response */
  success(data: TData): IpcResponseData<TData>;
  /** Send an error response */
  error(message: string, code?: number, details?: any): IpcResponseData<never>;
  /** Send a custom response */
  send(response: IpcResponseData<TData>): IpcResponseData<TData>;
}

/**
 * Standard response format
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
 * Route handler function signature
 */
export type IpcRouteHandler<TBody = any, TParams = any, TResponse = any> = (
  req: IpcRequest<TBody, TParams>,
  res: IpcResponse<TResponse>
) => Promise<IpcResponseData<TResponse>> | IpcResponseData<TResponse>;

/**
 * Middleware function signature
 */
export type IpcMiddleware = (
  req: IpcRequest,
  res: IpcResponse,
  next: () => void | Promise<void>
) => void | Promise<void>;

/**
 * Internal route definition
 */
interface Route {
  method: IpcMethod;
  path: string;
  channel: string;
  handler: IpcRouteHandler;
  middlewares: IpcMiddleware[];
}

/**
 * REST-like IPC Router for Electron
 *
 * Provides a familiar web API style interface for handling IPC communication
 * between renderer and main processes.
 *
 * @example
 * ```typescript
 * const router = new IpcRouter('/api/addons');
 *
 * router.get('/list', async (req, res) => {
 *   const addons = await getAddons();
 *   return res.success(addons);
 * });
 *
 * router.post('/install', async (req, res) => {
 *   const { addonId } = req.body;
 *   await installAddon(addonId);
 *   return res.success({ installed: true });
 * });
 *
 * router.register(mainWindow);
 * ```
 */
export class IpcRouter {
  private routes: Route[] = [];
  private middlewares: IpcMiddleware[] = [];
  private baseChannel: string;

  /**
   * @param baseChannel - Base channel prefix for all routes (e.g., '/api/addons')
   */
  constructor(baseChannel: string = "") {
    this.baseChannel = baseChannel.replace(/\/$/, ""); // Remove trailing slash
  }

  /**
   * Add global middleware to run before all route handlers
   */
  use(middleware: IpcMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Register a GET route
   */
  get<TBody = any, TParams = any, TResponse = any>(
    path: string,
    handler: IpcRouteHandler<TBody, TParams, TResponse>
  ): this {
    return this.addRoute("GET", path, handler);
  }

  /**
   * Register a POST route
   */
  post<TBody = any, TParams = any, TResponse = any>(
    path: string,
    handler: IpcRouteHandler<TBody, TParams, TResponse>
  ): this {
    return this.addRoute("POST", path, handler);
  }

  /**
   * Register a PUT route
   */
  put<TBody = any, TParams = any, TResponse = any>(
    path: string,
    handler: IpcRouteHandler<TBody, TParams, TResponse>
  ): this {
    return this.addRoute("PUT", path, handler);
  }

  /**
   * Register a PATCH route
   */
  patch<TBody = any, TParams = any, TResponse = any>(
    path: string,
    handler: IpcRouteHandler<TBody, TParams, TResponse>
  ): this {
    return this.addRoute("PATCH", path, handler);
  }

  /**
   * Register a DELETE route
   */
  delete<TBody = any, TParams = any, TResponse = any>(
    path: string,
    handler: IpcRouteHandler<TBody, TParams, TResponse>
  ): this {
    return this.addRoute("DELETE", path, handler);
  }

  /**
   * Register route with any method
   */
  route<TBody = any, TParams = any, TResponse = any>(
    method: IpcMethod,
    path: string,
    handler: IpcRouteHandler<TBody, TParams, TResponse>
  ): this {
    return this.addRoute(method, path, handler);
  }

  /**
   * Internal method to add a route
   */
  private addRoute(method: IpcMethod, path: string, handler: IpcRouteHandler): this {
    const fullPath = `${this.baseChannel}${path}`;
    const channel = this.pathToChannel(method, fullPath);

    this.routes.push({
      method,
      path: fullPath,
      channel,
      handler,
      middlewares: [...this.middlewares],
    });

    log.info(`[IpcRouter] Registered ${method} ${fullPath} -> ${channel}`);
    return this;
  }

  /**
   * Convert REST path to IPC channel name
   * Example: GET /api/addons/list -> api:addons:list:get
   */
  private pathToChannel(method: IpcMethod, path: string): string {
    return `${path.replace(/^\//, "").replace(/\//g, ":")}:${method.toLowerCase()}`;
  }

  /**
   * Extract parameters from path pattern
   * Example: /addons/:id/files/:fileId with /addons/123/files/456
   * Returns: { id: '123', fileId: '456' }
   */
  private extractParams(pattern: string, path: string): Record<string, string> {
    const params: Record<string, string> = {};
    const patternParts = pattern.split("/");
    const pathParts = path.split("/");

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(":")) {
        const paramName = patternParts[i].slice(1);
        params[paramName] = pathParts[i];
      }
    }

    return params;
  }

  /**
   * Create response helper object
   */
  private createResponse<TData = any>(): IpcResponse<TData> {
    return {
      success: (data: TData): IpcResponseData<TData> => ({
        success: true,
        data,
      }),
      error: (message: string, code?: number, details?: any): IpcResponseData<never> => ({
        success: false,
        error: {
          message,
          code,
          details,
        },
      }),
      send: (response: IpcResponseData<TData>): IpcResponseData<TData> => response,
    };
  }

  /**
   * Execute middleware chain
   */
  private async executeMiddlewares(
    middlewares: IpcMiddleware[],
    req: IpcRequest,
    res: IpcResponse
  ): Promise<void> {
    let index = 0;

    const next = async (): Promise<void> => {
      if (index >= middlewares.length) {
        return;
      }

      const middleware = middlewares[index];
      index++;
      await middleware(req, res, next);
    };

    await next();
  }

  /**
   * Register all routes with Electron's ipcMain
   * Call this after defining all routes
   */
  register(window?: BrowserWindow): void {
    for (const route of this.routes) {
      ipcMain.handle(route.channel, async (event, payload?: any) => {
        const req: IpcRequest = {
          event,
          body: payload?.body ?? payload ?? {},
          params: payload?.params ?? {},
          query: payload?.query ?? {},
          path: route.path,
          method: route.method,
        };

        const res = this.createResponse();

        try {
          // Execute middlewares
          await this.executeMiddlewares(route.middlewares, req, res);

          // Execute route handler
          const result = await route.handler(req, res);
          return result;
        } catch (error: any) {
          log.error(`[IpcRouter] Error in ${route.method} ${route.path}:`, error);
          return res.error(
            error.message || "Internal server error",
            error.code || 500,
            error.stack
          );
        }
      });
    }

    log.info(`[IpcRouter] Registered ${this.routes.length} routes`);
  }

  /**
   * Unregister all routes from ipcMain
   */
  unregister(): void {
    for (const route of this.routes) {
      ipcMain.removeHandler(route.channel);
    }
    log.info(`[IpcRouter] Unregistered ${this.routes.length} routes`);
  }

  /**
   * Get all registered routes (useful for debugging)
   */
  getRoutes(): Array<{ method: IpcMethod; path: string; channel: string }> {
    return this.routes.map((route) => ({
      method: route.method,
      path: route.path,
      channel: route.channel,
    }));
  }
}

/**
 * Helper to create an IPC client call from renderer side
 *
 * @example
 * ```typescript
 * // In renderer process
 * const addons = await ipcCall('GET', '/api/addons/list');
 * const result = await ipcCall('POST', '/api/addons/install', { addonId: '123' });
 * ```
 */
// export function createIpcClient() {
//   return {
//     /**
//      * Make an IPC call using REST-like method and path
//      */
//     async call<TResponse = any, TBody = any>(
//       method: IpcMethod,
//       path: string,
//       body?: TBody,
//       options?: { params?: any; query?: any }
//     ): Promise<TResponse> {
//       const channel = `${path.replace(/^\//, "").replace(/\//g, ":")}:${method.toLowerCase()}`;

//       const payload = {
//         body: body ?? {},
//         params: options?.params ?? {},
//         query: options?.query ?? {},
//       };

//       // This would be called from renderer via window.wowup.rendererInvoke
//       const response: IpcResponseData<TResponse> = await (window as any).wowup.rendererInvoke(
//         channel,
//         payload
//       );

//       if (!response.success) {
//         throw new Error(response.error?.message || "IPC call failed");
//       }

//       return response.data as TResponse;
//     },

//     get<TResponse = any>(path: string, query?: any): Promise<TResponse> {
//       return this.call<TResponse>("GET", path, undefined, { query });
//     },

//     post<TResponse = any, TBody = any>(path: string, body?: TBody): Promise<TResponse> {
//       return this.call<TResponse, TBody>("POST", path, body);
//     },

//     put<TResponse = any, TBody = any>(path: string, body?: TBody): Promise<TResponse> {
//       return this.call<TResponse, TBody>("PUT", path, body);
//     },

//     patch<TResponse = any, TBody = any>(path: string, body?: TBody): Promise<TResponse> {
//       return this.call<TResponse, TBody>("PATCH", path, body);
//     },

//     delete<TResponse = any>(path: string): Promise<TResponse> {
//       return this.call<TResponse>("DELETE", path);
//     },
//   };
// }

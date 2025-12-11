# IPC Router - REST-like API for Electron IPC

A REST-like routing system for Electron IPC communication that makes main-to-renderer communication feel like working with a web API (Express.js style).

## Overview

The IpcRouter provides:
- **REST-like methods**: GET, POST, PUT, PATCH, DELETE
- **Express-style routing**: Familiar route handlers with `req` and `res` parameters
- **Middleware support**: Add global or route-specific middleware
- **Type safety**: Full TypeScript support with generics
- **Standardized responses**: Consistent success/error response format
- **Path parameters**: Extract dynamic segments from routes (e.g., `/addons/:id`)
- **Query parameters**: Support for URL-style query params

## Why Use IpcRouter?

### Before (Traditional IPC):

**Main Process:**
```typescript
// Scattered throughout main.ts
ipcMain.handle('addon-get', async (evt, id: string) => {
  return getAddon(id);
});

ipcMain.handle('addon-save', async (evt, addon: Addon) => {
  saveAddon(addon);
});

ipcMain.handle('addon-delete', async (evt, id: string) => {
  deleteAddon(id);
});
```

**Renderer Process:**
```typescript
// Hard to discover what channels exist
const addon = await window.wowup.rendererInvoke('addon-get', '123');
await window.wowup.rendererInvoke('addon-save', addonData);
```

### After (With IpcRouter):

**Main Process:**
```typescript
const router = new IpcRouter('/api/addons');

router.get('/:id', async (req, res) => {
  const addon = await getAddon(req.params.id);
  return res.success(addon);
});

router.post('/', async (req, res) => {
  await saveAddon(req.body);
  return res.success({ message: 'Saved successfully' });
});

router.delete('/:id', async (req, res) => {
  await deleteAddon(req.params.id);
  return res.success({ message: 'Deleted' });
});

router.register(window);
```

**Renderer Process:**
```typescript
const api = createIpcClient();

// Clean, discoverable API
const addon = await api.get('/api/addons/123');
await api.post('/api/addons', addonData);
await api.delete('/api/addons/123');
```

## Installation & Setup

### 1. Create a Controller

Create a new file for your API routes (e.g., `app/controllers/addon-controller.ts`):

```typescript
import { BrowserWindow } from "electron";
import { IpcRouter } from "../ipc-router";

export function createAddonController(window: BrowserWindow): IpcRouter {
  const router = new IpcRouter("/api/addons");

  // Add middleware (optional)
  router.use(async (req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    await next();
  });

  // Define routes
  router.get("/list", async (req, res) => {
    const addons = await getAllAddons();
    return res.success(addons);
  });

  router.post("/", async (req, res) => {
    const addon = await createAddon(req.body);
    return res.success(addon);
  });

  return router;
}
```

### 2. Register in Main Process

In [app/main.ts](app/main.ts), register your controller:

```typescript
import { createAddonController } from "./controllers/addon-controller";

export function initializeIpcHandlers(window: BrowserWindow): void {
  // ... existing handlers ...

  // Register REST-like API controllers
  const addonController = createAddonController(window);
  addonController.register(window);
}
```

### 3. Use from Renderer Process

Create a service in your renderer process:

```typescript
import { createIpcClient } from "../../app/ipc-router";

const api = createIpcClient();

export class AddonService {
  async getAddons() {
    return await api.get('/api/addons/list');
  }

  async createAddon(addon: Addon) {
    return await api.post('/api/addons', addon);
  }

  async updateAddon(id: string, updates: Partial<Addon>) {
    return await api.put(`/api/addons/${id}`, updates);
  }

  async deleteAddon(id: string) {
    return await api.delete(`/api/addons/${id}`);
  }
}
```

## API Reference

### IpcRouter Class

#### Constructor

```typescript
const router = new IpcRouter(baseChannel?: string);
```

- `baseChannel`: Optional prefix for all routes (e.g., `/api/addons`)

#### Methods

**Route Registration:**

```typescript
router.get(path, handler)    // GET requests
router.post(path, handler)   // POST requests
router.put(path, handler)    // PUT requests
router.patch(path, handler)  // PATCH requests
router.delete(path, handler) // DELETE requests
```

**Middleware:**

```typescript
router.use(middleware)  // Add global middleware
```

**Management:**

```typescript
router.register(window)    // Register all routes with ipcMain
router.unregister()        // Unregister all routes
router.getRoutes()         // Get list of registered routes
```

### Request Object

The `req` parameter in route handlers contains:

```typescript
interface IpcRequest<TBody, TParams> {
  event: IpcMainInvokeEvent;  // Original Electron event
  body: TBody;                 // Request payload
  params: TParams;             // URL parameters (:id)
  query: Record<string, any>;  // Query string params
  path: string;                // Matched route path
  method: IpcMethod;           // HTTP-like method
}
```

### Response Object

The `res` parameter provides helper methods:

```typescript
interface IpcResponse<TData> {
  success(data: TData): IpcResponseData<TData>;
  error(message: string, code?: number, details?: any): IpcResponseData;
  send(response: IpcResponseData<TData>): IpcResponseData<TData>;
}
```

**Response Format:**

```typescript
{
  success: boolean;
  data?: any;           // Present on success
  error?: {             // Present on error
    message: string;
    code?: number;
    details?: any;
  }
}
```

## Examples

### Basic CRUD Operations

```typescript
const router = new IpcRouter("/api/users");

// List all
router.get("/", async (req, res) => {
  const users = await db.getAllUsers();
  return res.success(users);
});

// Get by ID
router.get("/:id", async (req, res) => {
  const user = await db.getUser(req.params.id);
  if (!user) {
    return res.error("User not found", 404);
  }
  return res.success(user);
});

// Create
router.post("/", async (req, res) => {
  const user = await db.createUser(req.body);
  return res.success(user);
});

// Update
router.put("/:id", async (req, res) => {
  const user = await db.updateUser(req.params.id, req.body);
  return res.success(user);
});

// Delete
router.delete("/:id", async (req, res) => {
  await db.deleteUser(req.params.id);
  return res.success({ message: "Deleted successfully" });
});

router.register(window);
```

### Using Middleware

**Logging middleware:**

```typescript
router.use(async (req, res, next) => {
  console.log(`[API] ${req.method} ${req.path}`);
  await next();
});
```

**Authentication middleware:**

```typescript
router.use(async (req, res, next) => {
  const token = req.body.token;
  if (!isValidToken(token)) {
    throw new Error("Unauthorized");
  }
  await next();
});
```

**Validation middleware:**

```typescript
router.use(async (req, res, next) => {
  if (req.method === "POST" && !req.body.name) {
    throw new Error("Name is required");
  }
  await next();
});
```

### Query Parameters

```typescript
// Route definition
router.get("/search", async (req, res) => {
  const { name, type, limit = 10 } = req.query;

  const results = await searchAddons({
    name,
    type,
    limit: parseInt(limit)
  });

  return res.success(results);
});

// Renderer usage
const results = await api.get('/api/addons/search', {
  name: 'questie',
  type: 'quest',
  limit: 20
});
```

### Error Handling

Errors thrown in handlers are automatically caught and returned as error responses:

```typescript
router.get("/:id", async (req, res) => {
  const addon = await getAddon(req.params.id);

  if (!addon) {
    // Option 1: Use res.error
    return res.error("Addon not found", 404);
  }

  // Option 2: Throw an error (will be caught automatically)
  if (!addon.isValid) {
    throw new Error("Invalid addon data");
  }

  return res.success(addon);
});
```

### Type Safety with Generics

```typescript
interface CreateAddonRequest {
  name: string;
  version: string;
  url: string;
}

interface AddonResponse {
  id: string;
  name: string;
  version: string;
  createdAt: Date;
}

router.post<CreateAddonRequest, {}, AddonResponse>(
  "/",
  async (req, res) => {
    // req.body is typed as CreateAddonRequest
    const { name, version, url } = req.body;

    const addon = await createAddon({ name, version, url });

    // Return type is enforced as AddonResponse
    return res.success({
      id: addon.id,
      name: addon.name,
      version: addon.version,
      createdAt: addon.createdAt
    });
  }
);
```

## Renderer-Side Clients

### Angular Client (Recommended for Angular App)

For the Angular renderer app, use the **IpcRouterClientService**:

```typescript
import { Component } from '@angular/core';
import { IpcRouterClientService } from './services/ipc-router/ipc-router-client.service';

@Component({
  selector: 'app-my-component',
  templateUrl: './my-component.component.html'
})
export class MyComponent {
  constructor(private ipcClient: IpcRouterClientService) {}

  async loadData() {
    // GET request
    const addons = await this.ipcClient.get('/api/addons/list');

    // POST request
    const result = await this.ipcClient.post('/api/addons', {
      name: 'MyAddon',
      version: '1.0.0'
    });

    // Observable variant (for use with async pipe)
    this.addons$ = this.ipcClient.get$('/api/addons/list');
  }
}
```

**See the [Angular IPC Router Client Documentation](../src/app/services/ipc-router/README.md) for complete Angular usage guide.**

### Vanilla JavaScript Client

For non-Angular renderer code, use **createIpcClient()**:

```typescript
import { createIpcClient } from "../../app/ipc-router";

const api = createIpcClient();

// GET request
const addons = await api.get('/api/addons/list');

// POST request
const result = await api.post('/api/addons', {
  name: 'MyAddon',
  version: '1.0.0'
});

// PUT request
await api.put('/api/addons/123', { version: '1.0.1' });

// DELETE request
await api.delete('/api/addons/123');

// With query params
const results = await api.get('/api/addons/search', {
  name: 'questie'
});
```

### Error Handling in Renderer

```typescript
try {
  const addon = await api.get('/api/addons/123');
  console.log(addon);
} catch (error) {
  // Error message from server
  console.error(error.message);
}
```

### Creating a Service Class

```typescript
export class AddonApiService {
  private api = createIpcClient();

  async getAllAddons() {
    const response = await this.api.get('/api/addons/list');
    return response.addons;
  }

  async getAddon(id: string) {
    return await this.api.get(`/api/addons/${id}`);
  }

  async createAddon(addon: CreateAddonDto) {
    return await this.api.post('/api/addons', addon);
  }

  async updateAddon(id: string, updates: UpdateAddonDto) {
    return await this.api.put(`/api/addons/${id}`, updates);
  }

  async deleteAddon(id: string) {
    return await this.api.delete(`/api/addons/${id}`);
  }

  async searchAddons(query: SearchQuery) {
    return await this.api.get('/api/addons/search', query);
  }
}
```

## Best Practices

### 1. Organize by Feature

Create separate controllers for different features:

```
app/
  controllers/
    addon-controller.ts
    file-controller.ts
    window-controller.ts
    settings-controller.ts
```

### 2. Use Middleware for Cross-Cutting Concerns

```typescript
// Logging
router.use(loggerMiddleware);

// Validation
router.use(validationMiddleware);

// Error tracking
router.use(errorTrackingMiddleware);
```

### 3. Standardize Response Shapes

```typescript
// Good: Consistent response structure
return res.success({
  items: addons,
  total: addons.length,
  page: 1
});

// Avoid: Inconsistent responses
return res.success(addons);  // Sometimes array
return res.success({ addons });  // Sometimes object
```

### 4. Use Path Parameters for Resources

```typescript
// Good: RESTful style
router.get('/addons/:id', ...)
router.delete('/addons/:id', ...)

// Avoid: Query params for IDs
router.get('/addons', ...) // then use req.query.id
```

### 5. Leverage TypeScript

```typescript
interface GetAddonParams {
  id: string;
}

interface GetAddonResponse {
  addon: Addon;
  lastUpdated: Date;
}

router.get<{}, GetAddonParams, GetAddonResponse>(
  '/:id',
  async (req, res) => {
    // Full type safety
  }
);
```

## Migration Guide

### Migrating Existing IPC Handlers

**Old code:**
```typescript
handle(IPC_GET_ADDON, async (evt, id: string) => {
  return await getAddon(id);
});
```

**New code:**
```typescript
router.get('/:id', async (req, res) => {
  const addon = await getAddon(req.params.id);
  return res.success(addon);
});
```

**Renderer update:**
```typescript
// Old
const addon = await window.wowup.rendererInvoke(IPC_GET_ADDON, '123');

// New
const addon = await api.get('/api/addons/123');
```

## Debugging

### View Registered Routes

```typescript
const routes = router.getRoutes();
console.log(routes);
// [
//   { method: 'GET', path: '/api/addons/list', channel: 'api:addons:list:get' },
//   { method: 'POST', path: '/api/addons', channel: 'api:addons:post' },
//   ...
// ]
```

### Enable Logging

IpcRouter automatically logs route registration and errors using `electron-log`:

```
[IpcRouter] Registered GET /api/addons/list -> api:addons:list:get
[IpcRouter] Registered POST /api/addons -> api:addons:post
[IpcRouter] Registered 5 routes
```

## Advanced Features

### Custom Response Format

```typescript
router.get('/custom', async (req, res) => {
  return res.send({
    success: true,
    data: { customField: 'value' },
    metadata: { timestamp: Date.now() }
  });
});
```

### Multiple Routers

```typescript
const addonRouter = new IpcRouter('/api/addons');
const fileRouter = new IpcRouter('/api/files');
const settingsRouter = new IpcRouter('/api/settings');

addonRouter.register(window);
fileRouter.register(window);
settingsRouter.register(window);
```

### Nested Routes

```typescript
const router = new IpcRouter('/api/addons');

router.get('/:addonId/files', async (req, res) => {
  const files = await getAddonFiles(req.params.addonId);
  return res.success(files);
});

router.get('/:addonId/files/:fileId', async (req, res) => {
  const file = await getAddonFile(
    req.params.addonId,
    req.params.fileId
  );
  return res.success(file);
});
```

## Performance Considerations

- Route handlers run in the main process (not blocking renderer)
- Middleware runs sequentially (keep middleware fast)
- Large data transfers should use streams (not this API)
- Consider batching for bulk operations

## Comparison with Traditional IPC

| Feature | Traditional IPC | IpcRouter |
|---------|----------------|-----------|
| Route organization | Scattered | Centralized in controllers |
| Discoverability | Channel strings | REST-like paths |
| Error handling | Manual | Automatic |
| Middleware | Manual | Built-in |
| Type safety | Partial | Full with generics |
| Response format | Inconsistent | Standardized |
| Path parameters | Manual parsing | Automatic |

## Troubleshooting

**Issue: Routes not responding**
- Ensure `router.register(window)` is called
- Check route path matches renderer call
- Verify method (GET/POST/etc.) matches

**Issue: Type errors in renderer**
- Make sure IpcRouter is exported from main
- Check TypeScript compiler is including the file
- Verify generics are properly specified

**Issue: Middleware not running**
- Middleware must call `next()` to continue
- Check middleware is added before routes
- Ensure middleware doesn't throw unhandled errors

## License

MIT - Part of WowUp Electron Project

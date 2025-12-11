# IPC Router Client for Angular

Angular service for making REST-like IPC calls to Electron's main process using the IpcRouter system.

## Overview

The `IpcRouterClientService` provides a clean, Angular-friendly interface for communicating with the main process via IPC, using familiar REST-like HTTP methods (GET, POST, PUT, PATCH, DELETE).

## Quick Start

### 1. Service is Already Registered

The `IpcRouterClientService` uses `providedIn: 'root'`, so it's automatically available throughout your Angular app. No need to add it to providers.

### 2. Inject in Your Component or Service

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
    const data = await this.ipcClient.get('/api/addons/list');
    console.log(data);
  }
}
```

### 3. Make IPC Calls

```typescript
// GET request
const addons = await this.ipcClient.get('/api/addons/list');

// POST request
const result = await this.ipcClient.post('/api/addons', {
  name: 'MyAddon',
  version: '1.0.0'
});

// PUT request
await this.ipcClient.put('/api/addons/123', { version: '2.0.0' });

// DELETE request
await this.ipcClient.delete('/api/addons/123');

// GET with query params
const results = await this.ipcClient.get('/api/addons/search', {
  name: 'questie',
  provider: 'Curse'
});
```

## API Reference

### Methods (Promise-based)

```typescript
// Generic call
ipcClient.call<TResponse, TBody>(method, path, body?, options?): Promise<TResponse>

// HTTP-like methods
ipcClient.get<TResponse>(path, query?): Promise<TResponse>
ipcClient.post<TResponse, TBody>(path, body?): Promise<TResponse>
ipcClient.put<TResponse, TBody>(path, body?): Promise<TResponse>
ipcClient.patch<TResponse, TBody>(path, body?): Promise<TResponse>
ipcClient.delete<TResponse>(path): Promise<TResponse>
```

### Methods (Observable-based)

For use with RxJS operators and Angular's async pipe:

```typescript
// Generic call
ipcClient.call$<TResponse, TBody>(method, path, body?, options?): Observable<TResponse>

// HTTP-like methods
ipcClient.get$<TResponse>(path, query?): Observable<TResponse>
ipcClient.post$<TResponse, TBody>(path, body?): Observable<TResponse>
ipcClient.put$<TResponse, TBody>(path, body?): Observable<TResponse>
ipcClient.patch$<TResponse, TBody>(path, body?): Observable<TResponse>
ipcClient.delete$<TResponse>(path): Observable<TResponse>
```

## Creating API Services

### Basic Pattern

Create dedicated services for different API domains:

```typescript
import { Injectable } from '@angular/core';
import { IpcRouterClientService } from './ipc-router-client.service';
import { Addon } from 'wowup-lib-core';

@Injectable({
  providedIn: 'root'
})
export class AddonApiService {
  constructor(private ipcClient: IpcRouterClientService) {}

  async getAllAddons(): Promise<Addon[]> {
    const response = await this.ipcClient.get<{ addons: Addon[] }>('/api/addons/list');
    return response.addons;
  }

  async getAddon(id: string): Promise<Addon> {
    return await this.ipcClient.get<Addon>(`/api/addons/${id}`);
  }

  async createAddon(addon: Addon): Promise<Addon> {
    return await this.ipcClient.post<Addon>('/api/addons', addon);
  }

  async updateAddon(id: string, updates: Partial<Addon>): Promise<Addon> {
    return await this.ipcClient.put<Addon>(`/api/addons/${id}`, updates);
  }

  async deleteAddon(id: string): Promise<void> {
    await this.ipcClient.delete(`/api/addons/${id}`);
  }
}
```

### With Type Safety

Define interfaces for request/response types:

```typescript
interface AddonListResponse {
  addons: Addon[];
  count: number;
  page: number;
}

interface CreateAddonRequest {
  name: string;
  version: string;
  url: string;
}

@Injectable({ providedIn: 'root' })
export class AddonApiService {
  constructor(private ipcClient: IpcRouterClientService) {}

  async getAllAddons(): Promise<AddonListResponse> {
    return await this.ipcClient.get<AddonListResponse>('/api/addons/list');
  }

  async createAddon(request: CreateAddonRequest): Promise<Addon> {
    return await this.ipcClient.post<Addon, CreateAddonRequest>('/api/addons', request);
  }
}
```

## Using with Observables

### With async Pipe

```typescript
@Component({
  selector: 'app-addon-list',
  template: `
    <div *ngIf="addons$ | async as response">
      <p>Total: {{ response.count }}</p>
      <div *ngFor="let addon of response.addons">
        {{ addon.name }}
      </div>
    </div>
  `
})
export class AddonListComponent {
  addons$: Observable<AddonListResponse>;

  constructor(private ipcClient: IpcRouterClientService) {
    this.addons$ = this.ipcClient.get$<AddonListResponse>('/api/addons/list');
  }
}
```

### With RxJS Operators

```typescript
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-addon-names',
  template: `
    <ul>
      <li *ngFor="let name of addonNames$ | async">{{ name }}</li>
    </ul>
  `
})
export class AddonNamesComponent {
  addonNames$: Observable<string[]>;

  constructor(private ipcClient: IpcRouterClientService) {
    this.addonNames$ = this.ipcClient.get$<{ addons: Addon[] }>('/api/addons/list').pipe(
      map(response => response.addons.map(addon => addon.name)),
      catchError(error => {
        console.error('Failed to load addons:', error);
        return of([]);
      })
    );
  }
}
```

## Error Handling

### Basic Try-Catch

```typescript
async loadAddons() {
  try {
    const addons = await this.ipcClient.get<Addon[]>('/api/addons/list');
    this.addons = addons;
  } catch (error: any) {
    console.error('Failed to load addons:', error.message);
    this.showErrorMessage(error.message);
  }
}
```

### With Error Codes

```typescript
async createAddon(addon: Addon) {
  try {
    const result = await this.ipcClient.post<Addon>('/api/addons', addon);
    this.showSuccess('Addon created successfully');
    return result;
  } catch (error: any) {
    if (error.code === 400) {
      this.showError('Validation error: ' + error.message);
    } else if (error.code === 404) {
      this.showError('Resource not found');
    } else if (error.code === 500) {
      this.showError('Server error occurred');
    } else {
      this.showError('Unexpected error: ' + error.message);
    }
    throw error;
  }
}
```

### With RxJS Error Handling

```typescript
this.addons$ = this.ipcClient.get$<AddonListResponse>('/api/addons/list').pipe(
  catchError((error: any) => {
    console.error('Failed to load addons:', error);
    this.notificationService.showError(error.message);
    return of({ addons: [], count: 0 }); // Return empty result
  })
);
```

## Advanced Usage

### Loading States

```typescript
@Component({
  selector: 'app-addon-list',
  template: `
    <div *ngIf="loading">Loading...</div>
    <div *ngIf="!loading && error">Error: {{ error }}</div>
    <div *ngIf="!loading && !error">
      <div *ngFor="let addon of addons">{{ addon.name }}</div>
    </div>
  `
})
export class AddonListComponent implements OnInit {
  addons: Addon[] = [];
  loading = false;
  error: string | null = null;

  constructor(private ipcClient: IpcRouterClientService) {}

  async ngOnInit() {
    await this.loadAddons();
  }

  async loadAddons() {
    this.loading = true;
    this.error = null;

    try {
      const response = await this.ipcClient.get<{ addons: Addon[] }>('/api/addons/list');
      this.addons = response.addons;
    } catch (error: any) {
      this.error = error.message;
      console.error('Failed to load addons:', error);
    } finally {
      this.loading = false;
    }
  }
}
```

### Combining Multiple Calls

```typescript
import { forkJoin } from 'rxjs';

async loadDashboardData() {
  // Parallel requests
  const [addons, settings, stats] = await Promise.all([
    this.ipcClient.get('/api/addons/list'),
    this.ipcClient.get('/api/settings'),
    this.ipcClient.get('/api/stats')
  ]);

  return { addons, settings, stats };
}

// Or with Observables
loadDashboardData$() {
  return forkJoin({
    addons: this.ipcClient.get$('/api/addons/list'),
    settings: this.ipcClient.get$('/api/settings'),
    stats: this.ipcClient.get$('/api/stats')
  });
}
```

### Polling

```typescript
import { interval, switchMap } from 'rxjs';

@Component({
  selector: 'app-live-stats',
  template: `<div>{{ stats$ | async | json }}</div>`
})
export class LiveStatsComponent {
  stats$: Observable<any>;

  constructor(private ipcClient: IpcRouterClientService) {
    // Poll every 5 seconds
    this.stats$ = interval(5000).pipe(
      switchMap(() => this.ipcClient.get$('/api/stats'))
    );
  }
}
```

### Caching

```typescript
import { shareReplay } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class AddonApiService {
  private addonsCache$: Observable<AddonListResponse> | null = null;

  constructor(private ipcClient: IpcRouterClientService) {}

  getAllAddons$(): Observable<AddonListResponse> {
    if (!this.addonsCache$) {
      this.addonsCache$ = this.ipcClient.get$<AddonListResponse>('/api/addons/list').pipe(
        shareReplay(1) // Cache the result
      );
    }
    return this.addonsCache$;
  }

  clearCache() {
    this.addonsCache$ = null;
  }
}
```

## Testing

### Mocking in Tests

```typescript
import { TestBed } from '@angular/core/testing';
import { IpcRouterClientService } from './ipc-router-client.service';

describe('AddonApiService', () => {
  let service: AddonApiService;
  let ipcClientSpy: jasmine.SpyObj<IpcRouterClientService>;

  beforeEach(() => {
    const spy = jasmine.createSpyObj('IpcRouterClientService', ['get', 'post', 'put', 'delete']);

    TestBed.configureTestingModule({
      providers: [
        AddonApiService,
        { provide: IpcRouterClientService, useValue: spy }
      ]
    });

    service = TestBed.inject(AddonApiService);
    ipcClientSpy = TestBed.inject(IpcRouterClientService) as jasmine.SpyObj<IpcRouterClientService>;
  });

  it('should get all addons', async () => {
    const mockResponse = { addons: [{ id: '1', name: 'Test' }], count: 1 };
    ipcClientSpy.get.and.returnValue(Promise.resolve(mockResponse));

    const result = await service.getAllAddons();

    expect(ipcClientSpy.get).toHaveBeenCalledWith('/api/addons/list');
    expect(result).toEqual(mockResponse);
  });
});
```

## Migration from ElectronService

If you're migrating from direct `ElectronService.invoke()` calls:

**Before:**
```typescript
constructor(private electronService: ElectronService) {}

async loadAddons() {
  const addons = await this.electronService.invoke('addons-get-all');
  return addons;
}
```

**After:**
```typescript
constructor(private ipcClient: IpcRouterClientService) {}

async loadAddons() {
  const response = await this.ipcClient.get<{ addons: Addon[] }>('/api/addons/list');
  return response.addons;
}
```

## Best Practices

1. **Create dedicated API services** - Don't use IpcRouterClientService directly in components
2. **Use type parameters** - Leverage TypeScript generics for type safety
3. **Handle errors consistently** - Create a centralized error handler
4. **Use Observables for streams** - Use the `$` methods when working with RxJS
5. **Cache when appropriate** - Use `shareReplay()` for expensive operations
6. **Test with mocks** - Mock IpcRouterClientService in unit tests

## See Also

- [Main Process IPC Router Documentation](../../../app/IPC-ROUTER.md)
- [Example Addon API Service](./addon-api.service.example.ts)
- [Example File API Service](./file-api.service.example.ts)

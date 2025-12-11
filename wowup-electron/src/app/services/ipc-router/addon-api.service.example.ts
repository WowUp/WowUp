/**
 * Example: Addon API Service using IpcRouterClientService
 *
 * This demonstrates how to create an Angular service that uses
 * the IpcRouterClientService to communicate with the main process
 * via REST-like IPC calls.
 */

import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { IpcRouterClientService } from "./ipc-router-client.service";
import { Addon } from "wowup-lib-core";

/**
 * Response interfaces for type safety
 */
interface AddonListResponse {
  addons: Addon[];
  count: number;
}

interface AddonSearchResponse {
  results: Addon[];
  count: number;
  query: {
    name?: string;
    provider?: string;
  };
}

interface BatchSaveResponse {
  message: string;
  saved: number;
  failed: number;
}

interface AddonActionResponse {
  message: string;
  addon?: Addon;
  id?: string;
}

/**
 * Search query parameters
 */
interface AddonSearchQuery {
  name?: string;
  provider?: string;
}

/**
 * Addon API Service - Example implementation
 *
 * This service provides a clean, typed interface for addon operations
 * using the IpcRouterClientService.
 *
 * @example
 * ```typescript
 * // In a component
 * constructor(private addonApi: AddonApiService) {}
 *
 * async ngOnInit() {
 *   // Get all addons
 *   const { addons } = await this.addonApi.getAllAddons();
 *
 *   // Get single addon
 *   const addon = await this.addonApi.getAddon('123');
 *
 *   // Create addon
 *   await this.addonApi.createAddon(newAddon);
 * }
 * ```
 */
@Injectable({
  providedIn: "root",
})
export class AddonApiService {
  constructor(private ipcClient: IpcRouterClientService) {}

  /**
   * Get all addons from the store
   */
  public async getAllAddons(): Promise<AddonListResponse> {
    return await this.ipcClient.get<AddonListResponse>("/api/addons/list");
  }

  /**
   * Get all addons as Observable (for use with async pipe)
   */
  public getAllAddons$(): Observable<AddonListResponse> {
    return this.ipcClient.get$<AddonListResponse>("/api/addons/list");
  }

  /**
   * Get a single addon by ID
   */
  public async getAddon(id: string): Promise<Addon> {
    return await this.ipcClient.get<Addon>(`/api/addons/${id}`);
  }

  /**
   * Get a single addon by ID as Observable
   */
  public getAddon$(id: string): Observable<Addon> {
    return this.ipcClient.get$<Addon>(`/api/addons/${id}`);
  }

  /**
   * Create or save a new addon
   */
  public async createAddon(addon: Addon): Promise<AddonActionResponse> {
    return await this.ipcClient.post<AddonActionResponse, Addon>("/api/addons", addon);
  }

  /**
   * Create or save a new addon as Observable
   */
  public createAddon$(addon: Addon): Observable<AddonActionResponse> {
    return this.ipcClient.post$<AddonActionResponse, Addon>("/api/addons", addon);
  }

  /**
   * Update an existing addon
   */
  public async updateAddon(id: string, updates: Partial<Addon>): Promise<AddonActionResponse> {
    return await this.ipcClient.put<AddonActionResponse, Partial<Addon>>(`/api/addons/${id}`, updates);
  }

  /**
   * Update an existing addon as Observable
   */
  public updateAddon$(id: string, updates: Partial<Addon>): Observable<AddonActionResponse> {
    return this.ipcClient.put$<AddonActionResponse, Partial<Addon>>(`/api/addons/${id}`, updates);
  }

  /**
   * Delete an addon
   */
  public async deleteAddon(id: string): Promise<AddonActionResponse> {
    return await this.ipcClient.delete<AddonActionResponse>(`/api/addons/${id}`);
  }

  /**
   * Delete an addon as Observable
   */
  public deleteAddon$(id: string): Observable<AddonActionResponse> {
    return this.ipcClient.delete$<AddonActionResponse>(`/api/addons/${id}`);
  }

  /**
   * Batch save multiple addons
   */
  public async batchSaveAddons(addons: Addon[]): Promise<BatchSaveResponse> {
    return await this.ipcClient.post<BatchSaveResponse, { addons: Addon[] }>("/api/addons/batch-save", { addons });
  }

  /**
   * Batch save multiple addons as Observable
   */
  public batchSaveAddons$(addons: Addon[]): Observable<BatchSaveResponse> {
    return this.ipcClient.post$<BatchSaveResponse, { addons: Addon[] }>("/api/addons/batch-save", { addons });
  }

  /**
   * Search addons with query parameters
   */
  public async searchAddons(query: AddonSearchQuery): Promise<AddonSearchResponse> {
    return await this.ipcClient.get<AddonSearchResponse>("/api/addons/search", query);
  }

  /**
   * Search addons with query parameters as Observable
   */
  public searchAddons$(query: AddonSearchQuery): Observable<AddonSearchResponse> {
    return this.ipcClient.get$<AddonSearchResponse>("/api/addons/search", query);
  }
}

/**
 * Example usage in a component:
 *
 * ```typescript
 * import { Component, OnInit } from '@angular/core';
 * import { AddonApiService } from './services/ipc-router/addon-api.service.example';
 * import { Addon } from 'wowup-lib-core';
 *
 * @Component({
 *   selector: 'app-addon-list',
 *   template: `
 *     <div *ngFor="let addon of addons">
 *       <h3>{{ addon.name }}</h3>
 *       <button (click)="updateVersion(addon)">Update</button>
 *       <button (click)="removeAddon(addon.id)">Delete</button>
 *     </div>
 *   `
 * })
 * export class AddonListComponent implements OnInit {
 *   addons: Addon[] = [];
 *
 *   constructor(private addonApi: AddonApiService) {}
 *
 *   async ngOnInit() {
 *     await this.loadAddons();
 *   }
 *
 *   async loadAddons() {
 *     try {
 *       const response = await this.addonApi.getAllAddons();
 *       this.addons = response.addons;
 *       console.log(`Loaded ${response.count} addons`);
 *     } catch (error) {
 *       console.error('Failed to load addons:', error);
 *     }
 *   }
 *
 *   async updateVersion(addon: Addon) {
 *     try {
 *       const result = await this.addonApi.updateAddon(addon.id, {
 *         version: '2.0.0'
 *       });
 *       console.log(result.message);
 *       await this.loadAddons(); // Reload list
 *     } catch (error) {
 *       console.error('Failed to update addon:', error);
 *     }
 *   }
 *
 *   async removeAddon(id: string) {
 *     try {
 *       const result = await this.addonApi.deleteAddon(id);
 *       console.log(result.message);
 *       await this.loadAddons(); // Reload list
 *     } catch (error) {
 *       console.error('Failed to delete addon:', error);
 *     }
 *   }
 *
 *   async searchAddons() {
 *     try {
 *       const results = await this.addonApi.searchAddons({
 *         name: 'questie',
 *         provider: 'Curse'
 *       });
 *       this.addons = results.results;
 *       console.log(`Found ${results.count} matching addons`);
 *     } catch (error) {
 *       console.error('Search failed:', error);
 *     }
 *   }
 * }
 * ```
 *
 * Example with Observables (for use with async pipe):
 *
 * ```typescript
 * @Component({
 *   selector: 'app-addon-list-reactive',
 *   template: `
 *     <div *ngIf="addons$ | async as response">
 *       <p>Total: {{ response.count }}</p>
 *       <div *ngFor="let addon of response.addons">
 *         <h3>{{ addon.name }}</h3>
 *       </div>
 *     </div>
 *   `
 * })
 * export class AddonListReactiveComponent {
 *   addons$: Observable<AddonListResponse>;
 *
 *   constructor(private addonApi: AddonApiService) {
 *     this.addons$ = this.addonApi.getAllAddons$();
 *   }
 *
 *   searchByName(name: string) {
 *     this.addons$ = this.addonApi.searchAddons$({ name });
 *   }
 * }
 * ```
 *
 * Example with error handling:
 *
 * ```typescript
 * async createNewAddon() {
 *   const newAddon: Addon = {
 *     id: uuidv4(),
 *     name: 'My Addon',
 *     version: '1.0.0',
 *     // ... other properties
 *   };
 *
 *   try {
 *     const result = await this.addonApi.createAddon(newAddon);
 *     console.log('Addon created:', result.addon);
 *     this.showSuccessMessage(result.message);
 *   } catch (error: any) {
 *     if (error.code === 400) {
 *       console.error('Validation error:', error.message);
 *       this.showValidationError(error.message);
 *     } else if (error.code === 404) {
 *       console.error('Not found:', error.message);
 *       this.showNotFoundError();
 *     } else {
 *       console.error('Unexpected error:', error);
 *       this.showGenericError();
 *     }
 *   }
 * }
 * ```
 */

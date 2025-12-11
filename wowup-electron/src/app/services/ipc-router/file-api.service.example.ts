/**
 * Example: File API Service using IpcRouterClientService
 *
 * This demonstrates a practical file operations service using
 * the IpcRouter pattern for file system operations.
 */

import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { IpcRouterClientService } from "./ipc-router-client.service";

/**
 * File operation response types
 */
interface FileReadResponse {
  content: string;
  path: string;
}

interface FileWriteResponse {
  success: boolean;
  path: string;
  bytesWritten: number;
}

interface DirectoryListResponse {
  files: string[];
  directories: string[];
  path: string;
}

interface FileExistsResponse {
  exists: boolean;
  path: string;
  isDirectory?: boolean;
  isFile?: boolean;
}

interface FileCopyResponse {
  success: boolean;
  source: string;
  destination: string;
}

/**
 * File API Service - Example implementation for file operations
 *
 * Shows how to wrap file system operations in a REST-like API
 * using IpcRouter.
 *
 * @example
 * ```typescript
 * constructor(private fileApi: FileApiService) {}
 *
 * async loadConfig() {
 *   const content = await this.fileApi.readFile('/path/to/config.json');
 *   return JSON.parse(content);
 * }
 * ```
 */
@Injectable({
  providedIn: "root",
})
export class FileApiService {
  constructor(private ipcClient: IpcRouterClientService) {}

  /**
   * Read a file's contents
   */
  public async readFile(filePath: string): Promise<string> {
    const response = await this.ipcClient.post<FileReadResponse, { path: string }>("/api/files/read", {
      path: filePath,
    });
    return response.content;
  }

  /**
   * Read a file as Observable
   */
  public readFile$(filePath: string): Observable<string> {
    return this.ipcClient.post$<string, { path: string }>("/api/files/read", { path: filePath });
  }

  /**
   * Write content to a file
   */
  public async writeFile(filePath: string, content: string): Promise<FileWriteResponse> {
    return await this.ipcClient.post<FileWriteResponse, { path: string; content: string }>("/api/files/write", {
      path: filePath,
      content,
    });
  }

  /**
   * Check if a file or directory exists
   */
  public async exists(filePath: string): Promise<boolean> {
    const response = await this.ipcClient.get<FileExistsResponse>("/api/files/exists", { path: filePath });
    return response.exists;
  }

  /**
   * List contents of a directory
   */
  public async listDirectory(dirPath: string): Promise<DirectoryListResponse> {
    return await this.ipcClient.get<DirectoryListResponse>("/api/files/list", { path: dirPath });
  }

  /**
   * List contents of a directory as Observable
   */
  public listDirectory$(dirPath: string): Observable<DirectoryListResponse> {
    return this.ipcClient.get$<DirectoryListResponse>("/api/files/list", { path: dirPath });
  }

  /**
   * Copy a file from source to destination
   */
  public async copyFile(source: string, destination: string): Promise<FileCopyResponse> {
    return await this.ipcClient.post<FileCopyResponse, { source: string; destination: string }>("/api/files/copy", {
      source,
      destination,
    });
  }

  /**
   * Delete a file
   */
  public async deleteFile(filePath: string): Promise<{ success: boolean; path: string }> {
    return await this.ipcClient.delete(`/api/files/${encodeURIComponent(filePath)}`);
  }

  /**
   * Create a directory
   */
  public async createDirectory(dirPath: string): Promise<{ success: boolean; path: string }> {
    return await this.ipcClient.post<{ success: boolean; path: string }, { path: string }>("/api/files/mkdir", {
      path: dirPath,
    });
  }
}

/**
 * Example usage in a component:
 *
 * ```typescript
 * import { Component } from '@angular/core';
 * import { FileApiService } from './services/ipc-router/file-api.service.example';
 *
 * @Component({
 *   selector: 'app-file-manager',
 *   template: `
 *     <div>
 *       <button (click)="loadConfig()">Load Config</button>
 *       <button (click)="saveConfig()">Save Config</button>
 *       <button (click)="listFiles()">List Files</button>
 *     </div>
 *   `
 * })
 * export class FileManagerComponent {
 *   constructor(private fileApi: FileApiService) {}
 *
 *   async loadConfig() {
 *     try {
 *       const content = await this.fileApi.readFile('/app/config.json');
 *       const config = JSON.parse(content);
 *       console.log('Config loaded:', config);
 *     } catch (error) {
 *       console.error('Failed to load config:', error);
 *     }
 *   }
 *
 *   async saveConfig() {
 *     const config = { theme: 'dark', language: 'en' };
 *     try {
 *       const result = await this.fileApi.writeFile(
 *         '/app/config.json',
 *         JSON.stringify(config, null, 2)
 *       );
 *       console.log(`Saved ${result.bytesWritten} bytes`);
 *     } catch (error) {
 *       console.error('Failed to save config:', error);
 *     }
 *   }
 *
 *   async listFiles() {
 *     try {
 *       const result = await this.fileApi.listDirectory('/app/addons');
 *       console.log('Directories:', result.directories);
 *       console.log('Files:', result.files);
 *     } catch (error) {
 *       console.error('Failed to list directory:', error);
 *     }
 *   }
 *
 *   async checkFileExists() {
 *     const exists = await this.fileApi.exists('/app/config.json');
 *     if (exists) {
 *       console.log('Config file exists');
 *     } else {
 *       console.log('Config file not found');
 *     }
 *   }
 *
 *   async copyAddonFiles() {
 *     try {
 *       const result = await this.fileApi.copyFile(
 *         '/source/addon.zip',
 *         '/destination/addon-backup.zip'
 *       );
 *       console.log('File copied successfully');
 *     } catch (error) {
 *       console.error('Failed to copy file:', error);
 *     }
 *   }
 * }
 * ```
 */

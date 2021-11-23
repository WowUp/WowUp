export interface IpcResponse {
  error?: Error;
}

export interface BackupGetExistingResponse {
  exists: boolean;
}

export interface BackupCreateResponse {
  error?: string;
}

export interface ZipEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

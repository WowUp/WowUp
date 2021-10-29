import { WowInstallation } from "../warcraft/wow-installation";

export interface IpcRequest {
  responseKey: string;
}

export interface BackupGetExistingRequest {
  backupPath: string;
  installation: WowInstallation;
}

export interface BackupCreateRequest {
  backupPath: string;
  installation: WowInstallation;
}

export interface GetDirectoryTreeOptions {
  includeHash?: boolean;
}

export interface GetDirectoryTreeRequest {
  dirPath: string;
  opts?: GetDirectoryTreeOptions;
}

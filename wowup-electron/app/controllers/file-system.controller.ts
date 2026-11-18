import * as fsp from "fs/promises";

import {
  DEFAULT_FILE_MODE,
  IPC_COPY_FILE_CHANNEL,
  IPC_CREATE_DIRECTORY_CHANNEL,
  IPC_DELETE_DIRECTORY_CHANNEL,
  IPC_GET_DIRECTORY_TREE,
  IPC_LIST_DIRECTORIES_CHANNEL,
  IPC_LIST_ENTRIES,
  IPC_LIST_FILES_CHANNEL,
  IPC_PATH_EXISTS_CHANNEL,
  IPC_READ_FILE_CHANNEL,
  IPC_STAT_FILES_CHANNEL,
  IPC_UNZIP_FILE_CHANNEL,
  IPC_WRITE_FILE_CHANNEL,
} from "../../src/common/constants";
import { CopyFileRequest } from "../../src/common/models/copy-file-request";
import { GetDirectoryTreeRequest } from "../../src/common/models/ipc-request";
import { UnzipRequest } from "../../src/common/models/unzip-request";
import { copyPath, getDirTree, readFileInZip, remove, unzipFile, zipFile } from "../file.utils";
import { FileSystemService } from "../services/files/file-system.service";
import { ipcHandle, IpcController } from "./ipc-controller";

export interface FileSystemControllerLogger {
  info: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
}

/** The renderer's file access that goes through main (`FileService`) */
export class FileSystemController implements IpcController {
  public constructor(
    private readonly _fileSystem: FileSystemService,
    private readonly _log: FileSystemControllerLogger,
  ) {}

  public register(): void {
    ipcHandle(IPC_PATH_EXISTS_CHANNEL, (_evt, filePath: string) => this._fileSystem.pathExists(filePath));
    ipcHandle(IPC_LIST_DIRECTORIES_CHANNEL, (_evt, dirPath: string, scanSymlinks: boolean) =>
      this._fileSystem.listDirectories(dirPath, scanSymlinks === true),
    );
    ipcHandle(IPC_LIST_ENTRIES, (_evt, dirPath: string, filter: string) =>
      this._fileSystem.listEntries(dirPath, filter),
    );
    ipcHandle(IPC_LIST_FILES_CHANNEL, (_evt, dirPath: string, filter: string) =>
      this._fileSystem.listFiles(dirPath, filter),
    );
    ipcHandle(IPC_STAT_FILES_CHANNEL, (_evt, filePaths: string[]) => this._fileSystem.statFiles(filePaths));
    ipcHandle(IPC_GET_DIRECTORY_TREE, (_evt, request: GetDirectoryTreeRequest) => {
      this._log.debug(IPC_GET_DIRECTORY_TREE, request);
      return getDirTree(request.dirPath, request.opts);
    });

    ipcHandle(IPC_READ_FILE_CHANNEL, (_evt, filePath: string) => fsp.readFile(filePath, { encoding: "utf-8" }));
    ipcHandle(IPC_WRITE_FILE_CHANNEL, (_evt, filePath: string, contents: string) =>
      fsp.writeFile(filePath, contents, { encoding: "utf-8", mode: DEFAULT_FILE_MODE }),
    );
    ipcHandle(IPC_CREATE_DIRECTORY_CHANNEL, async (_evt, dirPath: string) => {
      this._log.info(`[CreateDirectory] '${dirPath}'`);
      await fsp.mkdir(dirPath, { recursive: true });
      return true;
    });
    ipcHandle(IPC_COPY_FILE_CHANNEL, async (_evt, request: CopyFileRequest) => {
      this._log.info(`[FileCopy] '${request.sourceFilePath}' -> '${request.destinationFilePath}'`);
      await copyPath(request.sourceFilePath, request.destinationFilePath);
      return true;
    });
    ipcHandle("rename-file", (_evt, srcPath: string, destPath: string) => {
      this._log.info(`[RenameFile]: '${srcPath} -> ${destPath}`);
      return fsp.rename(srcPath, destPath);
    });
    ipcHandle(IPC_DELETE_DIRECTORY_CHANNEL, (_evt, filePath: string) => {
      this._log.info(`[FileRemove] ${filePath}`);
      return remove(filePath);
    });

    ipcHandle(IPC_UNZIP_FILE_CHANNEL, async (_evt, request: UnzipRequest) => {
      await unzipFile(request.zipFilePath, request.outputFolder);
      return request.outputFolder;
    });
    ipcHandle("zip-file", (_evt, srcPath: string, destPath: string) => {
      this._log.info(`[ZipFile]: '${srcPath} -> ${destPath}`);
      return zipFile(srcPath, destPath);
    });
    ipcHandle("zip-read-file", (_evt, zipPath: string, filePath: string) => {
      this._log.info(`[ZipReadFile]: '${zipPath} : ${filePath}`);
      return readFileInZip(zipPath, filePath);
    });
  }
}

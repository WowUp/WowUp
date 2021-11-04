export interface IpcRequest {
  responseKey: string;
}

export interface GetDirectoryTreeOptions {
  includeHash?: boolean;
}

export interface GetDirectoryTreeRequest {
  dirPath: string;
  opts?: GetDirectoryTreeOptions;
}

import { IpcRequest } from "./ipc-request";

export interface CurseHashFileRequest extends IpcRequest {
  filePath?: string;
  targetString?: string;
  targetStringEncoding?: BufferEncoding;
  precomputedLength: number;
  normalizeWhitespace: boolean;
}

import { IpcResponse } from "./ipc-response";

export interface CurseHashFileRequest extends IpcResponse {
    filePath?: string;
    targetString?: string;
    targetStringEncoding?: BufferEncoding;
    precomputedLength: number;
    normalizeWhitespace: boolean;
}
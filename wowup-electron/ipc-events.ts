import { ipcMain } from "electron";
import * as fs from 'fs';
import { CURSE_HASH_FILE_CHANNEL } from './src/common/constants';
import { CurseHashFileRequest } from './src/common/models/curse-hash-file-request';
import { CurseHashFileResponse } from './src/common/models/curse-hash-file-response';

const nativeAddon = require('./build/Debug/addon.node');

let _win: Electron.BrowserWindow;

export function setIpcEventsWindow(window: Electron.BrowserWindow) {
    _win = window;
}

ipcMain.on(CURSE_HASH_FILE_CHANNEL, async (evt, arg: CurseHashFileRequest) => {
    // console.log(CURSE_HASH_FILE_CHANNEL, arg);

    const response: CurseHashFileResponse = {
        fingerprint: 0
    };

    try {
        if (arg.targetString !== undefined) {
            const strBuffer = Buffer.from(arg.targetString, arg.targetStringEncoding || 'ascii');
            const hash = nativeAddon.computeHash(strBuffer, strBuffer.length);
            response.fingerprint = hash;
            _win?.webContents?.send(arg.responseKey, response);
        } else {
            fs.readFile(arg.filePath, (err, buffer) => {
                if (err) {
                    response.error = err;
                    _win?.webContents?.send(arg.responseKey, response);
                    return;
                }

                const hash = nativeAddon.computeHash(buffer, buffer.length);
                response.fingerprint = hash;
                _win?.webContents?.send(arg.responseKey, response);
            });
        }
    } catch (err) {
        console.error(err);
        console.log(arg);
        response.error = err;
        _win?.webContents?.send(arg.responseKey, response);
    }
});
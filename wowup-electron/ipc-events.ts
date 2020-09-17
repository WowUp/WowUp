import { ipcMain } from "electron";
import * as fs from 'fs';
import { CURSE_HASH_FILE_CHANNEL } from './src/common/constants';
import { CurseHashFileRequest } from './src/common/models/curse-hash-file-request';
import { CurseHashFileResponse } from './src/common/models/curse-hash-file-response';

const nativeAddon = require('./build/Debug/addon.node');

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
            evt.reply(arg.responseKey, response);
        } else {
            fs.readFile(arg.filePath, (err, buffer) => {
                if (err) {
                    response.error = err;
                    evt.reply(arg.responseKey, response);
                    return;
                }

                const hash = nativeAddon.computeHash(buffer, buffer.length);
                response.fingerprint = hash;
                evt.reply(arg.responseKey, response);
            });
        }
    } catch (err) {
        console.error(err);
        console.log(arg);
        response.error = err;
        evt.reply(arg.responseKey, response);
    }
});
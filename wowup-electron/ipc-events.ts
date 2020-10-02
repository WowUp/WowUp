import { ipcMain, shell } from "electron";
import * as fs from 'fs';
import * as path from 'path';
import { CURSE_HASH_FILE_CHANNEL, LIST_DIRECTORIES_CHANNEL, LIST_FILES_CHANNEL, SHOW_DIRECTORY } from './src/common/constants';
import { CurseHashFileRequest } from './src/common/models/curse-hash-file-request';
import { CurseHashFileResponse } from './src/common/models/curse-hash-file-response';
import { ListFilesRequest } from "./src/common/models/list-files-request";
import { ListFilesResponse } from "./src/common/models/list-files-response";
import { ShowDirectoryRequest } from "./src/common/models/show-directory-request";
import { ValueRequest } from "./src/common/models/value-request";
import { ValueResponse } from "./src/common/models/value-response";

const nativeAddon = require('./build/Release/addon.node');

ipcMain.on(SHOW_DIRECTORY, async (evt, arg: ShowDirectoryRequest) => {
  const result = await shell.openPath(arg.sourceDir);
  evt.reply(arg.responseKey, true);
})

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

ipcMain.on(LIST_FILES_CHANNEL, async (evt, arg: ListFilesRequest) => {
  console.log('list files', arg);
  const response: ListFilesResponse = {
    files: []
  };

  try {
    response.files = await readDirRecursive(arg.sourcePath);
  } catch (err) {
    response.error = err;
  }

  evt.reply(arg.sourcePath, response);
});

ipcMain.on(LIST_DIRECTORIES_CHANNEL, async (evt, arg: ValueRequest<string>) => {
  const response: ValueResponse<string[]> = { value: [] };

  fs.readdir(arg.value, { withFileTypes: true }, (err, files) => {
    if (err) {
      response.error = err;
    } else {
      response.value = files.filter(file => file.isDirectory()).map(file => file.name);
    }

    evt.reply(arg.responseKey, response);
  });
})

async function readDirRecursive(sourcePath: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const dirFiles: string[] = [];
    fs.readdir(sourcePath, { withFileTypes: true }, async (err, files) => {
      if (err) {
        return reject(err);
      }

      for (let file of files) {
        const filePath = path.join(sourcePath, file.name);
        if (file.isDirectory()) {
          const nestedFiles = await readDirRecursive(filePath);
          dirFiles.push(...nestedFiles);
        } else {
          dirFiles.push(filePath)
        }
      }

      resolve(dirFiles);
    });
  });
}
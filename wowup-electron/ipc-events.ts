import { ipcMain, shell } from "electron";
import * as fs from "fs";
import * as async from "async";

import { readDirRecursive } from "./file.utils";
import {
  CURSE_HASH_FILE_CHANNEL,
  LIST_DIRECTORIES_CHANNEL,
  LIST_FILES_CHANNEL,
  SHOW_DIRECTORY,
  PATH_EXISTS_CHANNEL,
  CURSE_GET_SCAN_RESULTS,
} from "./src/common/constants";
import { CurseGetScanResultsRequest } from "./src/common/curse/curse-get-scan-results-request";
import { CurseGetScanResultsResponse } from "./src/common/curse/curse-get-scan-results-response";
import { CurseHashFileRequest } from "./src/common/models/curse-hash-file-request";
import { CurseHashFileResponse } from "./src/common/models/curse-hash-file-response";
import { ListFilesRequest } from "./src/common/models/list-files-request";
import { ListFilesResponse } from "./src/common/models/list-files-response";
import { ShowDirectoryRequest } from "./src/common/models/show-directory-request";
import { ValueRequest } from "./src/common/models/value-request";
import { ValueResponse } from "./src/common/models/value-response";
import { CurseScanResult } from "./src/common/curse/curse-scan-result";
import { CurseFolderScanner } from "./src/common/curse/curse-folder-scanner";

const nativeAddon = require("./build/Release/addon.node");

ipcMain.on(SHOW_DIRECTORY, async (evt, arg: ShowDirectoryRequest) => {
  const result = await shell.openPath(arg.sourceDir);
  evt.reply(arg.responseKey, true);
});

ipcMain.on(CURSE_HASH_FILE_CHANNEL, async (evt, arg: CurseHashFileRequest) => {
  // console.log(CURSE_HASH_FILE_CHANNEL, arg);

  const response: CurseHashFileResponse = {
    fingerprint: 0,
  };

  try {
    if (arg.targetString !== undefined) {
      const strBuffer = Buffer.from(
        arg.targetString,
        arg.targetStringEncoding || "ascii"
      );
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
  const response: ListFilesResponse = {
    files: [],
  };

  try {
    response.files = await readDirRecursive(arg.sourcePath);
  } catch (err) {
    response.error = err;
  }

  evt.reply(arg.sourcePath, response);
});

ipcMain.on(LIST_DIRECTORIES_CHANNEL, (evt, arg: ValueRequest<string>) => {
  const response: ValueResponse<string[]> = { value: [] };

  fs.readdir(arg.value, { withFileTypes: true }, (err, files) => {
    if (err) {
      response.error = err;
    } else {
      response.value = files
        .filter((file) => file.isDirectory())
        .map((file) => file.name);
    }

    evt.reply(arg.responseKey, response);
  });
});

ipcMain.on(PATH_EXISTS_CHANNEL, (evt, arg: ValueRequest<string>) => {
  const response: ValueResponse<boolean> = { value: false };

  fs.open(arg.value, "r", (err, fid) => {
    if (err) {
      if (err.code === "ENOENT") {
        response.value = false;
      } else {
        response.error = err;
      }
    } else {
      response.value = true;
    }

    evt.reply(arg.responseKey, response);
  });
});

ipcMain.on(
  CURSE_GET_SCAN_RESULTS,
  async (evt, arg: CurseGetScanResultsRequest) => {
    const response: CurseGetScanResultsResponse = {
      scanResults: [],
    };

    try {
      // Scan addon folders in parallel for speed!?
      const scanResults = await async.mapLimit<string, CurseScanResult>(
        arg.filePaths,
        2,
        async (folder, callback) => {
          const scanResult = await new CurseFolderScanner().scanFolder(folder);

          callback(undefined, scanResult);
        }
      );

      response.scanResults = scanResults;
    } catch (err) {
      response.error = err;
    }

    evt.reply(arg.responseKey, response);
  }
);

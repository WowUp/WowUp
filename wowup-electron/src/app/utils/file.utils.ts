import * as fs from "fs";
import * as util from "util";
import { remote } from "electron";
import { ListFilesResponse } from "common/models/list-files-response";
import { ListFilesRequest } from "common/models/list-files-request";
import { v4 as uuidv4 } from "uuid";
import { LIST_FILES_CHANNEL, READ_FILE_CHANNEL } from "common/constants";
import { ReadFileResponse } from "common/models/read-file-response";
import { ReadFileRequest } from "common/models/read-file-request";

const fsAccess = util.promisify(fs.access);
const fsReadFile = util.promisify(fs.readFile);
const userDataPath = remote.app.getPath("userData");

export class FileUtils {
  static async exists(path: string) {
    try {
      await fsAccess(path, fs.constants.F_OK);
      return true;
    } catch (e) {
      return false;
    }
  }

  static readFile(path: string) {
    return fsReadFile(path);
  }

  static readFileSync(path: string) {
    return fs.readFileSync(path);
  }

  static getUserDataPath() {
    return userDataPath;
  }
}

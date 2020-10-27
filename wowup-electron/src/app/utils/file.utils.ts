import * as fs from "fs";
import * as util from "util";

const fsAccess = util.promisify(fs.access);
const fsReadFile = util.promisify(fs.readFile);

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
}

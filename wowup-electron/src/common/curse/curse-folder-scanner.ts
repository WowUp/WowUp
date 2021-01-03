import * as path from "path";
import * as fs from "fs";
import * as _ from "lodash";
import * as log from "electron-log";
import * as pLimit from "p-limit";
import { CurseScanResult } from "./curse-scan-result";
import { readDirRecursive, readFile } from "../../../file.utils";

const nativeAddon = require("../../../build/Release/addon.node");

const INVALID_PATH_CHARS = [
  "|",
  "\0",
  "\u0001",
  "\u0002",
  "\u0003",
  "\u0004",
  "\u0005",
  "\u0006",
  "\b",
  "\t",
  "\n",
  "\v",
  "\f",
  "\r",
  "\u000e",
  "\u000f",
  "\u0010",
  "\u0011",
  "\u0012",
  "\u0013",
  "\u0014",
  "\u0015",
  "\u0016",
  "\u0017",
  "\u0018",
  "\u0019",
  "\u001a",
  "\u001b",
  "\u001c",
  "\u001d",
  "\u001e",
  "\u001f",
];

export class CurseFolderScanner {
  // This map is required for solving for case sensitive mismatches from addon authors on Linux
  private _fileMap: { [key: string]: string } = {};

  private get tocFileCommentsRegex() {
    return /\s*#.*$/gim;
  }

  private get tocFileIncludesRegex() {
    return /^\s*((?:(?<!\.\.).)+\.(?:xml|lua))\s*$/gim;
  }

  private get tocFileRegex() {
    return /^([^\/]+)[\\\/]\1\.toc$/gim;
  }

  private get bindingsXmlRegex() {
    return /^[^\/\\]+[\/\\]Bindings\.xml$/gim;
  }

  private get bindingsXmlIncludesRegex() {
    return /<(?:Include|Script)\s+file=[\""\""']((?:(?<!\.\.).)+)[\""\""']\s*\/>/gis;
  }

  private get bindingsXmlCommentsRegex() {
    return /<!--.*?-->/gims;
  }

  async scanFolder(folderPath: string): Promise<CurseScanResult> {
    const fileList = await readDirRecursive(folderPath);
    fileList.forEach((fp) => (this._fileMap[fp.toLowerCase()] = fp));
    // log.debug("listAllFiles", folderPath, fileList.length);

    let matchingFiles = await this.getMatchingFiles(folderPath, fileList);
    matchingFiles = _.orderBy(matchingFiles, [(f) => f.toLowerCase()], ["asc"]);
    // log.debug("matchingFiles", matchingFiles.length);

    const limit = pLimit(4);
    const tasks = _.map(matchingFiles, (path) =>
      limit(async () => {
        try {
          return await this.getFileHash(path);
        } catch (e) {
          log.error(`Failed to get filehash: ${path}`, e);
          return -1;
        }
      })
    );
    
    let individualFingerprints = await Promise.all(tasks);
    individualFingerprints = _.filter(individualFingerprints, (fp) => fp >= 0);

    const hashConcat = _.orderBy(individualFingerprints).join("");
    const fingerprint = this.getStringHash(hashConcat);
    // log.debug("fingerprint", fingerprint);

    return {
      directory: folderPath,
      fileCount: matchingFiles.length,
      fingerprint,
      folderName: path.basename(folderPath),
      individualFingerprints,
    };
  }

  private async getMatchingFiles(folderPath: string, filePaths: string[]): Promise<string[]> {
    const parentDir = path.normalize(path.dirname(folderPath) + path.sep);
    const matchingFileList: string[] = [];
    const fileInfoList: string[] = [];

    for (let filePath of filePaths) {
      const input = filePath.toLowerCase().replace(parentDir.toLowerCase(), "");

      if (this.tocFileRegex.test(input)) {
        fileInfoList.push(filePath);
      } else if (this.bindingsXmlRegex.test(input)) {
        matchingFileList.push(filePath);
      }
    }

    // log.debug("fileInfoList", fileInfoList.length);
    for (let fileInfo of fileInfoList) {
      await this.processIncludeFile(matchingFileList, fileInfo);
    }

    return matchingFileList;
  }

  private async processIncludeFile(matchingFileList: string[], fileInfo: string) {
    let nativePath = "";
    try {
      nativePath = this.getRealPath(fileInfo);
    } catch (e) {
      return;
    }

    if (!fs.existsSync(nativePath) || matchingFileList.indexOf(nativePath) !== -1) {
      return;
    }

    matchingFileList.push(nativePath);

    let input = await readFile(nativePath);
    input = this.removeComments(nativePath, input);

    const inclusions = this.getFileInclusionMatches(nativePath, input);
    if (!inclusions || !inclusions.length) {
      return;
    }

    const dirname = path.dirname(nativePath);
    for (let include of inclusions) {
      if (this.hasInvalidPathChars(include)) {
        log.debug(`Invalid include file ${nativePath}`);
        break;
      }

      const fileName = path.join(dirname, include.replace(/\\/g, path.sep));
      await this.processIncludeFile(matchingFileList, fileName);
    }
  }

  private hasInvalidPathChars(path: string) {
    return INVALID_PATH_CHARS.some((c) => path.indexOf(c) !== -1);
  }

  private getFileInclusionMatches(fileInfo: string, fileContent: string): string[] | null {
    const ext = path.extname(fileInfo);
    switch (ext) {
      case ".xml":
        return this.ripMatch(fileContent, () => this.bindingsXmlIncludesRegex);
      case ".toc":
        return this.ripMatch(fileContent, () => this.tocFileIncludesRegex);
      default:
        return null;
    }
  }

  private removeComments(fileInfo: string, fileContent: string): string {
    const ext = path.extname(fileInfo);
    switch (ext) {
      case ".xml":
        return fileContent.replace(this.bindingsXmlCommentsRegex, "");
      case ".toc":
        return fileContent.replace(this.tocFileCommentsRegex, "");
      default:
        return fileContent;
    }
  }

  /**
   *  Recreate a strange behavior for .net regex regarding how it treats
   *  lines that end in \r\t vs lines with \r\n\t
   */
  private ripMatch(str: string, regex: () => RegExp): string[] {
    const splitStrings = str.split("\n");
    const matches = [];
    try {
      for (const splitStr of splitStrings) {
        const trimmedStr = splitStr.trim();
        const match = regex().exec(trimmedStr);
        if (match && match.length > 1) {
          matches.push(match[1]);
        }
      }
    } catch (e) {
      log.error(e);
    }

    return matches.map((s) => s.trim());
  }

  private matchAll(str: string, regex: RegExp): string[] {
    const matches: string[] = [];
    let currentMatch: RegExpExecArray;
    do {
      currentMatch = regex.exec(str);
      if (currentMatch) {
        matches.push(currentMatch[1]);
      }
    } while (currentMatch);

    return matches;
  }

  private getStringHash(targetString: string, targetStringEncoding?: BufferEncoding): number {
    try {
      const strBuffer = Buffer.from(targetString, targetStringEncoding || "ascii");

      const hash = nativeAddon.computeHash(strBuffer, strBuffer.length);

      return hash;
    } catch (err) {
      log.error(err);
      log.info(targetString, targetStringEncoding);
      throw err;
    }
  }

  private getFileHash(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      try {
        fs.readFile(filePath, (err, buffer) => {
          if (err) {
            return reject(err);
          }

          const hash = nativeAddon.computeHash(buffer, buffer.length);

          return resolve(hash);
        });
      } catch (err) {
        log.error(err);
        log.info(filePath);
        return reject(err);
      }
    });
  }

  private getRealPath(filePath: string) {
    const lowerPath = filePath.toLowerCase();
    const matchedPath = this._fileMap[lowerPath];
    if (!matchedPath) {
      throw new Error(`Path not found: ${lowerPath}`);
    }
    return matchedPath;
  }
}

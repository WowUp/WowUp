import * as _ from "lodash";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as pLimit from "p-limit";
import * as log from "electron-log";
import { readDirRecursive, readFile, readFileAsBuffer } from "../../../file.utils";
import { WowUpScanResult } from "./wowup-scan-result";

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

export class WowUpFolderScanner {
  private _folderPath = "";

  // This map is required for solving for case sensitive mismatches from addon authors on Linux
  private _fileMap: { [key: string]: string } = {};

  constructor(folderPath: string) {
    this._folderPath = folderPath;
  }

  private get tocFileCommentsRegex() {
    return /\s*#.*$/gim;
  }

  private get tocFileIncludesRegex() {
    return /^\s*((?:(?<!\.\.).)+\.(?:xml|lua))\s*$/gim;
  }

  private get tocFileRegex() {
    return /^([^\/]+)[\\\/]\1\.toc$/i;
  }

  private get bindingsXmlRegex() {
    return /^[^\/\\]+[\/\\]Bindings\.xml$/i;
  }

  private get bindingsXmlIncludesRegex() {
    return /<(?:Include|Script)\s+file=[\""\""']((?:(?<!\.\.).)+)[\""\""']\s*\/>/gi;
  }

  private get bindingsXmlCommentsRegex() {
    return /<!--.*?-->/gis;
  }

  public async scanFolder(): Promise<WowUpScanResult> {
    const files = await readDirRecursive(this._folderPath);
    files.forEach((fp) => (this._fileMap[fp.toLowerCase()] = fp));

    let matchingFiles = await this.getMatchingFiles(this._folderPath, files);
    matchingFiles = _.orderBy(matchingFiles, [(f) => f.toLowerCase()], ["asc"]);

    const limit = pLimit(4);
    const tasks = _.map(matchingFiles, (file) =>
      limit(async () => {
        return { hash: await this.hashFile(file), file };
      })
    );
    const fileFingerprints = await Promise.all(tasks);

    const fingerprintList = _.map(fileFingerprints, (ff) => ff.hash);
    const hashConcat = _.orderBy(fingerprintList).join("");
    const fingerprint = this.hashString(hashConcat);

    // log.info(this._folderPath, fingerprint);

    const result: WowUpScanResult = {
      fileFingerprints: fingerprintList,
      fingerprint,
      path: this._folderPath,
      folderName: path.basename(this._folderPath),
      fileCount: matchingFiles.length,
    };

    return result;
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

    // console.log('fileInfoList', fileInfoList.length)
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

  private getFileInclusionMatches(fileInfo: string, fileContent: string): string[] | null {
    const ext = path.extname(fileInfo);
    switch (ext) {
      case ".xml":
        return this.matchAll(fileContent, this.bindingsXmlIncludesRegex);
      case ".toc":
        return this.matchAll(fileContent, this.tocFileIncludesRegex);
      default:
        return null;
    }
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

  private hashString(str: string | crypto.BinaryLike) {
    const md5 = crypto.createHash("md5");
    md5.update(str);
    return md5.digest("hex");
  }

  private async hashFile(filePath: string): Promise<string> {
    const text = await readFileAsBuffer(filePath);
    return this.hashString(text);
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

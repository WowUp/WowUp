import * as path from "path";
import * as _ from "lodash";
import * as log from "electron-log/main";
import { exists, readDirRecursive } from "./file.utils";
import * as fsp from "fs/promises";
import { firstValueFrom, from, mergeMap, toArray } from "rxjs";
import { AddonScanResult } from "wowup-lib-core";

const nativeAddon = require("../build/Release/addon.node");

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
    return /^([^/]+)[\\/]\1([-|_](mainline|bcc|tbc|classic|vanilla|wrath|wotlkc|cata))?\.toc$/i;
  }

  private get bindingsXmlRegex() {
    return /^[^/\\]+[/\\]Bindings\.xml$/gim;
  }

  private get bindingsXmlIncludesRegex() {
    return /<(?:Include|Script)\s+file=["']((?:(?<!\.\.).)+)["']\s*\/>/gis;
  }

  private get bindingsXmlCommentsRegex() {
    return /<!--.*?-->/gims;
  }

  public async scanFolder(folderPath: string): Promise<AddonScanResult> {
    const fileList = await readDirRecursive(folderPath);
    fileList.forEach((fp) => (this._fileMap[fp.toLowerCase()] = fp));

    let matchingFiles = await this.getMatchingFiles(folderPath, fileList);
    matchingFiles = _.orderBy(matchingFiles, [(f) => f.toLowerCase()], ["asc"]);

    const toFileHash = async (path: string) => {
      try {
        return await this.getFileHash(path);
      } catch (e) {
        log.error(`Failed to get filehash: ${path}`, e);
        return -1;
      }
    };

    let individualFingerprints = await firstValueFrom(
      from(matchingFiles).pipe(
        mergeMap((file) => from(toFileHash(file)), 3),
        toArray()
      )
    );

    individualFingerprints = _.filter(individualFingerprints, (fp) => fp >= 0);

    const hashConcat = _.orderBy(individualFingerprints).join("");
    const fingerprint = this.getStringHash(hashConcat);

    return {
      source: "curseforge",
      path: folderPath,
      fileCount: matchingFiles.length,
      fingerprint: fingerprint.toString(),
      fingerprintNum: fingerprint,
      folderName: path.basename(folderPath),
    };
  }

  private async getMatchingFiles(folderPath: string, filePaths: string[]): Promise<string[]> {
    const parentDir = path.normalize(path.dirname(folderPath) + path.sep);
    const matchingFileList: string[] = [];
    const fileInfoList: string[] = [];

    for (const filePath of filePaths) {
      const input = filePath.toLowerCase().replace(parentDir.toLowerCase(), "");

      if (this.tocFileRegex.test(input)) {
        fileInfoList.push(filePath);
      } else if (this.bindingsXmlRegex.test(input)) {
        matchingFileList.push(filePath);
      }
    }

    // log.debug("fileInfoList", fileInfoList.length);
    for (const fileInfo of fileInfoList) {
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

    const pathExists = await exists(nativePath);
    if (!pathExists || matchingFileList.indexOf(nativePath) !== -1) {
      return;
    }

    matchingFileList.push(nativePath);

    let input = await fsp.readFile(nativePath, { encoding: "utf-8" });
    input = this.removeComments(nativePath, input);

    const inclusions = this.getFileInclusionMatches(nativePath, input);
    if (!inclusions || !inclusions.length) {
      return;
    }

    const dirname = path.dirname(nativePath);
    for (const include of inclusions) {
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
    let currentMatch: RegExpExecArray | null;
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

  private async getFileHash(filePath: string): Promise<number> {
    const buffer = await fsp.readFile(filePath);
    const hash = nativeAddon.computeHash(buffer, buffer.length);
    return hash;
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

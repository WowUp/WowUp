import * as _ from "lodash";
import * as path from "path";
import * as log from "electron-log";
import { WowUpScanResult } from "../src/common/wowup/models";
import { exists, readDirRecursive, hashFile, hashString } from "./file.utils";
import * as fsp from "fs/promises";
import { firstValueFrom, from, mergeMap, toArray } from "rxjs";

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

  public constructor(folderPath: string) {
    this._folderPath = folderPath;
  }

  private get tocFileCommentsRegex() {
    return /\s*#.*$/gim;
  }

  private get tocFileIncludesRegex() {
    return /^\s*((?:(?<!\.\.).)+\.(?:xml|lua))\s*$/gim;
  }

  private get tocFileRegex() {
    return /^([^/]+)[\\/]\1([-_](mainline|bcc|tbc|classic|vanilla|wrath|wotlkc))?\.toc$/i;
  }

  private get bindingsXmlRegex() {
    return /^[^/\\]+[/\\]Bindings\.xml$/i;
  }

  private get bindingsXmlIncludesRegex() {
    return /<(?:Include|Script)\s+file=["']((?:(?<!\.\.).)+)["']\s*\/>/gi;
  }

  private get bindingsXmlCommentsRegex() {
    return /<!--.*?-->/gis;
  }

  public async scanFolder(): Promise<WowUpScanResult> {
    const files = await readDirRecursive(this._folderPath);
    files.forEach((fp) => (this._fileMap[fp.toLowerCase()] = fp));

    let matchingFiles = await this.getMatchingFiles(this._folderPath, files);
    matchingFiles = _.orderBy(matchingFiles, [(f) => f.toLowerCase()], ["asc"]);

    async function toFileHash(file: string) {
      return { hash: await hashFile(file), file };
    }

    const fileFingerprints = await firstValueFrom(
      from(matchingFiles).pipe(
        mergeMap((file) => from(toFileHash(file)), 3),
        toArray()
      )
    );

    const fingerprintList = _.map(fileFingerprints, (ff) => ff.hash);
    const hashConcat = _.orderBy(fingerprintList).join("");
    const fingerprint = hashString(hashConcat);

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

    for (const filePath of filePaths) {
      const input = filePath.toLowerCase().replace(parentDir.toLowerCase(), "");

      if (this.tocFileRegex.test(input)) {
        fileInfoList.push(filePath);
      } else if (this.bindingsXmlRegex.test(input)) {
        matchingFileList.push(filePath);
      }
    }

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

  private getRealPath(filePath: string) {
    const lowerPath = filePath.toLowerCase();
    const matchedPath = this._fileMap[lowerPath];
    if (!matchedPath) {
      throw new Error(`Path not found: ${lowerPath}`);
    }
    return matchedPath;
  }
}

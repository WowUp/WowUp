import * as _ from "lodash";
import * as path from "path";
import { firstValueFrom, from, mergeMap, toArray } from "rxjs";
import { AddonScanResult } from "wowup-lib-core";

import { FolderScanContext } from "./services/scan/folder-scan-context";

/** Reading a file that is not a toc or an xml only ever produced a result that was thrown away. */
function isParsedForIncludes(filePath: string): boolean {
  const ext = path.extname(filePath);
  return ext === ".xml" || ext === ".toc";
}

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

  /**
   * The context is shared with the curse scanner working on the same folder, which is what keeps
   * the folder to one walk and each file to one read.
   */
  public constructor(
    folderPath: string,
    private readonly _context: FolderScanContext,
  ) {
    this._folderPath = folderPath;
  }

  private get tocFileCommentsRegex() {
    return /\s*#.*$/gim;
  }

  private get tocFileIncludesRegex() {
    return /^\s*((?:(?<!\.\.).)+\.(?:xml|lua))\s*$/gim;
  }

  private get tocFileRegex() {
    return /^([^/]+)[\\/]\1([-_](mainline|bcc|tbc|classic|vanilla|wrath|wotlkc|cata|mists|forever|camelot))?\.toc$/i;
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

  public async scanFolder(): Promise<AddonScanResult> {
    const files = await this._context.listFiles(this._folderPath);
    files.forEach((fp) => (this._fileMap[fp.toLowerCase()] = fp));

    let matchingFiles = await this.getMatchingFiles(this._folderPath, files);
    matchingFiles = _.orderBy(matchingFiles, [(f) => f.toLowerCase()], ["asc"]);

    const toFileHash = async (file: string) => {
      return { hash: await this._context.hashFileMd5(file), file };
    };

    const fileFingerprints = await firstValueFrom(
      from(matchingFiles).pipe(
        mergeMap((file) => from(toFileHash(file)), 3),
        toArray(),
      ),
    );

    const fingerprintList = _.map(fileFingerprints, (ff) => ff.hash);
    const hashConcat = _.orderBy(fingerprintList).join("");
    const fingerprint = this._context.hashStringMd5(hashConcat);

    // The per file hashes are deliberately not carried on the result. Nothing reads them, and for a
    // few hundred addons they were the majority of what crossed ipc and got dumped into the console.
    const result: AddonScanResult = {
      source: "wowup",
      fingerprint,
      fingerprintNum: 0,
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

    const pathExists = await this._context.exists(nativePath);
    if (!pathExists || matchingFileList.indexOf(nativePath) !== -1) {
      return;
    }

    matchingFileList.push(nativePath);

    // A lua include is matched and hashed, but parsing it for further includes never found any, so
    // reading its text here only ever cost a read.
    if (!isParsedForIncludes(nativePath)) {
      return;
    }

    let input = await this._context.readText(nativePath);
    input = this.removeComments(nativePath, input);

    const inclusions = this.getFileInclusionMatches(nativePath, input);
    if (!inclusions || !inclusions.length) {
      return;
    }

    const dirname = path.dirname(nativePath);
    for (const include of inclusions) {
      if (this.hasInvalidPathChars(include)) {
        this._context.log.debug(`Invalid include file ${nativePath}`);
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

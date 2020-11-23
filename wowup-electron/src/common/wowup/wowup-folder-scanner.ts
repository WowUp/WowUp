import * as _ from "lodash";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { readDirRecursive, readFile } from "../../../file.utils";
import { WowUpScanResult } from "./wowup-scan-result";

export class WowUpFolderScanner {
  private _folderPath = "";

  constructor(folderPath: string) {
    this._folderPath = folderPath;
  }

  private get tocFileCommentsRegex() {
    return /\s*#.*$/gm;
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
    return /<!--.*?-->/gs;
  }

  public async scanFolder(): Promise<WowUpScanResult> {
    const folderPath = this._folderPath;
    const files = await readDirRecursive(folderPath);
    console.log("listAllFiles", folderPath, files.length);

    let matchingFiles = await this.getMatchingFiles(folderPath, files);
    matchingFiles = _.sortBy(matchingFiles, (f) => f.toLowerCase());

    const tocFile = this.getTocFile(folderPath);

    let fileFingerprints: string[] = [];
    for (let file of matchingFiles) {
      const fileHash = await this.hashFile(file);
      fileFingerprints.push(fileHash);
    }

    const hashConcat = _.orderBy(fileFingerprints).join("");
    const fingerprint = this.hashString(hashConcat);

    const result: WowUpScanResult = {
      fileFingerprints,
      fingerprint,
      path: folderPath,
      folderName: path.basename(folderPath),
      fileCount: matchingFiles.length,
    };

    return result;
  }

  private getTocFile(directory: string) {
    const baseFiles = fs.readdirSync(directory);
    const tocFile = baseFiles.find((file) => path.extname(file) === ".toc");
    if (!tocFile) {
      console.warn("No toc file: " + directory);
      return "";
    }
    return path.join(directory, tocFile);
  }

  private async getMatchingFiles(folderPath: string, filePaths: string[]): Promise<string[]> {
    const parentDir = path.dirname(folderPath) + path.sep;
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
    if (!fs.existsSync(fileInfo) || matchingFileList.indexOf(fileInfo) !== -1) {
      return;
    }

    matchingFileList.push(fileInfo);

    let input = await readFile(fileInfo);
    input = this.removeComments(fileInfo, input);

    const inclusions = this.getFileInclusionMatches(fileInfo, input);
    if (!inclusions || !inclusions.length) {
      return;
    }

    const dirname = path.dirname(fileInfo);
    for (let include of inclusions) {
      const fileName = path.join(dirname, include.replace(/\\/g, path.sep));
      await this.processIncludeFile(matchingFileList, fileName);
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

  private hashString(str: string) {
    const md5 = crypto.createHash("md5");
    md5.update(str);
    return md5.digest("hex");
  }

  private hashFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const fileStream = fs.createReadStream(filePath);
      const hash = crypto.createHash("md5");
      hash.setEncoding("hex");

      fileStream.on("end", function () {
        hash.end();
        const hashStr = hash.read();
        fileStream.destroy();
        resolve(hashStr);
      });

      fileStream.on("error", (error) => {
        console.error(error);
        reject(error);
      });

      fileStream.pipe(hash);
    });
  }
}

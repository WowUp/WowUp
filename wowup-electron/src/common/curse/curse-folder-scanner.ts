import * as path from "path";
import * as fs from "fs";
import * as _ from "lodash";
import * as async from "async";
import { CurseScanResult } from "./curse-scan-result";
import { readDirRecursive, readFile } from "../../../file.utils";

const nativeAddon = require("../../../build/Release/addon.node");

export class CurseFolderScanner {
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

  async scanFolder(folderPath: string): Promise<CurseScanResult> {
    const files = await readDirRecursive(folderPath);
    console.log("listAllFiles", folderPath, files.length);

    let matchingFiles = await this.getMatchingFiles(folderPath, files);
    matchingFiles = _.sortBy(matchingFiles, (f) => f.toLowerCase());

    const individualFingerprints = await async.mapLimit<string, number>(
      matchingFiles,
      2,
      async (path, callback) => {
        const normalizedFileHash = await this.getFileHash(path);
        callback(undefined, normalizedFileHash);
      }
    );

    const hashConcat = _.orderBy(individualFingerprints).join("");
    const fingerprint = this.getStringHash(hashConcat);
    console.log("fingerprint", fingerprint);

    return {
      directory: folderPath,
      fileCount: matchingFiles.length,
      fingerprint,
      folderName: path.basename(folderPath),
      individualFingerprints,
    };
  }

  private async getMatchingFiles(
    folderPath: string,
    filePaths: string[]
  ): Promise<string[]> {
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

  private async processIncludeFile(
    matchingFileList: string[],
    fileInfo: string
  ) {
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

  private getFileInclusionMatches(
    fileInfo: string,
    fileContent: string
  ): string[] | null {
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

  private getStringHash(
    targetString: string,
    targetStringEncoding?: BufferEncoding
  ): number {
    try {
      const strBuffer = Buffer.from(
        targetString,
        targetStringEncoding || "ascii"
      );

      const hash = nativeAddon.computeHash(strBuffer, strBuffer.length);

      return hash;
    } catch (err) {
      console.error(err);
      console.log(targetString, targetStringEncoding);
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
        console.error(err);
        console.log(filePath);
        return reject(err);
      }
    });
  }
}

import { FileService } from "app/services/files/file.service";
import * as path from 'path';
import * as fs from 'fs';
import * as _ from 'lodash';
import { AddonFolder } from "app/models/wowup/addon-folder";
import { ElectronService } from "app/services";
import { CurseHashFileResponse } from "common/models/curse-hash-file-response";
import { CurseHashFileRequest } from "common/models/curse-hash-file-request";
import { CURSE_HASH_FILE_CHANNEL } from "common/constants";
import { v4 as uuidv4 } from 'uuid';
import { CurseScanResult } from "../../models/curse/curse-scan-result";
import { from } from "rxjs";
import { mergeMap } from "rxjs/operators";

export class CurseFolderScanner {

    constructor(
        private _electronService: ElectronService,
        private _fileService: FileService
    ) { }

    private get tocFileCommentsRegex() {
        return /\s*#.*$/mg;
    }

    private get tocFileIncludesRegex() {
        return /^\s*((?:(?<!\.\.).)+\.(?:xml|lua))\s*$/mig;
    }

    private get tocFileRegex() {
        return /^([^\/]+)[\\\/]\1\.toc$/i;
    }

    private get bindingsXmlRegex() {
        return /^[^\/\\]+[\/\\]Bindings\.xml$/i;
    }

    private get bindingsXmlIncludesRegex() {
        return /<(?:Include|Script)\s+file=[\""\""']((?:(?<!\.\.).)+)[\""\""']\s*\/>/ig;
    }

    private get bindingsXmlCommentsRegex() {
        return /<!--.*?-->/gs;
    }

    async scanFolder(addonFolder: AddonFolder): Promise<CurseScanResult> {
        const folderPath = addonFolder.path;
        const files = await this._fileService.listAllFiles(folderPath);
        console.log('listAllFiles', folderPath, files.length);

        let matchingFiles = await this.getMatchingFiles(folderPath, files);
        matchingFiles = _.sortBy(matchingFiles, f => f.toLowerCase());

        console.log('matching files', matchingFiles.length)
        // const fst = matchingFiles.map(f => f.toLowerCase()).join('\n');

        const individualFingerprints: number[] = [];
        for (let path of matchingFiles) {
            const normalizedFileHash = await this.computeNormalizedFileHash(path);
            individualFingerprints.push(normalizedFileHash);
        }

        const hashConcat = _.orderBy(individualFingerprints).join('');
        const fingerprint = await this.computeStringHash(hashConcat);
        console.log('fingerprint', fingerprint);

        return {
            directory: folderPath,
            fileCount: matchingFiles.length,
            fingerprint,
            folderName: path.basename(folderPath),
            individualFingerprints,
            addonFolder
        };
    }

    private async getMatchingFiles(folderPath: string, filePaths: string[]): Promise<string[]> {
        const parentDir = path.dirname(folderPath) + path.sep;
        const matchingFileList: string[] = [];
        const fileInfoList: string[] = [];
        for (let filePath of filePaths) {
            const input = filePath.toLowerCase().replace(parentDir.toLowerCase(), '');

            if (this.tocFileRegex.test(input)) {
                fileInfoList.push(filePath);
            } else if (this.bindingsXmlRegex.test(input)) {
                matchingFileList.push(filePath);
            }
        }

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

        let input = await this._fileService.readFile(fileInfo);
        input = this.removeComments(fileInfo, input);

        const inclusions = this.getFileInclusionMatches(fileInfo, input);
        if (!inclusions || !inclusions.length) {
            return;
        }

        for (let include of inclusions) {
            const fileName = path.join(path.dirname(fileInfo), include);
            await this.processIncludeFile(matchingFileList, fileName);
        }
    }

    private getFileInclusionMatches(fileInfo: string, fileContent: string): string[] | null {
        const ext = path.extname(fileInfo);
        switch (ext) {
            case '.xml':
                return this.matchAll(fileContent, this.bindingsXmlIncludesRegex);
            case '.toc':
                return this.matchAll(fileContent, this.tocFileIncludesRegex);
            default:
                return null;
        }
    }

    private removeComments(fileInfo: string, fileContent: string): string {
        const ext = path.extname(fileInfo);
        switch (ext) {
            case '.xml':
                return fileContent.replace(this.bindingsXmlCommentsRegex, '');
            case '.toc':
                return fileContent.replace(this.tocFileCommentsRegex, '');
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

    private computeNormalizedFileHash(filePath: string) {
        return this.computeFileHash(filePath, true);
    }

    private computeFileHash(filePath: string, normalizeWhitespace: boolean) {
        return this.computeHash(filePath, 0, normalizeWhitespace);
    }

    private computeStringHash(str: string): Promise<number> {
        return new Promise((resolve, reject) => {
            const eventHandler = (_evt: any, arg: CurseHashFileResponse) => {
                if (arg.error) {
                    return reject(arg.error);
                }

                resolve(arg.fingerprint);
            };

            const request: CurseHashFileRequest = {
                targetString: str,
                targetStringEncoding: 'ascii',
                responseKey: uuidv4(),
                normalizeWhitespace: false,
                precomputedLength: 0
            };

            this._electronService.ipcRenderer.once(request.responseKey, eventHandler);
            this._electronService.ipcRenderer.send(CURSE_HASH_FILE_CHANNEL, request);
        });
    }

    private computeHash(
        filePath: string,
        precomputedLength: number = 0,
        normalizeWhitespace: boolean = false
    ): Promise<number> {
        return new Promise((resolve, reject) => {
            const eventHandler = (_evt: any, arg: CurseHashFileResponse) => {
                if (arg.error) {
                    return reject(arg.error);
                }

                resolve(arg.fingerprint);
            };

            const request: CurseHashFileRequest = {
                responseKey: uuidv4(),
                filePath,
                normalizeWhitespace,
                precomputedLength
            };

            this._electronService.ipcRenderer.once(request.responseKey, eventHandler);
            this._electronService.ipcRenderer.send(CURSE_HASH_FILE_CHANNEL, request);
        });
    }

}
import { AddonScanResult } from '../../models'
import * as fu from '../../utilities/files'
import * as _ from 'lodash'
import * as path from 'path'
import { limitedPromiseAll } from '../../utilities/operations'

const INVALID_PATH_CHARS = [
  '|',
  '\0',
  '\u0001',
  '\u0002',
  '\u0003',
  '\u0004',
  '\u0005',
  '\u0006',
  '\b',
  '\t',
  '\n',
  '\v',
  '\f',
  '\r',
  '\u000e',
  '\u000f',
  '\u0010',
  '\u0011',
  '\u0012',
  '\u0013',
  '\u0014',
  '\u0015',
  '\u0016',
  '\u0017',
  '\u0018',
  '\u0019',
  '\u001a',
  '\u001b',
  '\u001c',
  '\u001d',
  '\u001e',
  '\u001f'
]

interface HashSet {
  hash: string
  file: string
}

export interface IWowUpFolderScanner {
  scanFolder(folderPath: string): Promise<AddonScanResult>
}

export class WowUpFolderScanner implements IWowUpFolderScanner {
  // This map is required for solving for case sensitive mismatches from addon authors on Linux
  private _fileMap: { [key: string]: string } = {}

  private get tocFileCommentsRegex(): RegExp {
    return /\s*#.*$/gim
  }

  private get tocFileIncludesRegex(): RegExp {
    return /^\s*((?:(?<!\.\.).)+\.(?:xml|lua))\s*$/gim
  }

  private get tocFileRegex(): RegExp {
    return /^([^/]+)[\\/]\1([-_](mainline|bcc|tbc|classic|vanilla|wrath|wotlkc|cata))?\.toc$/i
  }

  private get bindingsXmlRegex(): RegExp {
    return /^[^/\\]+[/\\]Bindings\.xml$/i
  }

  private get bindingsXmlIncludesRegex(): RegExp {
    return /<(?:Include|Script)\s+file=["']((?:(?<!\.\.).)+)["']\s*\/>/gi
  }

  private get bindingsXmlCommentsRegex(): RegExp {
    return /<!--.*?-->/gis
  }

  public async scanFolder(folderPath: string): Promise<AddonScanResult> {
    const files = await fu.readDirRecursive(folderPath)
    files.forEach((fp) => (this._fileMap[fp.toLowerCase()] = fp))

    let matchingFiles = await this.getMatchingFiles(folderPath, files)
    matchingFiles = _.orderBy(matchingFiles, [(f): string => f.toLowerCase()], ['asc'])

    async function toFileHash(file: string): Promise<HashSet> {
      return { hash: await fu.hashFile(file), file }
    }

    const fileFingerprints: HashSet[] = await limitedPromiseAll(matchingFiles, toFileHash, 3)

    const fingerprintList = _.map(fileFingerprints, (ff) => ff.hash)
    const hashConcat = _.orderBy(fingerprintList).join('')
    const fingerprint = fu.hashString(hashConcat)

    const result: AddonScanResult = {
      source: 'WowUpHub',
      fileFingerprints: fingerprintList,
      fingerprint,
      fingerprintNum: 0,
      path: folderPath,
      folderName: path.basename(folderPath),
      fileCount: matchingFiles.length
    }

    return result
  }

  private async getMatchingFiles(folderPath: string, filePaths: string[]): Promise<string[]> {
    const parentDir = path.normalize(path.dirname(folderPath) + path.sep)
    const matchingFileList: string[] = []
    const fileInfoList: string[] = []

    for (const filePath of filePaths) {
      const input = filePath.toLowerCase().replace(parentDir.toLowerCase(), '')

      if (this.tocFileRegex.test(input)) {
        fileInfoList.push(filePath)
      } else if (this.bindingsXmlRegex.test(input)) {
        matchingFileList.push(filePath)
      }
    }

    for (const fileInfo of fileInfoList) {
      await this.processIncludeFile(matchingFileList, fileInfo)
    }

    return matchingFileList
  }

  private async processIncludeFile(matchingFileList: string[], fileInfo: string): Promise<void> {
    let nativePath = ''
    try {
      nativePath = this.getRealPath(fileInfo)
    } catch (e) {
      return
    }

    const pathExists = await fu.pathExists(nativePath)
    if (!pathExists || matchingFileList.indexOf(nativePath) !== -1) {
      return
    }

    matchingFileList.push(nativePath)

    let input = await fu.readFile(nativePath)
    input = this.removeComments(nativePath, input)

    const inclusions = this.getFileInclusionMatches(nativePath, input)
    if (!inclusions || !inclusions.length) {
      return
    }

    const dirname = path.dirname(nativePath)
    for (const include of inclusions) {
      if (this.hasInvalidPathChars(include)) {
        console.debug(`Invalid include file ${nativePath}`)
        break
      }

      const fileName = path.join(dirname, include.replace(/\\/g, path.sep))
      await this.processIncludeFile(matchingFileList, fileName)
    }
  }

  private hasInvalidPathChars(path: string): boolean {
    return INVALID_PATH_CHARS.some((c) => path.indexOf(c) !== -1)
  }

  private removeComments(fileInfo: string, fileContent: string): string {
    const ext = path.extname(fileInfo)
    switch (ext) {
      case '.xml':
        return fileContent.replace(this.bindingsXmlCommentsRegex, '')
      case '.toc':
        return fileContent.replace(this.tocFileCommentsRegex, '')
      default:
        return fileContent
    }
  }

  private getFileInclusionMatches(fileInfo: string, fileContent: string): string[] | null {
    const ext = path.extname(fileInfo)
    switch (ext) {
      case '.xml':
        return this.matchAll(fileContent, this.bindingsXmlIncludesRegex)
      case '.toc':
        return this.matchAll(fileContent, this.tocFileIncludesRegex)
      default:
        return null
    }
  }

  private matchAll(str: string, regex: RegExp): string[] {
    const matches: string[] = []
    let currentMatch: RegExpExecArray | null
    do {
      currentMatch = regex.exec(str)
      if (currentMatch !== null) {
        matches.push(currentMatch[1])
      }
    } while (currentMatch)

    return matches
  }

  private getRealPath(filePath: string): string {
    const lowerPath = filePath.toLowerCase()
    const matchedPath = this._fileMap[lowerPath]
    if (!matchedPath) {
      throw new Error(`Path not found: ${lowerPath}`)
    }
    return matchedPath
  }
}

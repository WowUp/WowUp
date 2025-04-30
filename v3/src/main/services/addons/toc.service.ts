import { injectable } from 'inversify'
import { IService } from '../service'
import { Toc } from '@shared/addons/toc'
import path from 'path'
import * as fu from '../../utilities/files'
import * as _ from 'lodash'
import { WowClientType } from '@shared/warcraft'
import { removeExtension } from '../../utilities/files'
import { AddonFolder } from '../../models'

export const TOC_AUTHOR = 'Author'
export const TOC_DEPENDENCIES = 'Dependencies'
export const TOC_INTERFACE = 'Interface'
export const TOC_NOTES = 'Notes'
export const TOC_REQUIRED_DEPS = 'RequiredDeps'
export const TOC_TITLE = 'Title'
export const TOC_VERSION = 'Version'
export const TOC_WEBSITE = 'Website'
export const TOC_X_ADDON_PROVIDER = 'X-AddonProvider'
export const TOC_X_CATEGORY = 'X-Category'
export const TOC_X_CURSE_PROJECT_ID = 'X-Curse-Project-ID'
export const TOC_X_LOADONDEMAND = 'LoadOnDemand'
export const TOC_X_LOCALIZATIONS = 'X-Localizations'
export const TOC_X_PART_OF = 'X-Part-Of'
export const TOC_X_TUKUI_PROJECTID = 'X-Tukui-ProjectID'
export const TOC_X_TUKUI_PROJECTFOLDERS = 'X-Tukui-ProjectFolders'
export const TOC_X_WEBSITE = 'X-Website'
export const TOC_X_WOWI_ID = 'X-WoWI-ID'
export const TOC_X_WAGO_ID = 'X-Wago-ID'

export interface ITocService extends IService {
  parse(tocPath: string): Promise<Toc>
  getTocForGameType(tocFileNames: string[], clientType: WowClientType): string
  getTocForGameType2(folderName: string, tocs: Toc[], clientType: WowClientType): Toc | undefined
  getTocForAddonFolderGameType(addonFolder: AddonFolder, clientType: WowClientType): Toc | undefined
}

@injectable()
export class TocService implements ITocService {
  public constructor() {
    console.log('init TocService')
  }

  public async parse(tocPath: string): Promise<Toc> {
    const fileName = path.basename(tocPath)
    let tocText = await fu.readFile(tocPath)
    tocText = tocText.trim()

    const dependencies =
      this.getValue(TOC_DEPENDENCIES, tocText) || this.getValue(TOC_REQUIRED_DEPS, tocText)

    const dependencyList: string[] = this.getDependencyList(tocText)

    return {
      fileName,
      filePath: tocPath,
      author: this.getValue(TOC_AUTHOR, tocText),
      curseProjectId: this.getValue(TOC_X_CURSE_PROJECT_ID, tocText),
      interface: this.getValueArray(TOC_INTERFACE, tocText),
      title: this.getValue(TOC_TITLE, tocText),
      website: this.getWebsite(tocText),
      version: this.getValue(TOC_VERSION, tocText),
      partOf: this.getValue(TOC_X_PART_OF, tocText),
      category: this.getValue(TOC_X_CATEGORY, tocText),
      localizations: this.getValue(TOC_X_LOCALIZATIONS, tocText),
      wowInterfaceId: this.getValue(TOC_X_WOWI_ID, tocText),
      wagoAddonId: this.getValue(TOC_X_WAGO_ID, tocText),
      dependencies,
      dependencyList,
      tukUiProjectId: this.getValue(TOC_X_TUKUI_PROJECTID, tocText),
      tukUiProjectFolders: this.getValue(TOC_X_TUKUI_PROJECTFOLDERS, tocText),
      loadOnDemand: this.getValue(TOC_X_LOADONDEMAND, tocText),
      addonProvider: this.getValue(TOC_X_ADDON_PROVIDER, tocText),
      notes: this.getValue(TOC_NOTES, tocText)
    }
  }

  /**
   * Given a list of toc file names, select the one that goes with the given client type
   * Use a similar priority switch as the actual wow client, if a targeted one exists use that, if not check for a base toc and try that
   */
  public getTocForGameType(tocFileNames: string[], clientType: WowClientType): string {
    let matchedToc = ''

    switch (clientType) {
      case WowClientType.Beta:
      case WowClientType.Retail:
      case WowClientType.RetailPtr:
      case WowClientType.RetailXPtr:
        matchedToc = tocFileNames.find((tfn) => /.*[-_]mainline\.toc$/gi.test(tfn)) || ''
        break
      case WowClientType.ClassicEra:
      case WowClientType.ClassicEraPtr:
        matchedToc = tocFileNames.find((tfn) => /.*[-_](classic|vanilla)\.toc$/gi.test(tfn)) || ''
        break
      case WowClientType.Classic:
      case WowClientType.ClassicPtr:
      case WowClientType.ClassicBeta:
        matchedToc = tocFileNames.find((tfn) => /.*[-_](cata)\.toc$/gi.test(tfn)) || ''
        break
      default:
        break
    }

    return (
      matchedToc ||
      tocFileNames.find((tfn) =>
        /.*(?<![-_](classic|vanilla|bcc|tbc|mainline|wrath|wotlkc|cata))\.toc$/gi.test(tfn)
      ) ||
      ''
    )
  }

  public getTocForGameType2(
    folderName: string,
    tocs: Toc[],
    clientType: WowClientType
  ): Toc | undefined {
    let matchedToc = ''

    const tocFileNames = _.map(tocs, (toc) => toc.fileName)
    matchedToc = this.getTocForGameType(tocFileNames, clientType)

    // If we still have no match, we need to return the toc that matches the folder name if it exists
    // Example: All the things for TBC (ATT-Classic)
    if (matchedToc === '') {
      return _.find(
        tocs,
        (toc) => removeExtension(toc.fileName).toLowerCase() === folderName.toLowerCase()
      )
    }

    return tocs.find((toc) => toc.fileName === matchedToc)
  }

  public getTocForAddonFolderGameType = (
    addonFolder: AddonFolder,
    clientType: WowClientType
  ): Toc | undefined => {
    let matchedToc = ''

    const tocs = addonFolder.tocs
    const tocFileNames = tocs.map((toc) => toc.fileName)
    matchedToc = this.getTocForGameType(tocFileNames, clientType)

    // If we still have no match, we need to return the toc that matches the folder name if it exists
    // Example: All the things for TBC (ATT-Classic)
    if (matchedToc === '') {
      return tocs.find(
        (toc) => removeExtension(toc.fileName).toLowerCase() === addonFolder.name.toLowerCase()
      )
    }

    return tocs.find((toc) => toc.fileName === matchedToc)
  }

  private getWebsite(tocText: string): string {
    return this.getValue(TOC_WEBSITE, tocText) || this.getValue(TOC_X_WEBSITE, tocText)
  }

  private getValueArray(key: string, tocText: string): string[] {
    const value = this.getValue(key, tocText)
    return _.uniq(value.split(',').map((x) => x.trim()))
  }

  private getDependencyList(tocText: string): string[] {
    const dependencies = this.getValue(TOC_DEPENDENCIES, tocText)
    const requiredDeps = this.getValue(TOC_REQUIRED_DEPS, tocText)

    const deps = [...dependencies.split(','), ...requiredDeps.split(',')].filter((dep) => !!dep)

    return deps
  }

  private getValue(key: string, tocText: string): string {
    const match = new RegExp(`^## ${key}:(.*?)$`, 'm').exec(tocText)

    if (!match || match.length !== 2) {
      return ''
    }

    return this.stripEncodedChars(match[1].trim())
  }

  private stripEncodedChars(value: string): string {
    let str = this.stripColorCode(value)
    str = this.stripTextureCode(str)
    str = this.stripNewLineChars(str)

    return str
  }

  private stripNewLineChars(value: string): string {
    return value.replace(/\|r/g, '')
  }

  public stripColorCode(str: string): string {
    if (str.indexOf('|c') === -1) {
      return str
    }

    const regex = /(\|c[a-z0-9]{8})|(\|r)/gi

    return str.replace(regex, '').trim()
  }

  public stripTextureCode(str: string): string {
    if (str.indexOf('|T') === -1) {
      return str
    }

    const regex = /(\|T.*\|t)/g

    return str.replace(regex, '').trim()
  }
}

import { AddonFolder } from '../addons';
import { Toc } from '../toc';
import { WowClientType, WowGameType } from '../types';
import { removeExtension } from './string.utils';
import { getWowGameType } from './wow-client.utils';

// The toc game type and family names that match each of our game types, see https://warcraft.wiki.gg/wiki/TOC_format
const TOC_GAME_TYPE_NAMES: Record<WowGameType, string[]> = {
  [WowGameType.Retail]: ['standard', 'mainline'],
  [WowGameType.Forever]: ['forever', 'camelot', 'mainline'],
  [WowGameType.Classic]: ['vanilla', 'classic'],
  [WowGameType.BurningCrusade]: ['tbc', 'classic'],
  [WowGameType.WOTLK]: ['wrath', 'classic'],
  [WowGameType.Cata]: ['cata', 'classic'],
  [WowGameType.Mists]: ['mists', 'classic'],
};

const KNOWN_TOC_GAME_TYPE_NAMES = new Set([...Object.values(TOC_GAME_TYPE_NAMES).flat(), 'plunderstorm', 'wowhack']);

const LOAD_GAME_TYPE_CONDITION_REGEX = /\[(Allow|Exclude)LoadGameType\s+([^\]]*)\]/gi;

/** Remove client load directives, e.g. "Title [AllowLoadGameType wrath][ExcludeLoadGameType classic]" -> "Title" */
export function stripLoadConditions(str: string): string {
  if (str.indexOf('[') === -1) {
    return str;
  }

  return str.replace(/\s*\[(Allow|Exclude)Load[^\]]*\]/gi, '').trim();
}

export function hasLoadGameTypeConditions(line: string): boolean {
  return new RegExp(LOAD_GAME_TYPE_CONDITION_REGEX.source, 'i').test(line);
}

/**
 * Whether the inline [AllowLoadGameType ...] / [ExcludeLoadGameType ...] conditions on a toc line apply to the game type.
 * Like the client, an allow list made up only of game types we don't know about is satisfied.
 */
export function isLoadConditionMet(line: string, gameType: WowGameType): boolean {
  const names = TOC_GAME_TYPE_NAMES[gameType] ?? [];

  for (const [, kind, list] of line.matchAll(LOAD_GAME_TYPE_CONDITION_REGEX)) {
    const listed = list
      .split(',')
      .map((name) => name.trim().toLowerCase())
      .filter((name) => KNOWN_TOC_GAME_TYPE_NAMES.has(name));
    const matches = listed.some((name) => names.includes(name));

    if (kind.toLowerCase() === 'allow' && listed.length > 0 && !matches) {
      return false;
    }
    if (kind.toLowerCase() === 'exclude' && matches) {
      return false;
    }
  }

  return true;
}

/** The toc as the given client sees it, with the title picked for its game type */
export function getTocForClientType(toc: Toc, clientType: WowClientType): Toc {
  const title = toc.titles?.[getWowGameType(clientType)];
  return title ? { ...toc, title } : toc;
}

/**
 * Given a list of toc file names, select the one that goes with the given client type
 * Use a similar priority switch as the actual wow client, if a targeted one exists use that, if not check for a base toc and try that
 */
export function getTocForGameType(tocFileNames: string[], clientType: WowClientType): string {
  let matchedToc = '';

  switch (clientType) {
    case WowClientType.Beta:
    case WowClientType.Retail:
    case WowClientType.RetailPtr:
    case WowClientType.RetailXPtr:
      matchedToc = tocFileNames.find((tfn) => /.*[-_]mainline\.toc$/gi.test(tfn)) || '';
      break;
    case WowClientType.ClassicEra:
    case WowClientType.ClassicEraPtr:
      matchedToc = tocFileNames.find((tfn) => /.*[-_](classic|vanilla)\.toc$/gi.test(tfn)) || '';
      break;
    case WowClientType.Classic:
    case WowClientType.ClassicPtr:
      matchedToc = tocFileNames.find((tfn) => /.*[-_](mists)\.toc$/gi.test(tfn)) || '';
      break;
    case WowClientType.Anniversary:
      matchedToc = tocFileNames.find((tfn) => /.*[-_](tbc|bcc)\.toc$/gi.test(tfn)) || '';
      break;
    case WowClientType.Forever:
    case WowClientType.ClassicBeta:
      matchedToc = tocFileNames.find((tfn) => /.*[-_](forever|camelot)\.toc$/gi.test(tfn)) || '';
      break;
    default:
      break;
  }

  return (
    matchedToc ||
    tocFileNames.find((tfn) =>
      /.*(?<![-_](classic|vanilla|bcc|tbc|mainline|wrath|wotlkc|cata|mists|forever|camelot))\.toc$/gi.test(tfn),
    ) ||
    ''
  );
}

export function getTocForGameType2(addonFolder: AddonFolder, clientType: WowClientType): Toc | undefined {
  let matchedToc = '';

  const tocs = addonFolder.tocs;
  const tocFileNames = tocs.map((toc) => toc.fileName);
  matchedToc = getTocForGameType(tocFileNames, clientType);

  // If we still have no match, we need to return the toc that matches the folder name if it exists
  // Example: All the things for TBC (ATT-Classic)
  const toc =
    matchedToc === ''
      ? tocs.find((toc) => removeExtension(toc.fileName).toLowerCase() === addonFolder.name.toLowerCase())
      : tocs.find((toc) => toc.fileName === matchedToc);

  return toc && getTocForClientType(toc, clientType);
}

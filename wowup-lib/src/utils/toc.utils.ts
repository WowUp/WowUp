import { AddonFolder } from '../addons';
import { Toc } from '../toc';
import { WowClientType } from '../types';
import { removeExtension } from './string.utils';

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
    case WowClientType.ClassicBeta:
      matchedToc = tocFileNames.find((tfn) => /.*[-_](mists)\.toc$/gi.test(tfn)) || '';
      break;
    case WowClientType.Anniversary:
      matchedToc = tocFileNames.find((tfn) => /.*[-_](tbc|bcc)\.toc$/gi.test(tfn)) || '';
      break;
    default:
      break;
  }

  return (
    matchedToc ||
    tocFileNames.find((tfn) =>
      /.*(?<![-_](classic|vanilla|bcc|tbc|mainline|wrath|wotlkc|cata|mists))\.toc$/gi.test(tfn),
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
  if (matchedToc === '') {
    return tocs.find((toc) => removeExtension(toc.fileName).toLowerCase() === addonFolder.name.toLowerCase());
  }

  return tocs.find((toc) => toc.fileName === matchedToc);
}

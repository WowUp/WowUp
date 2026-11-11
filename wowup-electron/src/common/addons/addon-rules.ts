// Shared by the renderer and the main process, so nothing here may depend on Angular or Electron.
import { Addon, AddonExternalId, getTocForClientType, getTocForGameType, Toc, WowClientType } from "wowup-lib-core";

import {
  ADDON_PROVIDER_CURSEFORGE,
  ADDON_PROVIDER_CURSEFORGEV2,
  ADDON_PROVIDER_GITHUB,
  ADDON_PROVIDER_RAIDERIO,
  ADDON_PROVIDER_TUKUI,
  ADDON_PROVIDER_WAGO,
  ADDON_PROVIDER_WOWINTERFACE,
  ADDON_PROVIDER_WOWUP_COMPANION,
} from "../constants";

/** The toc field each provider stores its project id in */
export const ADDON_PROVIDER_TOC_EXTERNAL_ID_MAP: Record<string, keyof Toc> = {
  [ADDON_PROVIDER_WOWINTERFACE]: "wowInterfaceId",
  [ADDON_PROVIDER_TUKUI]: "tukUiProjectId",
  [ADDON_PROVIDER_CURSEFORGE]: "curseProjectId",
  [ADDON_PROVIDER_CURSEFORGEV2]: "curseProjectId",
  [ADDON_PROVIDER_WAGO]: "wagoAddonId",
};

/** Providers whose ids are never recorded as an addon's external ids */
const EXTERNAL_ID_EXCLUDED_PROVIDERS = [ADDON_PROVIDER_RAIDERIO, ADDON_PROVIDER_WOWUP_COMPANION];

const isNumericId = (addonId: string): boolean => !!addonId && !isNaN(parseInt(addonId, 10));

/**
 * What each provider accepts as one of its addon ids. Providers not listed accept none, matching
 * AddonProvider.isValidAddonId's default.
 *
 * The Curse, GitHub and Wago providers answer isValidAddonId from this table. TukUI and WoWInterface
 * live in wowup-lib, which can't import from here, so their rule is repeated: keep the two in step.
 */
const EXTERNAL_ID_RULES: Record<string, (addonId: string) => boolean> = {
  [ADDON_PROVIDER_CURSEFORGE]: isNumericId,
  [ADDON_PROVIDER_GITHUB]: (addonId) => typeof addonId === "string" && addonId.indexOf("/") !== -1,
  [ADDON_PROVIDER_WAGO]: (addonId) => typeof addonId === "string" && addonId.length >= 8 && addonId.length <= 10,
  [ADDON_PROVIDER_TUKUI]: (addonId) => typeof addonId === "string" && isNumericId(addonId),
  [ADDON_PROVIDER_WOWINTERFACE]: (addonId) => typeof addonId === "string" && isNumericId(addonId),
};

export function isValidExternalAddonId(providerName: string, addonId: string): boolean {
  return EXTERNAL_ID_RULES[providerName]?.(addonId) ?? false;
}

export function containsOwnExternalId(addon: Addon, array?: AddonExternalId[]): boolean {
  const arr = array || addon.externalIds;
  return (
    Array.isArray(arr) && !!arr.find((ext) => ext.id === addon.externalId && ext.providerName === addon.providerName)
  );
}

/**
 * Add a provider's id to the list unless it's already there, the provider isn't one this build has
 * (`providerNames`), or the id isn't one that provider could have issued.
 */
export function insertExternalId(
  externalIds: AddonExternalId[],
  providerName: string,
  providerNames: ReadonlySet<string>,
  addonId?: string,
): void {
  if (!addonId || EXTERNAL_ID_EXCLUDED_PROVIDERS.includes(providerName)) {
    return;
  }

  // Runs once per provider per addon, so roughly the addon count times five on every scan. That
  // the id is already present is the expected case and says nothing worth a log row.
  const exists = externalIds.findIndex((extId) => extId.id === addonId && extId.providerName === providerName) !== -1;
  if (exists) {
    return;
  }

  // A provider that is not enabled for this flavor is the normal case, not something to report.
  if (!providerNames.has(providerName)) {
    return;
  }

  if (isValidExternalAddonId(providerName, addonId)) {
    externalIds.push({ id: addonId, providerName });
  } else {
    console.warn(`Invalid provider id ${providerName}|${addonId}`);
  }
}

/** Collect every provider id the toc names, plus the addon's own, onto the addon */
export function setExternalIds(addon: Addon, toc: Toc | undefined, providerNames: ReadonlySet<string>): void {
  if (!toc) {
    return;
  }

  const externalIds: AddonExternalId[] = [];
  for (const [key, value] of Object.entries(ADDON_PROVIDER_TOC_EXTERNAL_ID_MAP)) {
    insertExternalId(externalIds, key, providerNames, toc[value] as string);
  }

  //If the addon does not include the current external id add it
  if (!containsOwnExternalId(addon, externalIds)) {
    if (!addon.providerName || !addon.externalId) {
      return;
    }

    insertExternalId(externalIds, addon.providerName, providerNames, addon.externalId);
  }

  addon.externalIds = externalIds;
}

function removeExtension(str: string): string {
  return str.replace(/\.[^/.]+$/, "");
}

/** The toc a folder loads for the given client, falling back to the one named after the folder */
export function getTocForGameType2(folderName: string, tocs: Toc[], clientType: WowClientType): Toc | undefined {
  const tocFileNames = tocs.map((toc) => toc.fileName);
  const matchedToc = getTocForGameType(tocFileNames, clientType);

  // If we still have no match, we need to return the toc that matches the folder name if it exists
  // Example: All the things for TBC (ATT-Classic)
  const toc =
    matchedToc === ""
      ? tocs.find((toc) => removeExtension(toc.fileName).toLowerCase() === folderName.toLowerCase())
      : tocs.find((toc) => toc.fileName === matchedToc);

  return toc && getTocForClientType(toc, clientType);
}

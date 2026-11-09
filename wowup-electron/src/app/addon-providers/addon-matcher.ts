import { Addon, AddonFolder, Toc } from "wowup-lib-core";

/** Searches per scan and provider for folders nothing else matched, it bounds the cost of many local addons */
export const MAX_SCAN_SEARCHES = 25;

/** A provider release as the matcher sees it */
export interface MatchRelease<TRelease> {
  /** The provider's release ID, stored as the installed release when this release is the TOC's version */
  id?: string;
  /** Names that carry the version, e.g. a display name and a file name */
  names: string[];
  /** The folders the release ships, empty when the provider does not say */
  folders: string[];
  /** Whether the release is meant for the installation's client */
  compatible: boolean;
  source: TRelease;
}

/** A provider project as the matcher sees it */
export interface MatchProject<TProject, TRelease> {
  id: string;
  slug?: string;
  name: string;
  authors: string[];
  /** Newest first */
  releases: MatchRelease<TRelease>[];
  source: TProject;
}

/** The installed release of an addon matched through its TOC, when no release of the provider is the TOC's version */
export interface InstalledOverride {
  version: string;
  releaseId: string | undefined;
}

export interface SearchQuery {
  /** The provider's project slug, taken from the TOC website */
  slug?: string;
  /** The cleaned TOC title */
  title?: string;
}

/**
 * What a provider has to offer for the provider independent match steps. The fingerprint step stays in the
 * providers, the requests and answers have nothing in common.
 */
export interface MatchSource<TProject, TRelease> {
  /** Log prefix, e.g. "curseforge" */
  readonly logName: string;
  /** The provider's project ID in the TOC, e.g. X-Curse-Project-ID */
  getTocProjectId(toc: Toc): string | undefined;
  getProjectsById(ids: string[]): Promise<MatchProject<TProject, TRelease>[]>;
  /**
   * Only for providers whose search results name the folders their releases ship, without them a search result
   * cannot be told apart from an addon of the same name
   */
  searchProjects?(query: SearchQuery): Promise<MatchProject<TProject, TRelease>[]>;
  /** The project slug of a link to the provider's addon page */
  getSlugFromWebsite?(website: string | undefined): string | undefined;
  /** reference is the installed release, or the one to take the addon's details from when installed is set */
  createAddon(
    mainFolder: AddonFolder,
    project: MatchProject<TProject, TRelease>,
    reference: MatchRelease<TRelease>,
    installed: InstalledOverride | undefined,
  ): Addon;
}

/**
 * The provider independent part of matching addon folders, for the folders the provider's fingerprints left:
 * 1. the project ID the folder's TOC declares, e.g. an install that did not come from the provider's zip
 * 2. a project search by the TOC's website or title, accepted only when the project ships a folder of the same name
 */
export class AddonMatcher {
  public constructor(private readonly _getToc: (addonFolder: AddonFolder) => Toc | undefined) {}

  /** Runs every step the source supports. Failures are only logged, they must not discard earlier matches. */
  public async matchUnmatched<TProject, TRelease>(
    addonFolders: AddonFolder[],
    source: MatchSource<TProject, TRelease>,
  ): Promise<void> {
    try {
      await this.matchByTocProjectId(addonFolders, source);
      await this.matchBySearch(addonFolders, source);
    } catch (e) {
      console.error(`[${source.logName}] scan fallback failed`, e);
    }
  }

  /** Matches the folders whose TOC names their project */
  public async matchByTocProjectId<TProject, TRelease>(
    addonFolders: AddonFolder[],
    source: MatchSource<TProject, TRelease>,
  ): Promise<void> {
    const foldersByProject = new Map<string, AddonFolder[]>();
    for (const addonFolder of addonFolders) {
      if (addonFolder.matchingAddon) {
        continue;
      }

      const toc = this._getToc(addonFolder);
      const projectId = toc ? source.getTocProjectId(toc)?.trim() : undefined;
      if (!projectId) {
        continue;
      }

      foldersByProject.set(projectId, [...(foldersByProject.get(projectId) ?? []), addonFolder]);
    }

    if (!foldersByProject.size) {
      return;
    }

    const projects = await source.getProjectsById([...foldersByProject.keys()]);
    for (const project of projects) {
      const declaringFolders = foldersByProject.get(project.id) ?? [];
      if (declaringFolders.some((folder) => !folder.matchingAddon)) {
        this.matchFoldersToProject(addonFolders, declaringFolders, project, source);
      }
    }
  }

  /**
   * Last resort for folders without a fingerprint or TOC ID match, e.g. a local build of an addon that is also on
   * the provider. A link to the provider in the TOC is looked up by its slug, otherwise the TOC title is searched.
   * Only a project whose release ships a folder of the same name is accepted, and for a title search its slug, name
   * or one of its authors has to agree with the TOC too.
   */
  public async matchBySearch<TProject, TRelease>(
    addonFolders: AddonFolder[],
    source: MatchSource<TProject, TRelease>,
  ): Promise<void> {
    const searchProjects = source.searchProjects?.bind(source);
    if (!searchProjects) {
      return;
    }

    const candidates = addonFolders
      .filter((addonFolder) => !addonFolder.matchingAddon)
      .map((addonFolder) => ({ addonFolder, toc: this._getToc(addonFolder) }))
      .filter(({ toc }) => toc !== undefined && toc.loadOnDemand !== "1")
      .slice(0, MAX_SCAN_SEARCHES);

    for (const { addonFolder, toc } of candidates) {
      // A previous search may have matched this folder as part of another project
      if (addonFolder.matchingAddon || toc === undefined) {
        continue;
      }

      const slug = source.getSlugFromWebsite?.(toc.website);
      const title = cleanTocTitle(toc.title ?? "");
      if (!slug && !title) {
        continue;
      }

      let results: MatchProject<TProject, TRelease>[];
      try {
        results = await searchProjects(slug ? { slug } : { title });
      } catch (e) {
        console.warn(`[${source.logName}] search for ${addonFolder.name} failed`, e);
        continue;
      }

      const project = results.find((result) => isSearchMatch(result, addonFolder.name, toc, slug, title));
      if (project) {
        this.matchFoldersToProject(addonFolders, [addonFolder], project, source);
      }
    }
  }

  /**
   * Gives the declaring folders, and every other unmatched folder the project's release ships, an addon for the
   * project. The installed release is the one whose version is the TOC's, unknown otherwise, so the next update
   * installs the release this client needs.
   */
  public matchFoldersToProject<TProject, TRelease>(
    addonFolders: AddonFolder[],
    declaringFolders: AddonFolder[],
    project: MatchProject<TProject, TRelease>,
    source: MatchSource<TProject, TRelease>,
  ): void {
    const mainFolder = declaringFolders[0];
    const toc = mainFolder ? this._getToc(mainFolder) : undefined;
    if (!toc) {
      return;
    }

    const tocVersion = toc.version ?? "";
    const installedRelease = preferCompatible(
      project.releases.filter((release) => isReleaseOfVersion(release.names, tocVersion)),
      (release) => release.compatible,
    );
    const reference = installedRelease ?? preferCompatible(project.releases, (release) => release.compatible);
    if (!reference) {
      return;
    }

    const installed = installedRelease ? undefined : { version: tocVersion, releaseId: undefined };

    let addon: Addon;
    try {
      addon = source.createAddon(mainFolder, project, reference, installed);
    } catch (e) {
      console.error(`[${source.logName}] could not create addon for ${project.id}`, e);
      return;
    }

    const shippedFolders = new Set((reference.folders ?? []).map((folder) => folder.toLowerCase()));
    const ownedFolders = addonFolders.filter(
      (folder) =>
        !folder.matchingAddon && (declaringFolders.includes(folder) || shippedFolders.has(folder.name.toLowerCase())),
    );
    // Only the folders this addon owns: a folder the release ships that is missing or belongs to another addon is not
    // this addon's, removing the addon must not remove it
    addon.installedFolderList = ownedFolders.map((folder) => folder.name);
    addon.installedFolders = addon.installedFolderList.join(",");

    for (const folder of ownedFolders) {
      folder.matchingAddon = addon;
    }
  }
}

function isSearchMatch<TProject, TRelease>(
  project: MatchProject<TProject, TRelease>,
  folderName: string,
  toc: Toc,
  slug: string | undefined,
  title: string,
): boolean {
  const folder = folderName.toLowerCase();
  const shipsFolder = project.releases.some((release) => release.folders.some((name) => name.toLowerCase() === folder));
  if (!shipsFolder) {
    return false;
  }

  if (slug) {
    return project.slug?.toLowerCase() === slug;
  }

  const tocAuthors = splitAuthors(toc.author ?? "");
  return (
    project.slug?.toLowerCase() === folder ||
    cleanTocTitle(project.name).toLowerCase() === title.toLowerCase() ||
    project.authors.some((author) => tocAuthors.includes(author.toLowerCase()))
  );
}

/**
 * The first candidate meant for the client, otherwise the first one. The files on disk are what they are: a release
 * that is not tagged for the client (common for newer clients like WoW Forever) still identifies the project.
 */
export function preferCompatible<T>(candidates: T[], isCompatible: (candidate: T) => boolean): T | undefined {
  return candidates.find(isCompatible) ?? candidates[0];
}

/** A TOC title without color codes and the version some addons append, e.g. "Questie|cFF00FF00 v12.6.4|r" */
export function cleanTocTitle(title: string): string {
  return title
    .replace(/\|c[0-9a-f]{8}/gi, "")
    .replace(/\|r/gi, "")
    .replace(/\s+v?\d+(\.\d+)+\S*\s*$/i, "")
    .trim();
}

/** The lower case author names of a TOC author line, e.g. "plusmouse, Borjamacare" or "Aero/Logon/Muehe" */
export function splitAuthors(author: string): string[] {
  return author
    .split(/[,/&]| and /i)
    .map((name) => name.trim().toLowerCase())
    .filter((name) => name.length > 0);
}

/**
 * Whether one of the release names is the given TOC version. Release names usually carry more than the version, e.g.
 * "Questie v12.6.4" or "Auctionator-343.zip", so the version has to appear in one of them as a whole.
 */
export function isReleaseOfVersion(names: (string | undefined)[], version: string): boolean {
  const normalized = version.trim().replace(/^v/i, "");
  if (!normalized) {
    return false;
  }

  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Not part of a longer version: "12.6.4" is not "12.6.41" or "12.6.4.1", but is "Questie-12.6.4.zip"
  const pattern = new RegExp(`(^|[^0-9a-z.])v?${escaped}(?=$|[^0-9a-z.]|\\.zip$)`, "i");
  return names.some((name) => !!name && pattern.test(name.trim()));
}

import { Addon, AddonFolder, Toc } from "wowup-lib-core";

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
  /** Newest first */
  releases: MatchRelease<TRelease>[];
  source: TProject;
}

/** The installed release of an addon matched through its TOC, when no release of the provider is the TOC's version */
export interface InstalledOverride {
  version: string;
  releaseId: string | undefined;
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
  /** reference is the installed release, or the one to take the addon's details from when installed is set */
  createAddon(
    mainFolder: AddonFolder,
    project: MatchProject<TProject, TRelease>,
    reference: MatchRelease<TRelease>,
    installed: InstalledOverride | undefined,
  ): Addon;
}

/**
 * The provider independent part of matching addon folders, for the folders the provider's fingerprints left: the
 * project ID the folder's TOC declares, e.g. an install that did not come from the provider's zip.
 *
 * Only projects with a release for the installation's client are matched. An addon that its author does not publish
 * for the client is not supported there, matching it anyway would send its users' reports to the author. Such an
 * addon can still be linked by hand.
 */
export class AddonMatcher {
  public constructor(private readonly _getToc: (addonFolder: AddonFolder) => Toc | undefined) {}

  /** Failures are only logged, they must not discard the fingerprint matches */
  public async matchUnmatched<TProject, TRelease>(
    addonFolders: AddonFolder[],
    source: MatchSource<TProject, TRelease>,
  ): Promise<void> {
    try {
      await this.matchByTocProjectId(addonFolders, source);
    } catch (e) {
      console.error(`[${source.logName}] TOC project ID match failed`, e);
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
   * Gives the declaring folders, and every other unmatched folder the project's release for the client ships, an
   * addon for the project. The installed release is the one whose version is the TOC's, unknown otherwise, so the
   * next update installs the release this client needs.
   */
  public matchFoldersToProject<TProject, TRelease>(
    addonFolders: AddonFolder[],
    declaringFolders: AddonFolder[],
    project: MatchProject<TProject, TRelease>,
    source: MatchSource<TProject, TRelease>,
  ): void {
    const mainFolder = declaringFolders[0];
    const toc = mainFolder ? this._getToc(mainFolder) : undefined;
    const releases = project.releases.filter((release) => release.compatible);
    if (!toc || !releases.length) {
      return;
    }

    const tocVersion = toc.version ?? "";
    const installedRelease = releases.find((release) => isReleaseOfVersion(release.names, tocVersion));
    const reference = installedRelease ?? releases[0];
    const installed = installedRelease ? undefined : { version: tocVersion, releaseId: undefined };

    let addon: Addon;
    try {
      addon = source.createAddon(mainFolder, project, reference, installed);
    } catch (e) {
      console.error(`[${source.logName}] could not create addon for ${project.id}`, e);
      return;
    }

    const shippedFolders = new Set(reference.folders.map((folder) => folder.toLowerCase()));
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

/**
 * Whether one of the release names is the given TOC version. Release names usually carry more than the version, e.g.
 * "AddonA v3.1.0" or "AddonB-120.zip", so the version has to appear in one of them as a whole.
 */
export function isReleaseOfVersion(names: (string | undefined)[], version: string): boolean {
  const normalized = version.trim().replace(/^v/i, "");
  if (!normalized) {
    return false;
  }

  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Not part of a longer version: "3.1.0" is not "3.1.01" or "3.1.0.1", but is "AddonA-3.1.0.zip"
  const pattern = new RegExp(`(^|[^0-9a-z.])v?${escaped}(?=$|[^0-9a-z.]|\\.zip$)`, "i");
  return names.some((name) => !!name && pattern.test(name.trim()));
}

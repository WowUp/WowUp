import { Component, Inject, OnInit } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { Addon, AddonSearchResult, WowInstallation } from "wowup-lib-core";

import { AddonService } from "../../../services/addons/addon.service";
import * as SearchResults from "../../../utils/search-result.utils";

export interface AddonLinkDialogData {
  addon: Addon;
  installation: WowInstallation;
}

interface LinkCandidate {
  result: AddonSearchResult;
  latestVersion: string;
  thumbnailLetter: string;
}

/**
 * Lets the user link an installed addon to a provider's addon when the scan could not identify it, by searching
 * the enabled providers or pasting the addon's page URL. The addon's files are kept as they are.
 */
@Component({
  selector: "app-addon-link-dialog",
  templateUrl: "./addon-link-dialog.component.html",
  styleUrls: ["./addon-link-dialog.component.scss"],
})
export class AddonLinkDialogComponent implements OnInit {
  public query = "";
  public isBusy = false;
  public hasSearched = false;
  public errorKey = "";
  public candidates: LinkCandidate[] = [];

  public constructor(
    private _addonService: AddonService,
    public dialogRef: MatDialogRef<AddonLinkDialogComponent, Addon>,
    @Inject(MAT_DIALOG_DATA) public data: AddonLinkDialogData,
  ) {}

  public ngOnInit(): void {
    this.query = this.data.addon.name;
    this.onSearch().catch((e) => console.error(e));
  }

  public onClose(): void {
    this.dialogRef.close();
  }

  public async onSearch(): Promise<void> {
    const query = this.query.trim();
    if (!query || this.isBusy) {
      return;
    }

    this.isBusy = true;
    this.errorKey = "";
    this.candidates = [];
    try {
      const results = await this.findResults(query);
      this.candidates = results.map((result) => this.toCandidate(result));
    } catch (e) {
      console.error("[addon-link] search failed", e);
      this.errorKey = "DIALOGS.ADDON_LINK.SEARCH_FAILED";
    } finally {
      this.hasSearched = true;
      this.isBusy = false;
    }
  }

  public async onLink(candidate: LinkCandidate): Promise<void> {
    if (this.isBusy) {
      return;
    }

    this.isBusy = true;
    this.errorKey = "";
    try {
      const linked = await this._addonService.linkAddon(this.data.addon, candidate.result, this.data.installation);
      this.dialogRef.close(linked);
    } catch (e) {
      console.error("[addon-link] link failed", e);
      this.errorKey = "DIALOGS.ADDON_LINK.LINK_FAILED";
    } finally {
      this.isBusy = false;
    }
  }

  private async findResults(query: string): Promise<AddonSearchResult[]> {
    const url = toUrl(query);
    if (url) {
      const byUrl = await this._addonService.getAddonByUrl(url, this.data.installation);
      return byUrl?.searchResult ? [byUrl.searchResult] : [];
    }

    return await this._addonService.search(query, this.data.installation);
  }

  private toCandidate(result: AddonSearchResult): LinkCandidate {
    const latestFile = SearchResults.getLatestFile(result, this.data.installation.defaultAddonChannelType);
    return {
      result,
      latestVersion: latestFile?.version ?? "",
      thumbnailLetter: (result.name ?? "?").charAt(0).toUpperCase(),
    };
  }
}

function toUrl(query: string): URL | undefined {
  if (!/^https?:\/\//i.test(query)) {
    return undefined;
  }

  try {
    return new URL(query);
  } catch {
    return undefined;
  }
}

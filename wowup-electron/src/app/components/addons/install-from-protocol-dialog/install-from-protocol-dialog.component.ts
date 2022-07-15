import * as _ from "lodash";
import { from, of } from "rxjs";
import { catchError, delay, first, switchMap } from "rxjs/operators";

import { AfterViewInit, Component, Inject, OnInit } from "@angular/core";
import { UntypedFormControl } from "@angular/forms";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";

import { ProtocolSearchResult } from "../../../models/wowup/protocol-search-result";
import { AddonService } from "../../../services/addons/addon.service";
import { SessionService } from "../../../services/session/session.service";
import { WarcraftInstallationService } from "../../../services/warcraft/warcraft-installation.service";
import { WowInstallation } from "../../../../common/warcraft/wow-installation";

export interface InstallFromProtocolDialogComponentData {
  protocol: string;
}

export interface WowInstallationWrapper extends WowInstallation {
  isInstalled?: boolean;
}

const ERROR_ADDON_NOT_FOUND = "DIALOGS.INSTALL_FROM_PROTOCOL.ERRORS.ADDON_NOT_FOUND";
const ERROR_GENERIC = "DIALOGS.INSTALL_FROM_PROTOCOL.ERRORS.GENERIC";
const ERROR_NO_VALID_WOW_INSTALLATIONS = "DIALOGS.INSTALL_FROM_PROTOCOL.ERRORS.NO_VALID_WOW_INSTALLATIONS";

@Component({
  selector: "app-install-from-protocol-dialog",
  templateUrl: "./install-from-protocol-dialog.component.html",
  styleUrls: ["./install-from-protocol-dialog.component.scss"],
})
export class InstallFromProtocolDialogComponent implements OnInit, AfterViewInit {
  public error = "";
  public ready = false;
  public addon!: ProtocolSearchResult;
  public installations = new UntypedFormControl();
  public validWowInstallations: WowInstallationWrapper[] = [];
  public installProgress = 0;
  public isInstalling = false;
  public isComplete = false;

  public constructor(
    private _addonService: AddonService,
    private _sessionService: SessionService,
    private _warcraftInstallationService: WarcraftInstallationService,
    @Inject(MAT_DIALOG_DATA) public data: InstallFromProtocolDialogComponentData,
    public dialogRef: MatDialogRef<InstallFromProtocolDialogComponent>
  ) {}

  public ngOnInit(): void {}

  public ngAfterViewInit(): void {
    of(true)
      .pipe(
        first(),
        delay(1000),
        switchMap(() => from(this.loadAddon())),
        catchError((e) => {
          console.error(e);
          return of(undefined);
        })
      )
      .subscribe();
  }

  public getVersion(): string {
    return _.first(this.addon?.files)?.version ?? "";
  }

  public getName(): string {
    return this.addon?.name ?? "";
  }

  public getThumbnailUrl(): string {
    return this.addon?.thumbnailUrl ?? "";
  }

  public getAuthor(): string {
    return this.addon?.author ?? "'";
  }

  public getProviderName(): string {
    return this.addon?.providerName ?? "";
  }

  public onClose(): void {
    this.dialogRef.close();
  }

  public onInstall = async (): Promise<void> => {
    console.debug("selectedInstallationId", this.installations.value);
    const selectedInstallationIds: string[] = this.installations.value;
    const selectedInstallations = this.validWowInstallations.filter((installation) =>
      selectedInstallationIds.includes(installation.id)
    );
    const targetFile = _.first(this.addon.files);

    try {
      this.isInstalling = true;

      const totalInstalls = selectedInstallations.length;
      let installIdx = 0;
      for (const installation of selectedInstallations) {
        await this._addonService.installPotentialAddon(
          this.addon,
          installation,
          (state, progress) => {
            console.debug("Install Progress", progress);
            this.installProgress = (installIdx * 100 + progress) / totalInstalls;
          },
          targetFile
        );
        installIdx += 1;
        this._sessionService.notifyTargetFileInstallComplete();
      }

      this.isComplete = true;
    } catch (e) {
      console.error(`Failed to install addon for protocol: ${this.data.protocol}`, e);
      this.error = ERROR_GENERIC;
    } finally {
      this.isInstalling = false;
    }
  };

  private async loadAddon(): Promise<void> {
    try {
      const searchResult = await this._addonService.getAddonForProtocol(this.data.protocol);
      if (!searchResult) {
        this.error = ERROR_ADDON_NOT_FOUND;
        return;
      }

      this.addon = searchResult;

      if (Array.isArray(searchResult.validClientGroups)) {
        this.validWowInstallations = await this._warcraftInstallationService.getWowInstallationsByClientGroups(
          searchResult.validClientGroups
        );
      } else if (Array.isArray(searchResult.validClientTypes)) {
        this.validWowInstallations = await this._warcraftInstallationService.getWowInstallationsByClientTypes(
          searchResult.validClientTypes
        );
      } else {
        throw new Error("No valid clients found");
      }

      if (this.validWowInstallations.length === 0) {
        this.error = ERROR_NO_VALID_WOW_INSTALLATIONS;
        return;
      }

      for (const installation of this.validWowInstallations) {
        installation.isInstalled = await this._addonService.isInstalled(
          this.addon.externalId,
          this.addon.providerName,
          installation
        );
      }

      if (this.validWowInstallations.length === 0) {
        return;
      }

      const allInstalled = _.every(this.validWowInstallations, (installation) => installation.isInstalled);
      if (allInstalled) {
        this.isComplete = true;
        this.installations.setValue(this.validWowInstallations.map((installation) => installation.id));
        return;
      }

      const installationId = _.find(this.validWowInstallations, (installation) => !installation.isInstalled)?.id;
      if (!installationId) {
        return;
      }
      this.installations.setValue([installationId]);
    } catch (e) {
      console.error(`Failed to load protocol addon`, e);
      this.error = ERROR_GENERIC;
    } finally {
      this.ready = true;
    }
  }
}

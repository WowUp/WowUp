import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { PotentialAddon } from 'app/models/wowup/potential-addon';
import { AddonService } from 'app/services/addons/addon.service';
import { SessionService } from 'app/services/session/session.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-install-from-url-dialog',
  templateUrl: './install-from-url-dialog.component.html',
  styleUrls: ['./install-from-url-dialog.component.scss']
})
export class InstallFromUrlDialogComponent implements OnInit, OnDestroy {

  public isBusy = false;
  public showInstallSpinner = false;
  public showInstallButton = false;
  public showInstallSuccess = false;
  public query = '';
  public addon?: PotentialAddon;

  private _installSubscription?: Subscription;

  constructor(
    private _addonService: AddonService,
    private _sessionService: SessionService,
    public dialogRef: MatDialogRef<InstallFromUrlDialogComponent>,
  ) { }

  ngOnInit(): void {
  }

  ngOnDestroy() {
    this._installSubscription?.unsubscribe();
  }

  onClearSearch() {
    this.query = '';
    this.onImportUrl();
  }

  onInstall() {
    this.showInstallButton = false;
    this.showInstallSpinner = true;

    this.showInstallSpinner = false;
    this.showInstallSuccess = true;
  }

  async onImportUrl() {
    this.addon = undefined;

    if (!this.query) {
      return;
    }

    try {
      const url = new URL(this.query);
      const importedAddon = await this._addonService
        .getAddonByUrl(url, this._sessionService.selectedClientType);

      console.log(importedAddon);
      if (!importedAddon) {
        throw new Error('Addon not found');
      }

      this.addon = importedAddon;
      this.showInstallButton = true;
    }
    catch (err) {
      console.error(err);
    }
  }

}

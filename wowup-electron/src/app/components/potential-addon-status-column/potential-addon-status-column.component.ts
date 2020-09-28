import { Component, Input, NgZone, OnInit } from '@angular/core';
import { AddonInstallState } from 'app/models/wowup/addon-install-state';
import { PotentialAddon } from 'app/models/wowup/potential-addon';
import { AddonService } from 'app/services/addons/addon.service';
import { SessionService } from 'app/services/session/session.service';

@Component({
  selector: 'app-potential-addon-status-column',
  templateUrl: './potential-addon-status-column.component.html',
  styleUrls: ['./potential-addon-status-column.component.scss']
})
export class PotentialAddonStatusColumnComponent implements OnInit {

  @Input('addon') addon: PotentialAddon;

  public isInstalled = false;
  public showInstallButton = false;
  public showProgress = false;
  public progressText = '';
  public progressValue = 0;

  constructor(
    private _ngZone: NgZone,
    private _addonService: AddonService,
    private _sessionService: SessionService
  ) { }

  ngOnInit(): void {
    this.isInstalled = this._addonService.isInstalled(this.addon.externalId, this._sessionService.selectedClientType);
    this.showInstallButton = !this.isInstalled;
  }

  refresh(params: any): boolean {
    throw new Error("Method not implemented.");
  }

  onInstall() {
    this.showInstallButton = false;
    this.showProgress = true;
    this.progressText = 'Installing...';

    this._addonService.installPotentialAddon(this.addon, this._sessionService.selectedClientType, (state, progress) => {
      console.log('UPDATE', state);
      
      if(state === AddonInstallState.Complete){
        this.showInstallButton = false;
        this.showProgress = false;
        this.isInstalled = true;
      }

      this._ngZone.run(() => {
        this.progressValue = progress;
      });
    })
  }

}

import {
  Component,
  OnInit,
  NgZone,
  OnChanges,
  SimpleChanges,
  Input,
} from "@angular/core";
import { MatSlideToggleChange } from "@angular/material/slide-toggle";
import { WowClientType } from "app/models/warcraft/wow-client-type";
import { ElectronService } from "app/services";
import { WarcraftService } from "app/services/warcraft/warcraft.service";
import { WowUpService } from "app/services/wowup/wowup.service";
import { filter, map } from "rxjs/operators";
import * as _ from "lodash";
import * as path from "path";
import { MatDialog } from "@angular/material/dialog";
import { AlertDialogComponent } from "app/components/alert-dialog/alert-dialog.component";
import { getEnumList, getEnumName } from "app/utils/enum.utils";
import { WowUpReleaseChannelType } from "app/models/wowup/wowup-release-channel-type";
import { MatSelectChange } from "@angular/material/select";
import { AnalyticsService } from "app/services/analytics/analytics.service";
import { AddonService } from "app/services/addons/addon.service";

@Component({
  selector: "app-options",
  templateUrl: "./options.component.html",
  styleUrls: ["./options.component.scss"],
})
export class OptionsComponent implements OnInit, OnChanges {
  @Input("tabIndex") tabIndex: number;

  public retailLocation = "";
  public classicLocation = "";
  public retailPtrLocation = "";
  public classicPtrLocation = "";
  public betaLocation = "";
  public collapseToTray = false;
  public telemetryEnabled = false;
  public wowClientTypes: WowClientType[] = getEnumList(WowClientType).filter(
    (clientType) => clientType !== WowClientType.None
  ) as WowClientType[];
  public wowUpReleaseChannel: WowUpReleaseChannelType;
  public wowUpReleaseChannels: {
    type: WowUpReleaseChannelType;
    name: string;
  }[] = getEnumList(
    WowUpReleaseChannelType
  ).map((type: WowUpReleaseChannelType) => ({
    type,
    name: getEnumName(WowUpReleaseChannelType, type),
  }));

  constructor(
    private _addonService: AddonService,
    private _analyticsService: AnalyticsService,
    private warcraft: WarcraftService,
    private _electronService: ElectronService,
    private _warcraftService: WarcraftService,
    private _wowUpService: WowUpService,
    private _dialog: MatDialog,
    private zone: NgZone,
    public electronService: ElectronService
  ) {
    _analyticsService.telemetryEnabled$.subscribe((enabled) => {
      this.telemetryEnabled = enabled;
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    console.log(changes);
  }

  ngOnInit(): void {
    this.wowUpReleaseChannel = this._wowUpService.wowUpReleaseChannel;

    this.loadData();
  }

  onShowLogs = () => {
    this._wowUpService.showLogsFolder();
  };

  onReScan = () => {
    this.warcraft.scanProducts();
    this.loadData();
  };

  onTelemetryChange = (evt: MatSlideToggleChange) => {
    this._analyticsService.telemetryEnabled = evt.checked;
  };

  onCollapseChange = (evt: MatSlideToggleChange) => {
    this._wowUpService.collapseToTray = evt.checked;
  };

  onWowUpChannelChange(evt: MatSelectChange) {
    this._wowUpService.wowUpReleaseChannel = evt.value;
  }

  async onLogDebugData() {
    await this._addonService.logDebugData();
  }

  async onSelectRetailClientPath() {
    const selectedPath = await this.selectWowClientPath(WowClientType.Retail);
    if (selectedPath) {
      this.retailLocation = selectedPath;
    }
  }

  async onSelectRetailPtrClientPath() {
    const selectedPath = await this.selectWowClientPath(
      WowClientType.RetailPtr
    );
    if (selectedPath) {
      this.retailPtrLocation = selectedPath;
    }
  }

  async onSelectClassicClientPath() {
    const selectedPath = await this.selectWowClientPath(WowClientType.Classic);
    if (selectedPath) {
      this.classicLocation = selectedPath;
    }
  }

  async onSelectClassicPtrClientPath() {
    const selectedPath = await this.selectWowClientPath(
      WowClientType.ClassicPtr
    );
    if (selectedPath) {
      this.classicPtrLocation = selectedPath;
    }
  }

  async onSelectBetaClientPath() {
    const selectedPath = await this.selectWowClientPath(WowClientType.Beta);
    if (selectedPath) {
      this.betaLocation = selectedPath;
    }
  }

  private async selectWowClientPath(
    clientType: WowClientType
  ): Promise<string> {
    const dialogResult = await this._electronService.remote.dialog.showOpenDialog(
      {
        properties: ["openDirectory"],
      }
    );

    if (dialogResult.canceled) {
      return "";
    }

    const selectedPath = _.first(dialogResult.filePaths);
    if (!selectedPath) {
      console.warn("No path selected");
      return "";
    }

    console.log("dialogResult", selectedPath);

    if (this._warcraftService.setWowFolderPath(clientType, selectedPath)) {
      return selectedPath;
    }

    const clientFolderName = this._warcraftService.getClientFolderName(
      clientType
    );
    const clientExecutableName = this._warcraftService.getExecutableName(
      clientType
    );
    const clientExecutablePath = path.join(
      selectedPath,
      clientFolderName,
      clientExecutableName
    );
    const dialogRef = this._dialog.open(AlertDialogComponent, {
      data: {
        title: `Alert`,
        message: `Unable to set "${selectedPath}" as your ${getEnumName(
          WowClientType,
          clientType
        )} folder.\nPath not found: "${clientExecutablePath}".`,
      },
    });

    await dialogRef.afterClosed().toPromise();

    return "";
  }

  private loadData() {
    this.zone.run(() => {
      this.telemetryEnabled = this._analyticsService.telemetryEnabled;
      this.collapseToTray = this._wowUpService.collapseToTray;
      this.retailLocation = this.warcraft.getClientLocation(
        WowClientType.Retail
      );
      this.classicLocation = this.warcraft.getClientLocation(
        WowClientType.Classic
      );
      this.retailPtrLocation = this.warcraft.getClientLocation(
        WowClientType.RetailPtr
      );
      this.classicPtrLocation = this.warcraft.getClientLocation(
        WowClientType.ClassicPtr
      );
      this.betaLocation = this.warcraft.getClientLocation(WowClientType.Beta);
    });
  }
}

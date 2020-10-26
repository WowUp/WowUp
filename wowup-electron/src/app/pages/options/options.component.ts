import {
  Component,
  OnInit,
  NgZone,
  OnChanges,
  SimpleChanges,
  Input,
  ChangeDetectionStrategy,
} from "@angular/core";
import { MatSlideToggleChange } from "@angular/material/slide-toggle";
import { WowClientType } from "app/models/warcraft/wow-client-type";
import { ElectronService } from "app/services";
import { WarcraftService } from "app/services/warcraft/warcraft.service";
import { WowUpService } from "app/services/wowup/wowup.service";
import * as _ from "lodash";
import { MatDialog } from "@angular/material/dialog";
import { getEnumList, getEnumName } from "app/utils/enum.utils";
import { WowUpReleaseChannelType } from "app/models/wowup/wowup-release-channel-type";
import { MatSelectChange } from "@angular/material/select";
import { AnalyticsService } from "app/services/analytics/analytics.service";
import { AddonService } from "app/services/addons/addon.service";
import { ConfirmDialogComponent } from "../../components/confirm-dialog/confirm-dialog.component";
import { TranslateService } from "@ngx-translate/core";

@Component({
  selector: "app-options",
  templateUrl: "./options.component.html",
  styleUrls: ["./options.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OptionsComponent implements OnInit, OnChanges {
  @Input("tabIndex") tabIndex: number;

  public collapseToTray = false;
  public telemetryEnabled = false;
  public useHardwareAcceleration = true;
  public startWithSystem = false;
  public startMinimized = false;
  public wowClientTypes: WowClientType[] = getEnumList(WowClientType).filter(
    (clientType) => clientType !== WowClientType.None
  ) as WowClientType[];
  public wowUpReleaseChannel: WowUpReleaseChannelType;

  public wowUpReleaseChannels: {
    type: WowUpReleaseChannelType;
    name: string;
  }[] = getEnumList(WowUpReleaseChannelType).map(
    (type: WowUpReleaseChannelType) => ({
      type,
      name: getEnumName(WowUpReleaseChannelType, type),
    })
  );

  public get minimizeOnCloseDescription() {
    const key = this._electronService.isWin
      ? "PAGES.OPTIONS.APPLICATION.MINIMIZE_ON_CLOSE_DESCRIPTION_WINDOWS"
      : "PAGES.OPTIONS.APPLICATION.MINIMIZE_ON_CLOSE_DESCRIPTION_MAC";

    return this._translateService.instant(key);
  }

  constructor(
    private _addonService: AddonService,
    private _analyticsService: AnalyticsService,
    private warcraft: WarcraftService,
    private _electronService: ElectronService,
    public wowupService: WowUpService,
    private _dialog: MatDialog,
    private zone: NgZone,
    public electronService: ElectronService,
    private _translateService: TranslateService
  ) {
    _analyticsService.telemetryEnabled$.subscribe((enabled) => {
      this.telemetryEnabled = enabled;
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    console.log(changes);
  }

  ngOnInit(): void {
    this.wowUpReleaseChannel = this.wowupService.wowUpReleaseChannel;

    this.loadData();
  }

  onShowLogs = () => {
    this.wowupService.showLogsFolder();
  };

  onReScan = () => {
    this.warcraft.scanProducts();
    this.loadData();
  };

  onTelemetryChange = (evt: MatSlideToggleChange) => {
    this._analyticsService.telemetryEnabled = evt.checked;
  };

  onCollapseChange = (evt: MatSlideToggleChange) => {
    this.wowupService.collapseToTray = evt.checked;
  };

  onEnableSystemNotifications = (evt: MatSlideToggleChange) => {
    this.wowupService.enableSystemNotifications = evt.checked;
  };

  onUseHardwareAccelerationChange = (evt: MatSlideToggleChange) => {
    const dialogRef = this._dialog.open(ConfirmDialogComponent, {
      data: {
        title: this._translateService.instant(
          "PAGES.OPTIONS.APPLICATION.USE_HARDWARE_ACCELERATION_CONFIRMATION_LABEL"
        ),
        message: this._translateService.instant(
          evt.checked
            ? "PAGES.OPTIONS.APPLICATION.USE_HARDWARE_ACCELERATION_ENABLE_CONFIRMATION_DESCRIPTION"
            : "PAGES.OPTIONS.APPLICATION.USE_HARDWARE_ACCELERATION_DISABLE_CONFIRMATION_DESCRIPTION"
        ),
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result) {
        evt.source.checked = !evt.source.checked;

        return;
      }

      this.wowupService.useHardwareAcceleration = evt.checked;
      this._electronService.restartApplication();
    });
  };

  onStartWithSystemChange = (evt: MatSlideToggleChange) => {
    this.wowupService.startWithSystem = evt.checked;
    if (!evt.checked)
      this.startMinimized = false;
  };

  onStartMinimizedChange = (evt: MatSlideToggleChange) => {
    this.wowupService.startMinimized = evt.checked;
  };

  onWowUpChannelChange(evt: MatSelectChange) {
    this.wowupService.wowUpReleaseChannel = evt.value;
  }

  async onLogDebugData() {
    await this._addonService.logDebugData();
  }

  private loadData() {
    this.zone.run(() => {
      this.telemetryEnabled = this._analyticsService.telemetryEnabled;
      this.collapseToTray = this.wowupService.collapseToTray;
      this.useHardwareAcceleration = this.wowupService.useHardwareAcceleration;
      this.startWithSystem = this.wowupService.startWithSystem;
      this.startMinimized = this.wowupService.startMinimized;
    });
  }
}

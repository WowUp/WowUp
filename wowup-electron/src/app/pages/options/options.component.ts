import {
  ChangeDetectionStrategy,
  Component,
  Input,
  NgZone,
  OnChanges,
  OnInit,
  SimpleChanges,
} from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { MatSelectChange } from "@angular/material/select";
import { MatSlideToggleChange } from "@angular/material/slide-toggle";
import { TranslateService } from "@ngx-translate/core";
import { ConfirmDialogComponent } from "../../components/confirm-dialog/confirm-dialog.component";
import { WowClientType } from "../../models/warcraft/wow-client-type";
import { WowUpReleaseChannelType } from "../../models/wowup/wowup-release-channel-type";
import { ElectronService } from "../../services";
import { AddonService } from "../../services/addons/addon.service";
import { AnalyticsService } from "../../services/analytics/analytics.service";
import { WarcraftService } from "../../services/warcraft/warcraft.service";
import { WowUpService } from "../../services/wowup/wowup.service";
import { getEnumList, getEnumName } from "../../utils/enum.utils";

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
    const key = this.electronService.isWin
      ? "PAGES.OPTIONS.APPLICATION.MINIMIZE_ON_CLOSE_DESCRIPTION_WINDOWS"
      : "PAGES.OPTIONS.APPLICATION.MINIMIZE_ON_CLOSE_DESCRIPTION_MAC";

    return this._translateService.instant(key);
  }

  constructor(
    private _addonService: AddonService,
    private _analyticsService: AnalyticsService,
    private warcraft: WarcraftService,
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
      this.electronService.restartApplication();
    });
  };

  onStartWithSystemChange = (evt: MatSlideToggleChange) => {
    this.wowupService.startWithSystem = evt.checked;
    if (!evt.checked) this.startMinimized = false;
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

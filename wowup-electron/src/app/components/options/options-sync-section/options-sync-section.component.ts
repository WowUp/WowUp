import { BehaviorSubject, Subject, takeUntil } from "rxjs";
import { WowClientType, WowInstallation } from "wowup-lib-core";

import { ChangeDetectorRef, Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from "@angular/core";
import { MatCheckboxChange } from "@angular/material/checkbox";
import { MatSlideToggleChange } from "@angular/material/slide-toggle";

import {
  SETTINGS_SYNC_ERROR_BUSY,
  SETTINGS_SYNC_ERROR_FOLDER_MISSING,
  SETTINGS_SYNC_ERROR_GAME_RUNNING,
  SETTINGS_SYNC_ERROR_INVALID_CODE,
  SETTINGS_SYNC_ERROR_NOT_CONFIGURED,
  SETTINGS_SYNC_ERROR_WRONG_KEY,
  SettingsSyncResult,
  SettingsSyncStatus,
} from "../../../../common/models/settings-sync";
import { AddonBrokerService, ImportSummary } from "../../../services/addons/addon-broker.service";
import { SettingsSyncApiService } from "../../../services/api/settings-sync-api.service";
import { ElectronService } from "../../../services/electron/electron.service";
import { SnackbarService } from "../../../services/snackbar/snackbar.service";
import { WarcraftInstallationService } from "../../../services/warcraft/warcraft-installation.service";

/** Error codes main throws, mapped to their text; ipc wraps the message, so match on contains */
const ERROR_KEYS: [string, string][] = [
  [SETTINGS_SYNC_ERROR_GAME_RUNNING, "PAGES.OPTIONS.SYNC.ERROR.GAME_RUNNING"],
  [SETTINGS_SYNC_ERROR_NOT_CONFIGURED, "PAGES.OPTIONS.SYNC.ERROR.NOT_CONFIGURED"],
  [SETTINGS_SYNC_ERROR_INVALID_CODE, "PAGES.OPTIONS.SYNC.ERROR.INVALID_CODE"],
  [SETTINGS_SYNC_ERROR_FOLDER_MISSING, "PAGES.OPTIONS.SYNC.ERROR.FOLDER_MISSING"],
  [SETTINGS_SYNC_ERROR_WRONG_KEY, "PAGES.OPTIONS.SYNC.ERROR.WRONG_KEY"],
  [SETTINGS_SYNC_ERROR_BUSY, "PAGES.OPTIONS.SYNC.ERROR.BUSY"],
];

interface InstallationRow {
  installation: WowInstallation;
  enabled: boolean;
  busy: boolean;
  result?: SettingsSyncResult;
  /** Addons the newest other device has that this one doesn't */
  missing?: ImportSummary;
  missingFrom?: string;
}

@Component({
  selector: "app-options-sync-section",
  templateUrl: "./options-sync-section.component.html",
  styleUrls: ["./options-sync-section.component.scss"],
})
export class OptionsSyncSectionComponent implements OnInit, OnChanges, OnDestroy {
  /** Loads only once the tab is shown */
  @Input() public active = false;

  private readonly _destroy$ = new Subject<boolean>();
  private _loaded = false;

  public readonly status$ = new BehaviorSubject<SettingsSyncStatus | undefined>(undefined);
  public readonly rows$ = new BehaviorSubject<InstallationRow[]>([]);
  public shownCode?: string;
  public codeInput = "";

  public constructor(
    private readonly _syncApi: SettingsSyncApiService,
    private readonly _electronService: ElectronService,
    private readonly _installationService: WarcraftInstallationService,
    private readonly _addonBroker: AddonBrokerService,
    private readonly _snackbarService: SnackbarService,
    private readonly _cdRef: ChangeDetectorRef,
  ) {}

  public ngOnInit(): void {
    this._syncApi.autoSyncResults$.pipe(takeUntil(this._destroy$)).subscribe((results) => {
      results.forEach((result) => void this.applyResult(result));
    });
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes.active?.currentValue && !this._loaded) {
      this._loaded = true;
      this._installationService.wowInstallations$.pipe(takeUntil(this._destroy$)).subscribe(() => void this.reload());
    }
  }

  public ngOnDestroy(): void {
    this._destroy$.next(true);
    this._destroy$.complete();
  }

  public async onCreateCode(): Promise<void> {
    await this.guard(async () => {
      this.shownCode = await this._syncApi.createCode();
      await this.reload();
    });
  }

  public async onSaveCode(): Promise<void> {
    await this.guard(async () => {
      await this._syncApi.setCode(this.codeInput);
      this.codeInput = "";
      this._snackbarService.showSuccessSnackbar("PAGES.OPTIONS.SYNC.CODE_SAVED");
      await this.reload();
    });
  }

  public async onToggleShowCode(): Promise<void> {
    this.shownCode = this.shownCode ? undefined : await this._syncApi.getCode();
    this._cdRef.detectChanges();
  }

  public onCodeCopied(): void {
    this._snackbarService.showSuccessSnackbar("PAGES.OPTIONS.SYNC.CODE_COPIED");
  }

  public async onClear(): Promise<void> {
    await this._syncApi.clear();
    this.shownCode = undefined;
    await this.reload();
  }

  public async onChooseFolder(): Promise<void> {
    const picked = await this._electronService.showOpenDialog({ properties: ["openDirectory", "createDirectory"] });
    if (picked.canceled || picked.filePaths.length === 0) {
      return;
    }
    await this._syncApi.setFolder(picked.filePaths[0]);
    await this.reload();
  }

  public async onAutoSyncChange(evt: MatSlideToggleChange): Promise<void> {
    await this._syncApi.setAutoSync(evt.checked);
    await this.reload();
  }

  public async onInstallationToggle(row: InstallationRow, evt: MatCheckboxChange): Promise<void> {
    const ids = new Set(this.status$.value?.installationIds ?? []);
    if (evt.checked) {
      ids.add(row.installation.id);
    } else {
      ids.delete(row.installation.id);
    }
    await this._syncApi.setInstallations([...ids]);
    await this.reload();
  }

  public async onSyncNow(row: InstallationRow): Promise<void> {
    row.busy = true;
    this.rows$.next([...this.rows$.value]);
    try {
      await this.guard(async () => {
        const result = await this._syncApi.sync(row.installation.id);
        await this.applyResult(result);
        this._snackbarService.showSuccessSnackbar("PAGES.OPTIONS.SYNC.SYNC_DONE");
      });
    } finally {
      row.busy = false;
      this.rows$.next([...this.rows$.value]);
    }
  }

  public async onInstallMissing(row: InstallationRow): Promise<void> {
    if (!row.missing) {
      return;
    }
    row.busy = true;
    this.rows$.next([...this.rows$.value]);
    try {
      await this._addonBroker.installImportSummary(row.missing, row.installation);
      row.missing = undefined;
    } finally {
      row.busy = false;
      this.rows$.next([...this.rows$.value]);
    }
  }

  public showInFolder(filePath: string): void {
    void this._electronService.showItemInFolder(filePath);
  }

  private async reload(): Promise<void> {
    const status = await this._syncApi.getStatus();
    this.status$.next(status);

    const previous = new Map(this.rows$.value.map((row) => [row.installation.id, row]));
    const installations = await this._installationService.getWowInstallationsAsync();
    const rows = installations.map((installation) => {
      const row = previous.get(installation.id);
      return {
        installation,
        enabled: status.installationIds.includes(installation.id),
        busy: row?.busy ?? false,
        result: status.lastResults[installation.id] ?? row?.result,
        missing: row?.missing,
        missingFrom: row?.missingFrom,
      };
    });
    this.rows$.next(rows);
    this._cdRef.detectChanges();
  }

  private async applyResult(result: SettingsSyncResult): Promise<void> {
    const rows = this.rows$.value;
    const row = rows.find((r) => r.installation.id === result.installationId);
    if (!row) {
      return;
    }
    row.result = result;
    row.missing = undefined;
    row.missingFrom = undefined;

    const newest = result.otherDevices[0];
    if (newest && newest.addons.length > 0) {
      const summary = await this._addonBroker.getImportSummary(
        { client_type: WowClientType[row.installation.clientType], addons: newest.addons },
        row.installation,
      );
      if (!summary.errorCode && summary.addedCt > 0) {
        row.missing = summary;
        row.missingFrom = newest.deviceName;
      }
    }
    this.rows$.next([...rows]);
    this._cdRef.detectChanges();
  }

  private async guard(action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch (e) {
      const message = (e as Error)?.message ?? String(e);
      const key = ERROR_KEYS.find(([code]) => message.includes(code))?.[1] ?? "PAGES.OPTIONS.SYNC.ERROR.GENERIC";
      console.error("[settings-sync]", e);
      this._snackbarService.showErrorSnackbar(key, { localeArgs: { message } });
    }
  }
}

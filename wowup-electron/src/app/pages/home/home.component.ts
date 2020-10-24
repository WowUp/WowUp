import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
} from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { LegacyImportDialogComponent } from "app/components/legacy-import-dialog/legacy-import-dialog.component";
import { TelemetryDialogComponent } from "app/components/telemetry-dialog/telemetry-dialog.component";
import { AnalyticsService } from "app/services/analytics/analytics.service";
import { SessionService } from "app/services/session/session.service";
import { WarcraftService } from "app/services/warcraft/warcraft.service";
import { WowUpService } from "app/services/wowup/wowup.service";
import { from, of } from "rxjs";
import { map, switchMap } from "rxjs/operators";

@Component({
  selector: "app-home",
  templateUrl: "./home.component.html",
  styleUrls: ["./home.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent implements OnInit, AfterViewInit {
  public selectedIndex = 0;
  public hasWowClient = false;
  public loadTabs = false;

  constructor(
    private _analyticsService: AnalyticsService,
    private _changeDetectorRef: ChangeDetectorRef,
    private _sessionService: SessionService,
    private _warcraftService: WarcraftService,
    private _dialog: MatDialog,
    private _wowUpService: WowUpService
  ) {
    this._warcraftService.installedClientTypes$.subscribe((clientTypes) => {
      if (clientTypes === undefined) {
        this.hasWowClient = false;
        this.selectedIndex = 3;
      } else {
        this.hasWowClient = clientTypes.length > 0;
        this.selectedIndex = this.hasWowClient ? 0 : 3;
      }
    });
  }

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    from(this.checkLegacyImport())
      .pipe(
        switchMap(() => this.openTelemetryDialog()),
        map(() => this._analyticsService.trackStartup())
      )
      .subscribe(() => {
        this.loadTabs = true;
        this._changeDetectorRef.detectChanges();
      });
  }

  onSelectedIndexChange(index: number) {
    this._sessionService.selectedHomeTab = index;
  }

  private async checkLegacyImport() {
    if (!this._wowUpService.showLegacyImportPrompt) {
      return;
    }

    const legacyDatabaseExists = await this._wowUpService.legacyAppExists();
    if (!legacyDatabaseExists) {
      return;
    }

    await this.showLegacyImportDialog();
  }

  private showLegacyImportDialog() {
    const dialogRef = this._dialog.open(LegacyImportDialogComponent, {
      disableClose: true,
    });

    return dialogRef.afterClosed().toPromise();
  }

  private openTelemetryDialog() {
    if (this._analyticsService.shouldPromptTelemetry) {
      const dialogRef = this._dialog.open(TelemetryDialogComponent, {
        disableClose: true,
      });

      return dialogRef.afterClosed().pipe(
        map((result) => {
          this._analyticsService.telemetryEnabled = result;
        })
      );
    } else {
      return of(undefined);
    }
  }
}

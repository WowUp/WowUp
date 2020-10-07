import { AfterViewInit, Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { AppConfig } from '../environments/environment';
import { TelemetryDialogComponent } from './components/telemetry-dialog/telemetry-dialog.component';
import { ElectronService } from './services';
import { AnalyticsService } from './services/analytics/analytics.service';
import { WarcraftService } from './services/warcraft/warcraft.service';
import { WowUpService } from './services/wowup/wowup.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements AfterViewInit {
  constructor(
    private _analyticsService: AnalyticsService,
    private electronService: ElectronService,
    private translate: TranslateService,
    private warcraft: WarcraftService,
    private _wowUpService: WowUpService,
    private _dialog: MatDialog
  ) {
    this.translate.setDefaultLang('en');

    this.translate.use(this.electronService.locale);
  }

  ngAfterViewInit(): void {
    if (this._analyticsService.shouldPromptTelemetry) {
      this.openDialog();
    } else {
      // TODO track startup
    }
  }

  openDialog(): void {
    const dialogRef = this._dialog.open(TelemetryDialogComponent, {
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      this._wowUpService.telemetryEnabled = result;
    });
  }
}

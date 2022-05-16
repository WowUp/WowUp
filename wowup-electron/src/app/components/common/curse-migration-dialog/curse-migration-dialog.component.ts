import { AfterViewChecked, Component, ElementRef, ViewChild } from "@angular/core";
import { MatDialogRef } from "@angular/material/dialog";
import { BehaviorSubject, map } from "rxjs";
import { ADDON_PROVIDER_CURSEFORGE, ADDON_PROVIDER_CURSEFORGEV2 } from "../../../../common/constants";
import { AddonService } from "../../../services/addons/addon.service";
import { LinkService } from "../../../services/links/link.service";
import { SessionService } from "../../../services/session/session.service";
import { WarcraftInstallationService } from "../../../services/warcraft/warcraft-installation.service";
import { formatDynamicLinks } from "../../../utils/dom.utils";

export interface ConsentDialogResult {
  telemetry: boolean;
  wagoProvider: boolean;
}

@Component({
  selector: "app-curse-migration-dialog",
  templateUrl: "./curse-migration-dialog.component.html",
  styleUrls: ["./curse-migration-dialog.component.scss"],
})
export class CurseMigrationDialogComponent implements AfterViewChecked {
  @ViewChild("dialogContent", { read: ElementRef }) public dialogContent!: ElementRef;

  public readonly isBusy$ = new BehaviorSubject<boolean>(false);
  public readonly autoError$ = new BehaviorSubject<Error | undefined>(undefined);
  public readonly autoComplete$ = new BehaviorSubject<boolean>(false);
  public readonly autoIncomplete$ = this.autoComplete$.pipe(map((complete) => !complete));

  public constructor(
    public dialogRef: MatDialogRef<CurseMigrationDialogComponent>,
    private _addonService: AddonService,
    private _linkService: LinkService,
    private _sessionService: SessionService,
    private _warcraftInstallationService: WarcraftInstallationService
  ) {}

  public ngAfterViewChecked(): void {
    const descriptionContainer: HTMLDivElement = this.dialogContent?.nativeElement;
    formatDynamicLinks(descriptionContainer, this.onOpenLink);
  }

  public onNoClick(): void {
    this.dialogRef.close();
  }

  public async onAutomaticClick(): Promise<void> {
    this.isBusy$.next(true);

    try {
      // Fetch all installations
      let scanCompleted = false;
      const wowInstallations = await this._warcraftInstallationService.getWowInstallationsAsync();
      for (const wowInstall of wowInstallations) {
        // If there are any old Curse addons, re-scan that installation
        let addons = await this._addonService.getAddons(wowInstall);
        addons = addons.filter(
          (addon) =>
            addon.isIgnored === false &&
            (addon.providerName === ADDON_PROVIDER_CURSEFORGE || addon.providerName === ADDON_PROVIDER_CURSEFORGEV2)
        );
        if (addons.length > 0) {
          await this._addonService.rescanInstallation(wowInstall);
          scanCompleted = true;
        }
      }

      if (scanCompleted) {
        this._sessionService.rescanCompleted();
      }
    } catch (e) {
      console.error(e);
      this.autoError$.next(e as Error);
    } finally {
      this.isBusy$.next(false);
      this.autoComplete$.next(true);
    }
  }

  private onOpenLink = (element: HTMLAnchorElement): boolean => {
    this._linkService.confirmLinkNavigation(element.href).subscribe();

    return false;
  };
}

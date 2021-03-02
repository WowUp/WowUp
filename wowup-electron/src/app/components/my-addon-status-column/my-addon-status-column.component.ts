import { Component, EventEmitter, Input, NgZone, OnDestroy, OnInit, Output } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { TranslateService } from "@ngx-translate/core";

import { AddonViewModel } from "../../business-objects/addon-view-model";
import { AddonWarningType } from "../../../common/wowup/addon-warning-type";
import { AlertDialogComponent } from "../alert-dialog/alert-dialog.component";

@Component({
  selector: "app-my-addon-status-column",
  templateUrl: "./my-addon-status-column.component.html",
  styleUrls: ["./my-addon-status-column.component.scss"],
})
export class MyAddonStatusColumnComponent implements OnInit {
  @Input() public listItem: AddonViewModel;

  @Output() public onViewUpdated: EventEmitter<boolean> = new EventEmitter();

  public warningType?: AddonWarningType;
  public hasWarning = false;
  public showStatusText = false;
  public statusText = "";

  public constructor(
    private _dialog: MatDialog,
    private _translateService: TranslateService,
    private _ngzone: NgZone
  ) {}

  public ngOnInit(): void {
    this.warningType = this.listItem?.addon?.warningType;
    this.hasWarning = this.warningType !== undefined;
    this.showStatusText = this.listItem?.isUpToDate() || this.listItem?.addon.isIgnored;
    this.statusText = this.getStatusText();
  }

  public getStatusText(): string {
    if (!this.listItem) {
      return "";
    }

    if (this.listItem?.addon.isIgnored) {
      return "COMMON.ADDON_STATE.IGNORED";
    }

    if (this.listItem?.isUpToDate()) {
      return "COMMON.ADDON_STATE.UPTODATE";
    }

    return this.listItem.stateTextTranslationKey;
  }

  public onUpdateButtonUpdated(): void {
    this._ngzone.run(() => {
      this.onViewUpdated.emit();
    });
  }

  public getWarningDescriptionKey(): string {
    if (!this.warningType) {
      return "";
    }

    switch (this.warningType) {
      case AddonWarningType.MissingOnProvider:
        return "COMMON.ADDON_WARNING.MISSING_ON_PROVIDER_DESCRIPTION";
      default:
        return "COMMON.ADDON_WARNING.GENERIC_DESCRIPTION";
    }
  }

  public onWarningButton(): void {
    const descriptionKey = this.getWarningDescriptionKey();
    this._dialog.open(AlertDialogComponent, {
      data: {
        title: this._translateService.instant("COMMON.ADDON_STATE.WARNING"),
        message: this._translateService.instant(descriptionKey),
      },
    });
  }
}

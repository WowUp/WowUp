import { Component, EventEmitter, Input, NgZone, OnDestroy, OnInit, Output } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { AddonViewModel } from "../../business-objects/addon-view-model";

@Component({
  selector: "app-my-addon-status-column",
  templateUrl: "./my-addon-status-column.component.html",
  styleUrls: ["./my-addon-status-column.component.scss"],
})
export class MyAddonStatusColumnComponent implements OnInit, OnDestroy {
  @Input() listItem: AddonViewModel;

  @Output() onViewUpdated: EventEmitter<boolean> = new EventEmitter();

  public get showStatusText() {
    return this.listItem?.isUpToDate() || this.listItem?.addon.isIgnored;
  }

  constructor(private _translateService: TranslateService, private _ngzone: NgZone) {}

  ngOnInit(): void {}

  ngOnDestroy(): void {}

  public getStatusText() {
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

  public onUpdateButtonUpdated() {
    this._ngzone.run(() => {
      this.onViewUpdated.emit();
    });
  }
}

import {
  Component,
  EventEmitter,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  Output,
} from "@angular/core";
import { AddonViewModel } from "../../business-objects/my-addon-list-item";
import { TranslateService } from "@ngx-translate/core";

@Component({
  selector: "app-my-addon-status-column",
  templateUrl: "./my-addon-status-column.component.html",
  styleUrls: ["./my-addon-status-column.component.scss"],
})
export class MyAddonStatusColumnComponent implements OnInit, OnDestroy {
  @Input() listItem: AddonViewModel;

  @Output() onViewUpdated: EventEmitter<boolean> = new EventEmitter();

  public get showStatusText() {
    return this.listItem?.isUpToDate || this.listItem?.isIgnored;
  }

  constructor(
    private _translateService: TranslateService,
    private _ngzone: NgZone
  ) {}

  ngOnInit(): void {
  }

  ngOnDestroy(): void {}

  public getStatusText() {
    if (this.listItem?.isUpToDate) {
      return this._translateService.instant("COMMON.ADDON_STATE.UPTODATE");
    }

    if (!this.listItem) {
      return "";
    }

    return this._translateService.instant(this.listItem.stateTextTranslationKey);
  }

  public onUpdateButtonUpdated() {
    this._ngzone.run(() => {
      this.onViewUpdated.emit();
    });
  }
}

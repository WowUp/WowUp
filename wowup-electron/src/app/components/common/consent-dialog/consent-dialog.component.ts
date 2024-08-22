import { AfterViewChecked, Component, ElementRef, OnInit, ViewChild } from "@angular/core";
import { UntypedFormControl, UntypedFormGroup } from "@angular/forms";
import { MatDialogRef } from "@angular/material/dialog";
import { IPC_OW_IS_CMP_REQUIRED, IPC_OW_OPEN_CMP } from "../../../../common/constants";
import { ElectronService } from "../../../services";
import { LinkService } from "../../../services/links/link.service";
import { AppConfig } from "../../../../environments/environment";

export interface ConsentDialogResult {
  telemetry: boolean;
  wagoProvider: boolean;
}

@Component({
  selector: "app-consent-dialog",
  templateUrl: "./consent-dialog.component.html",
  styleUrls: ["./consent-dialog.component.scss"],
})
export class ConsentDialogComponent implements AfterViewChecked, OnInit {
  @ViewChild("dialogContent", { read: ElementRef }) public dialogContent!: ElementRef;

  public consentOptions: UntypedFormGroup;
  public requiresCmp = false;
  public isWago = AppConfig.wago.enabled;
  public isCurseForge = AppConfig.curseforge.enabled;

  public readonly wagoTermsUrl = AppConfig.wago.termsUrl;
  public readonly wagoDataUrl = AppConfig.wago.dataConsentUrl;

  public constructor(
    public dialogRef: MatDialogRef<ConsentDialogComponent>,
    private _linkService: LinkService,
    private _electronService: ElectronService,
  ) {
    this.consentOptions = new UntypedFormGroup({
      telemetry: new UntypedFormControl(true),
      wagoProvider: new UntypedFormControl(true),
    });
  }

  public ngOnInit(): void {
    if (AppConfig.curseforge.enabled) {
      this._electronService
        .invoke<boolean>(IPC_OW_IS_CMP_REQUIRED)
        .then((cmpRequired) => {
          console.log("cmpRequired", cmpRequired);
          this.requiresCmp = cmpRequired;
        })
        .catch((e) => console.error("IPC_OW_IS_CMP_REQUIRED failed", e));
    }
  }

  public ngAfterViewChecked(): void {}

  public onClickAdVendors(evt: MouseEvent): void {
    evt.preventDefault();

    this._electronService.invoke(IPC_OW_OPEN_CMP, "vendors").catch((e) => console.error("onClickAdVendors failed", e));
  }

  public onClickManage(evt: MouseEvent): void {
    evt.preventDefault();

    this._electronService.invoke(IPC_OW_OPEN_CMP).catch((e) => console.error("onClickManage failed", e));
  }

  public onNoClick(): void {
    this.dialogRef.close();
  }

  public onSubmit(evt: any): void {
    evt.preventDefault();

    console.log(this.consentOptions.value);

    this.dialogRef.close(this.consentOptions.value);
  }
}

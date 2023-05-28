import { Component, Inject, OnInit } from "@angular/core";
import { MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA, MatLegacyDialogRef as MatDialogRef } from "@angular/material/legacy-dialog";
import { from } from "rxjs";
import { first, map } from "rxjs/operators";

import { WowUpService } from "../../../services/wowup/wowup.service";

export interface DialogData {
  title: string;
  message: string;
  url: string;
  domains: string[];
}

export interface DialogResult {
  success: boolean;
  trustDomain: string;
}

@Component({
  selector: "app-external-url-confirmation-dialog",
  templateUrl: "./external-url-confirmation-dialog.component.html",
  styleUrls: ["./external-url-confirmation-dialog.component.scss"],
})
export class ExternalUrlConfirmationDialogComponent implements OnInit {
  public domain = "";
  public trustDomain = false;

  private _trustedDomains: string[] = [];

  public constructor(
    public dialogRef: MatDialogRef<ExternalUrlConfirmationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData,
    private _wowupService: WowUpService
  ) {
    const url = new URL(data.url);
    this.domain = url.hostname;
  }

  public ngOnInit(): void {
    if (this.data.domains) {
      this._trustedDomains = this.data.domains;
      this.trustDomain = this._trustedDomains.includes(this.domain);
    } else {
      from(this._wowupService.getTrustedDomains())
        .pipe(
          first(),
          map((trustedDomains) => {
            this._trustedDomains = trustedDomains;

            this.trustDomain = this._trustedDomains.includes(this.domain);
          })
        )
        .subscribe();
    }
  }

  public onConfirm(success: boolean): void {
    const result: DialogResult = {
      success,
      trustDomain: this.trustDomain ? this.domain : "",
    };
    this.dialogRef.close(result);
  }
}

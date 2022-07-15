import { AfterViewChecked, Component, ElementRef, ViewChild } from "@angular/core";
import { UntypedFormControl, UntypedFormGroup } from "@angular/forms";
import { MatDialogRef } from "@angular/material/dialog";
import { AppConfig } from "../../../../environments/environment";
import { LinkService } from "../../../services/links/link.service";
import { formatDynamicLinks } from "../../../utils/dom.utils";

export interface ConsentDialogResult {
  telemetry: boolean;
  wagoProvider: boolean;
}

@Component({
  selector: "app-consent-dialog",
  templateUrl: "./consent-dialog.component.html",
  styleUrls: ["./consent-dialog.component.scss"],
})
export class ConsentDialogComponent implements AfterViewChecked {
  @ViewChild("dialogContent", { read: ElementRef }) public dialogContent!: ElementRef;

  public consentOptions: UntypedFormGroup;

  public readonly wagoTermsUrl = AppConfig.wago.termsUrl;
  public readonly wagoDataUrl = AppConfig.wago.dataConsentUrl;

  public constructor(public dialogRef: MatDialogRef<ConsentDialogComponent>, private _linkService: LinkService) {
    this.consentOptions = new UntypedFormGroup({
      telemetry: new UntypedFormControl(true),
      wagoProvider: new UntypedFormControl(true),
    });
  }

  public ngAfterViewChecked(): void {
    const descriptionContainer: HTMLDivElement = this.dialogContent?.nativeElement;
    formatDynamicLinks(descriptionContainer, this.onOpenLink);
  }

  public onNoClick(): void {
    this.dialogRef.close();
  }

  public onSubmit(evt: any): void {
    evt.preventDefault();

    console.log(this.consentOptions.value);

    this.dialogRef.close(this.consentOptions.value);
  }

  private onOpenLink = (element: HTMLAnchorElement): boolean => {
    this._linkService.confirmLinkNavigation(element.href).subscribe();

    return false;
  };
}

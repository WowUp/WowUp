import { Component, ElementRef, Inject, ViewChild } from "@angular/core";
import { MatDialogRef, MAT_DIALOG_DATA } from "@angular/material/dialog";

export interface DialogData {
  title: string;
  message: string;
  positiveKey?: string;
  negativeKey?: string;
}

@Component({
  selector: "app-confirm-dialog",
  templateUrl: "./confirm-dialog.component.html",
  styleUrls: ["./confirm-dialog.component.scss"],
})
export class ConfirmDialogComponent {
  @ViewChild("dialogContent", { read: ElementRef }) public dialogContent!: ElementRef;

  public positiveKey: string;
  public negativeKey: string;

  public constructor(
    public dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData,
  ) {
    this.positiveKey = data.positiveKey ?? "DIALOGS.CONFIRM.POSITIVE_BUTTON";
    this.negativeKey = data.negativeKey ?? "DIALOGS.CONFIRM.NEGATIVE_BUTTON";
  }

  public ngAfterViewChecked(): void {
    // formatDynamicLinks(descriptionContainer, this.onOpenLink);
  }

  // private onOpenLink = (element: HTMLAnchorElement): boolean => {
  //   this._linkService.confirmLinkNavigation(element.href).subscribe();

  //   return false;
  // };
}

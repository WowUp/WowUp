import { AfterViewChecked, Component, ElementRef, Inject, ViewChild } from "@angular/core";
import { MatDialogRef, MAT_DIALOG_DATA } from "@angular/material/dialog";
import { LinkService } from "../../../services/links/link.service";
import { formatDynamicLinks } from "../../../utils/dom.utils";

export interface AlertDialogData {
  title: string;
  message: string;
  positiveButton?: string;
  positiveButtonColor?: "primary" | "accent" | "warn";
  positiveButtonStyle?: "raised" | "flat" | "stroked";
}

@Component({
  selector: "app-alert-dialog",
  templateUrl: "./alert-dialog.component.html",
  styleUrls: ["./alert-dialog.component.scss"],
})
export class AlertDialogComponent implements AfterViewChecked {
  @ViewChild("dialogContent", { read: ElementRef }) public dialogContent!: ElementRef;

  public constructor(
    public dialogRef: MatDialogRef<AlertDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AlertDialogData,
    private _linkService: LinkService
  ) {}

  public ngAfterViewChecked(): void {
    const descriptionContainer: HTMLDivElement = this.dialogContent?.nativeElement;
    formatDynamicLinks(descriptionContainer, this.onOpenLink);
  }

  private onOpenLink = (element: HTMLAnchorElement): boolean => {
    
    this._linkService.confirmLinkNavigation(element.href).subscribe();

    return false;
  };
}

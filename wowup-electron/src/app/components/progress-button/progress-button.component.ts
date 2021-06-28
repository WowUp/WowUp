import { Component, EventEmitter, Input, Output } from "@angular/core";

@Component({
  selector: "app-progress-button",
  templateUrl: "./progress-button.component.html",
  styleUrls: ["./progress-button.component.scss"],
})
export class ProgressButtonComponent {
  @Input() public value = 0;
  @Input() public showProgress = false;
  @Input() public disable = false;

  @Output() public btnClick: EventEmitter<any> = new EventEmitter();

  public onClickButton(evt: Event): void {
    evt.preventDefault();
    evt.stopPropagation();

    this.btnClick.emit(evt);
  }
}

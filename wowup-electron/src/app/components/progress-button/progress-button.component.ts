import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from "@angular/core";

@Component({
  selector: "app-progress-button",
  templateUrl: "./progress-button.component.html",
  styleUrls: ["./progress-button.component.scss"],
})
export class ProgressButtonComponent implements OnInit, OnChanges {
  @Input() value: number;
  @Input() showProgress: boolean = false;
  @Input() disable: boolean = false;

  @Output() btnClick: EventEmitter<any> = new EventEmitter();

  constructor() {}

  ngOnInit(): void {}

  ngOnChanges(changes: SimpleChanges): void {}

  onClickButton(evt: any) {
    evt.preventDefault();
    evt.stopPropagation();

    this.btnClick.emit(evt);
  }
}

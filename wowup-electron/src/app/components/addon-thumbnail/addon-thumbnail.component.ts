import { Component, Input, OnInit } from "@angular/core";

@Component({
  selector: "app-addon-thumbnail",
  templateUrl: "./addon-thumbnail.component.html",
  styleUrls: ["./addon-thumbnail.component.scss"],
})
export class AddonThumbnailComponent implements OnInit {
  @Input() public url = "";
  @Input() public name = "";
  @Input() public size = 40;

  public constructor() {}

  public ngOnInit(): void {}

  public hasUrl(): boolean {
    return !!this.url;
  }

  public getLetter(): string {
    return this.name?.charAt(0).toUpperCase() ?? "";
  }
}

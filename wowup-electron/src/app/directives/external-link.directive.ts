import { Directive, HostListener } from "@angular/core";
import { ElectronService } from "../services";

@Directive({
  selector: "[appExternalLink]",
})
export class ExternalLinkDirective {
  @HostListener("click", ["$event"]) onClick($event) {
    $event.preventDefault();
    $event.stopPropagation();

    const target = $event.path.find((t) => t.tagName === "A");

    this._electronService.shell.openExternal(target.href);
  }

  constructor(private _electronService: ElectronService) {}
}

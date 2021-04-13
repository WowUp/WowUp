import { Directive, HostListener } from "@angular/core";
import { ElectronService } from "../services";

@Directive({
  selector: "[appExternalLink]",
})
export class ExternalLinkDirective {
  @HostListener("click", ["$event"]) public async onClick($event: any): Promise<void> {
    $event.preventDefault();
    $event.stopPropagation();

    const target = $event.path.find((t) => t.tagName === "A");

    await this._electronService.openExternal(target.href);
  }

  public constructor(private _electronService: ElectronService) {}
}

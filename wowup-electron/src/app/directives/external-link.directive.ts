import { Directive, HostListener } from "@angular/core";
import { ElectronService } from "../services";
import { WowUpService } from "../services/wowup/wowup.service";

@Directive({
  selector: "[appExternalLink]",
})
export class ExternalLinkDirective {
  @HostListener("click", ["$event"]) public async onClick($event: any): Promise<void> {
    $event.preventDefault();
    $event.stopPropagation();

    const target = $event.path.find((t) => t.tagName === "A");

    await this._wowupService.openExternalLink(target.href);
  }

  public constructor(private _wowupService: WowUpService) {}
}

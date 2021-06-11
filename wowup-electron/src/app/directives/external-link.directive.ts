import { Directive, HostListener } from "@angular/core";
import { WowUpService } from "../services/wowup/wowup.service";

@Directive({
  selector: "[appExternalLink]",
})
export class ExternalLinkDirective {
  @HostListener("click", ["$event"]) public async onClick($event: MouseEvent): Promise<void> {
    $event.preventDefault();
    $event.stopPropagation();

    const target = ($event as any).path?.find((t) => t.tagName === "A");

    await this._wowupService.openExternalLink(target.href);
  }

  public constructor(private _wowupService: WowUpService) {}
}

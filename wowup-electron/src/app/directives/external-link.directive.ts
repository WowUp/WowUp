import { Directive, HostListener } from "@angular/core";


@Directive({
  selector: "[appExternalLink]",
})
export class ExternalLinkDirective {
  @HostListener("click", ["$event"]) public onClick(): void {
    // $event.preventDefault();
    // $event.stopPropagation();

    // const target = ($event as any).path?.find((t) => t.tagName === "A");

    // this._linkService.confirmLinkNavigation(target.href as string).subscribe();
  }

  public constructor() {}
}

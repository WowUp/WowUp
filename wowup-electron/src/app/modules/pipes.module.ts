import { DatePipe } from "@angular/common";
import { NgModule } from "@angular/core";
import { DownloadCountPipe } from "../pipes/download-count.pipe";
import { GetAddonListItemFilePropPipe } from "../pipes/get-addon-list-item-file-prop.pipe";
import { InterfaceFormatPipe } from "../pipes/interface-format.pipe";
import { InvertBoolPipe } from "../pipes/inverse-bool.pipe";
import { NgxDatePipe } from "../pipes/ngx-date.pipe";
import { RelativeDurationPipe } from "../pipes/relative-duration-pipe";
import { SizeDisplayPipe } from "../pipes/size-display.pipe";
import { TrustHtmlPipe } from "../pipes/trust-html.pipe";

@NgModule({
  declarations: [
    TrustHtmlPipe,
    SizeDisplayPipe,
    NgxDatePipe,
    RelativeDurationPipe,
    GetAddonListItemFilePropPipe,
    DownloadCountPipe,
    InterfaceFormatPipe,
    InvertBoolPipe,
  ],
  exports: [
    TrustHtmlPipe,
    SizeDisplayPipe,
    NgxDatePipe,
    RelativeDurationPipe,
    GetAddonListItemFilePropPipe,
    DownloadCountPipe,
    InterfaceFormatPipe,
    InvertBoolPipe,
  ],
  providers: [RelativeDurationPipe, GetAddonListItemFilePropPipe, DownloadCountPipe, DatePipe],
})
export class PipesModule {}

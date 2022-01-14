import "reflect-metadata";
import "../polyfills";

import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";

import { HTTP_INTERCEPTORS, HttpClient, HttpClientModule } from "@angular/common/http";
import { APP_INITIALIZER, ErrorHandler, NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { BrowserModule } from "@angular/platform-browser";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";
import { TranslateHttpLoader } from "@ngx-translate/http-loader";
import { GalleryModule } from "ng-gallery";

import { AppRoutingModule } from "./app-routing.module";
import { AppComponent } from "./app.component";
import { TitlebarComponent } from "./components/common/titlebar/titlebar.component";
import { DirectiveModule } from "./modules/directive.module";
import { DefaultHeadersInterceptor } from "./interceptors/default-headers.interceptor";
import { ErrorHandlerInterceptor } from "./interceptors/error-handler-interceptor";
import { MatModule } from "./modules/mat-module";
import { HomeModule } from "./pages/home/home.module";
import { AnalyticsService } from "./services/analytics/analytics.service";
import { WowUpApiService } from "./services/wowup-api/wowup-api.service";
import { WowUpService } from "./services/wowup/wowup.service";
import { WarcraftInstallationService } from "./services/warcraft/warcraft-installation.service";
import { AddonService } from "./services/addons/addon.service";
import { IconService } from "./services/icons/icon.service";
import { HorizontalTabsComponent } from "./components/common/horizontal-tabs/horizontal-tabs.component";
import { CommonUiModule } from "./modules/common-ui.module";
import { FooterComponent } from "./components/common/footer/footer.component";
import { VerticalTabsComponent } from "./components/common/vertical-tabs/vertical-tabs.component";
import { AddonProviderFactory } from "./services/addons/addon.provider.factory";

// AoT requires an exported function for factories
export function httpLoaderFactory(http: HttpClient): TranslateHttpLoader {
  return new TranslateHttpLoader(http, "./assets/i18n/", ".json");
}

export function initializeApp(
  wowupService: WowUpService,
  wowUpApiService: WowUpApiService,
  addonService: AddonService,
  warcraftInstallationService: WarcraftInstallationService,
  iconService: IconService,
  addonProviderFactory: AddonProviderFactory
) {
  return async (): Promise<void> => {
    await wowupService.initializeLanguage();
    await addonProviderFactory.loadProviders();
  };
}

@NgModule({
  declarations: [AppComponent, TitlebarComponent, FooterComponent, HorizontalTabsComponent, VerticalTabsComponent],
  imports: [
    BrowserModule,
    FormsModule,
    HttpClientModule,
    HomeModule,
    AppRoutingModule,
    DirectiveModule,
    MatModule,
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: httpLoaderFactory,
        deps: [HttpClient],
      },
      compiler: {
        provide: TranslateCompiler,
        useClass: TranslateMessageFormatCompiler,
      },
    }),
    BrowserAnimationsModule,
    GalleryModule,
    CommonUiModule,
  ],
  providers: [
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApp,
      deps: [
        WowUpService,
        WowUpApiService,
        AddonService,
        WarcraftInstallationService,
        IconService,
        AddonProviderFactory,
      ],
      multi: true,
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: DefaultHeadersInterceptor,
      multi: true,
    },
    {
      provide: ErrorHandler,
      useClass: ErrorHandlerInterceptor,
      deps: [AnalyticsService],
    },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}

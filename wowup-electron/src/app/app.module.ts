import { HttpClient, HttpClientModule, HTTP_INTERCEPTORS } from "@angular/common/http";
import { APP_INITIALIZER, ErrorHandler, NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { BrowserModule } from "@angular/platform-browser";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
// NG Translate
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";
import { TranslateHttpLoader } from "@ngx-translate/http-loader";
import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";
import "reflect-metadata";
import "../polyfills";
import { AppRoutingModule } from "./app-routing.module";
import { AppComponent } from "./app.component";
import { FooterComponent } from "./components/footer/footer.component";
import { TitlebarComponent } from "./components/titlebar/titlebar.component";
import { DirectiveModule } from "./directive.module";
import { DefaultHeadersInterceptor } from "./interceptors/default-headers.interceptor";
import { ErrorHandlerIntercepter } from "./interceptors/error-handler-intercepter";
import { MatModule } from "./mat-module";
import { HomeModule } from "./pages/home/home.module";
import { AnalyticsService } from "./services/analytics/analytics.service";
import { WowUpService } from "./services/wowup/wowup.service";
import { SharedModule } from "./shared/shared.module";

// AoT requires an exported function for factories
export function httpLoaderFactory(http: HttpClient): TranslateHttpLoader {
  return new TranslateHttpLoader(http, "./assets/i18n/", ".json");
}

export function initializeApp(wowupService: WowUpService) {
  return async () => {
    await wowupService.initializeLanguage();
  };
}

@NgModule({
  declarations: [AppComponent, TitlebarComponent, FooterComponent],
  imports: [
    BrowserModule,
    FormsModule,
    HttpClientModule,
    SharedModule,
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
  ],
  providers: [
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApp,
      deps: [WowUpService],
      multi: true,
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: DefaultHeadersInterceptor,
      multi: true,
    },
    {
      provide: ErrorHandler,
      useClass: ErrorHandlerIntercepter,
      deps: [AnalyticsService],
    },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}

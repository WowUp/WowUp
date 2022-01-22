import { HttpClient, HttpClientModule } from "@angular/common/http";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";
import { TranslateHttpLoader } from "@ngx-translate/http-loader";
import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";
import { MatModule } from "../modules/mat-module";

export function mockPreload(): void {
  window.wowup = {
    onRendererEvent: () => {},
    onceRendererEvent: () => {},
    openExternal: async () => {},
    openPath: () => Promise.resolve(""),
    rendererInvoke: () => Promise.resolve(undefined),
    rendererSendSync: () => undefined,
    rendererOff: () => {},
    rendererOn: () => {},
    rendererSend: () => {},
  };
}

// AoT requires an exported function for factories
export function httpLoaderFactoryTest(http: HttpClient): TranslateHttpLoader {
  return new TranslateHttpLoader(http, "./assets/i18n/", ".json");
}

export function getStandardImports(): any[] {
  return [
    MatModule,
    HttpClientModule,
    BrowserAnimationsModule,
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: httpLoaderFactoryTest,
        deps: [HttpClient],
      },
      compiler: {
        provide: TranslateCompiler,
        useClass: TranslateMessageFormatCompiler,
      },
    }),
  ];
}

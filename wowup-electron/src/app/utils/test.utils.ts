import { HttpClient } from "@angular/common/http";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";
import { TranslateHttpLoader } from "@ngx-translate/http-loader";
import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";

export function testHttpLoaderFactory(http: HttpClient): TranslateHttpLoader {
  return new TranslateHttpLoader(http, "./assets/i18n/", ".json");
}

export function createTranslateModule() {
  return TranslateModule.forRoot({
    loader: {
      provide: TranslateLoader,
      useFactory: testHttpLoaderFactory,
      deps: [HttpClient],
    },
    compiler: {
      provide: TranslateCompiler,
      useClass: TranslateMessageFormatCompiler,
    },
  });
}

import { HttpClient, HttpClientModule } from "@angular/common/http";
import { TestBed, waitForAsync } from "@angular/core/testing";
import { TranslateCompiler, TranslateLoader, TranslateModule, TranslateService } from "@ngx-translate/core";
import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";
import { TranslateHttpLoader } from "@ngx-translate/http-loader";

const LOCALES = ["cs", "de", "en", "es", "fr", "it", "ko", "nb", "pt", "ru", "zh-TW", "zh"];

// AoT requires an exported function for factories
export function httpLoaderFactory(http: HttpClient): TranslateHttpLoader {
  return new TranslateHttpLoader(http, "./assets/i18n/", ".json");
}

describe("LocaleTest", () => {
  let translate: TranslateService;

  beforeEach(
    waitForAsync(() => {
      TestBed.configureTestingModule({
        declarations: [],
        imports: [
          HttpClientModule,
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
        ],
        providers: [],
      }).compileComponents();
    })
  );

  beforeEach(() => {
    translate = TestBed.inject(TranslateService);
  });

  function checkLocale(locale: string) {
    it(
      `should load ${locale} locale`,
      waitForAsync(async () => {
        await translate.use(locale).toPromise();
        const localeKey = "APP.AUTO_UPDATE_NOTIFICATION_TITLE";
        const result: string = await translate.get(localeKey).toPromise();
        console.log(`Checking locale: ${locale} -> ${result}`);
        expect(result === localeKey).toBeFalse();
      })
    );
  }

  for (const locale of LOCALES) {
    checkLocale(locale);
  }
});

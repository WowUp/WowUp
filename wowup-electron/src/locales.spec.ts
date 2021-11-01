import { HttpClientModule } from "@angular/common/http";
import { TestBed } from "@angular/core/testing";
import { TranslateCompiler, TranslateLoader, TranslateModule, TranslateService } from "@ngx-translate/core";
import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";
import fs from "fs";
import path from "path";
import flatten from "flat";
import { Observable, of } from "rxjs";

const LOCALES = ["cs", "de", "en", "es", "fr", "it", "ko", "nb", "pt", "ru", "zh-TW", "zh"];
const LOCALE_DIR = path.join(__dirname, "..", "..", "..", "..", "..", "..", "src", "assets", "i18n");

class JsonTranslationLoader implements TranslateLoader {
  public getTranslation(code = ""): Observable<any> {
    const localeJson = fs.readFileSync(path.join(LOCALE_DIR, `${code}.json`), {
      encoding: "utf-8",
    });
    const localeObj = JSON.parse(localeJson);

    return of(localeObj);
  }
}

describe("LocaleTest", () => {
  let translate: TranslateService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [],
      imports: [
        HttpClientModule,
        TranslateModule.forRoot({
          loader: { provide: TranslateLoader, useClass: JsonTranslationLoader },
          compiler: {
            provide: TranslateCompiler,
            useClass: TranslateMessageFormatCompiler,
          },
        }),
      ],
      providers: [],
    })
      .compileComponents()
      .catch((e) => console.error(e));
  });

  beforeEach(() => {
    translate = TestBed.inject(TranslateService);
  });

  LOCALES.forEach((locale) => {
    describe(`${locale}:`, () => {
      beforeEach(async () => {
        await translate.use(locale).toPromise();
      });

      const localeKeys = loadLocaleKeys(locale);
      for (const lk of Object.keys(localeKeys)) {
        it(`should have translated value ${locale}:${lk}`, async () => {
          await translate
            .get(lk, { count: 1, myriadCount: 2, rawCount: 3, addonNames: "test1, test2" })
            .toPromise()
            .catch((e) => console.error(e))
            .then((translated) => {
              expect(translated === lk).toBeFalse();
            });
        });
      }
    });
  });

  function loadLocaleKeys(locale: string): { [key: string]: string } {
    const localeJson = fs.readFileSync(path.join(LOCALE_DIR, `${locale}.json`), {
      encoding: "utf-8",
    });
    const localeObj = JSON.parse(localeJson);
    const localeStrs: { [key: string]: string } = flatten(localeObj);

    return localeStrs;
  }
});

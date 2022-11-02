/* eslint-disable */
import { TestBed } from "@angular/core/testing";
import { TranslateCompiler, TranslateLoader, TranslateModule, TranslateService } from "@ngx-translate/core";
import fs from "fs";
import path from "path";
import flatten from "flat";
import { catchError, firstValueFrom, Observable, of } from "rxjs";
import MessageFormat, { MessageFormatOptions } from "@messageformat/core";

const LOCALES = ["cs", "de", "en", "es", "fr", "it", "ko", "nb", "pt", "ru", "zh-TW", "zh"];
const LOCALE_DIR = path.join(__dirname, "..", "..", "..", "..", "..", "..", "src", "assets", "i18n");

const LOCALE_SET = {};

function loadLocale(code: string) {
  const localeJson = fs.readFileSync(path.join(LOCALE_DIR, `${code}.json`), {
    encoding: "utf-8",
  });
  const localeObj = JSON.parse(localeJson);

  LOCALE_SET[code] = flatten(localeObj);

  console.log(`LOCALE ${code} ${Object.keys(localeObj).length.toString()}`);
}

for (const code of LOCALES) {
  loadLocale(code);
}

class CustomCompiler extends TranslateCompiler {
  private mfCache = new Map<string, MessageFormat>();
  private config: MessageFormatOptions<"string">;

  public constructor() {
    super();

    this.config = { customFormatters: undefined, biDiSupport: false, strict: false };
  }

  public compile(value: string, lang: string): (params: any) => string {
    return this.getMessageFormatInstance(lang).compile(value);
  }

  private doTx(key: string, lang: string): (args: any) => string {
    return (args: any) => {
      console.log("DO COMP", key, args);
      return this.getMessageFormatInstance(lang).compile(key)(args);
    };
  }

  compileTranslations(translation: any, lang: string): Object {
    const f = flatten(translation) as any;

    Object.keys(f).forEach((k) => {
      const ik = f[k];
      f[k] = this.doTx(ik, lang);
    });

    return f;
  }

  private getMessageFormatInstance(locale: string): MessageFormat {
    if (!this.mfCache.has(locale)) {
      this.mfCache.set(locale, new MessageFormat<"string">(locale, this.config));
    }

    return this.mfCache.get(locale)!;
  }
}

class JsonTranslationLoader implements TranslateLoader {
  public getTranslation(code: string): Observable<any> {
    console.log("LOAD CODE " + code);
    return of(LOCALE_SET["en"]);
  }
}

describe("LocaleTest", () => {
  let translate: TranslateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        TranslateModule.forRoot({
          loader: { provide: TranslateLoader, useClass: JsonTranslationLoader },
          compiler: {
            provide: TranslateCompiler,
            useClass: CustomCompiler,
          },
        }),
      ],
    });

    translate = TestBed.inject(TranslateService);
  });

  describe("compiler check", () => {
    it("should use the correct compiler", () => {
      expect(translate).toBeDefined();
      expect(translate.compiler).toBeDefined();
      expect(translate.compiler instanceof CustomCompiler).toBeTruthy();
    });
  });

  LOCALES.forEach((locale) => {
    describe(`${locale}:`, () => {
      beforeEach(async () => {
        try {
          return await firstValueFrom(translate.use(locale));
        } catch (e) {
          return console.error(e);
        }
      });

      const localeKeys = loadLocaleKeys(locale);
      for (const lk of Object.keys(localeKeys)) {
        it(`should have translated value ${locale}:${lk}`, (done) => {
          // console.log("translations", JSON.stringify(translate.store.translations));
          translate
            .get(lk, { d: Date.now(), count: 1, myriadCount: 2, rawCount: 3, addonNames: "test1, test2" })
            .pipe(
              catchError((e) => {
                console.error(e);
                return of("");
              })
            )
            .subscribe((tx) => {
              console.log(`TX ${tx}`);
              expect(tx === lk).toBeFalse();
              done();
            });
        });
      }
    });
  });

  function loadLocaleKeys(locale: string): { [key: string]: string } {
    const localeObj = LOCALE_SET[locale];
    const localeStrs: { [key: string]: string } = flatten(localeObj);

    return localeStrs;
  }
});

import { ComponentFixture, TestBed } from "@angular/core/testing";
import { AlertDialogComponent } from "./alert-dialog.component";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { HttpClient, HttpClientModule } from "@angular/common/http";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";
import { httpLoaderFactory } from "../../app.module";
import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";
import { MatModule } from "../../mat-module";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";

describe("AlertDialogComponent", () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AlertDialogComponent],
      imports: [
        MatModule,
        NoopAnimationsModule,
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
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: {} },
        { provide: MatDialogRef, useValue: {} },
      ],
    }).compileComponents();
  });

  it("should create", () => {
    const fixture = TestBed.createComponent(AlertDialogComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});

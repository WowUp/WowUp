import { ComponentFixture, TestBed, waitForAsync } from "@angular/core/testing";
import { GetAddonListItemFilePropPipe } from "./get-addon-list-item-file-prop.pipe";
import { HttpClient, HttpClientModule } from "@angular/common/http";
import { TranslateCompiler, TranslateLoader, TranslateModule } from "@ngx-translate/core";
import { httpLoaderFactory } from "../app.module";
import { TranslateMessageFormatCompiler } from "ngx-translate-messageformat-compiler";
import { Component } from "@angular/core";
import { GetAddonListItem } from "../business-objects/get-addon-list-item";
import { AddonChannelType } from "../models/wowup/addon-channel-type";

@Component({
  template: `<p>{{ item | getAddonListItemFileProp: "version": channel }}</p>`,
})
class TestAddonListItemFilePropComponent {
  public item: GetAddonListItem = {
    searchResult: {
      files: [],
    },
  } as GetAddonListItem;
  public channel: AddonChannelType = AddonChannelType.Stable;
}

describe("GetAddonListItemFilePropPipe", () => {
  let component: TestAddonListItemFilePropComponent;
  let fixture: ComponentFixture<TestAddonListItemFilePropComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TestAddonListItemFilePropComponent, GetAddonListItemFilePropPipe],
      imports: [HttpClientModule, TranslateModule.forRoot({
        loader: {
          provide: TranslateLoader,
          useFactory: httpLoaderFactory,
          deps: [HttpClient],
        },
        compiler: {
          provide: TranslateCompiler,
          useClass: TranslateMessageFormatCompiler,
        },
      })],
    }).compileComponents();

    fixture = TestBed.createComponent(TestAddonListItemFilePropComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});

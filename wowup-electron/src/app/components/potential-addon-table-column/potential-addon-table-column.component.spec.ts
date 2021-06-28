import { TestBed } from "@angular/core/testing";
import { GetAddonListItemFilePropPipe } from "../../pipes/get-addon-list-item-file-prop.pipe";
import { DialogFactory } from "../../services/dialog/dialog.factory";
import { PotentialAddonTableColumnComponent } from "./potential-addon-table-column.component";

describe("PotentialAddonTableColumnComponent", () => {
  let dialogFactory: DialogFactory;

  beforeEach(async () => {
    dialogFactory = jasmine.createSpyObj("DialogFactory", [""], {});

    await TestBed.configureTestingModule({
      declarations: [PotentialAddonTableColumnComponent, GetAddonListItemFilePropPipe],
      imports: [
        // MatModule,
        // NoopAnimationsModule,
        // HttpClientModule,
        // MatDialogModule,
        // TranslateModule.forRoot({
        //   loader: {
        //     provide: TranslateLoader,
        //     useFactory: httpLoaderFactory,
        //     deps: [HttpClient],
        //   },
        //   compiler: {
        //     provide: TranslateCompiler,
        //     useClass: TranslateMessageFormatCompiler,
        //   },
        // }),
      ],
      providers: [GetAddonListItemFilePropPipe],
    })
      .overrideComponent(PotentialAddonTableColumnComponent, {
        set: {
          providers: [{ provide: DialogFactory, useValue: dialogFactory }],
        },
      })
      .compileComponents();
  });

  it("should create", () => {
    const fixture = TestBed.createComponent(PotentialAddonTableColumnComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});

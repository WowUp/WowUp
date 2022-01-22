import { ComponentFixture, TestBed } from "@angular/core/testing";

import { SessionService } from "../../../services/session/session.service";
import { TableContextHeaderCellComponent } from "./table-context-header-cell.component";

describe("TableContextHeaderCellComponent", () => {
  let component: TableContextHeaderCellComponent;
  let fixture: ComponentFixture<TableContextHeaderCellComponent>;
  let sessionService: SessionService;

  beforeEach(async () => {
    sessionService = jasmine.createSpyObj("SessionService", [""], {});

    await TestBed.configureTestingModule({
      declarations: [TableContextHeaderCellComponent],
    })
      .overrideComponent(TableContextHeaderCellComponent, {
        set: {
          providers: [{ provide: SessionService, useValue: sessionService }],
        },
      })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TableContextHeaderCellComponent);
    component = fixture.componentInstance;

    /* eslint-disable @typescript-eslint/no-unsafe-argument */
    component.agInit({
      column: {
        addEventListener: () => {},
        isSortAscending: () => false,
        isSortDescending: () => false,
      },
    } as any);
    /* eslint-enable @typescript-eslint/no-unsafe-argument */

    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});

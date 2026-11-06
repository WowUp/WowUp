import { ICellRendererParams } from "ag-grid-community";
import { WowClientType, WowInstallation } from "wowup-lib-core";

import { SessionService } from "../../../services/session/session.service";
import { GameVersionCellComponent } from "./game-version-cell.component";

describe("GameVersionCellComponent", () => {
  function render(value: string[], installation: Partial<WowInstallation> | undefined): GameVersionCellComponent {
    const session = {
      getSelectedWowInstallation: () => installation as WowInstallation | undefined,
    } as unknown as SessionService;

    const component = new GameVersionCellComponent(session);
    component.agInit({ value } as ICellRendererParams);
    return component;
  }

  it("shows only the newest version of the installation's flavor", () => {
    const component = render(["11.2.7", "11.2.5", "11.0.7"], {
      clientType: WowClientType.Retail,
      gameVersion: "12.1.5",
    });

    expect(component.displayValue).toEqual("11.2.7");
  });

  it("ignores versions of other flavors", () => {
    const component = render(["1.15.9", "12.1.7", "12.1.5"], {
      clientType: WowClientType.Retail,
      gameVersion: "12.1.5",
    });

    expect(component.displayValue).toEqual("12.1.7");
  });

  it("keeps every version in the tooltip", () => {
    const component = render(["12.1.7", "1.15.9"], { clientType: WowClientType.Retail, gameVersion: "12.1.5" });

    expect(component.title).toEqual("12.1.7, 1.15.9");
  });

  it("does not mix classic era with forever", () => {
    const era = render(["1.60.2", "1.15.9"], { clientType: WowClientType.ClassicEra, gameVersion: "1.15.9" });
    const forever = render(["1.60.2", "1.15.9"], { clientType: WowClientType.Forever, gameVersion: "1.60.1" });

    expect(era.displayValue).toEqual("1.15.9");
    expect(forever.displayValue).toEqual("1.60.2");
  });

  it("falls back to the first version with a count when the game version is unknown", () => {
    const component = render(["12.1.7", "12.1.5"], { clientType: WowClientType.Retail });

    expect(component.displayValue).toEqual("12.1.7, 1 +");
  });

  it("falls back when none of the versions belong to the installation's flavor", () => {
    const component = render(["1.15.9"], { clientType: WowClientType.Retail, gameVersion: "12.1.5" });

    expect(component.displayValue).toEqual("1.15.9");
  });
});

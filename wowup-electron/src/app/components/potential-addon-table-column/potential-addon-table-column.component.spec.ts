import { inject } from "@angular/core/testing";
import { GetAddonListItemFilePropPipe } from "../../pipes/get-addon-list-item-file-prop.pipe";
import { PotentialAddonTableColumnComponent } from "./potential-addon-table-column.component";

describe("PotentialAddonTableColumnComponent", () => {
  it("should create", () => {
    inject([GetAddonListItemFilePropPipe], (propPipe: GetAddonListItemFilePropPipe) => {
      const pipe = new PotentialAddonTableColumnComponent(propPipe);
      expect(pipe).toBeTruthy();
    });
  });
});

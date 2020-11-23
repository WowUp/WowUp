import { DatePipe } from "@angular/common";
import { inject } from "@angular/core/testing";
import { TranslateService } from "@ngx-translate/core";
import { RelativeDurationPipe } from "./relative-duration-pipe";

describe("RelativeDurationPipe", () => {
  it("create an instance", () => {
    inject([DatePipe, TranslateService], (datePipe: DatePipe, translateService: TranslateService) => {
      const pipe = new RelativeDurationPipe(translateService);
      expect(pipe).toBeTruthy();
    });
  });
});

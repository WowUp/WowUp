import { IPC_THEME_NATIVE_UPDATED, IPC_THEME_SHOULD_USE_DARK_COLORS } from "../../../common/constants";
import { ElectronService } from "../electron/electron.service";
import { ThemeApiService } from "./theme-api.service";

describe("ThemeApiService", () => {
  let service: ThemeApiService;
  let electronServiceSpy: any;

  beforeEach(() => {
    electronServiceSpy = jasmine.createSpyObj("ElectronService", ["invoke", "onRendererEvent"]);
    service = new ThemeApiService(electronServiceSpy as unknown as ElectronService);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  it("asks the main process for the current OS color scheme", async () => {
    electronServiceSpy.invoke.and.returnValue(Promise.resolve(true));

    const result = await service.getShouldUseDarkColors();

    expect(electronServiceSpy.invoke).toHaveBeenCalledWith(IPC_THEME_SHOULD_USE_DARK_COLORS);
    expect(result).toBe(true);
  });

  it("forwards native theme change pushes from the main process to the given callback", () => {
    const callback = jasmine.createSpy("callback");

    service.onShouldUseDarkColorsChanged(callback);

    expect(electronServiceSpy.onRendererEvent).toHaveBeenCalledWith(IPC_THEME_NATIVE_UPDATED, jasmine.any(Function));

    const registeredListener = electronServiceSpy.onRendererEvent.calls.mostRecent().args[1];
    registeredListener({}, false);

    expect(callback).toHaveBeenCalledWith(false);
  });
});

import { expect } from "chai";

import { WOWUP_PROTOCOL_NAME } from "../../wowup-shell/contract/protocol-client";
import { APP_PROTOCOL_NAME } from "../src/common/constants";

// The shell can't import app code, so the values it shares with the app are duplicated and checked here
describe("shell contract", () => {
  it("the shell registers the same protocol name the app handles", () => {
    expect(WOWUP_PROTOCOL_NAME).to.equal(APP_PROTOCOL_NAME);
  });
});

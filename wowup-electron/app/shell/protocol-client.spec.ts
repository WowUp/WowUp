import { expect } from "chai";

import { APP_PROTOCOL_NAME } from "../../src/common/constants";
import { WOWUP_PROTOCOL_NAME } from "./protocol-client";

describe("protocol-client", () => {
  it("registers the same protocol name the app handles", () => {
    expect(WOWUP_PROTOCOL_NAME).to.equal(APP_PROTOCOL_NAME);
  });
});

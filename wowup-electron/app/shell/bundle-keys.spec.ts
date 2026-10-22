import { expect } from "chai";
import { createPublicKey } from "crypto";

import { BUNDLE_PUBLIC_KEYS } from "./bundle-keys";

describe("BUNDLE_PUBLIC_KEYS", () => {
  it("has at least one key", () => {
    expect(Object.keys(BUNDLE_PUBLIC_KEYS)).to.not.be.empty;
  });

  // A pasted key that doesn't parse would make every manifest signed with it fail verification
  for (const [keyId, pem] of Object.entries(BUNDLE_PUBLIC_KEYS)) {
    it(`"${keyId}" is an ed25519 public key`, () => {
      expect(createPublicKey(pem).asymmetricKeyType).to.equal("ed25519");
    });
  }
});

import { expect } from "chai";

import {
  SETTINGS_SYNC_ERROR_INVALID_CODE,
  SETTINGS_SYNC_ERROR_WRONG_KEY,
} from "../../../src/common/models/settings-sync";
import { createSyncCode, deriveSyncKeys, getCodeHint, normalizeSyncCode, open, opaqueName, seal } from "./sync-crypto";

describe("sync-crypto", () => {
  describe("sync codes", () => {
    it("creates codes that validate and differ", () => {
      const a = createSyncCode();
      const b = createSyncCode();
      expect(a).to.match(/^WUS1(-[A-Z2-9]{4}){14}$/);
      expect(a).to.not.equal(b);
      expect(normalizeSyncCode(a)).to.equal(a);
    });

    it("accepts a code typed in lower case, with spaces or without dashes", () => {
      const code = createSyncCode();
      expect(normalizeSyncCode(code.toLowerCase().replace(/-/g, " "))).to.equal(code);
      expect(normalizeSyncCode(code.replace(/-/g, ""))).to.equal(code);
    });

    it("rejects a typo instead of opening another vault", () => {
      const code = createSyncCode();
      const last = code[code.length - 6];
      const typo = code.slice(0, -6) + (last === "A" ? "B" : "A") + code.slice(-5);
      expect(() => normalizeSyncCode(typo)).to.throw(SETTINGS_SYNC_ERROR_INVALID_CODE);
      expect(() => normalizeSyncCode("hello")).to.throw(SETTINGS_SYNC_ERROR_INVALID_CODE);
      expect(() => normalizeSyncCode(code.slice(0, -1))).to.throw(SETTINGS_SYNC_ERROR_INVALID_CODE);
    });

    it("hints at a code without giving it away", () => {
      const code = createSyncCode();
      expect(getCodeHint(code)).to.equal(code.slice(0, 9));
    });
  });

  describe("keys", () => {
    it("derives the same keys from the same code on every device", () => {
      const code = createSyncCode();
      const a = deriveSyncKeys(code);
      const b = deriveSyncKeys(code.toLowerCase());
      expect(a.vaultId)
        .to.equal(b.vaultId)
        .and.to.match(/^[0-9a-f]{32}$/);
      expect(a.encryptionKey.equals(b.encryptionKey)).to.equal(true);
      expect(opaqueName(a, "game:Forever")).to.equal(opaqueName(b, "game:Forever"));
    });

    it("derives different vaults for different codes", () => {
      expect(deriveSyncKeys(createSyncCode()).vaultId).to.not.equal(deriveSyncKeys(createSyncCode()).vaultId);
    });
  });

  describe("seal / open", () => {
    const keys = deriveSyncKeys(createSyncCode());
    const plaintext = Buffer.from('WeakAurasSaved = { ["displays"] = {} }');

    it("round-trips and hides the content", () => {
      const sealed = seal(keys, plaintext, "blob:x");
      expect(sealed.includes(Buffer.from("WeakAuras"))).to.equal(false);
      expect(open(keys, sealed, "blob:x").equals(plaintext)).to.equal(true);
    });

    it("refuses another key, another context and tampered data", () => {
      const sealed = seal(keys, plaintext, "blob:x");
      const otherKeys = deriveSyncKeys(createSyncCode());
      expect(() => open(otherKeys, sealed, "blob:x")).to.throw(SETTINGS_SYNC_ERROR_WRONG_KEY);
      expect(() => open(keys, sealed, "blob:y")).to.throw(SETTINGS_SYNC_ERROR_WRONG_KEY);

      const tampered = Buffer.from(sealed);
      tampered[tampered.length - 1] ^= 1;
      expect(() => open(keys, tampered, "blob:x")).to.throw(SETTINGS_SYNC_ERROR_WRONG_KEY);
      expect(() => open(keys, Buffer.from("nope"), "blob:x")).to.throw(SETTINGS_SYNC_ERROR_WRONG_KEY);
    });
  });
});

import { expect } from "chai";

import { createLiveInstallation, createLiveNetwork, silenceConsoleErrors } from "./live-test-helpers";
import { TukUiAddonProvider } from "./tukui-addon-provider";

silenceConsoleErrors();

function createTukUiProvider(): TukUiAddonProvider {
  return new TukUiAddonProvider(createLiveNetwork("tukui_provider"));
}

it("TukUiAddonProvider getAllBatch empty", async () => {
  const provider = createTukUiProvider();

  const batch = await provider.getAllBatch([createLiveInstallation()], ["24910"]);

  expect(Object.keys(batch.errors).length).to.deep.equal(0);
  expect(Object.keys(batch.installationResults).length).to.deep.equal(0);
});

it("TukUiAddonProvider getAll success", async () => {
  const provider = createTukUiProvider();

  const allResults = await provider.getAll(createLiveInstallation(), ["-1", "-2"]);

  expect(Array.isArray(allResults?.searchResults)).to.equal(true);
  expect(allResults.searchResults.length).to.deep.equal(2);
});

it("TukUiAddonProvider getAll with error and success", async () => {
  const provider = createTukUiProvider();

  const allResults = await provider.getAll(createLiveInstallation(), ["-1", "-2", "88140000"]);

  expect(Array.isArray(allResults?.errors)).to.equal(true);
  expect(Array.isArray(allResults?.searchResults)).to.equal(true);
  expect(allResults.searchResults.length).to.deep.equal(2);
  expect(allResults.errors.length).to.deep.equal(1);
});

it("TukUiAddonProvider getAll with error", async () => {
  const provider = createTukUiProvider();

  const allResults = await provider.getAll(createLiveInstallation(), ["88140000"]);

  expect(Array.isArray(allResults?.errors)).to.equal(true);
  expect(Array.isArray(allResults?.searchResults)).to.equal(true);
  expect(allResults.searchResults.length).to.deep.equal(0);
  expect(allResults.errors.length).to.deep.equal(1);
});

it("TukUiAddonProvider getAll empty set", async () => {
  const provider = createTukUiProvider();

  const allResults = await provider.getAll(createLiveInstallation(), []);

  expect(Array.isArray(allResults?.errors)).to.equal(true);
  expect(Array.isArray(allResults?.searchResults)).to.equal(true);
  expect(allResults.searchResults.length).to.deep.equal(0);
  expect(allResults.errors.length).to.deep.equal(0);
});

it("TukUiAddonProvider getAll bad id set", async () => {
  const provider = createTukUiProvider();

  const allResults = await provider.getAll(createLiveInstallation(), ["", "abcd"]);

  expect(Array.isArray(allResults?.errors)).to.equal(true);
  expect(Array.isArray(allResults?.searchResults)).to.equal(true);
  expect(allResults.searchResults.length).to.deep.equal(0);
  expect(allResults.errors.length).to.deep.equal(2);
});

it("TukUiAddonProvider getAll mixed bad good id set", async () => {
  const provider = createTukUiProvider();

  const allResults = await provider.getAll(createLiveInstallation(), ["", "abcd", "-1"]);

  expect(Array.isArray(allResults?.errors)).to.equal(true);
  expect(Array.isArray(allResults?.searchResults)).to.equal(true);
  expect(allResults.searchResults.length).to.deep.equal(1);
  expect(allResults.errors.length).to.deep.equal(2);
});

it("TukUiAddonProvider getDescription success", async () => {
  const provider = createTukUiProvider();

  const desc = await provider.getDescription(createLiveInstallation(), "-1");

  expect(typeof desc === "string").to.equal(true);
  expect(desc.length).to.be.greaterThan(0);
});

it("TukUiAddonProvider getDescription failure", async () => {
  const provider = createTukUiProvider();

  const desc = await provider.getDescription(createLiveInstallation(), "88140000");

  expect(typeof desc).to.deep.equal("string");
  expect(desc.length).to.deep.equal(0);
});

it("TukUiAddonProvider getChangelog success", async () => {
  const provider = createTukUiProvider();

  const desc = await provider.getChangelog(createLiveInstallation(), "-2");

  expect(typeof desc === "string").to.equal(true);
  expect(desc.length).to.be.greaterThan(0);
});

it("TukUiAddonProvider getChangelog failure", async () => {
  const provider = createTukUiProvider();

  const desc = await provider.getChangelog(createLiveInstallation(), "88140000");

  expect(typeof desc).to.deep.equal("string");
  expect(desc.length).to.deep.equal(0);
});

it("TukUiAddonProvider searchByUrl not implemented", async () => {
  const provider = createTukUiProvider();

  const url = new URL("https://api.tukui.org/addons.php?id=38");
  const result = await provider.searchByUrl(url, createLiveInstallation());
  expect(result).to.equal(undefined);
});

it("TukUiAddonProvider getById with success", async () => {
  const provider = createTukUiProvider();

  const searchResult = await provider.getById("-2", createLiveInstallation());

  expect(searchResult).to.not.equal(undefined);
  expect(searchResult?.name.length).to.be.greaterThan(1);
});

it("TukUiAddonProvider getById id failure", async () => {
  const provider = createTukUiProvider();

  const searchResult = await provider.getById("88140000", createLiveInstallation());

  expect(searchResult).to.equal(undefined);
});

it("TukUiAddonProvider getById empty id failure", async () => {
  const provider = createTukUiProvider();

  const searchResult = await provider.getById("", createLiveInstallation());

  expect(searchResult).to.equal(undefined);
});

it("TukUiAddonProvider isValidAddonUri not implemented", () => {
  const provider = createTukUiProvider();

  const url = new URL("https://api.tukui.org/addons.php?id=38");
  const isValid = provider.isValidAddonUri(url);

  expect(isValid).to.deep.equal(false);
});

it("TukUiAddonProvider isValidAddonId success", () => {
  const provider = createTukUiProvider();

  const isValid = provider.isValidAddonId("8814");

  expect(isValid).to.deep.equal(true);
});

it("TukUiAddonProvider isValidAddonId failure", () => {
  const provider = createTukUiProvider();

  const isValid = provider.isValidAddonId("abcd");

  expect(isValid).to.deep.equal(false);
});

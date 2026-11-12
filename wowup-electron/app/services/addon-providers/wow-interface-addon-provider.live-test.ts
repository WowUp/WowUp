import { expect } from "chai";

import { createLiveInstallation, createLiveNetwork, expectRejection, silenceConsoleErrors } from "./live-test-helpers";
import { WowInterfaceAddonProvider } from "./wow-interface-addon-provider";

silenceConsoleErrors();

it("WowInterfaceAddonProvider getAllBatch empty", async () => {
  const provider = createWowInterfaceProvider();

  const batch = await provider.getAllBatch([createLiveInstallation()], ["24910"]);

  expect(Object.keys(batch.errors).length).to.deep.equal(0);
  expect(Object.keys(batch.installationResults).length).to.deep.equal(0);
});

it("WowInterfaceAddonProvider getAll success", async () => {
  const provider = createWowInterfaceProvider();

  const allResults = await provider.getAll(createLiveInstallation(), ["24910", "26409"]);

  expect(Array.isArray(allResults?.searchResults)).to.equal(true);
  expect(allResults.searchResults.length).to.deep.equal(2);
});

it("WowInterfaceAddonProvider getAll with fallback success", async () => {
  const provider = createWowInterfaceProvider();

  const allResults = await provider.getAll(createLiveInstallation(), ["24910", "8814"]);

  expect(Array.isArray(allResults?.searchResults)).to.equal(true);
  expect(allResults.searchResults.length).to.deep.equal(2);
});

it("WowInterfaceAddonProvider getAll with error and success", async () => {
  const provider = createWowInterfaceProvider();

  const allResults = await provider.getAll(createLiveInstallation(), ["24910", "8814", "88140000"]);

  expect(Array.isArray(allResults?.errors)).to.equal(true);
  expect(Array.isArray(allResults?.searchResults)).to.equal(true);
  expect(allResults.searchResults.length).to.deep.equal(2);
  expect(allResults.errors.length).to.deep.equal(1);
});

it("WowInterfaceAddonProvider getAll with error", async () => {
  const provider = createWowInterfaceProvider();

  const allResults = await provider.getAll(createLiveInstallation(), ["88140000"]);

  expect(Array.isArray(allResults?.errors)).to.equal(true);
  expect(Array.isArray(allResults?.searchResults)).to.equal(true);
  expect(allResults.searchResults.length).to.deep.equal(0);
  expect(allResults.errors.length).to.deep.equal(1);
});

it("WowInterfaceAddonProvider getAll empty set", async () => {
  const provider = createWowInterfaceProvider();

  const allResults = await provider.getAll(createLiveInstallation(), []);

  expect(Array.isArray(allResults?.errors)).to.equal(true);
  expect(Array.isArray(allResults?.searchResults)).to.equal(true);
  expect(allResults.searchResults.length).to.deep.equal(0);
  expect(allResults.errors.length).to.deep.equal(0);
});

it("WowInterfaceAddonProvider getAll bad id set", async () => {
  const provider = createWowInterfaceProvider();

  const allResults = await provider.getAll(createLiveInstallation(), ["", "abcd"]);

  expect(Array.isArray(allResults?.errors)).to.equal(true);
  expect(Array.isArray(allResults?.searchResults)).to.equal(true);
  expect(allResults.searchResults.length).to.deep.equal(0);
  expect(allResults.errors.length).to.deep.equal(2);
});

it("WowInterfaceAddonProvider getAll mixed bad good id set", async () => {
  const provider = createWowInterfaceProvider();

  const allResults = await provider.getAll(createLiveInstallation(), ["", "abcd", "24910"]);

  expect(Array.isArray(allResults?.errors)).to.equal(true);
  expect(Array.isArray(allResults?.searchResults)).to.equal(true);
  expect(allResults.searchResults.length).to.deep.equal(1);
  expect(allResults.errors.length).to.deep.equal(2);
});

it("WowInterfaceAddonProvider getAll mixed bad good id with fallback set", async () => {
  const provider = createWowInterfaceProvider();

  const allResults = await provider.getAll(createLiveInstallation(), ["", "abcd", "8814"]);

  expect(Array.isArray(allResults?.errors)).to.equal(true);
  expect(Array.isArray(allResults?.searchResults)).to.equal(true);
  expect(allResults.searchResults.length).to.deep.equal(1);
  expect(allResults.errors.length).to.deep.equal(2);
});

it("WowInterfaceAddonProvider getDescription success", async () => {
  const provider = createWowInterfaceProvider();

  const desc = await provider.getDescription(createLiveInstallation(), "24910");

  expect(typeof desc === "string").to.equal(true);
  expect(desc.length).to.be.greaterThan(0);
});

it("WowInterfaceAddonProvider getDescription with fallback success", async () => {
  const provider = createWowInterfaceProvider();

  const desc = await provider.getDescription(createLiveInstallation(), "8814");

  expect(typeof desc === "string").to.equal(true);
  expect(desc.length).to.be.greaterThan(0);
});

it("WowInterfaceAddonProvider getDescription failure", async () => {
  const provider = createWowInterfaceProvider();
  const desc = await provider.getDescription(createLiveInstallation(), "88140000");
  expect(typeof desc).to.deep.equal("string");
  expect(desc.length).to.deep.equal(0);
});

it("WowInterfaceAddonProvider getChangelog success", async () => {
  const provider = createWowInterfaceProvider();

  const desc = await provider.getChangelog(createLiveInstallation(), "24910");

  expect(typeof desc === "string").to.equal(true);
  expect(desc.length).to.be.greaterThan(0);
});

it("WowInterfaceAddonProvider getChangelog with fallback success", async () => {
  const provider = createWowInterfaceProvider();

  const desc = await provider.getChangelog(createLiveInstallation(), "8814");

  expect(typeof desc === "string").to.equal(true);
  expect(desc.length).to.be.greaterThan(0);
});

it("WowInterfaceAddonProvider getChangelog failure", async () => {
  const provider = createWowInterfaceProvider();
  const desc = await provider.getChangelog(createLiveInstallation(), "88140000");
  expect(typeof desc).to.deep.equal("string");
  expect(desc.length).to.deep.equal(0);
});

it("WowInterfaceAddonProvider searchByUrl success", async () => {
  const provider = createWowInterfaceProvider();

  const searchResult = await provider.searchByUrl(
    new URL("https://www.wowinterface.com/downloads/info26409-HandyNotesDragonflight.html"),
  );

  expect(typeof searchResult).to.not.equal(undefined);
  expect(searchResult.errors?.length).to.deep.equal(0);
  expect(searchResult.searchResult).to.not.equal(undefined);
});

it("WowInterfaceAddonProvider searchByUrl with fallback success", async () => {
  const provider = createWowInterfaceProvider();

  const searchResult = await provider.searchByUrl(
    new URL("https://www.wowinterface.com/downloads/info8814-DeadlyBossMods.html"),
  );

  expect(typeof searchResult).to.not.equal(undefined);
  expect(searchResult.errors?.length).to.deep.equal(0);
  expect(searchResult.searchResult).to.not.equal(undefined);
});

it("WowInterfaceAddonProvider searchByUrl with error", async () => {
  const provider = createWowInterfaceProvider();

  const url = new URL("https://www.wowinterface.com/downloads/info88140000-DeadlyBossMods.html");
  const task = provider.searchByUrl(url);
  await expectRejection(task, `Bad addon api response ${url.toString()}`);
});

it("WowInterfaceAddonProvider getById with success", async () => {
  const provider = createWowInterfaceProvider();

  const searchResult = await provider.getById("26409");

  expect(typeof searchResult).to.not.equal(undefined);
  expect(searchResult?.name.length).to.be.greaterThan(1);
});

it("WowInterfaceAddonProvider getById with fallback success", async () => {
  const provider = createWowInterfaceProvider();

  const searchResult = await provider.getById("8814");

  expect(typeof searchResult).to.not.equal(undefined);
  expect(searchResult?.name.length).to.be.greaterThan(1);
});

it("WowInterfaceAddonProvider getById id failure", async () => {
  const provider = createWowInterfaceProvider();

  const searchResult = await provider.getById("88140000");

  expect(searchResult).to.equal(undefined);
});

it("WowInterfaceAddonProvider getById empty id failure", async () => {
  const provider = createWowInterfaceProvider();

  const searchResult = await provider.getById("");

  expect(searchResult).to.equal(undefined);
});

it("WowInterfaceAddonProvider isValidAddonUri success", () => {
  const provider = createWowInterfaceProvider();

  const url = new URL("https://www.wowinterface.com/downloads/info8814-DeadlyBossMods.html");
  const isValid = provider.isValidAddonUri(url);

  expect(isValid).to.deep.equal(true);
});

it("WowInterfaceAddonProvider isValidAddonUri failure", () => {
  const provider = createWowInterfaceProvider();

  const url = new URL("https://wowup.io/addons/10");
  const isValid = provider.isValidAddonUri(url);

  expect(isValid).to.deep.equal(false);
});

it("WowInterfaceAddonProvider isValidAddonId success", () => {
  const provider = createWowInterfaceProvider();

  const isValid = provider.isValidAddonId("8814");

  expect(isValid).to.deep.equal(true);
});

it("WowInterfaceAddonProvider isValidAddonId failure", () => {
  const provider = createWowInterfaceProvider();

  const isValid = provider.isValidAddonId("abcd");

  expect(isValid).to.deep.equal(false);
});

function createWowInterfaceProvider(): WowInterfaceAddonProvider {
  return new WowInterfaceAddonProvider(createLiveNetwork("wow_interface_provider"));
}

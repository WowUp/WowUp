import { expect } from "chai";

import { createLiveInstallation, createLiveNetwork, expectRejection, silenceConsoleErrors } from "./live-test-helpers";
import { WowUpAddonProvider } from "./wowup-addon-provider";

silenceConsoleErrors();

const HUB_URL = "https://hub.dev.wowup.io";
const WEBSITE_URL = "https://dev.wowup.io";

it("WowUpAddonProvider getDescription success", async () => {
  const provider = getWowUpProvider();

  const desc = await provider.getDescription(createLiveInstallation(), "10");

  expect(typeof desc === "string").to.equal(true);
  expect(desc.length).to.be.greaterThan(0);
});

it("WowUpAddonProvider getDescription bad id", async () => {
  const provider = getWowUpProvider();
  const desc = await provider.getDescription(createLiveInstallation(), "-1");
  expect(desc.length).to.deep.equal(0);
});

it("WowUpAddonProvider getChangelog success", async () => {
  const provider = getWowUpProvider();

  const desc = await provider.getChangelog(createLiveInstallation(), "10", "49996");

  expect(typeof desc === "string").to.equal(true);
  expect(desc.length).to.be.greaterThan(0);
});

it("WowUpAddonProvider getChangelog 404 addon", async () => {
  const provider = getWowUpProvider();

  const desc = await provider.getChangelog(createLiveInstallation(), "-1", "49996");
  expect(desc.length).to.deep.equal(0);
});

it("WowUpAddonProvider getChangelog 404 release", async () => {
  const provider = getWowUpProvider();

  const desc = await provider.getChangelog(createLiveInstallation(), "10", "-1");
  expect(desc.length).to.deep.equal(0);
});

it("WowUpAddonProvider searchProtocol success", async () => {
  const provider = getWowUpProvider();

  const searchRes = await provider.searchProtocol("wowup://install?addonId=10&releaseId=49996");

  expect(searchRes === undefined).to.equal(false);
  expect(searchRes?.protocolAddonId?.length).to.be.greaterThan(0);
});

it("WowUpAddonProvider searchProtocol invalid addon", async () => {
  const provider = getWowUpProvider();

  await expectRejection(provider.searchProtocol("wowup://install?addonId=-1&releaseId=49996"), "Http failure response");
});

it("WowUpAddonProvider searchProtocol invalid release", async () => {
  const provider = getWowUpProvider();

  await expectRejection(provider.searchProtocol("wowup://install?addonId=10&releaseId=-1"), "Http failure response");
});

it("WowUpAddonProvider getAllBatch success", async () => {
  const provider = getWowUpProvider();

  const res = await provider.getAllBatch([createLiveInstallation()], ["10"]);
  expect(res === undefined).to.equal(false);
  Object.keys(res.errors).forEach((k) => {
    expect(Array.isArray(res.errors[k])).to.equal(true);
    expect(res.errors[k].length).to.deep.equal(0);
  });

  Object.keys(res.installationResults).forEach((k) => {
    expect(res.installationResults[k].length).to.be.greaterThan(0);
  });
});

function getWowUpProvider(): WowUpAddonProvider {
  return new WowUpAddonProvider(HUB_URL, WEBSITE_URL, createLiveNetwork("wowup_addon_provider"));
}

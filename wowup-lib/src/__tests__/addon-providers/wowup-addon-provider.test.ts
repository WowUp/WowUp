import { WowUpAddonProvider } from '../../addon-providers/wowup-addon-provider';
import fetchMock from 'jest-fetch-mock';
import { createMockNetworkInterface } from '../../mocks/mock-network-interface';
import { createMockWowInstallation } from '../../mocks/mock-wow-installation';

fetchMock.enableMocks();
fetchMock.dontMock();

jest.setTimeout(10000);

const HUB_URL = 'https://hub.dev.wowup.io';
const WEBSITE_IRL = 'https://dev.wowup.io';

test('WowUpAddonProvider getDescription success', async () => {
  const provider = getWowUpProvider();

  const desc = await provider.getDescription(createMockWowInstallation(), '10');

  expect(typeof desc === 'string').toBeTruthy();
  expect(desc.length).toBeGreaterThan(0);
});

test('WowUpAddonProvider getDescription bad id', async () => {
  const provider = getWowUpProvider();

  const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

  const desc = await provider.getDescription(createMockWowInstallation(), '-1');

  expect(consoleSpy).toHaveBeenCalled();
  expect(desc.length).toEqual(0);
});

test('WowUpAddonProvider getChangelog success', async () => {
  const provider = getWowUpProvider();

  const desc = await provider.getChangelog(createMockWowInstallation(), '10', '49996');

  expect(typeof desc === 'string').toBeTruthy();
  expect(desc.length).toBeGreaterThan(0);
});

test('WowUpAddonProvider getChangelog 404 addon', async () => {
  const provider = getWowUpProvider();

  const desc = await provider.getChangelog(createMockWowInstallation(), '-1', '49996');

  const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

  expect(consoleSpy).toHaveBeenCalled();
  expect(desc.length).toEqual(0);
});

test('WowUpAddonProvider getChangelog 404 release', async () => {
  const provider = getWowUpProvider();

  const desc = await provider.getChangelog(createMockWowInstallation(), '10', '-1');

  const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

  expect(consoleSpy).toHaveBeenCalled();
  expect(desc.length).toEqual(0);
});

test('WowUpAddonProvider searchProtocol success', async () => {
  const provider = getWowUpProvider();

  const searchRes = await provider.searchProtocol('wowup://install?addonId=10&releaseId=49996');

  expect(searchRes === undefined).toBeFalsy();
  expect(searchRes?.protocolAddonId?.length).toBeGreaterThan(0);
});

test('WowUpAddonProvider searchProtocol invalid addon', async () => {
  const provider = getWowUpProvider();

  await expect(provider.searchProtocol('wowup://install?addonId=-1&releaseId=49996')).rejects.toThrow(
    'invalid response',
  );
});

test('WowUpAddonProvider searchProtocol invalid release', async () => {
  const provider = getWowUpProvider();

  await expect(provider.searchProtocol('wowup://install?addonId=10&releaseId=-1')).rejects.toThrow('invalid response');
});

test('WowUpAddonProvider getAllBatch success', async () => {
  const provider = getWowUpProvider();

  const res = await provider.getAllBatch([createMockWowInstallation()], ['10']);
  expect(res === undefined).toBeFalsy();
  Object.keys(res.errors).forEach((k) => {
    expect(Array.isArray(res.errors[k])).toBeTruthy();
    expect(res.errors[k].length).toEqual(0);
  });

  Object.keys(res.installationResults).forEach((k) => {
    expect(res.installationResults[k].length).toBeGreaterThan(0);
  });
});

function getWowUpProvider(): WowUpAddonProvider {
  return new WowUpAddonProvider(HUB_URL, WEBSITE_IRL, createMockNetworkInterface());
}

import { WowInterfaceAddonProvider } from '../../addon-providers/wow-interface-addon-provider';
import { createMockNetworkInterface } from '../../mocks/mock-network-interface';
import { createMockWowInstallation } from '../../mocks/mock-wow-installation';
import fetchMock from 'jest-fetch-mock';

fetchMock.enableMocks();
fetchMock.dontMock();

test('WowInterfaceAddonProvider getAllBatch empty', async () => {
  const provider = createWowInterfaceProvider();

  const batch = await provider.getAllBatch([createMockWowInstallation()], ['24910']);

  expect(Object.keys(batch.errors).length).toEqual(0);
  expect(Object.keys(batch.installationResults).length).toEqual(0);
});

test('WowInterfaceAddonProvider getAll success', async () => {
  const provider = createWowInterfaceProvider();

  const allResults = await provider.getAll(createMockWowInstallation(), ['24910', '26409']);

  expect(Array.isArray(allResults?.searchResults)).toBeTruthy();
  expect(allResults.searchResults.length).toEqual(2);
});

test('WowInterfaceAddonProvider getAll with fallback success', async () => {
  const provider = createWowInterfaceProvider();

  const allResults = await provider.getAll(createMockWowInstallation(), ['24910', '8814']);

  expect(Array.isArray(allResults?.searchResults)).toBeTruthy();
  expect(allResults.searchResults.length).toEqual(2);
});

test('WowInterfaceAddonProvider getAll with error and success', async () => {
  const provider = createWowInterfaceProvider();

  const allResults = await provider.getAll(createMockWowInstallation(), ['24910', '8814', '88140000']);

  expect(Array.isArray(allResults?.errors)).toBeTruthy();
  expect(Array.isArray(allResults?.searchResults)).toBeTruthy();
  expect(allResults.searchResults.length).toEqual(2);
  expect(allResults.errors.length).toEqual(1);
});

test('WowInterfaceAddonProvider getAll with error', async () => {
  const provider = createWowInterfaceProvider();

  const allResults = await provider.getAll(createMockWowInstallation(), ['88140000']);

  expect(Array.isArray(allResults?.errors)).toBeTruthy();
  expect(Array.isArray(allResults?.searchResults)).toBeTruthy();
  expect(allResults.searchResults.length).toEqual(0);
  expect(allResults.errors.length).toEqual(1);
});

test('WowInterfaceAddonProvider getAll empty set', async () => {
  const provider = createWowInterfaceProvider();

  const allResults = await provider.getAll(createMockWowInstallation(), []);

  expect(Array.isArray(allResults?.errors)).toBeTruthy();
  expect(Array.isArray(allResults?.searchResults)).toBeTruthy();
  expect(allResults.searchResults.length).toEqual(0);
  expect(allResults.errors.length).toEqual(0);
});

test('WowInterfaceAddonProvider getAll bad id set', async () => {
  const provider = createWowInterfaceProvider();

  const allResults = await provider.getAll(createMockWowInstallation(), ['', 'abcd']);

  expect(Array.isArray(allResults?.errors)).toBeTruthy();
  expect(Array.isArray(allResults?.searchResults)).toBeTruthy();
  expect(allResults.searchResults.length).toEqual(0);
  expect(allResults.errors.length).toEqual(2);
});

test('WowInterfaceAddonProvider getAll mixed bad good id set', async () => {
  const provider = createWowInterfaceProvider();

  const allResults = await provider.getAll(createMockWowInstallation(), ['', 'abcd', '24910']);

  expect(Array.isArray(allResults?.errors)).toBeTruthy();
  expect(Array.isArray(allResults?.searchResults)).toBeTruthy();
  expect(allResults.searchResults.length).toEqual(1);
  expect(allResults.errors.length).toEqual(2);
});

test('WowInterfaceAddonProvider getAll mixed bad good id with fallback set', async () => {
  const provider = createWowInterfaceProvider();

  const allResults = await provider.getAll(createMockWowInstallation(), ['', 'abcd', '8814']);

  expect(Array.isArray(allResults?.errors)).toBeTruthy();
  expect(Array.isArray(allResults?.searchResults)).toBeTruthy();
  expect(allResults.searchResults.length).toEqual(1);
  expect(allResults.errors.length).toEqual(2);
});

test('WowInterfaceAddonProvider getDescription success', async () => {
  const provider = createWowInterfaceProvider();

  const desc = await provider.getDescription(createMockWowInstallation(), '24910');

  expect(typeof desc === 'string').toBeTruthy();
  expect(desc.length).toBeGreaterThan(0);
});

test('WowInterfaceAddonProvider getDescription with fallback success', async () => {
  const provider = createWowInterfaceProvider();

  const desc = await provider.getDescription(createMockWowInstallation(), '8814');

  expect(typeof desc === 'string').toBeTruthy();
  expect(desc.length).toBeGreaterThan(0);
});

test('WowInterfaceAddonProvider getDescription failure', async () => {
  const provider = createWowInterfaceProvider();

  const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

  const desc = await provider.getDescription(createMockWowInstallation(), '88140000');

  expect(consoleSpy).toHaveBeenCalled();
  expect(typeof desc).toEqual('string');
  expect(desc.length).toEqual(0);
});

test('WowInterfaceAddonProvider getChangelog success', async () => {
  const provider = createWowInterfaceProvider();

  const desc = await provider.getChangelog(createMockWowInstallation(), '24910');

  expect(typeof desc === 'string').toBeTruthy();
  expect(desc.length).toBeGreaterThan(0);
});

test('WowInterfaceAddonProvider getChangelog with fallback success', async () => {
  const provider = createWowInterfaceProvider();

  const desc = await provider.getChangelog(createMockWowInstallation(), '8814');

  expect(typeof desc === 'string').toBeTruthy();
  expect(desc.length).toBeGreaterThan(0);
});

test('WowInterfaceAddonProvider getChangelog failure', async () => {
  const provider = createWowInterfaceProvider();

  const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

  const desc = await provider.getChangelog(createMockWowInstallation(), '88140000');

  expect(consoleSpy).toHaveBeenCalled();
  expect(typeof desc).toEqual('string');
  expect(desc.length).toEqual(0);
});

test('WowInterfaceAddonProvider searchByUrl success', async () => {
  const provider = createWowInterfaceProvider();

  const searchResult = await provider.searchByUrl(
    new URL('https://www.wowinterface.com/downloads/info26409-HandyNotesDragonflight.html'),
  );

  expect(typeof searchResult).toBeDefined();
  expect(searchResult.errors?.length).toEqual(0);
  expect(searchResult.searchResult).toBeDefined();
});

test('WowInterfaceAddonProvider searchByUrl with fallback success', async () => {
  const provider = createWowInterfaceProvider();

  const searchResult = await provider.searchByUrl(
    new URL('https://www.wowinterface.com/downloads/info8814-DeadlyBossMods.html'),
  );

  expect(typeof searchResult).toBeDefined();
  expect(searchResult.errors?.length).toEqual(0);
  expect(searchResult.searchResult).toBeDefined();
});

test('WowInterfaceAddonProvider searchByUrl with error', async () => {
  const provider = createWowInterfaceProvider();

  const url = new URL('https://www.wowinterface.com/downloads/info88140000-DeadlyBossMods.html');
  const task = provider.searchByUrl(url);
  await expect(task).rejects.toThrow('Bad addon api response ' + url);
});

test('WowInterfaceAddonProvider getById with success', async () => {
  const provider = createWowInterfaceProvider();

  const searchResult = await provider.getById('26409');

  expect(typeof searchResult).toBeDefined();
  expect(searchResult?.name.length).toBeGreaterThan(1);
});

test('WowInterfaceAddonProvider getById with fallback success', async () => {
  const provider = createWowInterfaceProvider();

  const searchResult = await provider.getById('8814');

  expect(typeof searchResult).toBeDefined();
  expect(searchResult?.name.length).toBeGreaterThan(1);
});

test('WowInterfaceAddonProvider getById id failure', async () => {
  const provider = createWowInterfaceProvider();

  const searchResult = await provider.getById('88140000');

  expect(searchResult).toBeUndefined();
});

test('WowInterfaceAddonProvider getById empty id failure', async () => {
  const provider = createWowInterfaceProvider();

  const searchResult = await provider.getById('');

  expect(searchResult).toBeUndefined();
});

test('WowInterfaceAddonProvider isValidAddonUri success', async () => {
  const provider = createWowInterfaceProvider();

  const url = new URL('https://www.wowinterface.com/downloads/info8814-DeadlyBossMods.html');
  const isValid = provider.isValidAddonUri(url);

  expect(isValid).toEqual(true);
});

test('WowInterfaceAddonProvider isValidAddonUri failure', async () => {
  const provider = createWowInterfaceProvider();

  const url = new URL('https://wowup.io/addons/10');
  const isValid = provider.isValidAddonUri(url);

  expect(isValid).toEqual(false);
});

test('WowInterfaceAddonProvider isValidAddonId success', async () => {
  const provider = createWowInterfaceProvider();

  const isValid = provider.isValidAddonId('8814');

  expect(isValid).toEqual(true);
});

test('WowInterfaceAddonProvider isValidAddonId failure', async () => {
  const provider = createWowInterfaceProvider();

  const isValid = provider.isValidAddonId('abcd');

  expect(isValid).toEqual(false);
});

function createWowInterfaceProvider(): WowInterfaceAddonProvider {
  return new WowInterfaceAddonProvider(createMockNetworkInterface());
}

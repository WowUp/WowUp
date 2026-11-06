import { TukUiAddonProvider } from '../../addon-providers';
import { createMockNetworkInterface } from '../../mocks/mock-network-interface';
import { createMockWowInstallation } from '../../mocks/mock-wow-installation';
import fetchMock from 'jest-fetch-mock';

fetchMock.enableMocks();
fetchMock.dontMock();

function createTukUiProvider(): TukUiAddonProvider {
  return new TukUiAddonProvider(createMockNetworkInterface());
}

test('TukUiAddonProvider getAllBatch empty', async () => {
  const provider = createTukUiProvider();

  const batch = await provider.getAllBatch([createMockWowInstallation()], ['24910']);

  expect(Object.keys(batch.errors).length).toEqual(0);
  expect(Object.keys(batch.installationResults).length).toEqual(0);
});

test('TukUiAddonProvider getAll success', async () => {
  const provider = createTukUiProvider();

  const allResults = await provider.getAll(createMockWowInstallation(), ['-1', '-2']);

  expect(Array.isArray(allResults?.searchResults)).toBeTruthy();
  expect(allResults.searchResults.length).toEqual(2);
});

test('TukUiAddonProvider getAll with error and success', async () => {
  const provider = createTukUiProvider();

  const allResults = await provider.getAll(createMockWowInstallation(), ['-1', '-2', '88140000']);

  expect(Array.isArray(allResults?.errors)).toBeTruthy();
  expect(Array.isArray(allResults?.searchResults)).toBeTruthy();
  expect(allResults.searchResults.length).toEqual(2);
  expect(allResults.errors.length).toEqual(1);
});

test('TukUiAddonProvider getAll with error', async () => {
  const provider = createTukUiProvider();

  const allResults = await provider.getAll(createMockWowInstallation(), ['88140000']);

  expect(Array.isArray(allResults?.errors)).toBeTruthy();
  expect(Array.isArray(allResults?.searchResults)).toBeTruthy();
  expect(allResults.searchResults.length).toEqual(0);
  expect(allResults.errors.length).toEqual(1);
});

test('TukUiAddonProvider getAll empty set', async () => {
  const provider = createTukUiProvider();

  const allResults = await provider.getAll(createMockWowInstallation(), []);

  expect(Array.isArray(allResults?.errors)).toBeTruthy();
  expect(Array.isArray(allResults?.searchResults)).toBeTruthy();
  expect(allResults.searchResults.length).toEqual(0);
  expect(allResults.errors.length).toEqual(0);
});

test('TukUiAddonProvider getAll bad id set', async () => {
  const provider = createTukUiProvider();

  const allResults = await provider.getAll(createMockWowInstallation(), ['', 'abcd']);

  expect(Array.isArray(allResults?.errors)).toBeTruthy();
  expect(Array.isArray(allResults?.searchResults)).toBeTruthy();
  expect(allResults.searchResults.length).toEqual(0);
  expect(allResults.errors.length).toEqual(2);
});

test('TukUiAddonProvider getAll mixed bad good id set', async () => {
  const provider = createTukUiProvider();

  const allResults = await provider.getAll(createMockWowInstallation(), ['', 'abcd', '-1']);

  expect(Array.isArray(allResults?.errors)).toBeTruthy();
  expect(Array.isArray(allResults?.searchResults)).toBeTruthy();
  expect(allResults.searchResults.length).toEqual(1);
  expect(allResults.errors.length).toEqual(2);
});

test('TukUiAddonProvider getDescription success', async () => {
  const provider = createTukUiProvider();

  const desc = await provider.getDescription(createMockWowInstallation(), '-1');

  expect(typeof desc === 'string').toBeTruthy();
  expect(desc.length).toBeGreaterThan(0);
});

test('TukUiAddonProvider getDescription failure', async () => {
  const provider = createTukUiProvider();

  const desc = await provider.getDescription(createMockWowInstallation(), '88140000');

  expect(typeof desc).toEqual('string');
  expect(desc.length).toEqual(0);
});

test('TukUiAddonProvider getChangelog success', async () => {
  const provider = createTukUiProvider();

  const desc = await provider.getChangelog(createMockWowInstallation(), '-2');

  expect(typeof desc === 'string').toBeTruthy();
  expect(desc.length).toBeGreaterThan(0);
});

test('TukUiAddonProvider getChangelog failure', async () => {
  const provider = createTukUiProvider();

  const desc = await provider.getChangelog(createMockWowInstallation(), '88140000');

  expect(typeof desc).toEqual('string');
  expect(desc.length).toEqual(0);
});

test('TukUiAddonProvider searchByUrl not implemented', async () => {
  const provider = createTukUiProvider();

  const url = new URL('https://api.tukui.org/addons.php?id=38');
  const result = await provider.searchByUrl(url, createMockWowInstallation());
  expect(result).toBeUndefined();
});

test('TukUiAddonProvider getById with success', async () => {
  const provider = createTukUiProvider();

  const searchResult = await provider.getById('-2', createMockWowInstallation());

  expect(searchResult).toBeDefined();
  expect(searchResult?.name.length).toBeGreaterThan(1);
});

test('TukUiAddonProvider getById id failure', async () => {
  const provider = createTukUiProvider();

  const searchResult = await provider.getById('88140000', createMockWowInstallation());

  expect(searchResult).toBeUndefined();
});

test('TukUiAddonProvider getById empty id failure', async () => {
  const provider = createTukUiProvider();

  const searchResult = await provider.getById('', createMockWowInstallation());

  expect(searchResult).toBeUndefined();
});

test('TukUiAddonProvider isValidAddonUri not implemented', async () => {
  const provider = createTukUiProvider();

  const url = new URL('https://api.tukui.org/addons.php?id=38');
  const isValid = provider.isValidAddonUri(url);

  expect(isValid).toEqual(false);
});

test('TukUiAddonProvider isValidAddonId success', async () => {
  const provider = createTukUiProvider();

  const isValid = provider.isValidAddonId('8814');

  expect(isValid).toEqual(true);
});

test('TukUiAddonProvider isValidAddonId failure', async () => {
  const provider = createTukUiProvider();

  const isValid = provider.isValidAddonId('abcd');

  expect(isValid).toEqual(false);
});

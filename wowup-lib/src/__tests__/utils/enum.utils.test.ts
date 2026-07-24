import { getEnumKeys } from '../../utils/enum.utils';
import { AddonCategory, AddonWarningType } from '../../types';

jest.setTimeout(10000);

test('getEnumKeys number success', () => {
  const keys = getEnumKeys(AddonCategory);
  expect(keys.length).toBeGreaterThan(0);
});

test('getEnumKeys string fail', () => {
  const keys = getEnumKeys(AddonWarningType);
  expect(keys.length).toEqual(0);
});

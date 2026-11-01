import { AddonFolder } from '../../addons';
import { Toc } from '../../toc';
import { WowClientType, WowGameType } from '../../types';
import { getTocForGameType2, isLoadConditionMet, stripLoadConditions } from '../../utils/toc.utils';

describe('stripLoadConditions', () => {
  test('removes chained allow and exclude conditions', () => {
    expect(stripLoadConditions('GW2 UI Forever [AllowLoadGameType camelot][ExcludeLoadGameType standard, classic]')).toBe(
      'GW2 UI Forever',
    );
  });

  test('leaves other bracketed text alone', () => {
    expect(stripLoadConditions('My [Beta] Addon')).toBe('My [Beta] Addon');
  });
});

describe('isLoadConditionMet', () => {
  test('matches game types and families', () => {
    expect(isLoadConditionMet('## Title: A [AllowLoadGameType standard]', WowGameType.Retail)).toBe(true);
    expect(isLoadConditionMet('## Title: A [AllowLoadGameType standard]', WowGameType.Mists)).toBe(false);
    expect(isLoadConditionMet('## Title: A [AllowLoadGameType classic]', WowGameType.BurningCrusade)).toBe(true);
  });

  test('honors exclude conditions', () => {
    const line = '## Title: A [AllowLoadGameType camelot][ExcludeLoadGameType standard, classic]';
    expect(isLoadConditionMet(line, WowGameType.Forever)).toBe(true);
    expect(isLoadConditionMet(line, WowGameType.Retail)).toBe(false);
  });

  test('treats an allow list of only unknown game types as met', () => {
    expect(isLoadConditionMet('## Title: A [AllowLoadGameType somethingnew]', WowGameType.Retail)).toBe(true);
  });
});

describe('getTocForGameType2', () => {
  const toc: Toc = {
    fileName: 'GW2_UI.toc',
    filePath: 'GW2_UI/GW2_UI.toc',
    interface: ['11509', '38002', '50504', '120100'],
    title: 'GW2 UI Midnight',
    titles: {
      [WowGameType.Retail]: 'GW2 UI Midnight',
      [WowGameType.Classic]: 'GW2 UI Era',
      [WowGameType.Mists]: 'GW2 UI Mists',
    },
    dependencyList: [],
  };
  const folder = { name: 'GW2_UI', path: 'GW2_UI', status: 'Pending', tocs: [toc] } as AddonFolder;

  test('uses the title for the client game type', () => {
    expect(getTocForGameType2(folder, WowClientType.Retail)?.title).toBe('GW2 UI Midnight');
    expect(getTocForGameType2(folder, WowClientType.ClassicEra)?.title).toBe('GW2 UI Era');
    expect(getTocForGameType2(folder, WowClientType.Classic)?.title).toBe('GW2 UI Mists');
  });

  test('falls back to the toc title without a game type title', () => {
    expect(getTocForGameType2(folder, WowClientType.Anniversary)?.title).toBe('GW2 UI Midnight');
  });
});

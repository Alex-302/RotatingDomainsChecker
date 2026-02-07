import { ContentProbe } from '../src/probe.js';
import type { Config } from '../src/types.js';

function makeConfig(enabled = true): Config {
  return {
    contentProbe: { enabled },
  } as unknown as Config;
}

describe('7. probe.ts — Content probe', () => {
  test('probeTexts with both keywords present → true', async () => {
    const probe = new ContentProbe(makeConfig());
    const result = await probe.verify(['keyword1', 'keyword2'], 'page has keyword1 and keyword2 in body');
    expect(result).toBe(true);
  });

  test('probeTexts with only one keyword present → false', async () => {
    const probe = new ContentProbe(makeConfig());
    const result = await probe.verify(['keyword1', 'keyword2'], 'page has keyword1 only');
    expect(result).toBe(false);
  });

  test('probeTexts: [] → true (skip)', async () => {
    const probe = new ContentProbe(makeConfig());
    const result = await probe.verify([], 'any body');
    expect(result).toBe(true);
  });

  test('body: undefined → false', async () => {
    const probe = new ContentProbe(makeConfig());
    const result = await probe.verify(['keyword'], undefined);
    expect(result).toBe(false);
  });

  test('contentProbe.enabled: false → true (skip)', async () => {
    const probe = new ContentProbe(makeConfig(false));
    const result = await probe.verify(['keyword'], 'no keyword here');
    expect(result).toBe(true);
  });

  test('body: empty string → false', async () => {
    const probe = new ContentProbe(makeConfig());
    const result = await probe.verify(['keyword'], '');
    expect(result).toBe(false);
  });
});

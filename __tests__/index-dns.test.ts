// Tests for DNS pre-flight check (dnsPreflightCheck function)
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';

const mockedDnsLookup = jest.fn().mockResolvedValue({ address: '127.0.0.1', family: 4 } as never);
jest.unstable_mockModule('dns', () => ({
  promises: {
    resolve: jest.fn(),
    lookup: mockedDnsLookup,
  },
}));

// Dynamic import — dnsPreflightCheck is exported from index.ts
const { dnsPreflightCheck } = await import('../src/index.js');

describe('dnsPreflightCheck', () => {
  let exitSpy: jest.SpiedFunction<typeof process.exit>;
  let logSpy: jest.Mock;
  let logger: { logGlobal: jest.Mock };

  beforeEach(() => {
    mockedDnsLookup.mockReset();

    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    }) as never;

    logSpy = jest.fn();
    logger = { logGlobal: logSpy };
  });

  afterEach(() => {
    exitSpy.mockRestore();
  });

  test('all 3 DNS fail → process.exit(1) and logs FATAL message', async () => {
    mockedDnsLookup.mockRejectedValue(new Error('ENOTFOUND') as never);

    await expect(dnsPreflightCheck(logger)).rejects.toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(logSpy).toHaveBeenCalledWith(0, expect.stringContaining('FATAL: DNS pre-flight check failed'));
    expect(logSpy).toHaveBeenCalledWith(0, expect.stringContaining('0/3'));
  });

  test('only 1 of 3 resolves → process.exit(1)', async () => {
    mockedDnsLookup
      .mockResolvedValueOnce({ address: '8.8.8.8', family: 4 } as never)  // google.com OK
      .mockRejectedValueOnce(new Error('ENOTFOUND') as never)             // cloudflare.com fail
      .mockRejectedValueOnce(new Error('ENOTFOUND') as never);            // adguard.com fail

    await expect(dnsPreflightCheck(logger)).rejects.toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(logSpy).toHaveBeenCalledWith(0, expect.stringContaining('1/3'));
  });

  test('2 of 3 resolve → resolves without exit', async () => {
    mockedDnsLookup
      .mockResolvedValueOnce({ address: '8.8.8.8', family: 4 } as never)  // google.com OK
      .mockResolvedValueOnce({ address: '1.1.1.1', family: 4 } as never)  // cloudflare.com OK
      .mockRejectedValueOnce(new Error('ENOTFOUND') as never);            // adguard.com fail

    await dnsPreflightCheck(logger);

    expect(exitSpy).not.toHaveBeenCalled();
  });

  test('all 3 resolve → resolves without exit', async () => {
    mockedDnsLookup.mockResolvedValue({ address: '127.0.0.1', family: 4 } as never);

    await dnsPreflightCheck(logger);

    expect(exitSpy).not.toHaveBeenCalled();
  });

  test('google.com fail, cloudflare.com OK, adguard.com OK → resolves without exit', async () => {
    mockedDnsLookup
      .mockRejectedValueOnce(new Error('ENOTFOUND') as never)             // google.com fail
      .mockResolvedValueOnce({ address: '1.1.1.1', family: 4 } as never)  // cloudflare.com OK
      .mockResolvedValueOnce({ address: '127.0.0.1', family: 4 } as never); // adguard.com OK

    await dnsPreflightCheck(logger);

    expect(exitSpy).not.toHaveBeenCalled();
  });

  test('FATAL log includes all host names', async () => {
    mockedDnsLookup.mockRejectedValue(new Error('ENOTFOUND') as never);

    await expect(dnsPreflightCheck(logger)).rejects.toThrow('process.exit called');
    const logMsg = logSpy.mock.calls[0]?.[1] ?? '';
    expect(logMsg).toContain('google.com');
    expect(logMsg).toContain('cloudflare.com');
    expect(logMsg).toContain('adguard.com');
  });

  test('works without logger (no error when logger undefined)', async () => {
    mockedDnsLookup
      .mockRejectedValueOnce(new Error('ENOTFOUND') as never)
      .mockResolvedValueOnce({ address: '1.1.1.1', family: 4 } as never)
      .mockResolvedValueOnce({ address: '127.0.0.1', family: 4 } as never);

    await expect(dnsPreflightCheck(undefined)).resolves.toBeUndefined();
    expect(exitSpy).not.toHaveBeenCalled();
  });
});

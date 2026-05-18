// Tests for DNS pre-flight check (dnsPreflightCheck function)
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';

const mockedDnsResolve = jest.fn().mockResolvedValue(['127.0.0.1'] as never);
const mockedSetServers = jest.fn();
const processForTest = (globalThis as unknown as { process: { exit: (code?: number) => never } }).process;

jest.unstable_mockModule('node:dns/promises', () => ({
  Resolver: jest.fn().mockImplementation(() => ({
    resolve: mockedDnsResolve,
    setServers: mockedSetServers,
    getServers: () => ['8.8.8.8', '1.1.1.1'],
  })),
}));

// Dynamic import — dnsPreflightCheck is exported from index.ts
const { dnsPreflightCheck } = await import('../src/index.js');

describe('dnsPreflightCheck', () => {
  let exitSpy: jest.SpiedFunction<(code?: number) => never>;
  let logSpy: jest.Mock;
  let logger: { logGlobal: jest.Mock };

  beforeEach(() => {
    mockedDnsResolve.mockReset();
    mockedDnsResolve.mockResolvedValue(['127.0.0.1'] as never);

    exitSpy = jest.spyOn(processForTest, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    }) as never;

    logSpy = jest.fn();
    logger = { logGlobal: logSpy };
  });

  afterEach(() => {
    exitSpy.mockRestore();
  });

  test('all 3 DNS fail → process.exit(1) and logs FATAL message', async () => {
    mockedDnsResolve.mockRejectedValue(new Error('ENOTFOUND') as never);

    await expect(dnsPreflightCheck(logger)).rejects.toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(logSpy).toHaveBeenCalledWith(0, expect.stringContaining('FATAL: DNS pre-flight check failed'));
    expect(logSpy).toHaveBeenCalledWith(0, expect.stringContaining('0/3'));
  });

  test('only 1 of 3 resolves → process.exit(1)', async () => {
    mockedDnsResolve
      .mockResolvedValueOnce(['8.8.8.8'] as never)                         // google.com OK
      .mockRejectedValueOnce(new Error('ENOTFOUND') as never)             // cloudflare.com fail
      .mockRejectedValueOnce(new Error('ENOTFOUND') as never);            // adguard.com fail

    await expect(dnsPreflightCheck(logger)).rejects.toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(logSpy).toHaveBeenCalledWith(0, expect.stringContaining('1/3'));
  });

  test('2 of 3 resolve → resolves without exit', async () => {
    mockedDnsResolve
      .mockResolvedValueOnce(['8.8.8.8'] as never)                        // google.com OK
      .mockResolvedValueOnce(['1.1.1.1'] as never)                        // cloudflare.com OK
      .mockRejectedValueOnce(new Error('ENOTFOUND') as never);            // adguard.com fail

    await dnsPreflightCheck(logger);

    expect(exitSpy).not.toHaveBeenCalled();
  });

  test('all 3 resolve → resolves without exit', async () => {
    mockedDnsResolve.mockResolvedValue(['127.0.0.1'] as never);

    await dnsPreflightCheck(logger);

    expect(exitSpy).not.toHaveBeenCalled();
  });

  test('google.com fail, cloudflare.com OK, adguard.com OK → resolves without exit', async () => {
    mockedDnsResolve
      .mockRejectedValueOnce(new Error('ENOTFOUND') as never)             // google.com fail
      .mockResolvedValueOnce(['1.1.1.1'] as never)                        // cloudflare.com OK
      .mockResolvedValueOnce(['127.0.0.1'] as never);                     // adguard.com OK

    await dnsPreflightCheck(logger);

    expect(exitSpy).not.toHaveBeenCalled();
  });

  test('FATAL log includes all host names', async () => {
    mockedDnsResolve.mockRejectedValue(new Error('ENOTFOUND') as never);

    await expect(dnsPreflightCheck(logger)).rejects.toThrow('process.exit called');
    const logMsg = logSpy.mock.calls[0]?.[1] ?? '';
    expect(logMsg).toContain('google.com');
    expect(logMsg).toContain('cloudflare.com');
    expect(logMsg).toContain('adguard.com');
  });

  test('works without logger (no error when logger undefined)', async () => {
    mockedDnsResolve
      .mockRejectedValueOnce(new Error('ENOTFOUND') as never)
      .mockResolvedValueOnce(['1.1.1.1'] as never)
      .mockResolvedValueOnce(['127.0.0.1'] as never);

    await expect(dnsPreflightCheck(undefined)).resolves.toBeUndefined();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  test('configures forced DNS servers on resolver creation', async () => {
    await dnsPreflightCheck(logger);

    expect(mockedSetServers).toHaveBeenCalledWith(['8.8.8.8', '1.1.1.1']);
  });
});

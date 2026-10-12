import { describe, expect, it } from 'vitest';
import { developmentPorts, endToEndTestPorts, resolvePortFromEnvironment } from './index.mts';

describe('resolvePortFromEnvironment', () => {
  it('returns the fallback port when the variable is missing', () => {
    expect(resolvePortFromEnvironment({}, 'API_PORT', 5318)).toBe(5318);
  });

  it('returns the fallback port when the variable is empty or only whitespace', () => {
    expect(resolvePortFromEnvironment({ API_PORT: '' }, 'API_PORT', 5318)).toBe(5318);
    expect(resolvePortFromEnvironment({ API_PORT: '   ' }, 'API_PORT', 5318)).toBe(5318);
  });

  it('returns the override port when the variable holds a valid port', () => {
    expect(resolvePortFromEnvironment({ API_PORT: '5328' }, 'API_PORT', 5318)).toBe(5328);
    expect(resolvePortFromEnvironment({ API_PORT: '1' }, 'API_PORT', 5318)).toBe(1);
    expect(resolvePortFromEnvironment({ API_PORT: '65535' }, 'API_PORT', 5318)).toBe(65535);
  });

  it.each(['not-a-port', '0', '65536', '12.5', '-1'])(
    'throws a descriptive error for the invalid value "%s"',
    (invalidPortValue) => {
      expect(() =>
        resolvePortFromEnvironment({ API_PORT: invalidPortValue }, 'API_PORT', 5318),
      ).toThrow(
        `API_PORT must be a port number between 1 and 65535, received "${invalidPortValue}"`,
      );
    },
  );
});

describe('port constants', () => {
  it('never reuse a development port for an end-to-end test server', () => {
    const developmentPortNumbers: number[] = Object.values(developmentPorts);
    const endToEndPortNumbers: number[] = Object.values(endToEndTestPorts);

    const sharedPortNumbers = endToEndPortNumbers.filter((endToEndPort) =>
      developmentPortNumbers.includes(endToEndPort),
    );

    expect(sharedPortNumbers).toEqual([]);
  });
});

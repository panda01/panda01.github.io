/**
 * The loopback host every local service binds to, so nothing in this project is reachable from other machines.
 */
export const localLoopbackHost = '127.0.0.1';

/**
 * Fixed ports used while developing locally (`npm run dev`, `npm run neko:up`).
 * These values are the single source of truth for TypeScript code; `infra/neko/compose.yaml`
 * repeats the neko ports and a unit test keeps the two in sync.
 */
export const developmentPorts = {
  webApplication: 5317,
  apiServer: 5318,
  nekoHttp: 5319,
  chromeDevtoolsProtocol: 5320,
  nekoWebrtcMux: 52000,
} as const;

/**
 * Ports used by the Playwright end-to-end test servers, kept separate from the development ports
 * so tests never attach to (or kill) a developer's running servers.
 */
export const endToEndTestPorts = {
  webApplication: 5327,
  apiServer: 5328,
} as const;

/**
 * Reads a TCP port number from an environment-variable map, falling back to a default when the
 * variable is missing or empty.
 * @param environmentVariables - The environment-variable map to read from (for example `process.env`).
 * @param environmentVariableName - The name of the variable that may hold an override port.
 * @param fallbackPort - The port to use when no override is set.
 * @returns The override port when one is set, otherwise the fallback port.
 * @throws {Error} When the variable is set but is not an integer between 1 and 65535.
 */
export function resolvePortFromEnvironment(
  environmentVariables: Readonly<Record<string, string | undefined>>,
  environmentVariableName: string,
  fallbackPort: number,
): number {
  const rawOverrideValue = environmentVariables[environmentVariableName];
  const isOverrideMissing = rawOverrideValue === undefined || rawOverrideValue.trim() === '';
  if (isOverrideMissing) {
    return fallbackPort;
  }

  const parsedOverridePort = Number(rawOverrideValue);
  const isValidTcpPort =
    Number.isInteger(parsedOverridePort) && parsedOverridePort >= 1 && parsedOverridePort <= 65535;
  if (!isValidTcpPort) {
    throw new Error(
      `Environment variable ${environmentVariableName} must be a port number between 1 and 65535, received "${rawOverrideValue}".`,
    );
  }

  return parsedOverridePort;
}

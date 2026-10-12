import { developmentPorts, localLoopbackHost } from '@khalah/shared';

const apiHealthUrl = `http://${localLoopbackHost}:${String(developmentPorts.apiServer)}/api/health`;
const homepageUrl = `http://${localLoopbackHost}:${String(developmentPorts.webApplication)}/`;

/**
 * Confirms the API server answers its health check with `200 { "status": "ok" }`.
 * @returns A human-readable failure reason, or undefined when the check passed.
 */
async function findApiHealthProblem(): Promise<string | undefined> {
  try {
    const healthResponse = await fetch(apiHealthUrl);
    const healthBody: unknown = await healthResponse.json();
    const isHealthy =
      healthResponse.status === 200 &&
      typeof healthBody === 'object' &&
      healthBody !== null &&
      'status' in healthBody &&
      healthBody.status === 'ok';
    return isHealthy
      ? undefined
      : `unexpected response ${String(healthResponse.status)} ${JSON.stringify(healthBody)}`;
  } catch (requestError) {
    return String(requestError);
  }
}

/**
 * Sniff-tests the homepage: it must load with status 200 and contain the app's mount element.
 * @returns A human-readable failure reason, or undefined when the check passed.
 */
async function findHomepageProblem(): Promise<string | undefined> {
  try {
    const homepageResponse = await fetch(homepageUrl);
    const homepageHtml = await homepageResponse.text();
    const containsMountElement = homepageHtml.includes('<div id="root"></div>');
    if (homepageResponse.status !== 200) {
      return `unexpected status ${String(homepageResponse.status)}`;
    }
    return containsMountElement ? undefined : 'page is missing <div id="root"></div>';
  } catch (requestError) {
    return String(requestError);
  }
}

/**
 * Runs both dev-server checks, prints the results, and sets a failing exit code if either failed.
 * @returns Resolves when both checks have finished.
 */
async function checkDevServers(): Promise<void> {
  const apiHealthProblem = await findApiHealthProblem();
  const homepageProblem = await findHomepageProblem();

  console.log(`API health  ${apiHealthUrl}: ${apiHealthProblem ?? 'ok'}`);
  console.log(`Homepage    ${homepageUrl}: ${homepageProblem ?? 'ok'}`);

  const didAnyCheckFail = apiHealthProblem !== undefined || homepageProblem !== undefined;
  if (didAnyCheckFail) {
    process.exitCode = 1;
  }
}

await checkDevServers();

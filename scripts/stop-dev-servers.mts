import { execFileSync } from 'node:child_process';
import { setTimeout as waitMilliseconds } from 'node:timers/promises';
import { developmentPorts, endToEndTestPorts } from '@khalah/shared';

// Only this project's web/API ports (dev + E2E). neko is stopped separately with `npm run neko:down`.
const projectServerPorts: readonly number[] = [
  developmentPorts.webApplication,
  developmentPorts.apiServer,
  endToEndTestPorts.webApplication,
  endToEndTestPorts.apiServer,
];

// Parent processes that belong to a dev session started by `npm run dev` and should stop with it.
const devSessionParentCommandPattern = /concurrently|tsx|vite|npm (run|exec)|npm-cli\.js/;
const portReleaseTimeoutMilliseconds = 5000;

/**
 * Lists the process IDs currently listening for TCP connections on a port.
 * @param tcpPort - The port to inspect.
 * @returns The listening process IDs (empty when the port is free).
 */
function findListeningProcessIds(tcpPort: number): number[] {
  try {
    const lsofOutput = execFileSync(
      'lsof',
      ['-nP', '-t', `-iTCP:${String(tcpPort)}`, '-sTCP:LISTEN'],
      {
        encoding: 'utf8',
      },
    );
    return lsofOutput.split('\n').filter(Boolean).map(Number);
  } catch {
    // lsof exits with status 1 when nothing is listening.
    return [];
  }
}

/**
 * Reads the parent process ID and full command line of a process.
 * @param processId - The process to inspect.
 * @returns The parent PID and command, or undefined when the process no longer exists.
 */
function describeProcess(
  processId: number,
): { parentProcessId: number; command: string } | undefined {
  try {
    const psOutput = execFileSync('ps', ['-o', 'ppid=,command=', '-p', String(processId)], {
      encoding: 'utf8',
    }).trim();
    const firstSpaceIndex = psOutput.indexOf(' ');
    return {
      parentProcessId: Number(psOutput.slice(0, firstSpaceIndex)),
      command: psOutput.slice(firstSpaceIndex + 1),
    };
  } catch {
    return undefined;
  }
}

/**
 * Collects a listening server process plus its dev-session ancestors (npm, concurrently, tsx watch),
 * stopping at the first ancestor that is not part of the dev session (for example the user's shell).
 * @param listeningProcessId - A process listening on one of the project's ports.
 * @returns The process IDs to stop, the listener first.
 */
function collectDevSessionProcessIds(listeningProcessId: number): number[] {
  const processIdsToStop = [listeningProcessId];
  let currentProcessDescription = describeProcess(listeningProcessId);
  while (currentProcessDescription !== undefined) {
    const parentProcessDescription = describeProcess(currentProcessDescription.parentProcessId);
    const isParentPartOfDevSession =
      parentProcessDescription !== undefined &&
      devSessionParentCommandPattern.test(parentProcessDescription.command);
    if (!isParentPartOfDevSession) {
      break;
    }
    processIdsToStop.push(currentProcessDescription.parentProcessId);
    currentProcessDescription = parentProcessDescription;
  }
  return processIdsToStop;
}

/**
 * Sends SIGTERM to a process, ignoring processes that have already exited.
 * @param processId - The process to stop.
 */
function sendTerminateSignal(processId: number): void {
  try {
    process.kill(processId, 'SIGTERM');
  } catch {
    // Already gone.
  }
}

/**
 * Stops every dev/E2E server on this project's ports, then confirms each port is free.
 * @returns Resolves when done; sets a failing exit code if any port is still in use.
 */
async function stopProjectDevServers(): Promise<void> {
  const processIdsToStop = new Set<number>();
  for (const projectServerPort of projectServerPorts) {
    for (const listeningProcessId of findListeningProcessIds(projectServerPort)) {
      for (const devSessionProcessId of collectDevSessionProcessIds(listeningProcessId)) {
        processIdsToStop.add(devSessionProcessId);
      }
    }
  }

  for (const processIdToStop of processIdsToStop) {
    sendTerminateSignal(processIdToStop);
  }

  const portCheckDeadline = Date.now() + portReleaseTimeoutMilliseconds;
  let portsStillInUse = projectServerPorts.filter(
    (port) => findListeningProcessIds(port).length > 0,
  );
  while (portsStillInUse.length > 0 && Date.now() < portCheckDeadline) {
    await waitMilliseconds(200);
    portsStillInUse = projectServerPorts.filter((port) => findListeningProcessIds(port).length > 0);
  }

  console.log(`Stopped ${String(processIdsToStop.size)} process(es).`);
  if (portsStillInUse.length > 0) {
    console.error(`Ports still in use: ${portsStillInUse.join(', ')}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Ports free: ${projectServerPorts.join(', ')}`);
}

await stopProjectDevServers();

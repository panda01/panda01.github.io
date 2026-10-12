import { readFileSync } from 'node:fs';
import { developmentPorts } from '@khalah/shared';
import { describe, expect, it } from 'vitest';

// compose.yaml cannot import TypeScript, so this test keeps its port numbers in sync with ports.mts.
const nekoComposeFileText = readFileSync(
  new URL('../../../infra/neko/compose.yaml', import.meta.url),
  'utf8',
);

describe('infra/neko/compose.yaml', () => {
  it('publishes the neko HTTP port from ports.mts on loopback only', () => {
    expect(nekoComposeFileText).toContain(`'127.0.0.1:${String(developmentPorts.nekoHttp)}:8080'`);
  });

  it('publishes the Chrome DevTools Protocol port from ports.mts on loopback only', () => {
    expect(nekoComposeFileText).toContain(
      `'127.0.0.1:${String(developmentPorts.chromeDevtoolsProtocol)}:9222'`,
    );
  });

  it('publishes and configures the WebRTC mux port from ports.mts for UDP and TCP', () => {
    const muxPort = String(developmentPorts.nekoWebrtcMux);

    expect(nekoComposeFileText).toContain(`'127.0.0.1:${muxPort}:${muxPort}/udp'`);
    expect(nekoComposeFileText).toContain(`'127.0.0.1:${muxPort}:${muxPort}/tcp'`);
    expect(nekoComposeFileText).toContain(`NEKO_WEBRTC_UDPMUX: '${muxPort}'`);
    expect(nekoComposeFileText).toContain(`NEKO_WEBRTC_TCPMUX: '${muxPort}'`);
  });
});

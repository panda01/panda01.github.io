# Local neko browser for the Browser app: stock neko Chromium (arm64 + amd64) plus
#  - kiosk mode, so only web content is streamed (our Safari-style toolbar is drawn by the web app)
#  - the Chrome DevTools Protocol, so the Express server can drive navigation and tabs
FROM ghcr.io/m1k1o/neko/chromium:3.1.6

# Chromium only listens for DevTools on 127.0.0.1 inside the container; socat republishes it on 9222.
RUN apt-get update \
  && apt-get install --yes --no-install-recommends socat \
  && rm -rf /var/lib/apt/lists/*

COPY chromium.conf /etc/neko/supervisord/chromium.conf
COPY devtools-forwarder.conf /etc/neko/supervisord/devtools-forwarder.conf
COPY policies.json /etc/chromium/policies/managed/policies.json

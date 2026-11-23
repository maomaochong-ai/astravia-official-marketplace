config-version: 8

server:
  host: "127.0.0.1"
  port: ${ASTRAVIA_SERVICE_PORT}

management:
  allow-remote: false
  secret-key: "${ASTRAVIA_SERVICE_SECRET_MANAGEMENT_KEY}"
  disable-control-panel: true

oauth:
  auth-dir: '${ASTRAVIA_SERVICE_DATA_DIR}/auths'
  providers:
    antigravity:
      antigravity-credits: false

access:
  api-keys:
    - "${ASTRAVIA_SERVICE_SECRET_API_KEY}"

observability:
  logs:
    debug: false
    logging-to-file: false
  usage:
    usage-statistics-enabled: false

requests:
  passthrough-headers: true

plugins:
  enabled: true
  dir: '${ASTRAVIA_SERVICE_RUNTIME_DIR}/plugins'
  configs:
    gemini-cli:
      enabled: true
      priority: 10

routing:
  # Astravia owns retries, backoff, cancellation, and user-visible errors.
  # Each request reaches at most one CPA credential attempt.
  retry:
    request-retry: 0
    max-retry-credentials: 1
    max-retry-interval: 0
  strategy: "round-robin"
  # Keep every model call from one Vetta conversation on the same healthy account.
  # CPA automatically fails over and rebinds when that credential is unavailable.
  session-affinity: true
  session-affinity-ttl: "1h"
  session-affinity-subagents: true

#!/bin/sh
set -e
mkdir -p /app/server/data
chown -R node:node /app/server/data
if [ ! -f /app/server/data/store.json ]; then
  su-exec node sh -c 'printf "%s\n" "{\"contentVersion\":1,\"fingerprints\":{},\"overlay\":{}}" > /app/server/data/store.json'
fi
exec su-exec node "$@"

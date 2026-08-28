#!/bin/sh
set -e
mkdir -p /tmp/uploads /data/uploads
if [ "$(id -u)" = "0" ]; then
  chown -R nextjs:nodejs /tmp/uploads /data 2>/dev/null || true
  exec su-exec nextjs node server.js
fi
exec node server.js

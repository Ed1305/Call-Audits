#!/bin/sh
set -e
mkdir -p /data/uploads
if [ "$(id -u)" = "0" ]; then
  chown -R nextjs:nodejs /data 2>/dev/null || true
  exec su-exec nextjs node server.js
fi
exec node server.js

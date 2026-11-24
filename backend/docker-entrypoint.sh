#!/bin/sh
set -eu

SECRETS_FILE="/app/.tmp/.runtime-secrets.env"
mkdir -p /app/.tmp

if [ -z "${APP_KEYS:-}" ] || [ -z "${API_TOKEN_SALT:-}" ] || [ -z "${ADMIN_JWT_SECRET:-}" ] || [ -z "${TRANSFER_TOKEN_SALT:-}" ] || [ -z "${JWT_SECRET:-}" ] || [ -z "${ENCRYPTION_KEY:-}" ]; then
  if [ ! -f "$SECRETS_FILE" ]; then
    node -e '
      const fs = require("fs");
      const crypto = require("crypto");
      const rand = () => crypto.randomBytes(16).toString("hex");
      const lines = [
        `APP_KEYS=${rand()},${rand()}`,
        `API_TOKEN_SALT=${rand()}`,
        `ADMIN_JWT_SECRET=${rand()}`,
        `TRANSFER_TOKEN_SALT=${rand()}`,
        `JWT_SECRET=${rand()}`,
        `ENCRYPTION_KEY=${rand()}`
      ];
      fs.writeFileSync(process.argv[1], lines.join("\n") + "\n", { mode: 0o600 });
    ' "$SECRETS_FILE"
  fi
  set -a
  . "$SECRETS_FILE"
  set +a
fi

exec npm run start

#!/usr/bin/env bash
set -e
mkdir -p keys
openssl genpkey -algorithm RSA -out keys/access-private.pem -pkeyopt rsa_keygen_bits:2048
openssl rsa -pubout -in keys/access-private.pem -out keys/access-public.pem
echo "Generated keys/access-private.pem and keys/access-public.pem"
echo
echo "For local Docker/dev, JWT_ACCESS_PRIVATE_KEY_PATH / JWT_ACCESS_PUBLIC_KEY_PATH in .env.example already point here."
echo
echo "For production (Railway, Render, or any platform without a mounted keys/ volume),"
echo "set these two environment variables instead — base64 keeps the multi-line PEM as one line:"
echo
echo "JWT_ACCESS_PRIVATE_KEY_BASE64=$(base64 < keys/access-private.pem | tr -d '\n')"
echo "JWT_ACCESS_PUBLIC_KEY_BASE64=$(base64 < keys/access-public.pem | tr -d '\n')"
echo
echo "When either *_BASE64 variable is set it always wins; the file path is read only when NODE_ENV is not 'production'."

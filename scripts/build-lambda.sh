#!/usr/bin/env bash
# Builds the Lambda deployment package for the backend: backend/build/lambda.zip
#
# The dependencies are NOT the ones in backend/.venv: those are macOS wheels and
# Lambda runs Linux. pip cross-installs them here with --platform/--only-binary,
# which is why every dependency must ship a wheel for the target.
#
#   ARCH=x86_64|arm64   Lambda architecture     (default: x86_64)
#   PY_VERSION=3.11     Lambda Python runtime   (default: 3.11)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$ROOT/backend"
STAGE="$BACKEND/build/lambda"
ZIP="$BACKEND/build/lambda.zip"

ARCH="${ARCH:-x86_64}"
PY_VERSION="${PY_VERSION:-3.11}"

case "$ARCH" in
  x86_64) WHEEL_ARCH="x86_64" ;;
  arm64)  WHEEL_ARCH="aarch64" ;;
  *) echo "ARCH must be x86_64 or arm64 (got: $ARCH)" >&2; exit 1 ;;
esac

# How new a wheel may be is decided by the runtime's OS, not by the package:
# python3.11 is Amazon Linux 2 (glibc 2.26), 3.12+ is Amazon Linux 2023 (glibc
# 2.34). A manylinux_2_28 wheel installs happily on this Mac and then dies with
# a GLIBC error inside a 3.11 function, so it is only allowed from 3.12 on.
PLATFORMS=(--platform "manylinux2014_$WHEEL_ARCH")
if [ "$PY_VERSION" != "3.11" ]; then
  PLATFORMS+=(--platform "manylinux_2_28_$WHEEL_ARCH")
fi

# psycopg-binary publishes aarch64 wheels only for glibc 2.28+, so arm64 has no
# resolvable set on Amazon Linux 2. Caught here because pip's own message for
# this is an unreadable ResolutionImpossible over every psycopg version.
if [ "$ARCH" = "arm64" ] && [ "$PY_VERSION" = "3.11" ]; then
  cat >&2 <<MSG
arm64 requires PY_VERSION=3.12 or newer.
psycopg-binary ships aarch64 wheels for glibc 2.28+ only, and the python3.11
runtime is Amazon Linux 2 (glibc 2.26). Either:
  ARCH=x86_64 bash scripts/build-lambda.sh            # python3.11, as deployed
  ARCH=arm64 PY_VERSION=3.12 bash scripts/build-lambda.sh   # python3.12 function
MSG
  exit 1
fi

PYTHON="$BACKEND/.venv/bin/python"
if [ ! -x "$PYTHON" ]; then
  echo "Missing backend/.venv — run: bun run setup" >&2
  exit 1
fi

echo "==> target: python$PY_VERSION on $ARCH (${PLATFORMS[*]})"

rm -rf "$STAGE" "$ZIP"
mkdir -p "$STAGE"

# uvicorn is the local dev server; inside Lambda the runtime calls the Mangum
# handler directly, so it and its uvloop/httptools/watchfiles extras are dead
# weight in the package.
REQS="$(mktemp)"
trap 'rm -f "$REQS"' EXIT
grep -v '^uvicorn' "$BACKEND/requirements.txt" > "$REQS"

echo "==> pip install (cross-platform wheels)"
"$PYTHON" -m pip install \
  --quiet \
  --target "$STAGE" \
  "${PLATFORMS[@]}" \
  --python-version "$PY_VERSION" \
  --implementation cp \
  --only-binary=:all: \
  --upgrade \
  -r "$REQS"

echo "==> app code"
# .env is excluded on purpose: the secrets live in the function's environment,
# and pydantic-settings reads them from there when no file is present.
rsync -a \
  --exclude '__pycache__' \
  --exclude '*.py[cod]' \
  --exclude '.env' \
  "$BACKEND/app" "$STAGE/"

# Bytecode compiled for macOS is useless to the function and only adds weight.
find "$STAGE" -name '__pycache__' -type d -prune -exec rm -rf {} + 2>/dev/null || true
find "$STAGE" -name '*.py[co]' -delete 2>/dev/null || true

echo "==> zip"
# -X drops the macOS extended attributes; Lambda has no use for them.
(cd "$STAGE" && zip -qrX "$ZIP" .)

UNZIPPED_KB=$(du -sk "$STAGE" | cut -f1)
echo
echo "    $ZIP"
echo "    zipped:   $(du -h "$ZIP" | cut -f1)"
echo "    unzipped: $(du -sh "$STAGE" | cut -f1)   (Lambda limit: 250 MB)"
if [ "$UNZIPPED_KB" -gt 256000 ]; then
  echo
  echo "!!  Over the 250 MB unzipped limit — deploy as a container image instead." >&2
  exit 1
fi

cat <<TXT

Deploy:
  aws lambda update-function-code \\
    --function-name <NAME> --zip-file fileb://backend/build/lambda.zip

  # over 50 MB zipped, upload through S3:
  aws s3 cp backend/build/lambda.zip s3://<BUCKET>/lambda.zip
  aws lambda update-function-code \\
    --function-name <NAME> --s3-bucket <BUCKET> --s3-key lambda.zip

Function config:
  handler       app.main.handler
  runtime       python$PY_VERSION
  architecture  $ARCH
  env vars      DATABASE_URL, CORS_ORIGINS, CLERK_JWKS_URL, CLERK_SECRET_KEY,
                CLERK_ISSUER, AI_GATEWAY_API_KEY, API_GATEWAY_BASE_PATH
TXT

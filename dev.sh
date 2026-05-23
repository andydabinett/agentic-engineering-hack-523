#!/usr/bin/env bash
cd "$(dirname "$0")"
set -a
source .env
set +a
PI_CODING_AGENT_DIR=./agent exec ./node_modules/.bin/pi

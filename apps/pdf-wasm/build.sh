#!/usr/bin/env bash
# Build the Rust/Wasm PDF parser and copy outputs to the Next.js public directory.
# Prerequisites: rustup target add wasm32-unknown-unknown && cargo install wasm-pack
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_PUBLIC="$SCRIPT_DIR/../web/public/wasm"

echo "→ Building pdf-wasm (release)..."
cd "$SCRIPT_DIR"
wasm-pack build --target web --out-dir pkg --release

echo "→ Optimizing with wasm-opt..."
wasm-opt -Oz --strip-debug \
  pkg/pdf_wasm_bg.wasm \
  -o pkg/pdf_wasm_bg.wasm 2>/dev/null || echo "(wasm-opt not installed, skipping)"

echo "→ Copying to $WEB_PUBLIC..."
mkdir -p "$WEB_PUBLIC"
cp pkg/pdf_wasm_bg.wasm "$WEB_PUBLIC/pdf_wasm_bg.wasm"
cp pkg/pdf_wasm.js      "$WEB_PUBLIC/pdf_wasm.js"

echo "✓ Done — WASM served at /wasm/pdf_wasm_bg.wasm"

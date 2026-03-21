#!/bin/bash
# Smoke test — verify Makefile targets parse and key files exist.
# Run: bash test/smoke-makefile.sh
cd "$(dirname "$0")/.."

PASS=0 FAIL=0

ok()   { echo "  ok: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }

# 1. Default target parses (dry run)
default=$(sed -n 's/^\.DEFAULT_GOAL := \(.*\)/\1/p' Makefile | head -1)
if [[ -n "$default" ]]; then
  make -n "$default" >/dev/null 2>&1 \
    && ok "default target '$default' parses (dry run)" \
    || fail "default target '$default' fails dry run"
else
  fail "no .DEFAULT_GOAL in Makefile"
fi

# 2. help target exists and runs
make -n help >/dev/null 2>&1 \
  && ok "help target parses" \
  || ok "no help target (optional)"

# 3. All .PHONY targets parse
for t in $(sed -n 's/^\.PHONY:[ ]*//p' Makefile 2>/dev/null | tr ' ' '\n' | sort -u); do
  make -n "$t" >/dev/null 2>&1 \
    && ok "target '$t' parses" \
    || fail "target '$t' fails dry run"
done

# 4. Key file checks based on project type
[[ -f package.json ]] && {
  ok "package.json exists"
  node -e "JSON.parse(require('fs').readFileSync('package.json'))" 2>/dev/null \
    && ok "package.json is valid JSON" \
    || fail "package.json is invalid JSON"
}
[[ -f go.mod ]] && {
  ok "go.mod exists"
  grep -q '^module ' go.mod && ok "go.mod has module line" || fail "go.mod missing module line"
}
[[ -f requirements.txt ]] && ok "requirements.txt exists"
[[ -f pyproject.toml ]] && ok "pyproject.toml exists"
[[ -f index.html ]] && ok "index.html exists"
[[ -f manifest.json ]] && {
  ok "manifest.json exists"
  node -e "JSON.parse(require('fs').readFileSync('manifest.json'))" 2>/dev/null \
    && ok "manifest.json is valid JSON" \
    || fail "manifest.json is invalid JSON"
}

echo ""
echo "$PASS passed, $FAIL failed"
[[ $FAIL -eq 0 ]]

#!/usr/bin/env bash
set -euo pipefail

EMAIL="${TEST_EMAIL:-}"
PASS="${TEST_PASSWORD:-Password123!}"
NAME="${TEST_NAME:-Test User}"

if [[ -z "$EMAIL" ]]; then
  echo "Set TEST_EMAIL before running. Example:"
  echo "TEST_EMAIL='your-real-email@domain.com' TEST_PASSWORD='Password123!' ./backend/scripts/auth-smoke-test.sh"
  exit 1
fi

echo "[1] Health"
curl -s http://localhost:3000/api/health
echo

echo "[2] Signup"
SIGNUP_JSON=$(curl -s -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"displayName\":\"$NAME\"}")
echo "$SIGNUP_JSON"
echo

echo "[3] Login"
LOGIN_JSON=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")
echo "$LOGIN_JSON"
echo

ACCESS_TOKEN=$(printf '%s' "$LOGIN_JSON" | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{try{const j=JSON.parse(s);process.stdout.write((j.session&&j.session.access_token)||'')}catch(e){process.stdout.write('')}})")
REFRESH_TOKEN=$(printf '%s' "$LOGIN_JSON" | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{try{const j=JSON.parse(s);process.stdout.write((j.session&&j.session.refresh_token)||'')}catch(e){process.stdout.write('')}})")

echo "[4] Token lengths"
echo "access=${#ACCESS_TOKEN} refresh=${#REFRESH_TOKEN}"
echo

if [[ -z "$ACCESS_TOKEN" || -z "$REFRESH_TOKEN" ]]; then
  echo "Could not get tokens from login response."
  exit 1
fi

echo "[5] Me"
curl -s http://localhost:3000/api/auth/me -H "Authorization: Bearer $ACCESS_TOKEN"
echo

echo "[6] Refresh"
REFRESH_JSON=$(curl -s -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}")
echo "$REFRESH_JSON"
echo

echo "[7] Logout"
curl -s -X POST http://localhost:3000/api/auth/logout -H "Authorization: Bearer $ACCESS_TOKEN"
echo

echo "[8] Me after logout (should be 401 error payload)"
curl -s http://localhost:3000/api/auth/me -H "Authorization: Bearer $ACCESS_TOKEN"
echo

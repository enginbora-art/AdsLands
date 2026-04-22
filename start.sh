#!/bin/bash
ROOT="$(cd "$(dirname "$0")" && pwd)"
echo "🚀 AdsLens başlatılıyor..."

node "$ROOT/backend/src/index.js" &
BACKEND_PID=$!
echo "✅ Backend: http://localhost:3001 (PID: $BACKEND_PID)"

cd "$ROOT/frontend" && npm run dev -- --port 5173 &
FRONTEND_PID=$!
echo "✅ Frontend: http://localhost:5173 (PID: $FRONTEND_PID)"

echo ""
echo "Durdurmak için Ctrl+C"
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'AdsLens durduruldu.'" EXIT
wait

#!/bin/bash

echo "🚀 Starting Creative Asset Library"
echo "===================================="

# Create logs directory
mkdir -p logs

# Kill existing processes
echo "Cleaning up existing processes..."
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:3001 | xargs kill -9 2>/dev/null
lsof -ti:5001 | xargs kill -9 2>/dev/null
pkill -f "react-scripts start" 2>/dev/null
pkill -f "node.*server.js" 2>/dev/null
pkill -f "python.*app.py" 2>/dev/null
sleep 2

# Check PostgreSQL
echo "Checking PostgreSQL..."
if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
  echo "❌ PostgreSQL is not running. Please start it first."
  exit 1
fi
echo "✅ PostgreSQL is running"

# Start Backend
echo "Starting backend..."
node backend/src/server.js > logs/backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > logs/backend.pid
sleep 3
if ps -p $BACKEND_PID > /dev/null; then
  echo "✅ Backend started (PID: $BACKEND_PID)"
else
  echo "❌ Backend failed to start. Check logs/backend.log"
  exit 1
fi

# Start Python Service
echo "Starting Python service..."
python-service/venv/bin/python python-service/app.py > logs/python.log 2>&1 &
PYTHON_PID=$!
echo $PYTHON_PID > logs/python.pid
sleep 3
if ps -p $PYTHON_PID > /dev/null; then
  echo "✅ Python service started (PID: $PYTHON_PID)"
else
  echo "❌ Python service failed to start. Check logs/python.log"
  exit 1
fi

# Start Frontend
echo "Starting frontend..."
cd frontend
BROWSER=none npm start > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > ../logs/frontend.pid
cd ..
sleep 15

echo ""
echo "===================================="
echo "✨ All services started!"
echo "===================================="
echo ""
echo "📍 Services:"
echo "  • Frontend:  http://localhost:3000"
echo "  • Backend:   http://localhost:3001"
echo "  • Python:    http://localhost:5001"
echo "  • Database:  localhost:5432"
echo ""
echo "📄 Logs:"
echo "  • Backend:  logs/backend.log"
echo "  • Python:   logs/python.log"
echo "  • Frontend: logs/frontend.log"
echo ""
echo "🛑 To stop all services:"
echo "  ./stop-all.sh"
echo ""
echo "⏳ Waiting for frontend to compile..."
tail -f logs/frontend.log

#!/bin/bash

echo "🛑 Stopping Creative Asset Library"
echo "===================================="

# Kill processes from PID files
if [ -f logs/backend.pid ]; then
  kill $(cat logs/backend.pid) 2>/dev/null && echo "✅ Backend stopped"
fi

if [ -f logs/python.pid ]; then
  kill $(cat logs/python.pid) 2>/dev/null && echo "✅ Python service stopped"
fi

if [ -f logs/frontend.pid ]; then
  kill $(cat logs/frontend.pid) 2>/dev/null && echo "✅ Frontend stopped"
fi

# Kill by port
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:3001 | xargs kill -9 2>/dev/null
lsof -ti:5001 | xargs kill -9 2>/dev/null

# Kill by process name
pkill -f "react-scripts start" 2>/dev/null
pkill -f "node.*server.js" 2>/dev/null
pkill -f "python.*app.py" 2>/dev/null

echo "===================================="
echo "✨ All services stopped"

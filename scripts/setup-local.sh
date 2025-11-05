#!/bin/bash

# Local Development Setup Script
# Run this to set up the project for local development

set -e  # Exit on error

echo "🚀 Creative Library - Local Setup"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python is not installed. Please install Python 3.8+ first."
    exit 1
fi

echo "✅ Prerequisites check passed"
echo ""

# Create .env file if it doesn't exist
if [ ! -f backend/.env ]; then
    echo "${YELLOW}📝 Creating backend/.env from .env.example${NC}"
    cp backend/.env.example backend/.env
    echo "⚠️  Please update backend/.env with your actual credentials"
    echo ""
fi

# Install backend dependencies
echo "${GREEN}📦 Installing backend dependencies...${NC}"
cd backend
npm install
cd ..
echo "✅ Backend dependencies installed"
echo ""

# Install Python dependencies
echo "${GREEN}🐍 Installing Python dependencies...${NC}"
cd python-service
pip3 install -r requirements.txt
cd ..
echo "✅ Python dependencies installed"
echo ""

# Start Docker services
echo "${GREEN}🐳 Starting Docker services (PostgreSQL)...${NC}"
docker-compose up -d postgres
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 5
echo "✅ PostgreSQL is running"
echo ""

# Run database migrations
echo "${GREEN}🗄️  Setting up database...${NC}"
export $(cat backend/.env | grep DATABASE_URL | xargs)
docker exec -i $(docker-compose ps -q postgres) psql $DATABASE_URL < database/schema.sql
docker exec -i $(docker-compose ps -q postgres) psql $DATABASE_URL < database/seeds/01_initial_data.sql
echo "✅ Database setup complete"
echo ""

echo "${GREEN}✅ Setup Complete!${NC}"
echo ""
echo "To start the development servers:"
echo ""
echo "  Terminal 1 (Backend):"
echo "    cd backend && npm run dev"
echo ""
echo "  Terminal 2 (Python Service):"
echo "    cd python-service && python app.py"
echo ""
echo "  Terminal 3 (PostgreSQL):"
echo "    docker-compose up postgres"
echo ""
echo "Or start all services with Docker:"
echo "  docker-compose up"
echo ""
echo "📚 Documentation:"
echo "  - README.md - Project overview"
echo "  - SETUP_GUIDE.md - Detailed setup instructions"
echo "  - API_TEST_GUIDE.md - API endpoint testing"
echo ""
echo "🎉 Happy coding!"

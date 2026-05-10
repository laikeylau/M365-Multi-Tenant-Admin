#!/bin/bash

# M365 Multi-Tenant Admin - Ubuntu Deployment Script
# This script sets up the application on Ubuntu 20.04/22.04

set -e

echo "================================================"
echo "  M365 Multi-Tenant Admin - Deployment Script"
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${YELLOW}Note: Some commands may require sudo privileges${NC}"
fi

# Function to print status
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Check system requirements
echo ""
echo "Checking system requirements..."

# Check if Docker is installed
if command -v docker &> /dev/null; then
    print_status "Docker is installed"
else
    print_warning "Docker not found. Installing..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    print_status "Docker installed successfully"
fi

# Check if Docker Compose is installed
if command -v docker-compose &> /dev/null || docker compose version &> /dev/null; then
    print_status "Docker Compose is installed"
else
    print_warning "Docker Compose not found. Installing..."
    sudo apt-get update
    sudo apt-get install -y docker-compose-plugin
    print_status "Docker Compose installed successfully"
fi

# Create application directory
APP_DIR="/opt/m365-admin"
echo ""
echo "Setting up application directory..."

if [ ! -d "$APP_DIR" ]; then
    sudo mkdir -p $APP_DIR
    sudo chown $USER:$USER $APP_DIR
    print_status "Created $APP_DIR"
else
    print_status "Directory $APP_DIR already exists"
fi

# Copy files (if not already in the correct location)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ "$SCRIPT_DIR" != "$APP_DIR" ]; then
    echo "Copying files to $APP_DIR..."
    cp -r $SCRIPT_DIR/* $APP_DIR/
    print_status "Files copied"
fi

cd $APP_DIR

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo ""
    echo "Creating environment configuration..."
    
    # Generate a random secret key
    SECRET_KEY=$(openssl rand -hex 32)
    
    cat > .env << EOF
# M365 Admin Configuration
SECRET_KEY=$SECRET_KEY
DEBUG=false
CORS_ORIGINS=*

# Database (SQLite by default)
DATABASE_URL=sqlite+aiosqlite:///./data/m365_admin.db
EOF
    
    print_status "Created .env file with secure secret key"
else
    print_status ".env file already exists"
fi

# Build and start the application
echo ""
echo "Building and starting the application..."

# Use docker-compose or docker compose based on availability
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
else
    COMPOSE_CMD="docker compose"
fi

$COMPOSE_CMD build
print_status "Docker image built"

$COMPOSE_CMD up -d
print_status "Application started"

# Wait for the application to start
echo ""
echo "Waiting for application to start..."
sleep 5

# Check if application is running
if curl -s http://localhost:8000/health | grep -q "healthy"; then
    print_status "Application is running and healthy"
else
    print_warning "Application may still be starting. Check logs with: $COMPOSE_CMD logs -f"
fi

# Print summary
echo ""
echo "================================================"
echo -e "${GREEN}  Deployment Complete!${NC}"
echo "================================================"
echo ""
echo "Application URL: http://localhost:8000"
echo "API Documentation: http://localhost:8000/docs"
echo ""
echo "Useful commands:"
echo "  View logs:     cd $APP_DIR && $COMPOSE_CMD logs -f"
echo "  Stop:          cd $APP_DIR && $COMPOSE_CMD down"
echo "  Restart:       cd $APP_DIR && $COMPOSE_CMD restart"
echo "  Update:        cd $APP_DIR && git pull && $COMPOSE_CMD up -d --build"
echo ""
echo "Next steps:"
echo "  1. Access the application at http://your-server-ip:8000"
echo "  2. Add your first M365 tenant using the web interface"
echo "  3. Configure Azure AD app credentials for each tenant"
echo ""

#!/bin/bash

# Color styles
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}===================================================${NC}"
echo -e "${BLUE}=== IntelliDoc Office Suite Installation Setup ===${NC}"
echo -e "${BLUE}===================================================${NC}"

# Check Prerequisites
echo "Checking prerequisites..."

# 1. Check Node.js & NPM
if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: Node.js and NPM are required but not installed.${NC}"
    echo "Please download and install Node.js from https://nodejs.org/"
    exit 1
fi
echo -e "${GREEN}✔ Node.js and NPM are installed.${NC}"

# 2. Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is required but not installed.${NC}"
    echo "Please download and install Docker Desktop from https://www.docker.com/"
    exit 1
fi
echo -e "${GREEN}✔ Docker is installed.${NC}"

# 3. Check Docker Compose
DOCKER_COMPOSE_CMD="docker compose"
if ! docker compose version &> /dev/null; then
    if command -v docker-compose &> /dev/null; then
        DOCKER_COMPOSE_CMD="docker-compose"
    else
        echo -e "${RED}Error: Docker Compose is required but not installed.${NC}"
        echo "Please install Docker Compose."
        exit 1
    fi
fi
echo -e "${GREEN}✔ Docker Compose is installed ($DOCKER_COMPOSE_CMD).${NC}"

# Start Docker Containers
echo "Starting ONLYOFFICE Document Server container..."
$DOCKER_COMPOSE_CMD up -d

# Wait for local.json to be generated inside ONLYOFFICE container
echo "Waiting for ONLYOFFICE container to initialize services (takes about 15-30s)..."
MAX_ATTEMPTS=30
ATTEMPT=1
while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    if docker exec onlyoffice-document-server ls -la /etc/onlyoffice/documentserver/local.json &> /dev/null; then
        echo -e "${GREEN}✔ ONLYOFFICE initialized configuration files.${NC}"
        break
    fi
    echo "Waiting for initialization... (Attempt $ATTEMPT/$MAX_ATTEMPTS)"
    sleep 2
    ATTEMPT=$((ATTEMPT+1))
done

if [ $ATTEMPT -gt $MAX_ATTEMPTS ]; then
    echo -e "${RED}Error: ONLYOFFICE initialization timed out. Checking container status...${NC}"
    docker ps
    exit 1
fi

# Override request filtering agent in local.json (disabling loopback block)
echo "Overriding request connection filters..."
docker exec onlyoffice-document-server python3 -c "
import json
file = '/etc/onlyoffice/documentserver/local.json'
with open(file, 'r') as f:
    data = json.load(f)
if 'services' not in data:
    data['services'] = {}
if 'CoAuthoring' not in data['services']:
    data['services']['CoAuthoring'] = {}
if 'request-filtering-agent' not in data['services']['CoAuthoring']:
    data['services']['CoAuthoring']['request-filtering-agent'] = {}
data['services']['CoAuthoring']['request-filtering-agent']['allowPrivateIPAddress'] = True
data['services']['CoAuthoring']['request-filtering-agent']['allowLoopbackAddress'] = True
with open(file, 'w') as f:
    json.dump(data, f, indent=2)
"

# Inject Stylesheet rules to hide branding header logo
echo "Refactoring stylesheet overrides in container..."
docker exec onlyoffice-document-server sh -c "echo '.header-logo, #header-logo { display: none !important; }' >> /var/www/onlyoffice/documentserver/web-apps/apps/documenteditor/main/resources/css/app.css"
docker exec onlyoffice-document-server sh -c "echo '.header-logo, #header-logo { display: none !important; }' >> /var/www/onlyoffice/documentserver/web-apps/apps/documenteditor/embed/resources/css/app-all.css"
docker exec onlyoffice-document-server sh -c "echo '.header-logo, #header-logo { display: none !important; }' >> /var/www/onlyoffice/documentserver/web-apps/apps/spreadsheeteditor/main/resources/css/app.css"
docker exec onlyoffice-document-server sh -c "echo '.header-logo, #header-logo { display: none !important; }' >> /var/www/onlyoffice/documentserver/web-apps/apps/presentationeditor/main/resources/css/app.css"
docker exec onlyoffice-document-server sh -c "echo '.header-logo, #header-logo { display: none !important; }' >> /var/www/onlyoffice/documentserver/web-apps/apps/pdfeditor/main/resources/css/app.css"

# Restart container to apply local.json
echo "Restarting ONLYOFFICE Document Server to apply overrides..."
docker restart onlyoffice-document-server

# Install local node dependencies
echo "Installing Node.js dependencies..."
npm install

echo -e "${GREEN}===================================================${NC}"
echo -e "${GREEN}=== Setup Installation Complete! ===${NC}"
echo -e "${GREEN}===================================================${NC}"
echo -e "To start the application, run:"
echo -e "  ${BLUE}npm start${NC}"
echo -e "Then open your browser and navigate to:"
echo -e "  ${BLUE}http://localhost:5000${NC}"

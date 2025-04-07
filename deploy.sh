#!/bin/bash

# Advanced Web Scraper API Deployment Script

# Exit on error
set -e

# Display help message
function show_help {
  echo "Advanced Web Scraper API Deployment Script"
  echo ""
  echo "Usage: ./deploy.sh [OPTIONS]"
  echo ""
  echo "Options:"
  echo "  -h, --help                 Show this help message"
  echo "  -e, --env FILE             Specify environment file (default: .env.docker)"
  echo "  -b, --build                Force rebuild of Docker images"
  echo "  -d, --detach               Run containers in detached mode"
  echo "  -p, --pull                 Pull latest images before starting"
  echo "  -s, --stop                 Stop running containers"
  echo "  -r, --restart              Restart containers"
  echo "  -l, --logs [SERVICE]       View logs (optionally for a specific service)"
  echo "  --prune                    Remove unused Docker resources"
  echo ""
  echo "Examples:"
  echo "  ./deploy.sh                Start all services"
  echo "  ./deploy.sh -b -d          Rebuild and start in detached mode"
  echo "  ./deploy.sh -s             Stop all services"
  echo "  ./deploy.sh -r             Restart all services"
  echo "  ./deploy.sh -l app         View logs for the app service"
  echo ""
}

# Default values
ENV_FILE=".env.docker"
BUILD=false
DETACH=false
PULL=false
STOP=false
RESTART=false
LOGS=false
LOG_SERVICE=""
PRUNE=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      show_help
      exit 0
      ;;
    -e|--env)
      ENV_FILE="$2"
      shift 2
      ;;
    -b|--build)
      BUILD=true
      shift
      ;;
    -d|--detach)
      DETACH=true
      shift
      ;;
    -p|--pull)
      PULL=true
      shift
      ;;
    -s|--stop)
      STOP=true
      shift
      ;;
    -r|--restart)
      RESTART=true
      shift
      ;;
    -l|--logs)
      LOGS=true
      if [[ $2 != -* && $2 != "" ]]; then
        LOG_SERVICE="$2"
        shift
      fi
      shift
      ;;
    --prune)
      PRUNE=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      show_help
      exit 1
      ;;
  esac
done

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
  echo "Error: Docker is not installed or not in PATH"
  exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
  echo "Error: Docker Compose is not installed or not in PATH"
  exit 1
fi

# Check if environment file exists
if [ ! -f "$ENV_FILE" ]; then
  echo "Error: Environment file '$ENV_FILE' not found"
  echo "Create it from .env.example or specify a different file with -e option"
  exit 1
fi

# Set environment file for Docker Compose
export COMPOSE_DOCKER_CLI_BUILD=1
export DOCKER_BUILDKIT=1
export ENV_FILE

# Stop containers if requested
if [ "$STOP" = true ]; then
  echo "Stopping containers..."
  docker-compose down
  echo "Containers stopped"
  exit 0
fi

# View logs if requested
if [ "$LOGS" = true ]; then
  if [ -z "$LOG_SERVICE" ]; then
    echo "Viewing logs for all services..."
    docker-compose logs -f
  else
    echo "Viewing logs for $LOG_SERVICE..."
    docker-compose logs -f "$LOG_SERVICE"
  fi
  exit 0
fi

# Prune Docker resources if requested
if [ "$PRUNE" = true ]; then
  echo "Pruning unused Docker resources..."
  docker system prune -f
  echo "Docker resources pruned"
fi

# Pull latest images if requested
if [ "$PULL" = true ]; then
  echo "Pulling latest images..."
  docker-compose pull
  echo "Images pulled"
fi

# Build options
BUILD_OPTS=""
if [ "$BUILD" = true ]; then
  BUILD_OPTS="--build"
fi

# Detach option
DETACH_OPTS=""
if [ "$DETACH" = true ]; then
  DETACH_OPTS="-d"
fi

# Restart containers if requested
if [ "$RESTART" = true ]; then
  echo "Restarting containers..."
  docker-compose down
  docker-compose up $BUILD_OPTS $DETACH_OPTS
  echo "Containers restarted"
  exit 0
fi

# Start containers
echo "Starting containers with environment file: $ENV_FILE"
docker-compose --env-file "$ENV_FILE" up $BUILD_OPTS $DETACH_OPTS

echo "Deployment completed"

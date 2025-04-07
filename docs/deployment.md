# Deployment Guide: Advanced Web Scraper API

This guide explains how to deploy the Advanced Web Scraper API using Docker and Docker Compose.

## Prerequisites

- Docker (version 20.10.0 or higher)
- Docker Compose (version 2.0.0 or higher)
- Git (for cloning the repository)

## Deployment Steps

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/adv-web-scraper-api.git
cd adv-web-scraper-api
```

### 2. Configure Environment Variables

The application uses environment variables for configuration. A template file `.env.docker` is provided:

```bash
# Copy the template
cp .env.docker .env
```

Edit the `.env` file to set your specific configuration values:

```bash
# Open with your preferred editor
nano .env
```

Important variables to configure:

- `NODE_ENV`: Set to `production` for production deployments
- `MONGODB_URI`: MongoDB connection string (default is fine if using the provided Docker Compose setup)
- `REDIS_HOST` and `REDIS_PORT`: Redis connection details (default is fine if using the provided Docker Compose setup)
- `TWOCAPTCHA_API_KEY` and `ANTICAPTCHA_API_KEY`: API keys for CAPTCHA solving services (if used)
- `PROXY_API_URL` and `PROXY_API_KEY`: Proxy service details (if used)
- `BROWSER_POOL_MIN` and `BROWSER_POOL_MAX`: Browser pool size configuration

### 3. Deploy with Docker Compose

The project includes a deployment script that simplifies the Docker Compose operations:

```bash
# Make the script executable (if not already)
chmod +x deploy.sh

# Deploy with default settings
./deploy.sh

# Or deploy with specific options
./deploy.sh -b -d  # Build and run in detached mode
```

#### Deployment Script Options

The `deploy.sh` script provides several options:

```
Options:
  -h, --help                 Show help message
  -e, --env FILE             Specify environment file (default: .env.docker)
  -b, --build                Force rebuild of Docker images
  -d, --detach               Run containers in detached mode
  -p, --pull                 Pull latest images before starting
  -s, --stop                 Stop running containers
  -r, --restart              Restart containers
  -l, --logs [SERVICE]       View logs (optionally for a specific service)
  --prune                    Remove unused Docker resources
```

### 4. Verify Deployment

After deployment, verify that all services are running:

```bash
docker-compose ps
```

You should see three services running:
- `app`: The Advanced Web Scraper API application
- `mongodb`: MongoDB database
- `redis`: Redis cache and queue

### 5. Access the API

The API will be available at:

```
http://localhost:3000
```

You can test it with a simple curl command:

```bash
curl http://localhost:3000/api/v1/health
```

## Managing the Deployment

### Viewing Logs

To view logs from the services:

```bash
# View logs from all services
./deploy.sh -l

# View logs from a specific service
./deploy.sh -l app
```

### Stopping the Services

To stop all services:

```bash
./deploy.sh -s
```

### Restarting the Services

To restart all services:

```bash
./deploy.sh -r
```

### Updating the Deployment

To update the deployment with the latest code:

```bash
# Pull the latest code
git pull

# Restart with a rebuild
./deploy.sh -r -b
```

## Docker Compose Manual Commands

If you prefer to use Docker Compose directly instead of the deployment script:

```bash
# Start services
docker-compose --env-file .env up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild and start
docker-compose up --build -d
```

## Data Persistence

The Docker Compose configuration sets up persistent volumes for:

1. MongoDB data: Stored in a Docker volume named `mongodb-data`
2. Redis data: Stored in a Docker volume named `redis-data`
3. Application logs: Mapped to the `./logs` directory
4. Screenshots: Mapped to the `./screenshots` directory
5. Browser data: Mapped to the `./browser-data` directory

These volumes ensure that your data persists across container restarts.

## Production Considerations

For production deployments, consider the following:

1. **Security**:
   - Use a reverse proxy (like Nginx) with HTTPS
   - Set up proper authentication for the API
   - Restrict access to MongoDB and Redis from external networks

2. **Scaling**:
   - Adjust the `BROWSER_POOL_MIN` and `BROWSER_POOL_MAX` based on your server resources
   - Consider using a container orchestration system like Kubernetes for larger deployments

3. **Monitoring**:
   - Set up monitoring for the containers
   - Configure alerts for service disruptions
   - Implement log aggregation

4. **Backup**:
   - Set up regular backups of MongoDB data
   - Implement a backup strategy for important scraping results

## Troubleshooting

### Common Issues

1. **Container fails to start**:
   - Check logs with `docker-compose logs app`
   - Verify environment variables are set correctly
   - Ensure MongoDB and Redis are running

2. **MongoDB connection issues**:
   - Verify MongoDB container is running
   - Check the MongoDB connection string in the environment file
   - Ensure the MongoDB port is not in use by another service

3. **Redis connection issues**:
   - Verify Redis container is running
   - Check the Redis host and port in the environment file
   - Ensure the Redis port is not in use by another service

4. **Browser automation issues**:
   - Check if Playwright is installed correctly
   - Verify the browser dependencies are installed
   - Adjust browser pool settings if you're running out of memory

### Getting Help

If you encounter issues not covered in this guide:

1. Check the application logs for error messages
2. Consult the project documentation
3. Open an issue on the project's GitHub repository

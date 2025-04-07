# Deploying Advanced Web Scraper API with Coolify

This guide explains how to deploy the Advanced Web Scraper API using Coolify, a self-hostable PaaS (Platform as a Service).

## Deployment Options with Coolify

Coolify offers two main deployment methods for Docker applications:

1. **Git Repository Deployment**: Coolify builds the Docker image directly from your Git repository
2. **Docker Hub Deployment**: You push a pre-built image to Docker Hub, and Coolify pulls and deploys it

Both methods are covered in this guide.

## Prerequisites

- A Coolify instance up and running
- Git repository with your Advanced Web Scraper API code
- (Optional) Docker Hub account for the Docker Hub deployment method

## Option 1: Git Repository Deployment (Recommended)

This method allows Coolify to build the Docker image directly from your Git repository.

### Steps:

1. **Log in to your Coolify dashboard**

2. **Create a new service**
   - Click "Create New Resource"
   - Select "Application"
   - Choose "Git Repository"

3. **Configure the Git repository**
   - Select your Git provider (GitHub, GitLab, etc.)
   - Connect your account if not already connected
   - Select the repository containing the Advanced Web Scraper API

4. **Configure the build settings**
   - Build Method: Dockerfile
   - Dockerfile Path: `./Dockerfile` (or the path to your Dockerfile)
   - Docker Compose: No (unless you want to use the docker-compose.yml file)

5. **Configure environment variables**
   - Add all the necessary environment variables from `.env.docker`
   - Make sure to update the database connection strings to point to your MongoDB and Redis instances
   - Important variables to set:
     ```
     NODE_ENV=production
     PORT=3000
     HOST=0.0.0.0
     MONGODB_URI=mongodb://your-mongodb-host:27017/web-scraper
     REDIS_HOST=your-redis-host
     REDIS_PORT=6379
     ```

6. **Configure resources**
   - Set appropriate CPU and memory limits based on your needs
   - The application requires more resources than typical Node.js apps due to browser automation

7. **Configure persistent storage**
   - Add persistent storage for:
     - `/usr/src/app/logs`
     - `/usr/src/app/screenshots`
     - `/usr/src/app/browser-data`

8. **Deploy the application**
   - Click "Deploy" to start the deployment process
   - Coolify will clone the repository, build the Docker image, and deploy it

## Option 2: Docker Hub Deployment

This method involves pushing your Docker image to Docker Hub first, then deploying it from there.

### Step 1: Build and Push to Docker Hub

1. **Build the Docker image locally**

   ```bash
   # Build the image with a tag
   docker build -t yourusername/adv-web-scraper-api:latest .
   
   # Log in to Docker Hub
   docker login
   
   # Push the image to Docker Hub
   docker push yourusername/adv-web-scraper-api:latest
   ```

2. **Automate builds with GitHub Actions (Optional)**

   Create a `.github/workflows/docker-publish.yml` file:

   ```yaml
   name: Docker

   on:
     push:
       branches: [ main ]
       tags: [ 'v*.*.*' ]
     pull_request:
       branches: [ main ]

   jobs:
     build:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         
         - name: Login to Docker Hub
           uses: docker/login-action@v2
           with:
             username: ${{ secrets.DOCKERHUB_USERNAME }}
             password: ${{ secrets.DOCKERHUB_TOKEN }}
             
         - name: Build and push
           uses: docker/build-push-action@v4
           with:
             push: true
             tags: yourusername/adv-web-scraper-api:latest
   ```

   Don't forget to add `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` secrets in your GitHub repository settings.

### Step 2: Deploy from Docker Hub in Coolify

1. **Log in to your Coolify dashboard**

2. **Create a new service**
   - Click "Create New Resource"
   - Select "Application"
   - Choose "Docker Image"

3. **Configure the Docker image**
   - Image: `yourusername/adv-web-scraper-api:latest`
   - Port: 3000

4. **Configure environment variables**
   - Add all the necessary environment variables from `.env.docker`
   - Make sure to update the database connection strings to point to your MongoDB and Redis instances

5. **Configure resources**
   - Set appropriate CPU and memory limits based on your needs

6. **Configure persistent storage**
   - Add persistent storage for:
     - `/usr/src/app/logs`
     - `/usr/src/app/screenshots`
     - `/usr/src/app/browser-data`

7. **Deploy the application**
   - Click "Deploy" to start the deployment process
   - Coolify will pull the Docker image and deploy it

## Setting Up Dependencies (MongoDB and Redis)

For a complete deployment, you'll need MongoDB and Redis. You can deploy these as separate services in Coolify:

### MongoDB Deployment

1. **Create a new service**
   - Click "Create New Resource"
   - Select "Database"
   - Choose "MongoDB"

2. **Configure MongoDB**
   - Set a strong password
   - Configure persistent storage
   - Set resource limits

3. **Note the connection details**
   - Update the `MONGODB_URI` in your Advanced Web Scraper API environment variables

### Redis Deployment

1. **Create a new service**
   - Click "Create New Resource"
   - Select "Database"
   - Choose "Redis"

2. **Configure Redis**
   - Set a strong password
   - Configure persistent storage
   - Set resource limits

3. **Note the connection details**
   - Update the `REDIS_HOST` and `REDIS_PORT` in your Advanced Web Scraper API environment variables

## Coolify-Specific Considerations

### Resource Requirements

The Advanced Web Scraper API requires more resources than typical Node.js applications due to browser automation:

- **CPU**: Minimum 1 vCPU, recommended 2+ vCPUs
- **Memory**: Minimum 2GB RAM, recommended 4GB+ RAM
- **Storage**: Minimum 10GB, recommended 20GB+

### Network Configuration

Ensure that your Coolify instance allows outbound connections to the websites you plan to scrape.

### Scaling Considerations

For high-volume scraping:

1. **Horizontal Scaling**:
   - Deploy multiple instances of the application
   - Use a load balancer to distribute requests

2. **Vertical Scaling**:
   - Increase CPU and memory resources for the application

### Monitoring

Set up monitoring for your Coolify deployment:

1. Enable Coolify's built-in monitoring
2. Configure alerts for resource usage and application health
3. Set up log monitoring to track scraping activities and errors

## Troubleshooting

### Common Issues

1. **Container fails to start**:
   - Check the logs in Coolify dashboard
   - Verify environment variables are set correctly
   - Ensure sufficient resources are allocated

2. **Browser automation issues**:
   - Ensure the container has enough memory
   - Check if all required dependencies are installed
   - Verify that the browser can run in the container environment

3. **Connection issues to MongoDB or Redis**:
   - Verify the connection strings are correct
   - Check if the services are running
   - Ensure network connectivity between services

### Getting Help

If you encounter issues not covered in this guide:

1. Check the application logs in the Coolify dashboard
2. Consult the Coolify documentation for deployment-specific issues
3. Open an issue on the project's GitHub repository

# Docker Deployment Guide

This guide covers deploying Aegis using Docker containers for local development and self-hosted production environments.

## Architecture

The Docker setup includes:
- **App Container**: Next.js 14 app running in standalone mode (optimized, production-ready)
- **PostgreSQL Container**: PostgreSQL 16 Alpine for data persistence
- **Volume**: Persistent storage for database data

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (v20.10+)
- [Docker Compose](https://docs.docker.com/compose/install/) (v2.0+)
- Git (to clone the repository)

## Quick Start

### 1. Clone and Configure

```bash
# Clone repository
git clone <your-repo-url>
cd aegis

# Copy environment template
cp .env.example .env

# Edit .env with your API keys (optional but recommended)
nano .env  # or use your preferred editor
```

**Recommended environment variables:**
```bash
# Optional: GitHub API token for higher rate limits
GITHUB_TOKEN=ghp_your_token_here

# Optional: Groq API key for AI-assisted verification
GROQ_API_KEY=gsk_your_key_here

# Optional: CI/CD security gate token
AEGIS_CI_TOKEN=your_random_token_here
```

### 2. Build and Start

```bash
# Build images and start containers
docker-compose up --build
```

This command:
- Builds the Next.js app in production mode
- Starts PostgreSQL 16 database
- Starts the Aegis app on port 3000
- Creates a persistent volume for database data

**First run** will take a few minutes to build the Docker image.

### 3. Initialize Database

In a new terminal (while containers are running):

```bash
# Run Prisma migrations to set up database schema
docker-compose exec app npx prisma migrate deploy
```

### 4. Access Application

Open your browser to:
- **Application**: http://localhost:3000
- **Interactive Demo**: http://localhost:3000/demo
- **Dashboard**: http://localhost:3000/dashboard

## Docker Compose Commands

### Start containers (background)
```bash
docker-compose up -d
```

### Stop containers
```bash
docker-compose down
```

### Stop and remove volumes (⚠️ deletes database data)
```bash
docker-compose down -v
```

### View logs
```bash
# All containers
docker-compose logs -f

# App only
docker-compose logs -f app

# PostgreSQL only
docker-compose logs -f postgres
```

### Rebuild after code changes
```bash
docker-compose up --build
```

### Execute commands in app container
```bash
# Run Prisma migrations
docker-compose exec app npx prisma migrate deploy

# Generate Prisma client
docker-compose exec app npx prisma generate

# Access shell
docker-compose exec app sh
```

### Execute commands in database
```bash
# Access PostgreSQL CLI
docker-compose exec postgres psql -U aegis -d aegis

# Backup database
docker-compose exec postgres pg_dump -U aegis aegis > backup.sql

# Restore database
docker-compose exec -T postgres psql -U aegis aegis < backup.sql
```

## Multi-Stage Build Details

The Dockerfile uses a two-stage build for optimal image size:

### Stage 1: Builder (node:20-alpine)
- Installs all dependencies
- Generates Prisma Client
- Builds Next.js in standalone mode
- ~1GB intermediate image

### Stage 2: Runner (node:20-alpine)
- Copies only production files
- Runs as non-root user (nextjs:nodejs)
- Final image: ~150-200MB

## Environment Variables

### Required
- `DATABASE_URL`: Set automatically by docker-compose to point to postgres service

### Optional
- `GITHUB_TOKEN`: GitHub PAT for higher API rate limits (60/hour → 5,000/hour)
- `GROQ_API_KEY`: Groq API key for AI-assisted verification
- `AEGIS_CI_TOKEN`: Shared secret for CI/CD security gate

### Automatic
- `NODE_ENV=production`: Set by Dockerfile
- `HOSTNAME=0.0.0.0`: Required for Docker networking
- `PORT=3000`: Application port

## Networking

### Ports Exposed
- **3000**: Next.js application (mapped to host)
- **5432**: PostgreSQL (mapped to host for external access)

### Service Communication
- App connects to PostgreSQL via hostname `postgres` (Docker internal DNS)
- Database URL: `postgresql://aegis:aegis_dev_password@postgres:5432/aegis`

## Volumes

### postgres_data
- **Type**: Named volume
- **Purpose**: Persists PostgreSQL database across container restarts
- **Location**: Managed by Docker (typically `/var/lib/docker/volumes/`)

**View volume:**
```bash
docker volume inspect aegis_postgres_data
```

**Backup volume:**
```bash
docker run --rm -v aegis_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_backup.tar.gz -C /data .
```

**Restore volume:**
```bash
docker run --rm -v aegis_postgres_data:/data -v $(pwd):/backup alpine tar xzf /backup/postgres_backup.tar.gz -C /data
```

## Production Deployment

### Security Hardening

1. **Change database credentials**:
   ```yaml
   # docker-compose.yml
   environment:
     POSTGRES_PASSWORD: use_strong_random_password_here
   ```
   
   Update `DATABASE_URL` in app service to match.

2. **Use secrets management**:
   ```bash
   # Use Docker secrets or environment-specific .env files
   docker-compose --env-file .env.production up
   ```

3. **Enable SSL for PostgreSQL**:
   - Mount SSL certificates
   - Update `DATABASE_URL` with `?sslmode=require`

4. **Restrict ports**:
   ```yaml
   # Remove public port mapping for postgres
   postgres:
     # ports:
     #   - "5432:5432"  # Comment out for production
   ```

### Scaling

Run multiple app instances behind a load balancer:

```bash
# Scale app service to 3 instances
docker-compose up --scale app=3 -d
```

Configure nginx/traefik to load balance across instances.

### Monitoring

**Health checks:**
```yaml
app:
  healthcheck:
    test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/api/health"]
    interval: 30s
    timeout: 5s
    retries: 3
```

**Resource limits:**
```yaml
app:
  deploy:
    resources:
      limits:
        cpus: '2'
        memory: 2G
      reservations:
        memory: 512M
```

## Troubleshooting

### Port already in use
```bash
# Check what's using port 3000
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Change port mapping in docker-compose.yml
ports:
  - "3001:3000"  # Use port 3001 on host
```

### Database connection failed
```bash
# Check postgres is healthy
docker-compose ps

# View postgres logs
docker-compose logs postgres

# Verify connection from app
docker-compose exec app npx prisma db pull
```

### Build fails
```bash
# Clean build cache
docker-compose build --no-cache

# Remove old images
docker system prune -a
```

### Migration fails
```bash
# Check database state
docker-compose exec app npx prisma migrate status

# Reset database (⚠️ destructive)
docker-compose exec app npx prisma migrate reset
```

### App won't start
```bash
# Check app logs
docker-compose logs app

# Verify environment variables
docker-compose exec app env | grep DATABASE_URL

# Test database connection
docker-compose exec app npx prisma db push
```

## Development Workflow

### Hot Reload (Development Mode)

For development with hot reload, override the Dockerfile:

```yaml
# docker-compose.dev.yml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    volumes:
      - .:/app
      - /app/node_modules
      - /app/.next
    environment:
      NODE_ENV: development
```

### Running Tests

```bash
# Unit tests
docker-compose exec app npm test

# E2E tests
docker-compose exec app npm run test:e2e
```

### Database Management

```bash
# Create new migration
docker-compose exec app npx prisma migrate dev --name add_new_field

# View database in Prisma Studio
docker-compose exec app npx prisma studio
# Access at http://localhost:5555
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Docker Build

on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Docker image
        run: docker build -t aegis:${{ github.sha }} .
      
      - name: Run tests
        run: |
          docker-compose up -d
          docker-compose exec -T app npx prisma migrate deploy
          docker-compose exec -T app npm test
          docker-compose down
```

## Comparison: Docker vs. Cloud

| Aspect | Docker (Self-Hosted) | Vercel/Render |
|--------|---------------------|---------------|
| **Setup** | Manual, full control | Automatic, managed |
| **Cost** | Server costs | Free tier → paid plans |
| **Scaling** | Manual | Automatic |
| **Database** | Self-managed | Managed (e.g., Neon) |
| **SSL** | Configure yourself | Automatic |
| **Updates** | Manual rebuild | Git push deploys |
| **Best For** | College projects, full control, compliance | Production, fast deployment |

## College Deployment Requirements

This Docker setup satisfies typical college project requirements:

✅ **Containerized deployment** - Multi-stage Dockerfile  
✅ **Database included** - PostgreSQL in container  
✅ **Environment configuration** - .env file support  
✅ **One-command setup** - `docker-compose up --build`  
✅ **Persistent data** - Docker volumes  
✅ **Production-ready** - Optimized standalone build  
✅ **Documentation** - Complete guide (this file)  

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Next.js Docker Documentation](https://nextjs.org/docs/deployment#docker-image)
- [Prisma with Docker](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-docker)

## Support

For issues specific to Docker deployment:
1. Check logs: `docker-compose logs`
2. Verify configuration: `docker-compose config`
3. Test database: `docker-compose exec postgres psql -U aegis`
4. Rebuild clean: `docker-compose down -v && docker-compose up --build`

# Docker Quick Reference

Quick commands for working with Aegis Docker deployment.

## Common Commands

### First Time Setup
```bash
# 1. Copy environment template
cp .env.example .env

# 2. Build and start
docker-compose up --build

# 3. Run migrations (in new terminal)
docker-compose exec app npx prisma migrate deploy

# 4. Access: http://localhost:3000
```

### Daily Development
```bash
# Start (background)
docker-compose up -d

# Stop
docker-compose down

# View logs
docker-compose logs -f

# Restart after code changes
docker-compose up --build
```

### Database Commands
```bash
# Run migrations
docker-compose exec app npx prisma migrate deploy

# Prisma Studio (GUI)
docker-compose exec app npx prisma studio

# PostgreSQL CLI
docker-compose exec postgres psql -U aegis -d aegis

# Backup database
docker-compose exec postgres pg_dump -U aegis aegis > backup.sql
```

### Debugging
```bash
# Check container status
docker-compose ps

# View app logs
docker-compose logs app

# View database logs
docker-compose logs postgres

# Access app shell
docker-compose exec app sh

# Test database connection
docker-compose exec app npx prisma db pull
```

### Cleanup
```bash
# Stop and remove containers
docker-compose down

# Remove containers + volumes (⚠️ deletes data)
docker-compose down -v

# Clean build cache
docker-compose build --no-cache

# Remove unused Docker resources
docker system prune -a
```

## Environment Variables

Create `.env` file with:
```bash
# Optional: GitHub rate limits
GITHUB_TOKEN=ghp_your_token

# Optional: AI verification
GROQ_API_KEY=gsk_your_key

# Optional: CI/CD gate
AEGIS_CI_TOKEN=your_token
```

## Ports

- **3000**: Application (http://localhost:3000)
- **5432**: PostgreSQL (for external tools)

## Troubleshooting

### "Port already in use"
```bash
# Change port in docker-compose.yml
ports:
  - "3001:3000"
```

### "Database connection failed"
```bash
# Wait for postgres to be ready
docker-compose logs postgres | grep "ready"

# Or restart
docker-compose restart postgres
```

### "Build failed"
```bash
# Clean build
docker-compose down -v
docker-compose build --no-cache
docker-compose up
```

## Quick Links

- Full guide: [../DOCKER.md](../DOCKER.md)
- Deployment: [../DEPLOYMENT.md](../DEPLOYMENT.md)
- Main README: [../README.md](../README.md)

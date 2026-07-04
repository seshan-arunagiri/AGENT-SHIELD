# Aegis Deployment Guide

Follow these manual steps to deploy Aegis to a production environment. 

## 1. Database Setup (Neon)
Aegis uses PostgreSQL in production. We recommend Neon for a serverless Postgres database.
1. Create a free account at [Neon.tech](https://neon.tech).
2. Create a new project and database.
3. Copy the **Connection String** (ensure it includes `?sslmode=require`).
4. Save this string; you will need it for the `DATABASE_URL` environment variable.

## 2. GitHub Token (Optional)
To ensure the Live GitHub Repo scanner isn't severely rate-limited by GitHub's public API limits:
1. Go to your GitHub account settings > Developer settings > Personal access tokens > Tokens (classic).
2. Generate a new token (no specific scopes required for public repos).
3. Copy the token. Save it for the `GITHUB_TOKEN` environment variable.

## 3. Version Control
1. Initialize a Git repository if you haven't already (`git init`).
2. Commit your code.
3. Push the code to a GitHub repository.

## 4. Deploy to Hosting Platform
You can deploy the entire Next.js application (frontend + API) to either Render or Vercel.

### Option A: Render
Render uses the included `render.yaml` to automatically configure the build and start commands.
1. Go to [Render.com](https://render.com) and connect your GitHub account.
2. Create a new **Blueprint Instance** (or Web Service).
3. Select your Aegis repository. Render will automatically detect the `render.yaml`.
4. In the Render dashboard, add the following Environment Variables:
   - `DATABASE_URL` = (Your Neon connection string)
   - `GITHUB_TOKEN` = (Your GitHub PAT)
5. Deploy. The build command `npm install && npx prisma generate && npx prisma migrate deploy && npm run build` will automatically run your database migrations against Neon.

### Option B: Vercel
1. Go to [Vercel.com](https://vercel.com) and connect your GitHub account.
2. Import your Aegis repository.
3. In the "Environment Variables" section before deploying, add:
   - `DATABASE_URL` = (Your Neon connection string)
   - `GITHUB_TOKEN` = (Your GitHub PAT)
4. Click Deploy. Vercel automatically runs `npm run build`, which triggers the `postinstall` script (`prisma generate`).
5. *Note:* If migrations do not run automatically on Vercel, you may need to run `npx prisma migrate deploy` locally against your production database using `DATABASE_URL=(Neon URL) npx prisma migrate deploy`.

## 5. End-to-End Verification
Once the deployment is live:
1. Visit your live URL.
2. Navigate to the **Interactive Demo** and run a mock scan.
3. Run a **GitHub Repo** scan (e.g., `github.com/facebook/react`) to verify external API fetching.
4. Navigate to the **Dashboard** and **Logs** to confirm the Postgres database successfully recorded the scans.

# Aegis

**Middleware security layer for AI agents — protecting against tool poisoning and prompt injection via MCP.**

> Work in Progress — scaffold only. Core implementation coming in subsequent iterations.

---

Built with Next.js 14 (App Router), TypeScript, Tailwind CSS, and Shadcn UI.

## Features

- **Real-time Threat Detection**: Scans MCP tool responses for 34+ threat patterns across 6 categories
- **Risk Scoring Engine**: Weighted risk calculation with diminishing returns
- **Content Sanitization**: Neutralizes detected threats while preserving functionality
- **GitHub Repository Scanning**: Scans up to 30 text-based files from public repositories
- **Automated CI Security Gate**: GitHub Actions integration blocks risky code from merging
- **Audit Logging**: SQLite/Postgres storage for compliance and threat analysis
- **Analytics Dashboard**: Visualize threat trends and detection patterns

## CI Security Gate

Aegis includes an automated GitHub Actions workflow that scans every push and pull request for security threats. Once configured, it runs automatically without manual intervention.

### Setup (One-Time Configuration)

1. **Deploy Aegis** to Vercel or Render (see [Deployment Options](#deployment-options) below)

2. **Generate a CI token**:
   ```bash
   openssl rand -hex 32
   ```

3. **Configure your deployed app**:
   - Add `AEGIS_CI_TOKEN` as an environment variable with the generated token
   - Redeploy to apply the change

4. **Configure GitHub repository secrets**:
   - Go to your repo's **Settings > Secrets and variables > Actions**
   - Add two secrets:
     - `AEGIS_API_URL`: Your deployed Aegis URL (e.g., `https://aegis.vercel.app`)
     - `AEGIS_CI_TOKEN`: The same token from step 2

### How It Works

Once configured, every push and pull request automatically:
1. Detects changed text-based files (.md, .js, .ts, .json, .py, etc.)
2. Sends file contents to your deployed Aegis instance for scanning
3. Posts a comment on the PR with per-file risk scores
4. **Blocks the merge** if any file has Medium or Critical risk level
5. Allows the merge if all files are Safe or Low risk

The workflow runs in seconds and requires no manual steps after initial setup.

## Deployment Options

Aegis is a full-stack Next.js application that can be deployed entirely on a single platform:
- **Vercel**: Can host the entire application seamlessly. The UI is deployed globally on the edge, while the `/api` routes are automatically deployed as serverless functions.
- **Render**: Can host the entire application as a single Node.js Web Service (configured via the included `render.yaml`).

For detailed manual deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).

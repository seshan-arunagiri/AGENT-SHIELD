# Aegis

**Middleware security layer for AI agents — protecting against tool poisoning and prompt injection via MCP.**

> Work in Progress — scaffold only. Core implementation coming in subsequent iterations.

---

Built with Next.js 14 (App Router), TypeScript, Tailwind CSS, and Shadcn UI.

## Deployment Options

Aegis is a full-stack Next.js application that can be deployed entirely on a single platform:
- **Vercel**: Can host the entire application seamlessly. The UI is deployed globally on the edge, while the `/api` routes are automatically deployed as serverless functions.
- **Render**: Can host the entire application as a single Node.js Web Service (configured via the included `render.yaml`).

For detailed manual deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).

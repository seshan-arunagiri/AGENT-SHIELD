import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-white/[0.06] py-10">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          {/* Left: Logo + tagline */}
          <div className="flex flex-col items-center gap-1.5 sm:items-start">
            <span className="text-sm font-semibold text-white">AgentShield</span>
            <p className="text-xs text-zinc-600">
              Security middleware for AI agents. Work in progress.
            </p>
          </div>

          {/* Right: Links */}
          <div className="flex items-center gap-5">
            <Link
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              id="footer-github"
              className="flex items-center gap-1.5 text-xs text-zinc-600 transition-colors hover:text-zinc-300"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              GitHub
            </Link>
            <span className="text-zinc-800">|</span>
            <Link
              href="#"
              id="footer-docs"
              className="text-xs text-zinc-600 transition-colors hover:text-zinc-300"
            >
              Docs
            </Link>
            <span className="text-zinc-800">|</span>
            <Link
              href="#"
              id="footer-privacy"
              className="text-xs text-zinc-600 transition-colors hover:text-zinc-300"
            >
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

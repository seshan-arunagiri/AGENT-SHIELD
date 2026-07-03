// Utility functions for AgentShield
// Implementations will be added as modules are built.

/**
 * Format a Date object as an ISO string (UTC).
 */
export function formatTimestamp(date: Date = new Date()): string {
  return date.toISOString();
}

/**
 * Truncate a string to a maximum length, appending "..." if truncated.
 */
export function truncate(text: string, maxLength: number = 80): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

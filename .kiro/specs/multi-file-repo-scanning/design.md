# Design Document: Multi-File Repository Scanning

## Overview

This feature extends Aegis to scan up to 30 text-based files from a GitHub repository instead of only the README. The system will fetch the repository's file tree, filter by relevant extensions, prioritize configuration and documentation files, fetch raw content via rate-limit-free endpoints, scan each file individually, and aggregate results with per-file breakdowns. The frontend will display a summary with expandable per-file details, maintaining the existing scroll-contained UI pattern.

Key constraints: scanner/riskEngine/sanitizer core logic remains untouched, only `app/api/scan-repo/route.ts` and `app/demo/page.tsx` are modified, strongly typed TypeScript throughout.

## Architecture

```mermaid
graph TB
    subgraph "Frontend: app/demo/page.tsx"
        UI[GitHub Repo Input Mode]
        Results[Multi-File Results Display]
    end
    
    subgraph "Backend: app/api/scan-repo/route.ts"
        API[POST Handler]
        Meta[Fetch Repo Metadata]
        Tree[Fetch File Tree]
        Filter[Filter & Prioritize Files]
        Fetch[Fetch Raw Content]
        Scan[Scan Each File]
        Agg[Aggregate Results]
    end
    
    subgraph "External Services"
        GH_API[GitHub API]
        GH_RAW[raw.githubusercontent.com]
    end
    
    subgraph "Existing Core"
        Scanner[runFullScan]
        Logger[logScan]
        DB[(Prisma DB)]
    end
    
    UI -->|POST /api/scan-repo| API
    API --> Meta
    Meta --> GH_API
    API --> Tree
    Tree --> GH_API
    API --> Filter
    API --> Fetch
    Fetch --> GH_RAW
    API --> Scan
    Scan --> Scanner
    API --> Agg
    Agg --> Logger
    Logger --> DB
    API -->|RepoScanResult| Results


## Sequence Diagrams

### Main Scan Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API as /api/scan-repo
    participant GitHub
    participant RawGH as raw.githubusercontent.com
    participant Scanner
    participant Logger
    participant DB

    User->>Frontend: Enter repo URL
    User->>Frontend: Click "Run Scan"
    Frontend->>API: POST {repoUrl}
    
    API->>GitHub: GET /repos/{owner}/{repo}
    GitHub-->>API: {default_branch, ...}
    
    API->>GitHub: GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1
    GitHub-->>API: {tree: [{path, type, ...}, ...]}
    
    API->>API: Filter files by extension
    API->>API: Exclude binaries/node_modules
    API->>API: Prioritize & cap at 30 files
    
    loop For each file (up to 30)
        API->>RawGH: GET /{owner}/{repo}/{branch}/{path}
        RawGH-->>API: Raw file content
        API->>Scanner: runFullScan(content)
        Scanner-->>API: ScanResult
        API->>API: Track highest risk score
    end
    
    API->>API: Aggregate results
    API->>Logger: logScan (highest-risk file)
    Logger->>DB: INSERT scan log
    
    API-->>Frontend: RepoScanResult
    Frontend->>User: Display summary + per-file breakdown
```

### Error Handling Flow

```mermaid
sequenceDiagram
    participant API as /api/scan-repo
    participant GitHub
    
    API->>GitHub: GET /repos/{owner}/{repo}
    
    alt Repo not found
        GitHub-->>API: 404
        API-->>Frontend: {error: "Repository not found"}
    else Rate limit exceeded
        GitHub-->>API: 403
        API-->>Frontend: {error: "Rate limit exceeded"}
    else Empty repo
        GitHub-->>API: 200 {tree: []}
        API-->>Frontend: {error: "Repository is empty"}
    else No matching files
        API->>API: Filter returns []
        API-->>Frontend: {error: "No scannable files found"}
    else File fetch failure
        API->>RawGH: GET file
        RawGH-->>API: 404/500
        API->>API: Skip file, continue
        Note over API: Partial results returned
    end
```


## Components and Interfaces

### Backend Component: Enhanced scan-repo Route Handler

**Purpose**: Orchestrate multi-file repository scanning by fetching metadata, retrieving file tree, filtering/prioritizing files, fetching raw content, scanning each file, and aggregating results.

**Interface**:
```typescript
// Request body
interface ScanRepoRequest {
  repoUrl: string;
}

// Response body
interface RepoScanResult {
  // Overall repository metrics
  overallRiskScore: number;        // Highest individual file score
  overallRiskLevel: RiskLevel;     // Derived from overallRiskScore
  overallStatus: "Blocked" | "Allowed";
  totalFilesScanned: number;
  
  // Per-file breakdown
  files: FileResult[];
  
  // Metadata
  repository: string;              // "owner/repo"
  defaultBranch: string;
  timestamp: string;
}

interface FileResult {
  filePath: string;                // Relative path from repo root
  riskScore: number;
  riskLevel: RiskLevel;
  detectedPatternsCount: number;
  detectedPatterns: ThreatPattern[];
}

// Error response
interface ErrorResponse {
  error: string;
}
```

**Responsibilities**:
- Validate and parse GitHub repository URL
- Fetch repository metadata to determine default branch
- Fetch complete file tree with recursive=1 parameter
- Filter files by whitelisted extensions
- Exclude binaries, images, lockfiles, node_modules, .git, dist/build paths
- Prioritize README and config files (sort to front)
- Cap filtered list at 30 files maximum
- Fetch raw content via raw.githubusercontent.com (avoids rate limits)
- Scan each file using existing `runFullScan` function
- Aggregate results: highest risk score becomes overall score
- Log ONE aggregate entry with highest-risk file's content
- Handle errors gracefully at each stage
- Respect global strictMode and learningMode settings

### Frontend Component: GitHub Repo Mode UI

**Purpose**: Provide input interface for repository URL and display multi-file scan results with per-file breakdown.

**Interface**:
```typescript
// Enhanced demo page state
interface RepoScanState {
  status: "idle" | "loading" | "done" | "error";
  result: RepoScanResult | null;
  errorMessage: string | null;
  loadingStep: "fetching" | "scanning" | null;  // Multi-step loading
}
```

**Responsibilities**:
- Accept GitHub repository URL input with validation
- Display multi-step loading states ("Fetching repo structure...", "Scanning X files...")
- Show overall summary: total files scanned, highest risk score, overall status
- Render per-file results table/list with expand/collapse
- Display per-file: path, risk score badge, risk level, pattern count
- Apply existing scroll-contained styling (max-height + overflow-y-auto)
- Update UI copy to reflect multi-file scanning capability
- Maintain consistency with existing 4-input-mode design pattern


## Data Models

### GitHub API Response Types

```typescript
// Repository metadata response
interface GitHubRepoMetadata {
  default_branch: string;
  name: string;
  full_name: string;
  private: boolean;
  // ... other fields we don't need
}

// File tree response
interface GitHubTreeResponse {
  tree: GitHubTreeNode[];
  truncated: boolean;
}

interface GitHubTreeNode {
  path: string;
  mode: string;
  type: "blob" | "tree" | "commit";
  sha: string;
  size?: number;
  url: string;
}
```

### Internal Processing Types

```typescript
// Filtered file candidate
interface FileCandidate {
  path: string;
  priority: number;  // Lower = higher priority (README=0, configs=1, source=2)
}

// Intermediate scan result before aggregation
interface IntermediateScanResult extends ScanResult {
  filePath: string;
}

// File filter configuration
interface FileFilterConfig {
  allowedExtensions: readonly string[];
  excludePatterns: readonly RegExp[];
  priorityFiles: readonly RegExp[];
}
```

### Validation Rules

**Repository URL**:
- Must be a string
- Must contain "github.com" as hostname
- Must have at least owner and repo segments in path
- Supports formats:
  - `github.com/owner/repo`
  - `https://github.com/owner/repo`
  - `https://github.com/owner/repo.git`

**File Filtering**:
- Allowed extensions: `.md`, `.txt`, `.json`, `.yml`, `.yaml`, `.js`, `.ts`, `.jsx`, `.tsx`, `.py`, `.env.example`
- Excluded patterns:
  - Binary files (by extension check)
  - Image files (`.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.ico`, `.webp`)
  - Lockfiles (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `Gemfile.lock`, `poetry.lock`, `Cargo.lock`)
  - `node_modules/` paths
  - `.git/` paths
  - `dist/`, `build/`, `out/`, `.next/` paths
  - Minified files (`.min.js`, `.min.css`)
- Priority order:
  1. README files (any case, any extension)
  2. Config files (`.json`, `.yml`, `.yaml`, `.env.example` in root)
  3. Other matching files
- Maximum: 30 files after filtering and prioritization


## Algorithmic Pseudocode

### Main Repository Scan Algorithm

```typescript
async function scanRepository(repoUrl: string): Promise<RepoScanResult> {
  // PRECONDITIONS:
  // - repoUrl is a valid, non-empty string
  // - Network connectivity exists
  // - GitHub API is accessible
  
  // POSTCONDITIONS:
  // - Returns RepoScanResult with aggregated metrics
  // - At least one scan log entry written to database
  // - No side effects on scanner/riskEngine/sanitizer core
  
  // Step 1: Parse and validate repository URL
  const { owner, repo } = parseGitHubUrl(repoUrl);
  
  // Step 2: Fetch repository metadata
  const metadata = await fetchRepoMetadata(owner, repo);
  const defaultBranch = metadata.default_branch;
  
  // Step 3: Fetch complete file tree
  const tree = await fetchFileTree(owner, repo, defaultBranch);
  
  // Step 4: Filter and prioritize files
  const candidates = filterAndPrioritizeFiles(tree.tree);
  
  // INVARIANT: candidates.length <= 30
  if (candidates.length === 0) {
    throw new Error("No scannable files found in repository");
  }
  
  // Step 5: Scan each file
  const fileResults: FileResult[] = [];
  let highestRiskScore = 0;
  let highestRiskFile: { path: string; content: string; result: ScanResult } | null = null;
  
  // LOOP INVARIANT: 
  // - fileResults contains valid scan results for all processed files
  // - highestRiskScore is the maximum riskScore seen so far
  // - highestRiskFile tracks the file with highestRiskScore
  for (const candidate of candidates) {
    try {
      // Fetch raw content
      const content = await fetchRawContent(owner, repo, defaultBranch, candidate.path);
      
      // Scan with existing pipeline
      const scanResult = runFullScan(content, { strictMode });
      
      // Track results
      fileResults.push({
        filePath: candidate.path,
        riskScore: scanResult.riskScore,
        riskLevel: scanResult.riskLevel,
        detectedPatternsCount: scanResult.detectedPatterns.length,
        detectedPatterns: scanResult.detectedPatterns
      });
      
      // Update highest risk tracking
      if (scanResult.riskScore > highestRiskScore) {
        highestRiskScore = scanResult.riskScore;
        highestRiskFile = { path: candidate.path, content, result: scanResult };
      }
    } catch (error) {
      // Skip individual file failures, continue scanning
      console.error(`Failed to scan ${candidate.path}:`, error);
      continue;
    }
  }
  
  // ASSERTION: At least one file scanned successfully
  if (fileResults.length === 0) {
    throw new Error("Failed to scan any files");
  }
  
  // Step 6: Determine overall status
  const overallRiskLevel = deriveRiskLevel(highestRiskScore);
  let overallStatus: "Blocked" | "Allowed" = 
    (overallRiskLevel === "Medium" || overallRiskLevel === "Critical") 
      ? "Blocked" 
      : "Allowed";
  
  if (learningMode) {
    overallStatus = "Allowed";
  }
  
  // Step 7: Log aggregate scan (highest-risk file content)
  await logScan({
    toolName: "github",
    scenario: "live-repo-full",
    riskScore: highestRiskFile!.result.riskScore,
    riskLevel: highestRiskFile!.result.riskLevel,
    detectedPatterns: highestRiskFile!.result.detectedPatterns,
    originalContent: highestRiskFile!.content,
    sanitizedContent: highestRiskFile!.result.sanitizedContent,
    status: overallStatus
  });
  
  // Step 8: Return aggregated results
  return {
    overallRiskScore: highestRiskScore,
    overallRiskLevel,
    overallStatus,
    totalFilesScanned: fileResults.length,
    files: fileResults,
    repository: `${owner}/${repo}`,
    defaultBranch,
    timestamp: new Date().toISOString()
  };
}
```

### File Filtering Algorithm

```typescript
function filterAndPrioritizeFiles(nodes: GitHubTreeNode[]): FileCandidate[] {
  // PRECONDITIONS:
  // - nodes is a valid array from GitHub tree API
  
  // POSTCONDITIONS:
  // - Returns array of FileCandidate, length <= 30
  // - Array is sorted by priority (lower number = higher priority)
  // - All returned files match allowed extensions
  // - No excluded paths are present
  
  const ALLOWED_EXTENSIONS = [
    '.md', '.txt', '.json', '.yml', '.yaml',
    '.js', '.ts', '.jsx', '.tsx', '.py', '.env.example'
  ];
  
  const EXCLUDE_PATTERNS = [
    /node_modules\//,
    /\.git\//,
    /^dist\//,
    /^build\//,
    /^out\//,
    /^\.next\//,
    /\.min\.(js|css)$/,
    /package-lock\.json$/,
    /yarn\.lock$/,
    /pnpm-lock\.yaml$/,
    /Gemfile\.lock$/,
    /poetry\.lock$/,
    /Cargo\.lock$/,
    /\.(png|jpg|jpeg|gif|svg|ico|webp|pdf|zip|tar|gz)$/i
  ];
  
  const candidates: FileCandidate[] = [];
  
  // LOOP INVARIANT: candidates contains only valid, non-excluded blobs
  for (const node of nodes) {
    // Only process blob (file) nodes, skip trees (directories)
    if (node.type !== "blob") continue;
    
    // Check if file has allowed extension
    const hasAllowedExt = ALLOWED_EXTENSIONS.some(ext => 
      node.path.toLowerCase().endsWith(ext)
    );
    if (!hasAllowedExt) continue;
    
    // Check if file matches exclude pattern
    const isExcluded = EXCLUDE_PATTERNS.some(pattern => 
      pattern.test(node.path)
    );
    if (isExcluded) continue;
    
    // Assign priority
    let priority = 2; // Default: source files
    
    if (/readme/i.test(node.path)) {
      priority = 0; // Highest: README files
    } else if (/^[^/]+\.(json|ya?ml|env\.example)$/i.test(node.path)) {
      priority = 1; // High: root-level config files
    }
    
    candidates.push({ path: node.path, priority });
  }
  
  // Sort by priority (ascending), then alphabetically
  candidates.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return a.path.localeCompare(b.path);
  });
  
  // Cap at 30 files
  return candidates.slice(0, 30);
}
```

### URL Parsing Algorithm

```typescript
function parseGitHubUrl(repoUrl: string): { owner: string; repo: string } {
  // PRECONDITIONS:
  // - repoUrl is a non-empty string
  
  // POSTCONDITIONS:
  // - Returns object with valid owner and repo strings
  // - Throws descriptive error if URL is invalid
  
  // Normalize URL
  let normalized = repoUrl.trim().replace(/\/+$/, "");
  
  // Prepend https:// if no protocol present
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = "https://" + normalized;
  }
  
  // Parse URL
  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw new Error("Invalid URL format");
  }
  
  // Validate hostname
  if (url.hostname !== "github.com") {
    throw new Error("Only GitHub repository URLs are supported");
  }
  
  // Extract path segments
  const segments = url.pathname
    .replace(/^\//, "")
    .split("/")
    .filter(Boolean);
  
  // Validate path structure
  if (segments.length < 2) {
    throw new Error("Invalid GitHub URL format — could not extract owner and repo");
  }
  
  const owner = segments[0];
  const repo = segments[1].replace(/\.git$/i, ""); // Strip .git suffix
  
  return { owner, repo };
}
```


## Key Functions with Formal Specifications

### Function 1: fetchRepoMetadata()

```typescript
async function fetchRepoMetadata(
  owner: string, 
  repo: string
): Promise<GitHubRepoMetadata>
```

**Preconditions:**
- `owner` is a non-empty string containing valid GitHub username/org
- `repo` is a non-empty string containing valid repository name
- Network connectivity exists

**Postconditions:**
- Returns `GitHubRepoMetadata` object with `default_branch` field populated
- Throws error with descriptive message if repository not found (404)
- Throws error if rate limit exceeded (403)
- No side effects on application state

**Implementation Notes:**
- Uses GitHub REST API v3: `GET /repos/{owner}/{repo}`
- Includes `Authorization` header if `GITHUB_TOKEN` env var is set
- Returns full metadata object; caller extracts `default_branch`

### Function 2: fetchFileTree()

```typescript
async function fetchFileTree(
  owner: string,
  repo: string,
  branch: string
): Promise<GitHubTreeResponse>
```

**Preconditions:**
- `owner`, `repo`, `branch` are non-empty strings
- Repository exists and branch is valid
- Network connectivity exists

**Postconditions:**
- Returns `GitHubTreeResponse` with complete file tree (recursive)
- Tree contains all files and directories in repository
- Throws error if branch not found or API fails
- No side effects on application state

**Implementation Notes:**
- Uses GitHub Git Data API: `GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1`
- `recursive=1` parameter fetches entire tree in one request
- Includes authorization header if token available
- Returns up to 100,000 nodes (GitHub API limit)

### Function 3: fetchRawContent()

```typescript
async function fetchRawContent(
  owner: string,
  repo: string,
  branch: string,
  filePath: string
): Promise<string>
```

**Preconditions:**
- All parameters are non-empty strings
- `filePath` exists in repository at specified branch
- File is text-based (not binary)

**Postconditions:**
- Returns file content as UTF-8 string
- Throws error if file not found or fetch fails
- Content is unmodified from repository state
- No side effects

**Implementation Notes:**
- Uses raw.githubusercontent.com: `GET /{owner}/{repo}/{branch}/{filePath}`
- Does NOT use GitHub API (avoids rate limits)
- No authentication required for public repositories
- Response is plain text, no base64 decoding needed

### Function 4: runFullScan() (Existing)

```typescript
function runFullScan(
  content: string, 
  options?: { strictMode?: boolean }
): ScanResult
```

**Preconditions:**
- `content` is a string (may be empty)
- `options.strictMode` is optional boolean

**Postconditions:**
- Returns `ScanResult` with `riskScore`, `riskLevel`, `detectedPatterns`
- `riskScore` is integer in range [0, 100]
- `riskLevel` is one of: "Safe", "Low", "Medium", "Critical"
- Pure function: no side effects, same input produces same output

**Implementation Notes:**
- Existing function from `lib/scanner/index.ts`
- Must NOT be modified per feature constraints
- Calls `scanContent()` and `calculateRiskScore()` internally

### Function 5: deriveRiskLevel()

```typescript
function deriveRiskLevel(score: number): RiskLevel
```

**Preconditions:**
- `score` is a number in range [0, 100]

**Postconditions:**
- Returns `RiskLevel` enum value
- Mapping follows existing thresholds:
  - 0-25 → "Safe"
  - 26-50 → "Low"
  - 51-75 → "Medium"
  - 76-100 → "Critical"
- Pure function: no side effects

**Loop Invariants:** N/A (no loops)

**Implementation Notes:**
- This logic already exists in `lib/riskEngine/riskEngine.ts`
- May be imported or duplicated inline


## Example Usage

### Backend API Request/Response Flow

```typescript
// Example 1: Successful multi-file scan
const response = await fetch("/api/scan-repo", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ 
    repoUrl: "https://github.com/openai/gpt-3" 
  })
});

const result: RepoScanResult = await response.json();
// {
//   overallRiskScore: 45,
//   overallRiskLevel: "Low",
//   overallStatus: "Allowed",
//   totalFilesScanned: 12,
//   files: [
//     {
//       filePath: "README.md",
//       riskScore: 45,
//       riskLevel: "Low",
//       detectedPatternsCount: 2,
//       detectedPatterns: [
//         { pattern: "api key", category: "credential_exfiltration", weight: 10 },
//         { pattern: "base64", category: "suspicious_encoding", weight: 30 }
//       ]
//     },
//     {
//       filePath: "config.json",
//       riskScore: 0,
//       riskLevel: "Safe",
//       detectedPatternsCount: 0,
//       detectedPatterns: []
//     },
//     // ... 10 more files
//   ],
//   repository: "openai/gpt-3",
//   defaultBranch: "main",
//   timestamp: "2024-01-15T10:30:00.000Z"
// }

// Example 2: Repository not found error
const errorResponse = await fetch("/api/scan-repo", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ 
    repoUrl: "github.com/nonexistent/repo" 
  })
});
// Status: 404
// Body: { error: "Repository \"nonexistent/repo\" not found or has no README..." }

// Example 3: No scannable files
const emptyResponse = await fetch("/api/scan-repo", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ 
    repoUrl: "github.com/user/binary-only-repo" 
  })
});
// Status: 400
// Body: { error: "No scannable files found in repository" }
```

### Frontend UI Flow

```typescript
// Example usage in app/demo/page.tsx

// State management
const [scanState, setScanState] = useState<RepoScanState>({
  status: "idle",
  result: null,
  errorMessage: null,
  loadingStep: null
});

// Multi-step loading
async function handleScan(repoUrl: string) {
  setScanState({ 
    status: "loading", 
    loadingStep: "fetching",
    result: null,
    errorMessage: null 
  });
  
  try {
    const response = await fetch("/api/scan-repo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoUrl })
    });
    
    if (!response.ok) {
      const { error } = await response.json();
      throw new Error(error);
    }
    
    // Update to scanning step
    setScanState(prev => ({ ...prev, loadingStep: "scanning" }));
    
    const result = await response.json();
    setScanState({ 
      status: "done", 
      result,
      errorMessage: null,
      loadingStep: null
    });
  } catch (error) {
    setScanState({ 
      status: "error", 
      result: null,
      errorMessage: error.message,
      loadingStep: null
    });
  }
}

// Render loading states
{scanState.status === "loading" && (
  <div className="loading-indicator">
    {scanState.loadingStep === "fetching" && "Fetching repo structure..."}
    {scanState.loadingStep === "scanning" && `Scanning ${scanState.result?.totalFilesScanned ?? 0} files...`}
  </div>
)}

// Render results
{scanState.status === "done" && scanState.result && (
  <div className="results-panel">
    {/* Overall summary */}
    <div className="summary">
      <h3>Repository: {scanState.result.repository}</h3>
      <p>Files scanned: {scanState.result.totalFilesScanned}</p>
      <p>Risk score: {scanState.result.overallRiskScore}</p>
      <p>Status: {scanState.result.overallStatus}</p>
    </div>
    
    {/* Per-file breakdown */}
    <div className="file-list">
      {scanState.result.files.map(file => (
        <div key={file.filePath} className="file-item">
          <span>{file.filePath}</span>
          <span className="risk-badge">{file.riskLevel}</span>
          <span>{file.detectedPatternsCount} patterns</span>
          <button>View Details</button>
        </div>
      ))}
    </div>
  </div>
)}
```


## Correctness Properties

### Repository Scanning Correctness

**Universal Properties:**

1. **Score Aggregation Correctness**
   ```
   ∀ files ∈ RepoScanResult.files:
     RepoScanResult.overallRiskScore = max(files.map(f => f.riskScore))
   ```
   The overall risk score is always the maximum individual file risk score.

2. **File Count Constraint**
   ```
   ∀ result ∈ RepoScanResult:
     result.totalFilesScanned ≤ 30 ∧ 
     result.totalFilesScanned = result.files.length ∧
     result.totalFilesScanned > 0
   ```
   Total files scanned never exceeds 30, matches files array length, and is at least 1.

3. **Risk Level Consistency**
   ```
   ∀ result ∈ RepoScanResult:
     deriveRiskLevel(result.overallRiskScore) = result.overallRiskLevel
   ```
   Overall risk level is correctly derived from overall risk score.

4. **Status Determination**
   ```
   ∀ result ∈ RepoScanResult where learningMode = false:
     result.overallStatus = "Blocked" ↔ 
       (result.overallRiskLevel = "Medium" ∨ result.overallRiskLevel = "Critical")
   ```
   Status is "Blocked" if and only if risk level is Medium or Critical (when not in learning mode).

5. **File Result Validity**
   ```
   ∀ file ∈ RepoScanResult.files:
     file.riskScore ∈ [0, 100] ∧
     file.riskLevel ∈ {"Safe", "Low", "Medium", "Critical"} ∧
     file.detectedPatternsCount = file.detectedPatterns.length ∧
     file.filePath ≠ ""
   ```
   Every file result has valid risk score, risk level, pattern count, and non-empty path.

### Filtering Correctness

**Universal Properties:**

6. **Extension Whitelist**
   ```
   ∀ file ∈ filteredFiles:
     ∃ ext ∈ ALLOWED_EXTENSIONS: file.path.endsWith(ext)
   ```
   All filtered files have allowed extensions.

7. **Exclusion Pattern**
   ```
   ∀ file ∈ filteredFiles:
     ∀ pattern ∈ EXCLUDE_PATTERNS: ¬pattern.test(file.path)
   ```
   No filtered file matches any exclusion pattern.

8. **Priority Ordering**
   ```
   ∀ i, j ∈ indices(filteredFiles) where i < j:
     filteredFiles[i].priority ≤ filteredFiles[j].priority
   ```
   Filtered files are sorted by ascending priority (lower number = higher priority).

9. **README Priority**
   ```
   ∀ file ∈ filteredFiles where /readme/i.test(file.path):
     file.priority = 0 ∧
     ∀ other ∈ filteredFiles: file.priority ≤ other.priority
   ```
   README files always have highest priority (0) and appear first.

### Logging Correctness

**Universal Properties:**

10. **Single Log Entry**
    ```
    ∀ repository scan:
      database logs contain exactly 1 new entry with scenario = "live-repo-full"
    ```
    Each repository scan creates exactly one aggregate log entry.

11. **Highest Risk Logged**
    ```
    ∀ scan log entry with scenario = "live-repo-full":
      entry.riskScore = max(scanned files' risk scores) ∧
      entry.originalContent = content of file with max risk score
    ```
    Log entry contains the highest risk score and corresponding file content.

### Error Handling Correctness

**Universal Properties:**

12. **Graceful Degradation**
    ```
    ∀ file ∈ candidateFiles:
      fetchError(file) → skip(file) ∧ continue scanning
    ```
    Individual file fetch failures do not abort the entire scan.

13. **Total Failure Detection**
    ```
    ∀ scans where all file fetches fail:
      throws Error("Failed to scan any files")
    ```
    Scan fails explicitly if no files can be scanned successfully.

14. **Input Validation**
    ```
    ∀ repoUrl ∈ ScanRepoRequest:
      (repoUrl = "" ∨ repoUrl = null ∨ ¬isGitHubUrl(repoUrl)) →
        returns ErrorResponse with status 400
    ```
    Invalid repository URLs return 400 Bad Request with descriptive error.


## Error Handling

### Error Scenario 1: Repository Not Found

**Condition**: GitHub API returns 404 when fetching repository metadata

**Response**: 
- HTTP Status: 404
- Body: `{ error: "Repository \"{owner}/{repo}\" not found or has no README. Ensure the repo is public and the URL is correct." }`

**Recovery**: User corrects repository URL or verifies repository visibility

### Error Scenario 2: GitHub API Rate Limit Exceeded

**Condition**: GitHub API returns 403 due to rate limiting

**Response**:
- HTTP Status: 403
- Body: `{ error: "GitHub API rate limit exceeded. Please try again later." }`

**Recovery**: 
- User waits for rate limit reset
- System administrator adds `GITHUB_TOKEN` environment variable to increase limits (5,000 req/hr authenticated vs 60 req/hr unauthenticated)

### Error Scenario 3: Empty Repository

**Condition**: File tree API returns empty tree array

**Response**:
- HTTP Status: 400
- Body: `{ error: "Repository is empty or contains no files." }`

**Recovery**: User selects different repository with content

### Error Scenario 4: No Scannable Files Found

**Condition**: File filtering returns empty array (no files match allowed extensions)

**Response**:
- HTTP Status: 400
- Body: `{ error: "No scannable files found in repository. Repository contains only binary or excluded files." }`

**Recovery**: User selects repository with text-based files

### Error Scenario 5: Individual File Fetch Failure

**Condition**: raw.githubusercontent.com returns error for specific file

**Response**:
- Log error to console: `console.error("Failed to scan {filePath}:", error)`
- Skip file and continue scanning remaining files
- Return partial results if at least one file scanned successfully

**Recovery**: Automatic - system continues with available files

### Error Scenario 6: All File Fetches Fail

**Condition**: Every file fetch attempt fails (network issue, repository deleted mid-scan)

**Response**:
- HTTP Status: 500
- Body: `{ error: "Failed to scan any files. All fetch attempts failed." }`

**Recovery**: User retries scan after checking network connectivity

### Error Scenario 7: Invalid URL Format

**Condition**: Repository URL cannot be parsed or is not a GitHub URL

**Response**:
- HTTP Status: 400
- Body: `{ error: "Invalid GitHub URL format. Example: github.com/owner/repo or https://github.com/owner/repo.git" }`

**Recovery**: User provides correctly formatted GitHub URL

### Error Scenario 8: Database Logging Failure

**Condition**: Prisma fails to write scan log to database

**Response**:
- Log error to console: `console.error("[Aegis /api/scan-repo] logScan failed:", err)`
- Continue execution - return scan results to user
- System maintains scan functionality even if logging fails

**Recovery**: 
- Automatic - user receives results despite logging failure
- System administrator checks database connectivity and Prisma configuration


## Testing Strategy

### Unit Testing Approach

**File Filtering Logic**
- Test `filterAndPrioritizeFiles()` with various tree structures
- Verify allowed extensions are included, excluded patterns are filtered
- Confirm priority ordering (README first, configs second, source last)
- Test 30-file cap with repositories having 100+ files
- Edge case: empty tree, tree with only excluded files

**URL Parsing Logic**
- Test `parseGitHubUrl()` with valid formats:
  - `github.com/owner/repo`
  - `https://github.com/owner/repo`
  - `https://github.com/owner/repo.git`
  - With/without trailing slashes
- Test error cases: non-GitHub URLs, malformed URLs, missing segments
- Verify `.git` suffix removal

**Risk Aggregation Logic**
- Test `deriveRiskLevel()` boundary conditions:
  - Score 0 → "Safe"
  - Score 25 → "Safe"
  - Score 26 → "Low"
  - Score 50 → "Low"
  - Score 51 → "Medium"
  - Score 75 → "Medium"
  - Score 76 → "Critical"
  - Score 100 → "Critical"
- Test overall score calculation with multiple files
- Verify highest score is selected correctly

**Coverage Goals**: 90%+ coverage for new functions, 100% coverage for critical paths (URL parsing, file filtering, aggregation)

### Property-Based Testing Approach

**Property Test Library**: fast-check (TypeScript)

**Property 1: File Count Never Exceeds 30**
```typescript
fc.property(
  fc.array(fc.record({
    path: fc.string(),
    type: fc.constantFrom("blob", "tree"),
    mode: fc.string(),
    sha: fc.string()
  })),
  (nodes) => {
    const filtered = filterAndPrioritizeFiles(nodes);
    return filtered.length <= 30;
  }
)
```

**Property 2: All Filtered Files Have Allowed Extensions**
```typescript
fc.property(
  fc.array(fc.record({
    path: fc.oneof(
      fc.constant("README.md"),
      fc.constant("test.txt"),
      fc.constant("config.json"),
      fc.constant("binary.exe"),
      fc.constant("image.png")
    ),
    type: fc.constant("blob")
  })),
  (nodes) => {
    const filtered = filterAndPrioritizeFiles(nodes);
    const ALLOWED_EXTENSIONS = ['.md', '.txt', '.json', '.yml', '.yaml', '.js', '.ts', '.jsx', '.tsx', '.py', '.env.example'];
    return filtered.every(f => 
      ALLOWED_EXTENSIONS.some(ext => f.path.toLowerCase().endsWith(ext))
    );
  }
)
```

**Property 3: Priority Ordering is Consistent**
```typescript
fc.property(
  fc.array(fc.record({
    path: fc.oneof(
      fc.constant("README.md"),
      fc.constant("config.json"),
      fc.constant("src/index.ts")
    ),
    type: fc.constant("blob")
  })),
  (nodes) => {
    const filtered = filterAndPrioritizeFiles(nodes);
    // Check ascending priority order
    for (let i = 1; i < filtered.length; i++) {
      if (filtered[i].priority < filtered[i-1].priority) {
        return false;
      }
    }
    return true;
  }
)
```

**Property 4: Overall Risk Score is Maximum of Individual Scores**
```typescript
fc.property(
  fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 1, maxLength: 30 }),
  (riskScores) => {
    const fileResults = riskScores.map((score, i) => ({
      filePath: `file${i}.txt`,
      riskScore: score,
      riskLevel: deriveRiskLevel(score),
      detectedPatternsCount: 0,
      detectedPatterns: []
    }));
    
    const overallScore = Math.max(...riskScores);
    
    // Simulate aggregation logic
    const actual = fileResults.reduce((max, file) => 
      Math.max(max, file.riskScore), 0
    );
    
    return actual === overallScore;
  }
)
```

### Integration Testing Approach

**GitHub API Integration**
- Test with real public repositories (use test fixtures)
- Mock GitHub API responses for predictable testing
- Test rate limiting behavior (with/without token)
- Test various repository states: empty, binary-only, text-only

**End-to-End Flow**
- Test complete scan flow with mock GitHub API
- Verify database logging (use test database)
- Test frontend state transitions (loading → done/error)
- Verify UI renders per-file results correctly

**Error Scenario Testing**
- Simulate network failures
- Test with non-existent repositories
- Test with private repositories (should fail gracefully)
- Test with repositories exceeding 30 files

**Performance Testing**
- Test scan time with 30 files
- Measure memory usage during large scans
- Verify no memory leaks in file fetching loop


## Performance Considerations

### Fetch Optimization Strategy

**Sequential vs Parallel Fetching**
- **Current Design**: Sequential file fetching with `for...of` loop
- **Rationale**: Avoids overwhelming raw.githubusercontent.com with concurrent requests
- **Alternative**: Parallel fetching with `Promise.all()` and concurrency limit
  - Could reduce total scan time from ~3s to ~1s for 30 files
  - Risk: Higher likelihood of rate limiting or connection errors
  - Recommendation: Implement sequential first, optimize to parallel with semaphore later

**Rate Limit Management**
- Using raw.githubusercontent.com (no rate limits) for file content
- Using GitHub API (5000/hr authenticated, 60/hr unauthenticated) only for metadata and tree
- Each scan requires: 1 metadata request + 1 tree request = 2 API calls per scan
- File content fetches do NOT count against API rate limit

**Content Size Limits**
- No explicit size limit on individual files currently
- Potential issue: Scanning large files (>1MB) could slow down scan
- Recommendation: Skip files larger than 500KB (add size check during filtering)
- GitHub API provides `size` field in tree nodes for filtering

### Caching Strategy

**Repository Metadata Caching** (Future Enhancement)
- Cache default branch and file tree for 5-10 minutes
- Reduces API calls for repeated scans of same repository
- Implementation: Redis or in-memory cache with TTL
- Key: `repo:{owner}/{repo}:tree:{branch}`

**Scan Result Caching** (Future Enhancement)
- Cache scan results based on repository commit SHA
- Invalidate when new commits detected
- Significantly speeds up repeated scans of unchanged repositories

### Database Performance

**Log Entry Optimization**
- Only one log entry per repository scan (not per file)
- Reduces database writes from N to 1 per scan
- `originalContent` field stores highest-risk file only (not all files)
- Per-file results returned in API response, not stored in database

### Memory Management

**Streaming Consideration** (Future Enhancement)
- Current design loads entire file content into memory
- 30 files × ~50KB average = ~1.5MB peak memory usage (acceptable)
- For larger deployments: Consider streaming scan for files >100KB

### Estimated Performance Metrics

**Timing Breakdown** (30 files, average conditions):
1. Repository metadata fetch: ~200ms
2. File tree fetch: ~300ms
3. File filtering & prioritization: ~5ms
4. File content fetching (sequential): ~2000ms (30 × ~70ms each)
5. Scanning all files: ~30ms (30 × ~1ms each)
6. Aggregation & logging: ~50ms
7. **Total: ~2.6 seconds**

**Optimization Targets**:
- Parallel fetching with concurrency limit: Reduce to ~1.2s total
- Metadata caching: Reduce repeat scans to ~2.3s
- Combined optimizations: Reduce to ~0.8s for cached repositories


## Security Considerations

### GitHub Token Security

**Threat**: Exposure of `GITHUB_TOKEN` environment variable
**Mitigation**:
- Token stored in environment variable, never in code or version control
- Token not included in API responses or logs
- Token only used server-side (never sent to frontend)
- Use Personal Access Token (PAT) with minimal scope: `public_repo` read-only

### Rate Limit Abuse Prevention

**Threat**: Malicious users triggering excessive GitHub API requests
**Mitigation**:
- Use raw.githubusercontent.com for file content (no rate limits)
- Only 2 GitHub API calls per scan (metadata + tree)
- Future: Implement per-IP rate limiting on `/api/scan-repo` endpoint
- Future: Add CAPTCHA for unauthenticated users

### Malicious Repository Content

**Threat**: Repository contains extremely large files or binary exploits
**Mitigation**:
- File filtering excludes binaries, images, and known binary extensions
- 30-file cap prevents resource exhaustion
- Future: Add file size limit (skip files >500KB)
- Scanner runs in isolated process without execution privileges

### Prompt Injection via Repository Content

**Threat**: Malicious files designed to exploit AI agents (primary use case)
**Mitigation**:
- This is the feature's purpose - detecting prompt injection
- Scanner/riskEngine detect and score malicious patterns
- Medium/Critical risk files trigger blocking behavior
- Results clearly show detected threats to user

### Private Repository Exposure

**Threat**: Accidental scanning of private repository leaks sensitive data
**Mitigation**:
- GitHub API returns 404 for private repositories (same as not found)
- No special handling needed - treated as "repository not found"
- Even with valid token, only public repositories should be scanned
- Future: Add explicit "public only" validation after metadata fetch

### Server-Side Request Forgery (SSRF)

**Threat**: Attacker provides URL to internal service instead of GitHub
**Mitigation**:
- URL parsing validates hostname is exactly "github.com"
- No support for GitHub Enterprise or other domains
- raw.githubusercontent.com is only other domain accessed (hardcoded)
- No user-controlled URL construction beyond owner/repo/branch/path

### Content Size Denial of Service

**Threat**: Repository with 30 × 10MB files exhausts server memory
**Mitigation**:
- Current: No explicit limit (relies on GitHub's practical file sizes)
- Future: Add `size` field check during filtering (skip files >500KB)
- Future: Add timeout per file fetch (abort after 10 seconds)
- Future: Add total scan timeout (abort after 60 seconds)

### Database Injection

**Threat**: Malicious content in files causes SQL injection via logging
**Mitigation**:
- Prisma ORM with parameterized queries (immune to SQL injection)
- Content stored as-is without interpretation
- No raw SQL queries constructed from user input

### Cross-Site Scripting (XSS)

**Threat**: Malicious file paths or content rendered in UI without escaping
**Mitigation**:
- React automatically escapes all rendered content
- File paths and scan results displayed as text, not HTML
- No `dangerouslySetInnerHTML` used in results panel
- Content displayed in monospace containers with proper escaping


## Dependencies

### External Services

**GitHub REST API v3**
- **Purpose**: Fetch repository metadata and file tree
- **Endpoints Used**:
  - `GET /repos/{owner}/{repo}` - Repository metadata
  - `GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1` - File tree
- **Authentication**: Optional `Authorization: Bearer {token}` header
- **Rate Limits**: 60 requests/hour (unauthenticated), 5,000 requests/hour (authenticated)
- **Documentation**: https://docs.github.com/en/rest

**raw.githubusercontent.com**
- **Purpose**: Fetch raw file content without rate limits
- **URL Format**: `https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}`
- **Authentication**: Not required for public repositories
- **Rate Limits**: None (CDN-backed)
- **Limitations**: Public repositories only

### Internal Libraries (Existing)

**lib/scanner**
- `runFullScan(content, options)` - Core scanning function
- Must NOT be modified per feature constraints
- Returns `ScanResult` with risk score, level, patterns

**lib/riskEngine**
- Risk score calculation and risk level derivation
- Used internally by `runFullScan()`
- Must NOT be modified

**lib/sanitizer**
- Content sanitization (future phase)
- Currently returns original content
- Must NOT be modified

**lib/logger**
- `logScan(entry)` - Persist scan results to database
- Must NOT be modified
- Returns `Promise<ScanLog>`

**lib/db/prisma**
- Prisma client singleton
- Database connection management
- Used for fetching global settings and logging scans

### Frontend Libraries (Existing)

**React 18+**
- Component rendering and state management
- No additional hooks or libraries needed

**Framer Motion**
- Animation for results display
- Already used in existing ResultPanel component
- Reuse existing animation patterns

**Tailwind CSS + Shadcn UI**
- Styling and component primitives
- Use existing design system tokens
- Maintain consistency with existing panels

### Environment Variables

**Required**: None (feature works without configuration)

**Optional**:
- `GITHUB_TOKEN` - GitHub Personal Access Token
  - Increases rate limit from 60/hr to 5,000/hr
  - Format: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
  - Scope: `public_repo` (read-only)
  - Set in `.env` or deployment environment

### TypeScript Types

**Imported Types**:
```typescript
import type { ScanResult, RiskLevel, ThreatPattern } from "@/types/types";
import type { ScanLog } from "@prisma/client";
```

**New Types** (defined in route.ts and page.tsx):
```typescript
// See "Components and Interfaces" section for full type definitions
- RepoScanResult
- FileResult
- GitHubRepoMetadata
- GitHubTreeResponse
- GitHubTreeNode
- FileCandidate
```

### Node.js Built-ins

**Used**:
- `URL` class - URL parsing and validation
- `Buffer` - Not needed (raw.githubusercontent.com returns plain text)
- `fetch` - Native in Next.js 14+, no additional imports

**Not Used**:
- No file system access
- No child processes
- No native crypto (handled by GitHub API)

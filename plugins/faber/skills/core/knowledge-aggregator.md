---
name: knowledge-aggregator
description: Aggregates knowledge base entries from core and all installed plugins
model: claude-haiku-3-5
tools: Read, Glob
---

# Knowledge Aggregator Skill

## Purpose

Aggregates troubleshooting knowledge from multiple sources:
- Core knowledge base: `.fractary/faber/knowledge-base/`
- Plugin knowledge bases: `.fractary/plugins/*/knowledge-base/`

Returns unified results with source attribution for the workflow-debugger agent.

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `category` | string | No | Filter by problem category (type_system, test_failure, build_failure, etc.) |
| `phase` | string | No | Filter by workflow phase (frame, architect, build, evaluate, release) |
| `step` | string | No | Filter by specific step within phase |
| `agent` | string | No | Filter by agent name (matches against `agents` array in KB entries) |
| `tags` | string[] | No | Filter by tags (comma-separated) |
| `limit` | number | No | Maximum entries to return (default: 20) |
| `format` | string | No | Output format: "json" (default) or "summary" |

## Algorithm

### Step 1: Discover Knowledge Base Sources

```
sources = []

# Core knowledge base
core_kb_path = ".fractary/faber/knowledge-base/"
if exists(core_kb_path):
  sources.append({
    name: "core",
    path: core_kb_path,
    priority: 1  # Core has highest priority
  })

# Plugin knowledge bases
plugin_dirs = glob(".fractary/plugins/*/")
for plugin_dir in plugin_dirs:
  plugin_name = extract_directory_name(plugin_dir)
  plugin_kb_path = "{plugin_dir}knowledge-base/"

  if exists(plugin_kb_path):
    sources.append({
      name: plugin_name,
      path: plugin_kb_path,
      priority: 2  # Plugins have lower priority
    })

PRINT "📚 Found {length(sources)} knowledge base source(s)"
```

### Step 2: Collect Entries from All Sources (with caching)

```
all_entries = []

# Load cache for performance optimization
cache_path = ".fractary/cache/kb-aggregator-cache.json"
TRY:
  if exists(cache_path):
    cache = parse_json(read(cache_path))
  else:
    cache = { entries: {}, last_updated: null }
CATCH:
  cache = { entries: {}, last_updated: null }

cache_updated = false

# Define allowed base paths for path traversal protection
allowed_base_paths = [
  ".fractary/faber/knowledge-base/",
  ".fractary/plugins/"
]

for source in sources:
  # Collect markdown entries (new format)
  md_files = glob("{source.path}**/*.md")

  for md_file in md_files:
    # Validate path before processing (prevents path traversal)
    if not validate_kb_file_path(md_file, allowed_base_paths):
      WARN "Skipping invalid KB file path: {md_file}"
      continue

    TRY:
      file_mtime = get_file_mtime(md_file)
      cache_key = md_file

      # Check cache first
      if cache_key in cache.entries and cache.entries[cache_key].mtime == file_mtime:
        # Use cached entry
        entry = cache.entries[cache_key].entry
      else:
        # Parse file and update cache
        content = read(md_file)
        entry = parse_markdown_kb_entry(content)
        if entry != null:
          cache.entries[cache_key] = { mtime: file_mtime, entry: entry }
          cache_updated = true

      if entry != null:
        entry.source = source.name
        entry.source_priority = source.priority
        entry.file_path = md_file
        all_entries.append(entry)
    CATCH parse_error:
      WARN "Failed to parse {md_file}: {parse_error}"

  # Collect JSON entries (legacy format)
  json_files = glob("{source.path}*.json")

  for json_file in json_files:
    # Validate path before processing (prevents path traversal)
    if not validate_kb_file_path(json_file, allowed_base_paths):
      WARN "Skipping invalid KB file path: {json_file}"
      continue

    TRY:
      file_mtime = get_file_mtime(json_file)
      cache_key = json_file

      # Check cache first
      if cache_key in cache.entries and cache.entries[cache_key].mtime == file_mtime:
        # Use cached entry
        entry = cache.entries[cache_key].entry
      else:
        # Parse file and update cache
        content = read(json_file)
        entry = parse_json(content)
        cache.entries[cache_key] = { mtime: file_mtime, entry: entry }
        cache_updated = true

      entry.source = source.name
      entry.source_priority = source.priority
      entry.file_path = json_file
      all_entries.append(entry)
    CATCH parse_error:
      WARN "Failed to parse {json_file}: {parse_error}"

# Save cache if updated
if cache_updated:
  TRY:
    ensure_directory_exists(dirname(cache_path))
    cache.last_updated = now()
    write(cache_path, json.serialize(cache, indent=2))
  CATCH:
    WARN "Failed to save KB cache"

PRINT "📖 Loaded {length(all_entries)} total entries"
```

### Step 3: Apply Filters

```
filtered_entries = all_entries

# Filter by category
if category_parameter:
  filtered_entries = filter(
    filtered_entries,
    lambda e: e.category == category_parameter
  )

# Filter by phase (supports both single 'phase' and 'phases' array)
if phase_parameter:
  filtered_entries = filter(
    filtered_entries,
    lambda e: (
      # Check phases array (new format)
      (e.phases and phase_parameter in e.phases) or
      # Check single phase field (legacy format)
      (e.phase == phase_parameter)
    )
  )

# Filter by step
if step_parameter:
  filtered_entries = filter(
    filtered_entries,
    lambda e: e.step == step_parameter
  )

# Filter by agent (supports both single 'agent' and 'agents' array)
if agent_parameter:
  filtered_entries = filter(
    filtered_entries,
    lambda e: (
      # Check agents array (new format)
      (e.agents and agent_parameter in e.agents) or
      # Check single agent field (legacy format)
      (e.agent == agent_parameter)
    )
  )

# Filter by tags
if tags_parameter:
  tags_list = split(tags_parameter, ",")
  filtered_entries = filter(
    filtered_entries,
    lambda e: any(tag in e.tags for tag in tags_list) if e.tags else false
  )

PRINT "🔍 {length(filtered_entries)} entries match filters"
```

### Step 4: Calculate Relevance Scores and Sort

```
# Calculate relevance score for each entry
# This incorporates agent matching boost when agent_parameter is provided

for entry in filtered_entries:
  score = 0

  # Base score from success count (0-40 points)
  score += min((entry.success_count or 0) * 2, 40)

  # Verified bonus (10 points)
  if entry.verified:
    score += 10

  # Agent match boost (20 points if current agent matches)
  if agent_parameter:
    if entry.agents and agent_parameter in entry.agents:
      score += 20  # Strong match in agents array
    elif entry.agent == agent_parameter:
      score += 15  # Match in legacy single agent field

  # Phase match boost (10 points)
  if phase_parameter:
    if entry.phases and phase_parameter in entry.phases:
      score += 10
    elif entry.phase == phase_parameter:
      score += 8

  # Source priority (core gets 10 points, plugins get 5)
  score += 10 if entry.source_priority == 1 else 5

  entry.relevance_score = score

# Sort by:
# 1. Relevance score (highest first)
# 2. Source priority (core first) - tiebreaker
# 3. Creation date (newest first) - tiebreaker

sorted_entries = sort(filtered_entries, key=lambda e: (
  -e.relevance_score,
  e.source_priority,
  -(parse_date(e.created) or 0)
))

# Apply limit
limit = limit_parameter or 20
result_entries = sorted_entries[:limit]
```

### Step 5: Format Output

```
if format_parameter == "summary":
  # Human-readable summary
  output = "# Knowledge Base Search Results\n\n"
  output += "**Entries**: {length(result_entries)} of {length(all_entries)}\n"
  output += "**Filters**: category={category_parameter}, phase={phase_parameter}, agent={agent_parameter}\n\n"

  for entry in result_entries:
    output += "## {entry.id}: {entry.title}\n"
    output += "- **Source**: {entry.source}\n"
    # Display phases (array or single)
    phases_display = join(entry.phases, ", ") if entry.phases else entry.phase
    output += "- **Phases**: {phases_display}\n"
    # Display agents (array or single)
    agents_display = join(entry.agents, ", ") if entry.agents else entry.agent
    output += "- **Agents**: {agents_display}\n"
    output += "- **Category**: {entry.category}\n"
    output += "- **Severity**: {entry.severity}\n"
    output += "- **Success Count**: {entry.success_count or 0}\n"
    output += "- **Verified**: {entry.verified}\n"
    output += "- **Relevance Score**: {entry.relevance_score}\n\n"

  PRINT output
else:
  # JSON output for programmatic use
  json_output = {
    total_sources: length(sources),
    total_entries: length(all_entries),
    filtered_count: length(filtered_entries),
    returned_count: length(result_entries),
    filters: {
      category: category_parameter,
      phase: phase_parameter,
      step: step_parameter,
      agent: agent_parameter,
      tags: tags_parameter
    },
    entries: result_entries
  }

  PRINT json.serialize(json_output, indent=2)
```

## Helper Functions

### parse_markdown_kb_entry(content)

```
# Parse markdown file with YAML front matter
front_matter_match = regex_match(r"^---\n(.*?)\n---\n(.*)$", content, flags=DOTALL)

if not front_matter_match:
  return null

yaml_content = front_matter_match.group(1)
markdown_body = front_matter_match.group(2)

# Parse YAML with error handling
TRY:
  metadata = parse_yaml(yaml_content)
CATCH yaml_error:
  WARN "Failed to parse YAML front matter: {yaml_error}"
  return null

# Validate required fields
if not metadata or not metadata.id or not metadata.title:
  WARN "KB entry missing required fields (id, title)"
  return null

# Extract markdown sections
sections = {}
current_section = null
current_content = []

for line in split(markdown_body, "\n"):
  if line.startswith("## "):
    if current_section:
      sections[current_section] = join(current_content, "\n").strip()
    current_section = line[3:].strip()
    current_content = []
  else:
    current_content.append(line)

if current_section:
  sections[current_section] = join(current_content, "\n").strip()

return {
  id: metadata.id,
  title: metadata.title,
  problem_pattern: metadata.title,
  # Support both single field (legacy) and array (new format)
  phase: metadata.phase or null,
  phases: metadata.phases or [],
  step: metadata.step or null,
  agent: metadata.agent or null,
  agents: metadata.agents or [],
  context_type: metadata.context_type or "agent",
  category: metadata.category,
  severity: metadata.severity or "medium",
  symptoms: metadata.symptoms or [],
  tags: metadata.tags or [],
  created: metadata.created,
  verified: metadata.verified or false,
  success_count: metadata.success_count or 0,
  root_cause: sections["Root Cause"] or "",
  solution: {
    description: sections["Solution"] or "",
    actions: extract_numbered_list(sections["Solution"])
  },
  prevention: sections["Prevention"] or ""
}
```

### extract_numbered_list(text)

```
# Extract numbered list items from markdown text
actions = []
lines = split(text, "\n")

for line in lines:
  match = regex_match(r"^\d+\.\s+(.+)$", line.strip())
  if match:
    actions.append(match.group(1))

return actions
```

### validate_kb_file_path(file_path, allowed_base_paths)

```
# Validate that a KB file path is within allowed directories
# Prevents path traversal attacks (e.g., ../../etc/passwd)

# Check for path traversal attempts in the raw path
if ".." in file_path:
  WARN "Path traversal attempt detected: {file_path}"
  return false

# Resolve to absolute path and normalize
resolved_path = resolve_absolute_path(file_path)
normalized_path = normalize_path(resolved_path)

# Verify path is under one of the allowed base paths
is_allowed = false
for base_path in allowed_base_paths:
  resolved_base = resolve_absolute_path(base_path)
  normalized_base = normalize_path(resolved_base)
  if normalized_path.startswith(normalized_base):
    is_allowed = true
    break

if not is_allowed:
  WARN "KB file path outside allowed directories: {file_path}"
  return false

# Verify file extension is allowed (.md or .json only)
allowed_extensions = [".md", ".json"]
if not any(normalized_path.lower().endswith(ext) for ext in allowed_extensions):
  WARN "Invalid KB file extension: {file_path}"
  return false

return true
```

## Output Format

### JSON Format (default)

```json
{
  "total_sources": 3,
  "total_entries": 45,
  "filtered_count": 12,
  "returned_count": 10,
  "filters": {
    "category": "type_system",
    "phase": "build",
    "step": null,
    "tags": null
  },
  "entries": [
    {
      "id": "KB-build-001",
      "title": "TypeScript module resolution failure",
      "source": "core",
      "phase": "build",
      "step": "implement",
      "category": "missing_dependency",
      "severity": "medium",
      "verified": true,
      "success_count": 12,
      "root_cause": "Module resolution fails due to...",
      "solution": {
        "description": "Check and fix the module resolution issue",
        "actions": [
          "Verify the package is installed",
          "If missing, install it",
          "Check import path"
        ]
      }
    }
  ]
}
```

## Use Cases

### Search by Category

```bash
/fractary-faber:knowledge-aggregator --category type_system
```

### Search by Phase and Step

```bash
/fractary-faber:knowledge-aggregator --phase build --step implement
```

### Search by Agent

```bash
/fractary-faber:knowledge-aggregator --agent software-engineer
```

### Search by Phase and Agent (with relevance boosting)

```bash
/fractary-faber:knowledge-aggregator --phase build --agent software-engineer
```

### Get Human-Readable Summary

```bash
/fractary-faber:knowledge-aggregator --phase evaluate --format summary
```

### Search with Tags

```bash
/fractary-faber:knowledge-aggregator --tags typescript,imports
```

## Performance Notes

- Uses file modification time (mtime) caching to avoid re-parsing unchanged files
- Cache stored in `.fractary/cache/kb-aggregator-cache.json`
- Cache invalidated when file mtime changes
- Limits default results to 20 entries
- Plugin KB paths are discovered once per invocation

### Caching Implementation

The skill maintains a cache of parsed KB entries to avoid re-reading and re-parsing files on every invocation:

```
cache_path = ".fractary/cache/kb-aggregator-cache.json"

# Load cache if exists
if exists(cache_path):
  cache = parse_json(read(cache_path))
else:
  cache = { entries: {}, last_updated: null }

# For each KB file:
for kb_file in all_kb_files:
  file_mtime = get_file_mtime(kb_file)
  cache_key = kb_file

  # Check if cached entry is still valid
  if cache_key in cache.entries:
    cached = cache.entries[cache_key]
    if cached.mtime == file_mtime:
      # Use cached entry - skip parsing
      entry = cached.entry
    else:
      # File changed - re-parse and update cache
      entry = parse_kb_file(kb_file)
      cache.entries[cache_key] = { mtime: file_mtime, entry: entry }
  else:
    # New file - parse and add to cache
    entry = parse_kb_file(kb_file)
    cache.entries[cache_key] = { mtime: file_mtime, entry: entry }

# Save updated cache
cache.last_updated = now()
write(cache_path, json.serialize(cache, indent=2))
```

This reduces repeated file I/O when the debugger runs multiple times in succession.

## Related Documentation

- `agents/workflow-debugger.md` - Uses this skill for KB searches
- `.fractary/faber/knowledge-base/` - Core KB location
- `.fractary/plugins/*/knowledge-base/` - Plugin KB locations

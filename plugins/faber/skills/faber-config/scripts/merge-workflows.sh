#!/bin/bash
# merge-workflows.sh - Deterministic workflow inheritance merger
#
# This script performs the critical workflow merge operation deterministically,
# removing LLM variability from this critical path.
#
# Usage: merge-workflows.sh <workflow_id> [--marketplace-root <path>] [--project-root <path>]
#
# Arguments:
#   workflow_id         - ID of workflow to resolve (e.g., "fractary-faber:default", "project:my-workflow")
#   --marketplace-root  - Marketplace root directory (default: ~/.claude/plugins/marketplaces)
#   --plugin-root       - Deprecated: use --marketplace-root (backward compatibility)
#   --project-root      - Project root directory (default: current working directory)
#
# Output: JSON with merged workflow and inheritance chain
#
# Exit codes:
#   0 - Success
#   1 - Workflow not found
#   2 - Invalid namespace
#   3 - Circular inheritance detected
#   4 - Duplicate step ID
#   5 - Invalid JSON

set -e

# Default paths
MARKETPLACE_ROOT="${CLAUDE_MARKETPLACE_ROOT:-$HOME/.claude/plugins/marketplaces}"
PROJECT_ROOT="$(pwd)"

# Parse arguments
WORKFLOW_ID=""
while [[ $# -gt 0 ]]; do
    case $1 in
        --marketplace-root)
            MARKETPLACE_ROOT="$2"
            shift 2
            ;;
        --plugin-root)
            # Backward compatibility: treat as marketplace root
            MARKETPLACE_ROOT="$2"
            shift 2
            ;;
        --project-root)
            PROJECT_ROOT="$2"
            shift 2
            ;;
        *)
            if [[ -z "$WORKFLOW_ID" ]]; then
                WORKFLOW_ID="$1"
            fi
            shift
            ;;
    esac
done

if [[ -z "$WORKFLOW_ID" ]]; then
    echo '{"status": "failure", "message": "workflow_id is required", "errors": ["Missing workflow_id argument"]}' >&2
    exit 1
fi

# Timeout for URL fetch operations (30 seconds)
URL_FETCH_TIMEOUT=30

# Function to check if an IP address is private/internal
# Returns 0 (true) if private, 1 (false) if public
is_private_ip() {
    local ip="$1"

    # IPv4 private/internal ranges
    if [[ "$ip" =~ ^127\. ]] ||                                    # Loopback
       [[ "$ip" =~ ^10\. ]] ||                                     # Private Class A
       [[ "$ip" =~ ^172\.(1[6-9]|2[0-9]|3[0-1])\. ]] ||           # Private Class B
       [[ "$ip" =~ ^192\.168\. ]] ||                               # Private Class C
       [[ "$ip" =~ ^169\.254\. ]] ||                               # Link-local (AWS metadata!)
       [[ "$ip" =~ ^0\. ]] ||                                      # Current network
       [[ "$ip" =~ ^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\. ]] || # Carrier-grade NAT
       [[ "$ip" =~ ^192\.0\.0\. ]] ||                              # IETF Protocol
       [[ "$ip" =~ ^192\.0\.2\. ]] ||                              # TEST-NET-1
       [[ "$ip" =~ ^198\.51\.100\. ]] ||                           # TEST-NET-2
       [[ "$ip" =~ ^203\.0\.113\. ]] ||                            # TEST-NET-3
       [[ "$ip" =~ ^224\. ]] ||                                    # Multicast
       [[ "$ip" =~ ^240\. ]] ||                                    # Reserved
       [[ "$ip" == "255.255.255.255" ]]; then                      # Broadcast
        return 0
    fi

    # IPv6 private/internal patterns
    if [[ "$ip" == "::1" ]] ||                                     # Loopback
       [[ "$ip" =~ ^[Ff][Ee]80: ]] ||                              # Link-local
       [[ "$ip" =~ ^[Ff][Cc]00: ]] ||                              # Unique local
       [[ "$ip" =~ ^[Ff][Dd][0-9a-fA-F]{2}: ]]; then              # Unique local
        return 0
    fi

    return 1
}

# Function to validate URL for SSRF protection
# Exits with error if URL is potentially dangerous
validate_url_security() {
    local url="$1"

    # Extract scheme
    local scheme="${url%%://*}"
    if [[ "$scheme" != "https" ]]; then
        echo '{"status": "failure", "message": "SSRF protection: URL scheme '"'$scheme'"' not allowed. Only HTTPS is permitted.", "errors": ["Invalid URL scheme"]}' >&2
        exit 1
    fi

    # Extract hostname
    local url_without_scheme="${url#*://}"
    local hostname="${url_without_scheme%%/*}"
    hostname="${hostname%%:*}"  # Remove port if present
    hostname=$(echo "$hostname" | tr '[:upper:]' '[:lower:]')

    # Block localhost hostnames
    if [[ "$hostname" == "localhost" ]] ||
       [[ "$hostname" == "localhost.localdomain" ]] ||
       [[ "$hostname" == *.localhost ]] ||
       [[ "$hostname" == *.local ]]; then
        echo '{"status": "failure", "message": "SSRF protection: Localhost URLs are not allowed", "errors": ["Blocked localhost hostname"]}' >&2
        exit 1
    fi

    # Resolve hostname to IP and check if private
    local resolved_ip
    resolved_ip=$(getent hosts "$hostname" 2>/dev/null | awk '{print $1; exit}')

    if [[ -z "$resolved_ip" ]]; then
        # Try using dig as fallback
        resolved_ip=$(dig +short "$hostname" 2>/dev/null | head -1)
    fi

    if [[ -z "$resolved_ip" ]]; then
        echo '{"status": "failure", "message": "SSRF protection: Failed to resolve hostname '"'$hostname'"'", "errors": ["DNS resolution failed"]}' >&2
        exit 1
    fi

    if is_private_ip "$resolved_ip"; then
        echo '{"status": "failure", "message": "SSRF protection: URL resolves to private/internal IP address ('"$resolved_ip"')", "errors": ["Blocked private IP"]}' >&2
        exit 1
    fi
}

# Function to resolve workflow reference to file path
# Supports three formats:
#   1. URL: url:https://example.com/workflow.json
#   2. Explicit: plugin@marketplace:workflow
#   3. Project-local: workflow-name
resolve_workflow_path() {
    local workflow_id="$1"

    # Format 1: URL reference
    if [[ "$workflow_id" == url:* ]]; then
        # Return special marker - actual fetch handled by load_workflow
        echo "URL:${workflow_id#url:}"
        return
    fi

    # Format 2: Explicit plugin@marketplace:workflow
    if [[ "$workflow_id" == *@*:* ]]; then
        local plugin="${workflow_id%%@*}"
        local rest="${workflow_id#*@}"
        local marketplace="${rest%%:*}"
        local workflow="${rest#*:}"
        echo "${MARKETPLACE_ROOT}/${marketplace}/plugins/${plugin}/.fractary/faber/workflows/${workflow}.json"
        return
    fi

    # Format 3: Project-local (no @ symbol)
    echo "${PROJECT_ROOT}/.fractary/faber/workflows/${workflow_id}.json"
}

# Function to load a workflow JSON file
# Handles URL references with caching, explicit plugin@marketplace references,
# and project-local references with fallback to plugin defaults
load_workflow() {
    local workflow_id="$1"
    local path
    path=$(resolve_workflow_path "$workflow_id")

    # Handle URL references
    if [[ "$path" == URL:* ]]; then
        local url="${path#URL:}"

        # SSRF Protection: Validate URL before fetching
        validate_url_security "$url"

        local cache_dir="${MARKETPLACE_ROOT}/.cache/workflows"
        local url_hash
        url_hash=$(echo -n "$url" | sha256sum | cut -d' ' -f1)
        local cache_file="${cache_dir}/${url_hash}.json"

        # Check cache (valid for 1 hour)
        if [[ -f "$cache_file" ]] && [[ $(find "$cache_file" -mmin -60 2>/dev/null) ]]; then
            cat "$cache_file"
            return
        fi

        # Create cache directory with restricted permissions (owner only)
        mkdir -p "$cache_dir"
        chmod 700 "$cache_dir"

        # Maximum content size (10MB) to prevent DoS via memory exhaustion
        local MAX_CONTENT_SIZE=10485760

        # Fetch with security options:
        # -s: silent mode
        # -f: fail silently on HTTP errors
        # --max-time: timeout to prevent hanging
        # --max-redirs 0: disable redirects (SSRF protection)
        # --max-filesize: limit response size to prevent DoS
        # -A: user agent
        if ! curl -sf \
            --max-time "$URL_FETCH_TIMEOUT" \
            --max-redirs 0 \
            --max-filesize "$MAX_CONTENT_SIZE" \
            -A "Fractary-Faber-WorkflowResolver/1.0" \
            "$url" -o "$cache_file" 2>/dev/null; then
            rm -f "$cache_file"
            echo '{"status": "failure", "message": "Failed to fetch URL: '"$url"'", "errors": ["HTTP request failed, timed out, or response too large for '"$url"'"]}' >&2
            exit 1
        fi

        # Set restricted permissions on cached file
        chmod 600 "$cache_file"

        # Validate file size (additional check in case Content-Length was missing)
        local file_size
        file_size=$(stat -c%s "$cache_file" 2>/dev/null || stat -f%z "$cache_file" 2>/dev/null)
        if [[ -n "$file_size" ]] && [[ "$file_size" -gt "$MAX_CONTENT_SIZE" ]]; then
            rm -f "$cache_file"
            echo '{"status": "failure", "message": "Response too large ('"$file_size"' bytes). Maximum allowed: '"$MAX_CONTENT_SIZE"' bytes", "errors": ["Content size exceeds limit"]}' >&2
            exit 1
        fi

        # Validate fetched JSON
        if ! jq empty "$cache_file" 2>/dev/null; then
            rm -f "$cache_file"
            echo '{"status": "failure", "message": "Invalid JSON from URL: '"$url"'", "errors": ["JSON parse error from '"$url"'"]}' >&2
            exit 5
        fi

        cat "$cache_file"
        return
    fi

    # Check if file exists at resolved path
    if [[ ! -f "$path" ]]; then
        # Fallback logic: if project-local (no @ or : in workflow_id),
        # try the plugin's default workflow location before failing
        if [[ "$workflow_id" != *"@"* ]] && [[ "$workflow_id" != *":"* ]]; then
            local fallback_path="${MARKETPLACE_ROOT}/fractary-faber/plugins/faber/.fractary/faber/workflows/${workflow_id}.json"
            if [[ -f "$fallback_path" ]]; then
                # Found in plugin defaults - use this path
                path="$fallback_path"
            else
                # Not found in either location
                echo '{"status": "failure", "message": "Workflow not found: '"$workflow_id"'", "errors": ["File not found in project ('"$path"') or plugin defaults ('"$fallback_path"')"]}' >&2
                exit 1
            fi
        else
            # Explicit reference was provided, don't fallback
            echo '{"status": "failure", "message": "Workflow not found: '"$workflow_id"'", "errors": ["File not found: '"$path"'"]}' >&2
            exit 1
        fi
    fi

    # Validate JSON
    if ! jq empty "$path" 2>/dev/null; then
        echo '{"status": "failure", "message": "Invalid JSON in workflow: '"$workflow_id"'", "errors": ["JSON parse error in '"$path"'"]}' >&2
        exit 5
    fi

    cat "$path"
}

# Build inheritance chain (child first, then ancestors)
build_inheritance_chain() {
    local workflow_id="$1"
    local chain="[]"
    local visited="{}"
    local current_id="$workflow_id"

    while [[ -n "$current_id" ]]; do
        # Check for circular inheritance
        if echo "$visited" | jq -e --arg id "$current_id" '.[$id] == true' >/dev/null 2>&1; then
            echo '{"status": "failure", "message": "Circular inheritance detected", "errors": ["Workflow '"$current_id"' creates inheritance cycle"]}' >&2
            exit 3
        fi

        # Mark as visited
        visited=$(echo "$visited" | jq --arg id "$current_id" '. + {($id): true}')

        # Add to chain
        chain=$(echo "$chain" | jq --arg id "$current_id" '. + [$id]')

        # Load workflow and get extends
        local workflow_json
        workflow_json=$(load_workflow "$current_id")
        current_id=$(echo "$workflow_json" | jq -r '.extends // empty')
    done

    echo "$chain"
}

# Merge steps for a single phase according to inheritance rules
# Pre-steps: root ancestor first (reversed chain)
# Main steps: only from child (first in chain)
# Post-steps: child first (chain order)
merge_phase_steps() {
    local chain_json="$1"
    local phase="$2"
    local merged_steps="[]"
    local chain_length
    chain_length=$(echo "$chain_json" | jq 'length')

    # Pre-steps: iterate from root (last) to child (first) = reversed
    for ((i=chain_length-1; i>=0; i--)); do
        local workflow_id
        workflow_id=$(echo "$chain_json" | jq -r ".[$i]")
        local workflow_json
        workflow_json=$(load_workflow "$workflow_id")

        # Get pre_steps for this phase
        local pre_steps
        pre_steps=$(echo "$workflow_json" | jq --arg phase "$phase" '.phases[$phase].pre_steps // []')

        # Add source metadata and position to each step
        pre_steps=$(echo "$pre_steps" | jq --arg src "$workflow_id" '[.[] | . + {"source": $src, "position": "pre_step"}]')

        # Append to merged
        merged_steps=$(echo "$merged_steps" "$pre_steps" | jq -s '.[0] + .[1]')
    done

    # Main steps: only from child (index 0)
    local child_id
    child_id=$(echo "$chain_json" | jq -r '.[0]')
    local child_workflow
    child_workflow=$(load_workflow "$child_id")
    local main_steps
    main_steps=$(echo "$child_workflow" | jq --arg phase "$phase" '.phases[$phase].steps // []')
    main_steps=$(echo "$main_steps" | jq --arg src "$child_id" '[.[] | . + {"source": $src, "position": "step"}]')
    merged_steps=$(echo "$merged_steps" "$main_steps" | jq -s '.[0] + .[1]')

    # Post-steps: iterate from child (first) to root (last) = chain order
    for ((i=0; i<chain_length; i++)); do
        local workflow_id
        workflow_id=$(echo "$chain_json" | jq -r ".[$i]")
        local workflow_json
        workflow_json=$(load_workflow "$workflow_id")

        # Get post_steps for this phase
        local post_steps
        post_steps=$(echo "$workflow_json" | jq --arg phase "$phase" '.phases[$phase].post_steps // []')

        # Add source metadata and position to each step
        post_steps=$(echo "$post_steps" | jq --arg src "$workflow_id" '[.[] | . + {"source": $src, "position": "post_step"}]')

        # Append to merged
        merged_steps=$(echo "$merged_steps" "$post_steps" | jq -s '.[0] + .[1]')
    done

    echo "$merged_steps"
}

# Apply skip_steps from child workflow
apply_skip_steps() {
    local merged_steps="$1"
    local skip_steps="$2"

    if [[ "$skip_steps" == "null" ]] || [[ "$skip_steps" == "[]" ]]; then
        echo "$merged_steps"
        return
    fi

    # Filter out steps whose id is in skip_steps
    echo "$merged_steps" | jq --argjson skip "$skip_steps" '[.[] | select(.id as $id | $skip | index($id) | not)]'
}

# Validate no duplicate step IDs
validate_unique_step_ids() {
    local all_steps="$1"

    # Get all step IDs
    local ids
    ids=$(echo "$all_steps" | jq -r '.[].id // empty')

    # Check for duplicates
    local duplicates
    duplicates=$(echo "$ids" | sort | uniq -d)

    if [[ -n "$duplicates" ]]; then
        echo '{"status": "failure", "message": "Duplicate step IDs found", "errors": ["Duplicate step IDs: '"$(echo "$duplicates" | tr '\n' ', ')"'"]}' >&2
        exit 4
    fi
}

# Merge context overlays across inheritance chain
# Context accumulates: ancestor context prepends to child context
# This ensures project-specific context (child) is most prominent
merge_context_overlays() {
    local chain_json="$1"
    local merged='{"global":"","phases":{},"steps":{}}'
    local chain_length
    chain_length=$(echo "$chain_json" | jq 'length')

    # Iterate root→child so ancestor context prepends to child
    for ((i=chain_length-1; i>=0; i--)); do
        local workflow_id
        workflow_id=$(echo "$chain_json" | jq -r ".[$i]")
        local workflow_json
        workflow_json=$(load_workflow "$workflow_id")
        local context
        context=$(echo "$workflow_json" | jq '.context // {}')

        # Skip if no context defined
        if [[ "$context" == "{}" ]] || [[ "$context" == "null" ]]; then
            continue
        fi

        # Merge global context
        local global
        global=$(echo "$context" | jq -r '.global // ""')
        if [[ -n "$global" ]]; then
            local existing_global
            existing_global=$(echo "$merged" | jq -r '.global')
            if [[ -z "$existing_global" ]]; then
                merged=$(echo "$merged" | jq --arg g "$global" '.global = $g')
            else
                merged=$(echo "$merged" | jq --arg g "$global" '.global = .global + "\n\n" + $g')
            fi
        fi

        # Merge phase contexts
        for phase in frame architect build evaluate release; do
            local phase_ctx
            phase_ctx=$(echo "$context" | jq -r --arg p "$phase" '.phases[$p] // ""')
            if [[ -n "$phase_ctx" ]]; then
                local existing_phase
                existing_phase=$(echo "$merged" | jq -r --arg p "$phase" '.phases[$p] // ""')
                if [[ -z "$existing_phase" ]]; then
                    merged=$(echo "$merged" | jq --arg p "$phase" --arg c "$phase_ctx" '.phases[$p] = $c')
                else
                    merged=$(echo "$merged" | jq --arg p "$phase" --arg c "$phase_ctx" '.phases[$p] = .phases[$p] + "\n\n" + $c')
                fi
            fi
        done

        # Merge step contexts (child overrides ancestor for same step ID)
        local step_ctx
        step_ctx=$(echo "$context" | jq '.steps // {}')
        if [[ "$step_ctx" != "{}" ]] && [[ "$step_ctx" != "null" ]]; then
            merged=$(echo "$merged" "$step_ctx" | jq -s '.[0].steps = (.[0].steps + .[1]) | .[0]')
        fi
    done

    # Return merged context (or null if empty)
    local has_content
    has_content=$(echo "$merged" | jq 'if .global == "" and (.phases | length) == 0 and (.steps | length) == 0 then false else true end')
    if [[ "$has_content" == "true" ]]; then
        # Clean up empty global
        if [[ $(echo "$merged" | jq -r '.global') == "" ]]; then
            merged=$(echo "$merged" | jq 'del(.global)')
        fi
        echo "$merged"
    else
        echo "null"
    fi
}

# Main execution
main() {
    # Build inheritance chain
    local chain
    chain=$(build_inheritance_chain "$WORKFLOW_ID")

    # Load child workflow for base metadata
    local child_workflow
    child_workflow=$(load_workflow "$(echo "$chain" | jq -r '.[0]')")

    # Get skip_steps from child
    local skip_steps
    skip_steps=$(echo "$child_workflow" | jq '.skip_steps // []')

    # Initialize merged workflow with child's metadata
    local merged
    merged=$(echo "$child_workflow" | jq '{
        id: .id,
        description: .description,
        autonomy: .autonomy,
        integrations: .integrations
    }')

    # Add inheritance chain metadata
    merged=$(echo "$merged" | jq --argjson chain "$chain" '. + {inheritance_chain: $chain}')

    # Add skipped_steps if any
    if [[ "$skip_steps" != "[]" ]]; then
        merged=$(echo "$merged" | jq --argjson skip "$skip_steps" '. + {skipped_steps: $skip}')
    fi

    # Merge phases
    local phases="{}"
    local all_steps="[]"

    for phase in frame architect build evaluate release; do
        local phase_steps
        phase_steps=$(merge_phase_steps "$chain" "$phase")

        # Apply skip_steps
        phase_steps=$(apply_skip_steps "$phase_steps" "$skip_steps")

        # Accumulate all steps for validation
        all_steps=$(echo "$all_steps" "$phase_steps" | jq -s '.[0] + .[1]')

        # Get enabled status from child (or default true)
        local enabled
        enabled=$(echo "$child_workflow" | jq --arg phase "$phase" '.phases[$phase].enabled // true')

        # Get max_retries for evaluate phase
        local max_retries=""
        if [[ "$phase" == "evaluate" ]]; then
            max_retries=$(echo "$child_workflow" | jq '.phases.evaluate.max_retries // 3')
        fi

        # Build phase object
        if [[ "$phase" == "evaluate" ]]; then
            phases=$(echo "$phases" | jq --arg phase "$phase" \
                --argjson steps "$phase_steps" \
                --argjson enabled "$enabled" \
                --argjson max_retries "$max_retries" \
                '. + {($phase): {enabled: $enabled, steps: $steps, max_retries: $max_retries}}')
        else
            phases=$(echo "$phases" | jq --arg phase "$phase" \
                --argjson steps "$phase_steps" \
                --argjson enabled "$enabled" \
                '. + {($phase): {enabled: $enabled, steps: $steps}}')
        fi
    done

    # Validate unique step IDs
    validate_unique_step_ids "$all_steps"

    # Add phases to merged workflow
    merged=$(echo "$merged" | jq --argjson phases "$phases" '. + {phases: $phases}')

    # Merge context overlays from inheritance chain
    local context_overlays
    context_overlays=$(merge_context_overlays "$chain")
    if [[ "$context_overlays" != "null" ]]; then
        merged=$(echo "$merged" | jq --argjson ctx "$context_overlays" '. + {context: $ctx}')
    fi

    # Return success response
    echo "{\"status\": \"success\", \"message\": \"Workflow merged successfully\", \"workflow\": $merged}"
}

# Run main
main

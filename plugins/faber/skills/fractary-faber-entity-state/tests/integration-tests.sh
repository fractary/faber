#!/usr/bin/env bash
# Integration tests for entity state tracking
# Tests: concurrent updates, path traversal prevention, index consistency

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENTITY_SCRIPTS_DIR="$(cd "$SCRIPT_DIR/../scripts" && pwd)"

# Test data directory
TEST_DATA_DIR="${SCRIPT_DIR}/.test-data"
TEST_ENTITY_DIR="${TEST_DATA_DIR}/.fractary/faber/entities"

# Cleanup function
cleanup() {
  if [ -d "$TEST_DATA_DIR" ]; then
    rm -rf "$TEST_DATA_DIR"
  fi
}

# Setup test environment
setup() {
  cleanup
  mkdir -p "$TEST_ENTITY_DIR"
  cd "$TEST_DATA_DIR"
}

# Test utilities
assert_success() {
  local command="$1"
  local description="$2"

  TESTS_RUN=$((TESTS_RUN + 1))

  if eval "$command" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} PASS: $description"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    return 0
  else
    echo -e "${RED}✗${NC} FAIL: $description"
    echo "   Command: $command"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    return 1
  fi
}

assert_failure() {
  local command="$1"
  local description="$2"

  TESTS_RUN=$((TESTS_RUN + 1))

  if eval "$command" > /dev/null 2>&1; then
    echo -e "${RED}✗${NC} FAIL: $description (expected failure, got success)"
    echo "   Command: $command"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    return 1
  else
    echo -e "${GREEN}✓${NC} PASS: $description"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    return 0
  fi
}

assert_file_exists() {
  local file="$1"
  local description="$2"

  TESTS_RUN=$((TESTS_RUN + 1))

  if [ -f "$file" ]; then
    echo -e "${GREEN}✓${NC} PASS: $description"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    return 0
  else
    echo -e "${RED}✗${NC} FAIL: $description (file not found: $file)"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    return 1
  fi
}

assert_json_field() {
  local file="$1"
  local jq_query="$2"
  local expected="$3"
  local description="$4"

  TESTS_RUN=$((TESTS_RUN + 1))

  local actual=$(jq -r "$jq_query" "$file" 2>/dev/null || echo "")

  if [ "$actual" = "$expected" ]; then
    echo -e "${GREEN}✓${NC} PASS: $description"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    return 0
  else
    echo -e "${RED}✗${NC} FAIL: $description"
    echo "   Expected: $expected"
    echo "   Actual: $actual"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    return 1
  fi
}

# Test Suite 1: Path Traversal Prevention
test_path_traversal_prevention() {
  echo ""
  echo -e "${YELLOW}=== Test Suite 1: Path Traversal Prevention ===${NC}"
  echo ""

  # Test 1.1: Reject entity_id with ..
  assert_failure \
    "bash '$ENTITY_SCRIPTS_DIR/entity-create.sh' --type blog-post --id '../../../etc/passwd' --org fractary --project test" \
    "Reject entity_id with path traversal (..)"

  # Test 1.2: Reject entity_id starting with .
  assert_failure \
    "bash '$ENTITY_SCRIPTS_DIR/entity-create.sh' --type blog-post --id '.hidden' --org fractary --project test" \
    "Reject entity_id starting with dot"

  # Test 1.3: Reject entity_id with /
  assert_failure \
    "bash '$ENTITY_SCRIPTS_DIR/entity-create.sh' --type blog-post --id 'path/to/file' --org fractary --project test" \
    "Reject entity_id with slash"

  # Test 1.4: Reject entity_id with special characters
  assert_failure \
    "bash '$ENTITY_SCRIPTS_DIR/entity-create.sh' --type blog-post --id 'test\$(whoami)' --org fractary --project test" \
    "Reject entity_id with command injection"

  # Test 1.5: Accept valid entity_id
  assert_success \
    "bash '$ENTITY_SCRIPTS_DIR/entity-create.sh' --type blog-post --id 'valid-entity_123' --org fractary --project test" \
    "Accept valid entity_id with alphanumeric, dash, underscore"

  assert_file_exists \
    ".fractary/faber/entities/blog-post/valid-entity_123.json" \
    "Valid entity file created"
}

# Test Suite 2: Concurrent Entity Updates
test_concurrent_updates() {
  echo ""
  echo -e "${YELLOW}=== Test Suite 2: Concurrent Entity Updates ===${NC}"
  echo ""

  # Create test entity
  bash "$ENTITY_SCRIPTS_DIR/entity-create.sh" \
    --type blog-post \
    --id test-concurrent \
    --org fractary \
    --project test \
    > /dev/null 2>&1

  # Test 2.1: Sequential updates should all succeed
  for i in {1..5}; do
    assert_success \
      "bash '$ENTITY_SCRIPTS_DIR/entity-update.sh' --type blog-post --id test-concurrent --properties '{\"iteration\": $i}'" \
      "Sequential update $i succeeds"
  done

  # Test 2.2: Verify version incremented correctly (1 initial + 5 updates = 6)
  assert_json_field \
    ".fractary/faber/entities/blog-post/test-concurrent.json" \
    ".version" \
    "6" \
    "Version incremented correctly after sequential updates"

  # Test 2.3: Concurrent updates with locking (spawn background processes)
  local pids=()
  for i in {1..10}; do
    bash "$ENTITY_SCRIPTS_DIR/entity-record-step.sh" \
      --type blog-post \
      --id test-concurrent \
      --step-id "step-$i" \
      --execution-status completed \
      --phase build \
      --workflow-id test-workflow \
      --run-id test/run/uuid \
      > /dev/null 2>&1 &
    pids+=($!)
  done

  # Wait for all background processes
  local all_succeeded=true
  for pid in "${pids[@]}"; do
    if ! wait $pid; then
      all_succeeded=false
    fi
  done

  TESTS_RUN=$((TESTS_RUN + 1))
  if $all_succeeded; then
    echo -e "${GREEN}✓${NC} PASS: All concurrent step records completed"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}✗${NC} FAIL: Some concurrent step records failed"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi

  # Test 2.4: Verify all steps recorded (10 steps)
  local step_count=$(jq '.step_status | length' ".fractary/faber/entities/blog-post/test-concurrent.json")
  TESTS_RUN=$((TESTS_RUN + 1))
  if [ "$step_count" -eq 10 ]; then
    echo -e "${GREEN}✓${NC} PASS: All 10 concurrent steps recorded"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}✗${NC} FAIL: Expected 10 steps, found $step_count"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi

  # Test 2.5: Verify no corruption in JSON (should be valid JSON)
  assert_success \
    "jq . '.fractary/faber/entities/blog-post/test-concurrent.json' > /dev/null" \
    "Entity JSON is valid after concurrent updates"
}

# Test Suite 3: Index Consistency
test_index_consistency() {
  echo ""
  echo -e "${YELLOW}=== Test Suite 3: Index Consistency ===${NC}"
  echo ""

  # Create multiple test entities
  for i in {1..5}; do
    bash "$ENTITY_SCRIPTS_DIR/entity-create.sh" \
      --type blog-post \
      --id "index-test-$i" \
      --org fractary \
      --project test \
      > /dev/null 2>&1
  done

  # Test 3.1: Verify by-type index updated
  assert_file_exists \
    ".fractary/faber/entities/_indices/by-type.json" \
    "by-type index created"

  local type_count=$(jq -r '.["blog-post"] | length' ".fractary/faber/entities/_indices/by-type.json")
  TESTS_RUN=$((TESTS_RUN + 1))
  if [ "$type_count" -ge 5 ]; then
    echo -e "${GREEN}✓${NC} PASS: by-type index contains at least 5 blog-post entities"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}✗${NC} FAIL: by-type index contains $type_count blog-post entities, expected at least 5"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi

  # Test 3.2: Verify by-status index updated
  assert_file_exists \
    ".fractary/faber/entities/_indices/by-status.json" \
    "by-status index created"

  local status_count=$(jq -r '.["pending"] | length' ".fractary/faber/entities/_indices/by-status.json")
  TESTS_RUN=$((TESTS_RUN + 1))
  if [ "$status_count" -ge 5 ]; then
    echo -e "${GREEN}✓${NC} PASS: by-status index contains at least 5 pending entities"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}✗${NC} FAIL: by-status index contains $status_count pending entities, expected at least 5"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi

  # Test 3.3: Update status and verify index consistency
  bash "$ENTITY_SCRIPTS_DIR/entity-update.sh" \
    --type blog-post \
    --id index-test-1 \
    --status completed \
    > /dev/null 2>&1

  local completed_count=$(jq -r '.["completed"] | length' ".fractary/faber/entities/_indices/by-status.json")
  TESTS_RUN=$((TESTS_RUN + 1))
  if [ "$completed_count" -ge 1 ]; then
    echo -e "${GREEN}✓${NC} PASS: Status change reflected in by-status index"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}✗${NC} FAIL: Status change not reflected in by-status index"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi

  # Test 3.4: Verify recent-updates index
  assert_file_exists \
    ".fractary/faber/entities/_indices/recent-updates.json" \
    "recent-updates index created"

  local recent_count=$(jq '. | length' ".fractary/faber/entities/_indices/recent-updates.json")
  TESTS_RUN=$((TESTS_RUN + 1))
  if [ "$recent_count" -ge 5 ]; then
    echo -e "${GREEN}✓${NC} PASS: recent-updates index contains at least 5 entries"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}✗${NC} FAIL: recent-updates index contains $recent_count entries, expected at least 5"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi

  # Test 3.5: Verify indices are valid JSON
  assert_success \
    "jq . '.fractary/faber/entities/_indices/by-type.json' > /dev/null" \
    "by-type index is valid JSON"

  assert_success \
    "jq . '.fractary/faber/entities/_indices/by-status.json' > /dev/null" \
    "by-status index is valid JSON"

  assert_success \
    "jq . '.fractary/faber/entities/_indices/recent-updates.json' > /dev/null" \
    "recent-updates index is valid JSON"
}

# Test Suite 4: Helper Functions
test_helper_functions() {
  echo ""
  echo -e "${YELLOW}=== Test Suite 4: Helper Functions ===${NC}"
  echo ""

  # Source helper library
  source "$ENTITY_SCRIPTS_DIR/lib/entity-helpers.sh"

  # Test 4.1: calculate_entity_status - all completed
  local result=$(calculate_entity_status '{"step1": {"execution_status": "completed"}, "step2": {"execution_status": "completed"}}')
  TESTS_RUN=$((TESTS_RUN + 1))
  if [ "$result" = "completed" ]; then
    echo -e "${GREEN}✓${NC} PASS: calculate_entity_status returns 'completed' when all steps completed"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}✗${NC} FAIL: calculate_entity_status returned '$result', expected 'completed'"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi

  # Test 4.2: calculate_entity_status - in progress
  result=$(calculate_entity_status '{"step1": {"execution_status": "in_progress"}, "step2": {"execution_status": "completed"}}')
  TESTS_RUN=$((TESTS_RUN + 1))
  if [ "$result" = "in_progress" ]; then
    echo -e "${GREEN}✓${NC} PASS: calculate_entity_status returns 'in_progress' when any step in progress"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}✗${NC} FAIL: calculate_entity_status returned '$result', expected 'in_progress'"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi

  # Test 4.3: calculate_entity_status - failed
  result=$(calculate_entity_status '{"step1": {"execution_status": "failed"}}')
  TESTS_RUN=$((TESTS_RUN + 1))
  if [ "$result" = "failed" ]; then
    echo -e "${GREEN}✓${NC} PASS: calculate_entity_status returns 'failed' when any step failed"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}✗${NC} FAIL: calculate_entity_status returned '$result', expected 'failed'"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi

  # Test 4.4: calculate_entity_status - pending (no steps)
  result=$(calculate_entity_status '{}')
  TESTS_RUN=$((TESTS_RUN + 1))
  if [ "$result" = "pending" ]; then
    echo -e "${GREEN}✓${NC} PASS: calculate_entity_status returns 'pending' when no steps"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}✗${NC} FAIL: calculate_entity_status returned '$result', expected 'pending'"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi

  # Test 4.5: map_result_to_outcome - success
  result=$(map_result_to_outcome '{"status": "completed"}')
  TESTS_RUN=$((TESTS_RUN + 1))
  if [ "$result" = "success" ]; then
    echo -e "${GREEN}✓${NC} PASS: map_result_to_outcome returns 'success' for completed"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}✗${NC} FAIL: map_result_to_outcome returned '$result', expected 'success'"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi

  # Test 4.6: map_result_to_outcome - warning
  result=$(map_result_to_outcome '{"status": "completed", "warnings": ["warn1"]}')
  TESTS_RUN=$((TESTS_RUN + 1))
  if [ "$result" = "warning" ]; then
    echo -e "${GREEN}✓${NC} PASS: map_result_to_outcome returns 'warning' for completed with warnings"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}✗${NC} FAIL: map_result_to_outcome returned '$result', expected 'warning'"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi

  # Test 4.7: map_result_to_outcome - partial
  result=$(map_result_to_outcome '{"status": "completed", "partial": true}')
  TESTS_RUN=$((TESTS_RUN + 1))
  if [ "$result" = "partial" ]; then
    echo -e "${GREEN}✓${NC} PASS: map_result_to_outcome returns 'partial' for partial completion"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}✗${NC} FAIL: map_result_to_outcome returned '$result', expected 'partial'"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi

  # Test 4.8: map_result_to_outcome - failure
  result=$(map_result_to_outcome '{"status": "failed"}')
  TESTS_RUN=$((TESTS_RUN + 1))
  if [ "$result" = "failure" ]; then
    echo -e "${GREEN}✓${NC} PASS: map_result_to_outcome returns 'failure' for failed"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}✗${NC} FAIL: map_result_to_outcome returned '$result', expected 'failure'"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi

  # Test 4.9: extract_artifacts_from_state
  result=$(extract_artifacts_from_state \
    '{"spec_path": "/path/to/spec.md", "pr_url": "https://github.com/org/repo/pull/123"}' \
    '{"spec_path": "file", "pr_url": "url"}' \
    "test-step" \
    "test/run/uuid" | jq 'length')
  TESTS_RUN=$((TESTS_RUN + 1))
  if [ "$result" = "2" ]; then
    echo -e "${GREEN}✓${NC} PASS: extract_artifacts_from_state extracts 2 artifacts"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}✗${NC} FAIL: extract_artifacts_from_state extracted $result artifacts, expected 2"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
}

# Test Suite 5: Trap Cleanup Handlers
test_trap_handlers() {
  echo ""
  echo -e "${YELLOW}=== Test Suite 5: Trap Cleanup Handlers ===${NC}"
  echo ""

  # Create test entity
  bash "$ENTITY_SCRIPTS_DIR/entity-create.sh" \
    --type blog-post \
    --id test-trap \
    --org fractary \
    --project test \
    > /dev/null 2>&1

  # Test 5.1: Simulate interrupted update (send SIGTERM)
  (
    bash "$ENTITY_SCRIPTS_DIR/entity-update.sh" \
      --type blog-post \
      --id test-trap \
      --properties '{"test": "data"}' &
    local pid=$!
    sleep 0.1
    kill -TERM $pid 2>/dev/null || true
    wait $pid 2>/dev/null || true
  )

  # Verify no stale lock files
  TESTS_RUN=$((TESTS_RUN + 1))
  if [ ! -d ".fractary/faber/entities/blog-post/test-trap.lock" ]; then
    echo -e "${GREEN}✓${NC} PASS: No stale lock after SIGTERM"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}✗${NC} FAIL: Stale lock found after SIGTERM"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi

  # Verify no temp files
  TESTS_RUN=$((TESTS_RUN + 1))
  if [ ! -f ".fractary/faber/entities/blog-post/test-trap.json.tmp" ]; then
    echo -e "${GREEN}✓${NC} PASS: No temp files after SIGTERM"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}✗${NC} FAIL: Temp files found after SIGTERM"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
}

# Main execution
main() {
  echo ""
  echo "========================================"
  echo "Entity State Tracking Integration Tests"
  echo "========================================"

  # Setup test environment
  setup

  # Run test suites
  test_path_traversal_prevention
  test_concurrent_updates
  test_index_consistency
  test_helper_functions
  test_trap_handlers

  # Print summary
  echo ""
  echo "========================================"
  echo "Test Summary"
  echo "========================================"
  echo "Tests run:    $TESTS_RUN"
  echo -e "Tests passed: ${GREEN}$TESTS_PASSED${NC}"
  echo -e "Tests failed: ${RED}$TESTS_FAILED${NC}"
  echo ""

  # Cleanup
  cleanup

  # Exit with appropriate code
  if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
  else
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
  fi
}

# Run main if executed directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  main "$@"
fi

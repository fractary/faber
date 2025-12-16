"""Pytest configuration and fixtures."""

from __future__ import annotations

import pytest


@pytest.fixture
def sample_issue_data() -> dict:
    """Sample issue data for testing."""
    return {
        "number": 123,
        "title": "Test Feature",
        "body": "Implement test feature\n\n## Acceptance Criteria\n- Works correctly",
        "state": "open",
        "labels": ["enhancement"],
        "assignees": ["test-user"],
        "url": "https://github.com/test/repo/issues/123",
    }


@pytest.fixture
def sample_spec_content() -> str:
    """Sample specification content."""
    return """# Feature: Test Feature

## Summary
Test feature implementation.

## Acceptance Criteria
- [ ] Feature works correctly
- [ ] Tests pass

## Technical Approach
1. Implement core functionality
2. Add tests
"""


@pytest.fixture
def sample_workflow_config() -> dict:
    """Sample workflow configuration."""
    return {
        "autonomy": "assisted",
        "max_retries": 3,
        "models": {
            "frame": "anthropic:claude-3-5-haiku-20241022",
            "architect": "anthropic:claude-sonnet-4-20250514",
            "build": "anthropic:claude-sonnet-4-20250514",
            "evaluate": "anthropic:claude-sonnet-4-20250514",
            "release": "anthropic:claude-3-5-haiku-20241022",
        },
    }

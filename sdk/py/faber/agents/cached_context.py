"""
Cached Agent Context - Build cacheable context for prompt caching.

Loads content from files, globs, or inline sources and structures them
as cacheable blocks for Claude's prompt caching API.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


class CachedAgentContext:
    """Manages cacheable context for agents.

    Loads content from various sources and builds message blocks with
    cache_control markers for Claude's prompt caching API.

    Example:
        context = CachedAgentContext(project_root=Path("/path/to/project"))
        context.load_from_file(".fractary/docs/STANDARDS.md", "Project Standards")
        context.load_from_glob(".fractary/templates/*.py", "Code Templates")
        blocks = context.build_system_blocks("You are an agent...")
    """

    def __init__(self, project_root: Path):
        """Initialize cached context.

        Args:
            project_root: Project root directory
        """
        self.project_root = project_root
        self.blocks: List[Dict[str, Any]] = []

    def add_cached_block(self, label: str, content: str) -> None:
        """Add a cacheable content block.

        Args:
            label: Label for this block (appears as header)
            content: Content to cache
        """
        if not content or not content.strip():
            logger.warning(f"Skipping empty cached block: {label}")
            return

        self.blocks.append(
            {
                "type": "text",
                "text": f"## {label}\n\n{content}",
                "cache_control": {"type": "ephemeral"},
            }
        )
        logger.debug(
            f"Added cached block: {label} ({len(content)} chars, "
            f"~{len(content.split())} tokens)"
        )

    def load_from_file(self, path: str, label: str) -> None:
        """Load content from a single file for caching.

        Args:
            path: Path to file (relative to project_root)
            label: Label for this content block
        """
        file_path = self.project_root / path

        if not file_path.exists():
            logger.warning(f"File not found for caching: {file_path}")
            return

        try:
            content = file_path.read_text(encoding="utf-8")
            self.add_cached_block(label, content)
        except Exception as e:
            logger.error(f"Failed to load file for caching {file_path}: {e}")

    def load_from_glob(self, pattern: str, label: str) -> None:
        """Load content from multiple files matching pattern.

        Args:
            pattern: Glob pattern (relative to project_root)
            label: Label for this content block
        """
        files = list(self.project_root.glob(pattern))

        if not files:
            logger.warning(f"No files found for pattern: {pattern}")
            return

        # Concatenate all matching files
        contents = []
        for file_path in sorted(files):
            try:
                file_content = file_path.read_text(encoding="utf-8")
                relative_path = file_path.relative_to(self.project_root)
                contents.append(f"### {relative_path}\n\n{file_content}")
            except Exception as e:
                logger.error(f"Failed to load file {file_path}: {e}")

        if contents:
            combined = "\n\n".join(contents)
            self.add_cached_block(label, combined)
            logger.debug(f"Loaded {len(files)} files for pattern: {pattern}")

    def load_from_codex(self, uri: str, label: str) -> None:
        """Load content from Codex URI for caching.

        Uses the fractary-codex plugin to fetch content from codex:// URIs.
        Content from codex is automatically cached to save tokens on standards,
        guides, and shared documentation.

        Note: This requires integration with the fractary-codex plugin.
        Currently this is a placeholder - proper integration will be added
        when the agent factory is enhanced to pass a codex client/fetcher.

        Args:
            uri: Codex URI (e.g., codex://org/project/path)
            label: Label for this content block

        Example:
            context.load_from_codex(
                "codex://fractary/standards/api-design.md",
                "API Design Standards"
            )
        """
        if not uri.startswith("codex://"):
            logger.error(f"Invalid codex URI: {uri}")
            return

        # TODO: Integrate with fractary-codex plugin
        # Options:
        # 1. Accept a codex_fetcher function in __init__ that can be passed from agent_factory
        # 2. Import fractary_codex module if available
        # 3. Use the codex MCP server if configured
        #
        # For now, log a warning that this feature requires additional setup
        logger.warning(
            f"Codex URI caching is configured but not yet integrated: {uri}. "
            f"To enable this feature, the fractary-codex plugin integration "
            f"needs to be completed. Skipping for now."
        )

        # When properly integrated, the implementation will:
        # 1. Fetch content from codex using the plugin's API
        # 2. Cache it using: self.add_cached_block(label, content)
        # 3. Log success: logger.debug(f"Loaded from codex: {uri}")

    def build_system_blocks(self, agent_prompt: str) -> List[Dict[str, Any]]:
        """Build complete system message blocks for agent.

        The structure is:
        1. Agent-specific prompt (NOT cached - changes per agent)
        2. Cached content blocks (standards, templates, patterns, etc.)

        Args:
            agent_prompt: Agent-specific system prompt

        Returns:
            List of message content blocks
        """
        blocks = []

        # Agent prompt first (not cached - varies per agent/task)
        blocks.append({"type": "text", "text": agent_prompt})

        # Then add cached blocks
        blocks.extend(self.blocks)

        logger.debug(
            f"Built system blocks: 1 agent prompt + {len(self.blocks)} cached blocks"
        )

        return blocks

    def get_cache_stats(self) -> Dict[str, Any]:
        """Get statistics about cached content.

        Returns:
            Dict with cache statistics
        """
        total_chars = sum(
            len(block["text"]) for block in self.blocks if "text" in block
        )
        total_words = sum(
            len(block["text"].split()) for block in self.blocks if "text" in block
        )

        return {
            "num_blocks": len(self.blocks),
            "total_chars": total_chars,
            "total_words": total_words,
            "estimated_tokens": total_words,  # Rough estimate
        }

    def __repr__(self) -> str:
        stats = self.get_cache_stats()
        return (
            f"CachedAgentContext("
            f"blocks={stats['num_blocks']}, "
            f"~{stats['estimated_tokens']} tokens"
            f")"
        )

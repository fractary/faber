"""
Converters - Convert Claude Code agents/skills to YAML format.

Helps migrate existing Claude Code definitions to the new universal format.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Optional

from faber.definitions.schemas import (
    AgentDefinition,
    BashImplementation,
    LLMConfig,
    PythonImplementation,
    ToolDefinition,
    ToolImplementation,
)


def convert_claude_agent(
    claude_agent_path: Path,
    output_name: str,
    model: str = "claude-sonnet-4-20250514",
    provider: str = "anthropic",
) -> AgentDefinition:
    """Convert a Claude Code agent (.md) to AgentDefinition.

    Claude agent format:
    ```markdown
    # Agent Name

    Description here

    ## Instructions

    - Do this
    - Do that
    ```

    Args:
        claude_agent_path: Path to Claude agent markdown file
        output_name: Name for output agent
        model: Model to use (default: claude-sonnet-4-20250514)
        provider: Provider to use (default: anthropic)

    Returns:
        AgentDefinition

    Raises:
        FileNotFoundError: If file doesn't exist
    """
    if not claude_agent_path.exists():
        raise FileNotFoundError(f"File not found: {claude_agent_path}")

    content = claude_agent_path.read_text(encoding="utf-8")

    # Extract title
    title_match = re.search(r"^# (.+)$", content, re.MULTILINE)
    title = title_match.group(1).strip() if title_match else output_name

    # Extract description (first paragraph after title)
    desc_match = re.search(r"^# .+\n\n(.+?)(?:\n\n|\n#)", content, re.DOTALL)
    description = desc_match.group(1).strip() if desc_match else title

    # System prompt is the full content (cleaned up)
    system_prompt = content

    # Create LLM config
    llm = LLMConfig(
        provider=provider,
        model=model,
        temperature=0.0,
    )

    return AgentDefinition(
        name=output_name,
        description=description,
        llm=llm,
        system_prompt=system_prompt,
        tools=[],  # User must add tools manually
        tags=["converted-from-claude"],
    )


def convert_claude_skill(
    claude_skill_path: Path,
    output_name: str,
) -> ToolDefinition:
    """Convert a Claude Code skill (.md) to ToolDefinition.

    Claude skill format:
    ```markdown
    # Skill Name

    Description

    ## Implementation

    ```bash
    command here
    ```
    ```

    Args:
        claude_skill_path: Path to Claude skill markdown file
        output_name: Name for output tool

    Returns:
        ToolDefinition

    Raises:
        FileNotFoundError: If file doesn't exist
    """
    if not claude_skill_path.exists():
        raise FileNotFoundError(f"File not found: {claude_skill_path}")

    content = claude_skill_path.read_text(encoding="utf-8")

    # Extract title
    title_match = re.search(r"^# (.+)$", content, re.MULTILINE)
    title = title_match.group(1).strip() if title_match else output_name

    # Extract description (first paragraph after title)
    desc_match = re.search(r"^# .+\n\n(.+?)(?:\n\n|\n#)", content, re.DOTALL)
    description = desc_match.group(1).strip() if desc_match else title

    # Try to extract bash implementation
    bash_match = re.search(r"```bash\n(.+?)\n```", content, re.DOTALL)

    if bash_match:
        # Bash implementation found
        bash_command = bash_match.group(1).strip()

        implementation = ToolImplementation(
            type="bash",
            bash=BashImplementation(
                command=bash_command,
                sandbox={
                    "enabled": True,
                    "allowlisted_commands": [],  # User must configure
                    "network_access": False,
                    "max_execution_time": 300,
                },
            ),
        )
    else:
        # Try Python implementation
        python_match = re.search(r"```python\n(.+?)\n```", content, re.DOTALL)

        if python_match:
            # Python code found - user needs to create module/function
            implementation = ToolImplementation(
                type="python",
                python=PythonImplementation(
                    module="custom.tools",  # Placeholder
                    function=output_name.replace("-", "_"),
                ),
            )
        else:
            # Default to bash with placeholder
            implementation = ToolImplementation(
                type="bash",
                bash=BashImplementation(
                    command="echo 'TODO: Add implementation'",
                    sandbox={
                        "enabled": True,
                        "allowlisted_commands": ["echo"],
                        "network_access": False,
                    },
                ),
            )

    return ToolDefinition(
        name=output_name,
        description=description,
        implementation=implementation,
        parameters={},  # User must add parameters
        tags=["converted-from-claude"],
    )


def convert_claude_directory(
    claude_dir: Path,
    output_dir: Path,
    convert_type: str = "agent",
) -> int:
    """Convert all Claude Code files in a directory.

    Args:
        claude_dir: Directory containing Claude Code files (.md)
        output_dir: Output directory for YAML files
        convert_type: Type to convert ("agent" or "skill")

    Returns:
        Number of files converted
    """
    if not claude_dir.exists():
        raise FileNotFoundError(f"Directory not found: {claude_dir}")

    output_dir.mkdir(parents=True, exist_ok=True)

    count = 0
    for md_file in claude_dir.glob("*.md"):
        # Generate output name from filename
        output_name = md_file.stem.lower().replace("_", "-").replace(" ", "-")

        try:
            if convert_type == "agent":
                definition = convert_claude_agent(md_file, output_name)
            else:
                definition = convert_claude_skill(md_file, output_name)

            # Save to YAML
            from faber.definitions.registry import get_registry

            registry = get_registry(project_root=output_dir.parent)

            if convert_type == "agent":
                registry.save_agent(definition)
            else:
                registry.save_tool(definition)

            count += 1

        except Exception as e:
            print(f"Failed to convert {md_file}: {e}")

    return count

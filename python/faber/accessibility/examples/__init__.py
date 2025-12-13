"""
Example YAML workflow definitions for FABER.

These examples demonstrate the declarative workflow definition format
and can be used as templates for custom workflows.

Available examples:
- software-dev.yaml: Standard 5-phase software development workflow
"""

from pathlib import Path

EXAMPLES_DIR = Path(__file__).parent


def get_example_path(name: str) -> Path:
    """Get the path to an example workflow.

    Args:
        name: Example name (e.g., "software-dev")

    Returns:
        Path to the example YAML file

    Raises:
        FileNotFoundError: If example doesn't exist
    """
    path = EXAMPLES_DIR / f"{name}.yaml"
    if not path.exists():
        available = [f.stem for f in EXAMPLES_DIR.glob("*.yaml")]
        raise FileNotFoundError(
            f"Example '{name}' not found. Available: {', '.join(available)}"
        )
    return path


def list_examples() -> list[str]:
    """List available example workflows.

    Returns:
        List of example names (without .yaml extension)
    """
    return [f.stem for f in EXAMPLES_DIR.glob("*.yaml")]

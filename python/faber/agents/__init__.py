"""
FABER Agents - Phase agents for the FABER workflow.

Each phase of the FABER methodology (Frame, Architect, Build, Evaluate, Release)
has a dedicated agent with specific tools and prompts.
"""

from faber.agents.base import (
    FaberAgentConfig,
    FaberMiddleware,
    create_faber_agent,
)
from faber.agents.frame import create_frame_agent, FRAME_CONFIG
from faber.agents.architect import create_architect_agent, ARCHITECT_CONFIG
from faber.agents.build import create_build_agent, BUILD_CONFIG
from faber.agents.evaluate import create_evaluate_agent, EVALUATE_CONFIG
from faber.agents.release import create_release_agent, RELEASE_CONFIG

__all__ = [
    # Base
    "FaberAgentConfig",
    "FaberMiddleware",
    "create_faber_agent",
    # Phase agents
    "create_frame_agent",
    "create_architect_agent",
    "create_build_agent",
    "create_evaluate_agent",
    "create_release_agent",
    # Configs
    "FRAME_CONFIG",
    "ARCHITECT_CONFIG",
    "BUILD_CONFIG",
    "EVALUATE_CONFIG",
    "RELEASE_CONFIG",
]

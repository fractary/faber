"""
FABER Primitives - Framework-agnostic core abstractions.

These primitives have NO LangChain dependencies and can be used
independently or wrapped with LangChain tools.
"""

from faber.primitives.work.manager import WorkManager
from faber.primitives.repo.manager import RepoManager
from faber.primitives.spec.manager import SpecManager
from faber.primitives.logs.manager import LogManager

__all__ = [
    "WorkManager",
    "RepoManager",
    "SpecManager",
    "LogManager",
]

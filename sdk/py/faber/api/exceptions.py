"""Exception types for FABER API."""

from typing import Any, Optional


class FaberError(Exception):
    """Base exception for all FABER errors."""

    def __init__(
        self,
        message: str,
        code: str = "FABER_ERROR",
        details: Optional[dict[str, Any]] = None,
    ):
        self.message = message
        self.code = code
        self.details = details or {}
        super().__init__(message)

    def to_dict(self) -> dict[str, Any]:
        """Convert exception to dictionary for serialization."""
        return {
            "error": self.message,
            "code": self.code,
            "details": self.details,
        }


class ConfigError(FaberError):
    """Configuration-related errors."""

    def __init__(self, message: str, details: Optional[dict] = None):
        super().__init__(message, code="CONFIG_ERROR", details=details)


class WorkflowError(FaberError):
    """Workflow execution errors."""

    def __init__(
        self,
        message: str,
        workflow_id: Optional[str] = None,
        phase: Optional[str] = None,
        details: Optional[dict] = None,
    ):
        self.workflow_id = workflow_id
        self.phase = phase
        details = details or {}
        if workflow_id:
            details["workflow_id"] = workflow_id
        if phase:
            details["phase"] = phase
        super().__init__(message, code="WORKFLOW_ERROR", details=details)

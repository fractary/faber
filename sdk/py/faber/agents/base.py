"""
Base agent configuration and middleware abstraction.

This module provides an abstraction layer that isolates FABER from
Deep Agents API changes, allowing fallback to native LangGraph implementation.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Callable, Optional, Sequence

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langchain_core.tools import BaseTool
from langgraph.prebuilt import create_react_agent


@dataclass
class FaberAgentConfig:
    """Configuration for a FABER phase agent."""

    name: str
    description: str
    system_prompt: str
    tools: Sequence[BaseTool | Callable]
    model: str = "anthropic:claude-sonnet-4-20250514"
    human_approval: bool = False
    max_iterations: int = 50
    temperature: float = 0.0
    metadata: dict[str, Any] = field(default_factory=dict)


class FaberMiddleware(ABC):
    """Abstract middleware interface for FABER agents.

    Implementations can use Deep Agents library or native LangGraph.
    This abstraction isolates FABER from external API changes.
    """

    @property
    @abstractmethod
    def tools(self) -> Sequence[BaseTool | Callable]:
        """Tools available to this middleware."""
        pass

    @property
    @abstractmethod
    def system_prompt(self) -> str:
        """System prompt for this middleware."""
        pass

    @abstractmethod
    async def invoke(
        self,
        messages: Sequence[BaseMessage],
        config: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """Invoke the agent with messages."""
        pass


class NativeMiddleware(FaberMiddleware):
    """Native LangGraph implementation of FABER middleware.

    Uses LangGraph's create_react_agent for a simple, reliable implementation
    that doesn't depend on external Deep Agents library.
    """

    def __init__(
        self,
        config: FaberAgentConfig,
        model: BaseChatModel,
    ) -> None:
        """Initialize native middleware.

        Args:
            config: Agent configuration
            model: LangChain chat model to use
        """
        self._config = config
        self._model = model
        self._tools = list(config.tools)
        self._system_prompt = config.system_prompt

        # Create the react agent
        self._agent = create_react_agent(
            model=model,
            tools=self._tools,
            state_modifier=self._system_prompt,
        )

    @property
    def tools(self) -> Sequence[BaseTool | Callable]:
        """Tools available to this middleware."""
        return self._tools

    @property
    def system_prompt(self) -> str:
        """System prompt for this middleware."""
        return self._system_prompt

    async def invoke(
        self,
        messages: Sequence[BaseMessage],
        config: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """Invoke the agent with messages."""
        result = await self._agent.ainvoke(
            {"messages": messages},
            config=config or {},
        )
        return result


def _get_model(model_string: str) -> BaseChatModel:
    """Get a LangChain model from a model string.

    Args:
        model_string: Model identifier like "anthropic:claude-sonnet-4-20250514"
                     or "openai:gpt-4o"

    Returns:
        Configured BaseChatModel instance
    """
    if ":" in model_string:
        provider, model_name = model_string.split(":", 1)
    else:
        # Default to anthropic if no provider specified
        provider = "anthropic"
        model_name = model_string

    provider = provider.lower()

    if provider == "anthropic":
        from langchain_anthropic import ChatAnthropic

        return ChatAnthropic(model=model_name)
    elif provider == "openai":
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(model=model_name)
    else:
        raise ValueError(f"Unsupported model provider: {provider}")


def create_faber_agent(
    config: FaberAgentConfig,
    model: Optional[BaseChatModel] = None,
) -> NativeMiddleware:
    """Create a FABER phase agent.

    This factory function creates agents using the native LangGraph implementation.
    In the future, could support Deep Agents if stable.

    Args:
        config: Agent configuration
        model: Optional pre-configured model (uses config.model if not provided)

    Returns:
        Configured agent middleware
    """
    if model is None:
        model = _get_model(config.model)

    return NativeMiddleware(config=config, model=model)


class AgentExecutor:
    """High-level executor for FABER agents.

    Wraps the middleware with additional functionality like
    logging, cost tracking, and error handling.
    """

    def __init__(
        self,
        middleware: FaberMiddleware,
        config: FaberAgentConfig,
    ) -> None:
        """Initialize agent executor.

        Args:
            middleware: Agent middleware
            config: Agent configuration
        """
        self.middleware = middleware
        self.config = config
        self._iteration_count = 0

    async def run(
        self,
        task: str,
        context: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """Run the agent on a task.

        Args:
            task: Task description or instruction
            context: Optional context data

        Returns:
            Agent execution result
        """
        messages = [HumanMessage(content=task)]

        # Add context if provided
        if context:
            context_str = "\n".join(f"- {k}: {v}" for k, v in context.items())
            messages[0] = HumanMessage(
                content=f"Context:\n{context_str}\n\nTask: {task}"
            )

        result = await self.middleware.invoke(messages)

        return {
            "messages": result.get("messages", []),
            "output": self._extract_output(result),
            "iterations": self._iteration_count,
        }

    def _extract_output(self, result: dict[str, Any]) -> str:
        """Extract the final output from agent result."""
        messages = result.get("messages", [])
        if messages:
            last_message = messages[-1]
            if hasattr(last_message, "content"):
                return last_message.content
        return ""

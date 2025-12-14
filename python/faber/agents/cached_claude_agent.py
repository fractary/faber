"""
Cached Claude Agent - Agent that uses Anthropic SDK with prompt caching.

This agent uses the Anthropic SDK directly (instead of LangChain) to support
the cache_control parameter for prompt caching, which can save ~90% on input
tokens for cached content.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Sequence

from anthropic import Anthropic
from langchain_core.messages import BaseMessage
from langchain_core.tools import BaseTool

from faber.agents.cached_context import CachedAgentContext

logger = logging.getLogger(__name__)


class CachedClaudeAgent:
    """Agent that uses Claude API with prompt caching.

    This agent bypasses LangChain to use Anthropic SDK directly, enabling
    cache_control for significant token savings on large context.

    Example:
        context = CachedAgentContext(project_root=Path("."))
        context.load_from_file(".fractary/docs/STANDARDS.md", "Standards")

        agent = CachedClaudeAgent(
            model="anthropic:claude-sonnet-4-20250514",
            agent_name="my-agent",
            agent_prompt="You are a helpful agent",
            tools=[tool1, tool2],
            context=context
        )

        result = await agent.invoke("Do something")
    """

    def __init__(
        self,
        model: str,
        agent_name: str,
        agent_prompt: str,
        tools: Sequence[BaseTool],
        context: CachedAgentContext,
    ):
        """Initialize cached Claude agent.

        Args:
            model: Model string (e.g., "anthropic:claude-sonnet-4-20250514")
            agent_name: Agent name
            agent_prompt: Agent-specific system prompt
            tools: List of tools agent can use
            context: Cached context with standards, templates, etc.
        """
        self.model = model
        self.agent_name = agent_name
        self.tools = list(tools)
        self.context = context

        # Extract model name from "provider:model" format
        if ":" in model:
            _, model_name = model.split(":", 1)
        else:
            model_name = model

        self.model_name = model_name

        # Build system blocks (agent prompt + cached content)
        self.system_blocks = context.build_system_blocks(agent_prompt)

        # Create Anthropic client
        self.client = Anthropic()

        # Convert tools to Anthropic format
        self.anthropic_tools = self._convert_tools_to_anthropic_format()

        logger.info(
            f"Created CachedClaudeAgent: {agent_name}, "
            f"model={model_name}, "
            f"tools={len(tools)}, "
            f"cache_blocks={len(context.blocks)}"
        )

    def _convert_tools_to_anthropic_format(self) -> List[Dict[str, Any]]:
        """Convert LangChain tools to Anthropic tool format.

        Returns:
            List of tool definitions in Anthropic format
        """
        anthropic_tools = []

        for tool in self.tools:
            # Get tool schema
            tool_schema = {
                "name": tool.name,
                "description": tool.description,
            }

            # Add input schema if available
            if hasattr(tool, "args_schema") and tool.args_schema:
                # Convert Pydantic model to JSON schema
                schema = tool.args_schema.model_json_schema()

                tool_schema["input_schema"] = {
                    "type": "object",
                    "properties": schema.get("properties", {}),
                    "required": schema.get("required", []),
                }
            else:
                # Default empty schema
                tool_schema["input_schema"] = {
                    "type": "object",
                    "properties": {},
                }

            anthropic_tools.append(tool_schema)

        return anthropic_tools

    async def invoke(
        self,
        messages: Sequence[BaseMessage] | str,
        config: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Invoke the agent with a task.

        Args:
            messages: User messages (BaseMessage list or string)
            config: Optional configuration

        Returns:
            Dict with output, messages, usage stats
        """
        # Convert to message list if string
        if isinstance(messages, str):
            anthropic_messages = [{"role": "user", "content": messages}]
        else:
            anthropic_messages = self._convert_messages_to_anthropic(messages)

        # Make initial call with caching
        response = self.client.messages.create(
            model=self.model_name,
            max_tokens=4096,
            system=self.system_blocks,  # Includes cache_control markers
            messages=anthropic_messages,
            tools=self.anthropic_tools if self.anthropic_tools else None,
        )

        # Tool execution loop
        while response.stop_reason == "tool_use":
            # Execute tools
            tool_results = await self._execute_tools(response.content)

            # Continue conversation with tool results
            # Cache is still active from initial call!
            anthropic_messages.append(
                {"role": "assistant", "content": response.content}
            )
            anthropic_messages.append({"role": "user", "content": tool_results})

            response = self.client.messages.create(
                model=self.model_name,
                max_tokens=4096,
                system=self.system_blocks,  # Cache hit!
                messages=anthropic_messages,
                tools=self.anthropic_tools if self.anthropic_tools else None,
            )

        # Extract final text output
        output_text = ""
        for block in response.content:
            if hasattr(block, "text"):
                output_text += block.text

        return {
            "output": output_text,
            "messages": response.content,
            "usage": {
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens,
                "cache_creation_input_tokens": getattr(
                    response.usage, "cache_creation_input_tokens", 0
                ),
                "cache_read_input_tokens": getattr(
                    response.usage, "cache_read_input_tokens", 0
                ),
            },
            "stop_reason": response.stop_reason,
        }

    async def _execute_tools(self, content: List[Any]) -> List[Dict[str, Any]]:
        """Execute tool calls from response.

        Args:
            content: Response content blocks

        Returns:
            Tool results in Anthropic format
        """
        results = []

        for block in content:
            if block.type == "tool_use":
                tool_name = block.name
                tool_input = block.input

                # Find matching tool
                tool = next((t for t in self.tools if t.name == tool_name), None)

                if not tool:
                    logger.error(f"Tool not found: {tool_name}")
                    results.append(
                        {
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "is_error": True,
                            "content": f"Tool not found: {tool_name}",
                        }
                    )
                    continue

                # Execute tool
                try:
                    # Support both sync and async tools
                    if hasattr(tool, "ainvoke"):
                        result = await tool.ainvoke(tool_input)
                    elif hasattr(tool, "arun"):
                        result = await tool.arun(tool_input)
                    else:
                        # Sync tool - call in executor
                        import asyncio

                        loop = asyncio.get_event_loop()
                        result = await loop.run_in_executor(
                            None, lambda: tool.invoke(tool_input)
                        )

                    results.append(
                        {
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": str(result),
                        }
                    )

                    logger.debug(f"Executed tool: {tool_name}")

                except Exception as e:
                    logger.error(f"Tool execution failed: {tool_name}: {e}")
                    results.append(
                        {
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "is_error": True,
                            "content": f"Tool execution failed: {e}",
                        }
                    )

        return results

    def _convert_messages_to_anthropic(
        self, messages: Sequence[BaseMessage]
    ) -> List[Dict[str, Any]]:
        """Convert LangChain messages to Anthropic format.

        Args:
            messages: LangChain messages

        Returns:
            Anthropic-format messages
        """
        anthropic_messages = []

        for msg in messages:
            role = "user" if msg.type == "human" else "assistant"
            anthropic_messages.append({"role": role, "content": msg.content})

        return anthropic_messages

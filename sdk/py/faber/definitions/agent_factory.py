"""
Agent Factory - Create executable agents from YAML definitions.

Handles:
- Loading LLM models (Anthropic, OpenAI, Google)
- Binding tools to agents
- Configuring prompt caching
- Creating agent middleware
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Sequence

from langchain_core.language_models import BaseChatModel
from langchain_core.tools import BaseTool

from faber.agents.base import FaberAgentConfig, NativeMiddleware, create_faber_agent
from faber.definitions.registry import DefinitionRegistry, get_registry
from faber.definitions.schemas import AgentDefinition, ToolDefinition
from faber.definitions.tool_executor import create_tool_executor

logger = logging.getLogger(__name__)


class AgentFactoryError(Exception):
    """Base exception for agent factory errors."""

    pass


class AgentFactory:
    """Factory for creating executable agents from definitions.

    Example:
        factory = AgentFactory()
        agent = factory.create_agent("my-agent")
        result = await agent.invoke([HumanMessage(content="Hello")])
    """

    def __init__(self, registry: Optional[DefinitionRegistry] = None):
        """Initialize the factory.

        Args:
            registry: Definition registry (uses global if not provided)
        """
        self.registry = registry or get_registry()

    def create_agent(self, agent_name: str) -> NativeMiddleware:
        """Create an executable agent from definition.

        Args:
            agent_name: Name of agent to create

        Returns:
            NativeMiddleware agent ready to invoke

        Raises:
            AgentFactoryError: If agent creation fails
        """
        # Load agent definition
        agent_def = self.registry.get_agent_or_raise(agent_name)

        # Load tools
        tools = self._load_tools(agent_def)

        # Create model
        model = self._create_model(agent_def.llm)

        # Check if caching is enabled
        if agent_def.caching and agent_def.caching.enabled:
            # Import here to avoid circular dependency
            from faber.agents.cached_context import CachedAgentContext
            from faber.agents.cached_claude_agent import CachedClaudeAgent

            # Build cached context
            context = self._build_cached_context(agent_def.caching)

            # Create cached agent
            model_string = f"{agent_def.llm.provider}:{agent_def.llm.model}"
            return CachedClaudeAgent(
                model=model_string,
                agent_name=agent_def.name,
                agent_prompt=agent_def.system_prompt,
                tools=tools,
                context=context,
            )
        else:
            # Create regular agent
            config = FaberAgentConfig(
                name=agent_def.name,
                description=agent_def.description,
                system_prompt=agent_def.system_prompt,
                tools=tools,
                model=f"{agent_def.llm.provider}:{agent_def.llm.model}",
                temperature=agent_def.llm.temperature,
                metadata=agent_def.config,
            )

            return create_faber_agent(config, model=model)

    def _load_tools(self, agent_def: AgentDefinition) -> List[BaseTool]:
        """Load all tools for an agent.

        Args:
            agent_def: Agent definition

        Returns:
            List of LangChain tools
        """
        tools: List[BaseTool] = []

        # Load built-in tools by name
        for tool_name in agent_def.tools:
            tool = self._load_builtin_tool(tool_name)
            if tool:
                tools.append(tool)
            else:
                logger.warning(
                    f"Built-in tool not found: {tool_name} (for agent {agent_def.name})"
                )

        # Create custom tools from definitions
        for custom_tool_def in agent_def.custom_tools:
            tool = self._create_custom_tool(custom_tool_def)
            tools.append(tool)

        return tools

    def _load_builtin_tool(self, tool_name: str) -> Optional[BaseTool]:
        """Load a built-in tool by name.

        Args:
            tool_name: Tool name

        Returns:
            BaseTool if found, None otherwise
        """
        # Import built-in tools
        try:
            from faber.tools import get_builtin_tool

            return get_builtin_tool(tool_name)
        except ImportError:
            logger.warning("Built-in tools module not available")
            return None
        except Exception as e:
            logger.warning(f"Failed to load built-in tool {tool_name}: {e}")
            return None

    def _create_custom_tool(self, tool_def: ToolDefinition) -> BaseTool:
        """Create a LangChain tool from custom tool definition.

        Args:
            tool_def: Tool definition

        Returns:
            BaseTool
        """
        from langchain_core.tools import StructuredTool

        # Create executor
        executor = create_tool_executor(tool_def)

        # Create async function that wraps executor
        async def tool_func(**kwargs) -> Dict[str, Any]:
            return await executor.execute(kwargs)

        # Build args schema from parameters
        from pydantic import BaseModel, Field, create_model

        # Convert ToolParameter to Pydantic fields
        fields = {}
        for param_name, param_def in tool_def.parameters.items():
            # Determine Python type from parameter type
            python_type = self._get_python_type(param_def.type)

            # Make optional if not required
            if not param_def.required:
                python_type = Optional[python_type]

            # Create field with description and default
            fields[param_name] = (
                python_type,
                Field(
                    default=param_def.default if not param_def.required else ...,
                    description=param_def.description,
                ),
            )

        # Create args schema
        ArgsSchema = create_model(f"{tool_def.name}Args", **fields)

        # Create structured tool
        return StructuredTool(
            name=tool_def.name,
            description=tool_def.description,
            func=tool_func,  # Provide sync version
            coroutine=tool_func,  # Provide async version
            args_schema=ArgsSchema,
        )

    def _get_python_type(self, param_type: str) -> type:
        """Convert parameter type string to Python type.

        Args:
            param_type: Parameter type string

        Returns:
            Python type
        """
        type_map = {
            "string": str,
            "integer": int,
            "number": float,
            "boolean": bool,
            "object": dict,
            "array": list,
        }
        return type_map.get(param_type, str)

    def _create_model(self, llm_config: Any) -> BaseChatModel:
        """Create LangChain model from LLM config.

        Args:
            llm_config: LLM configuration

        Returns:
            BaseChatModel instance

        Raises:
            AgentFactoryError: If provider not supported
        """
        provider = llm_config.provider.lower()
        model_name = llm_config.model
        temperature = llm_config.temperature
        max_tokens = llm_config.max_tokens

        if provider == "anthropic":
            try:
                from langchain_anthropic import ChatAnthropic

                return ChatAnthropic(
                    model=model_name,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
            except ImportError:
                raise AgentFactoryError(
                    "langchain-anthropic not installed. "
                    "Install with: pip install langchain-anthropic"
                )

        elif provider == "openai":
            try:
                from langchain_openai import ChatOpenAI

                return ChatOpenAI(
                    model=model_name,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
            except ImportError:
                raise AgentFactoryError(
                    "langchain-openai not installed. "
                    "Install with: pip install langchain-openai"
                )

        elif provider == "google":
            try:
                from langchain_google_genai import ChatGoogleGenerativeAI

                return ChatGoogleGenerativeAI(
                    model=model_name,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
            except ImportError:
                raise AgentFactoryError(
                    "langchain-google-genai not installed. "
                    "Install with: pip install langchain-google-genai"
                )

        else:
            raise AgentFactoryError(f"Unsupported LLM provider: {provider}")

    def _build_cached_context(self, caching_config: Any):
        """Build cached context from caching configuration.

        Args:
            caching_config: Caching configuration

        Returns:
            CachedAgentContext
        """
        from faber.agents.cached_context import CachedAgentContext

        context = CachedAgentContext(project_root=self.registry.project_root)

        # Load each cache source
        for source in caching_config.cache_sources:
            if source.type == "file":
                context.load_from_file(source.path, source.label)
            elif source.type == "glob":
                context.load_from_glob(source.pattern, source.label)
            elif source.type == "inline":
                context.add_cached_block(source.label, source.content)
            elif source.type == "codex":
                context.load_from_codex(source.uri, source.label)

        return context

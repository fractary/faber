"""Tests for AgentFactory LLM construction."""

from unittest.mock import MagicMock, patch

from faber.definitions.agent_factory import AgentFactory
from faber.definitions.schemas import LLMConfig


def _factory() -> AgentFactory:
    return AgentFactory(registry=MagicMock())


class TestCreateModel:
    """Sampling params must not reach models that reject them."""

    def test_anthropic_omits_temperature_by_default(self):
        """Claude Opus 5 / Sonnet 5 return 400 when temperature is sent."""
        config = LLMConfig(model="claude-sonnet-5")
        with patch("langchain_anthropic.ChatAnthropic") as chat:
            _factory()._create_model(config)
        chat.assert_called_once_with(model="claude-sonnet-5", max_tokens=16000)

    def test_anthropic_passes_explicit_temperature(self):
        config = LLMConfig(model="claude-haiku-4-5", temperature=0.2)
        with patch("langchain_anthropic.ChatAnthropic") as chat:
            _factory()._create_model(config)
        chat.assert_called_once_with(model="claude-haiku-4-5", max_tokens=16000, temperature=0.2)

    def test_openai_keeps_zero_temperature_default(self):
        config = LLMConfig(provider="openai", model="gpt-4o")
        with patch("langchain_openai.ChatOpenAI") as chat:
            _factory()._create_model(config)
        chat.assert_called_once_with(model="gpt-4o", max_tokens=16000, temperature=0.0)

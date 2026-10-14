"""Gemini client via langchain-google-genai. Reads GOOGLE_API_KEY from the environment, temperature 0."""
from langchain_google_genai import ChatGoogleGenerativeAI

from app.config import Settings
from app.tools import TOOLS


def make_llm(settings: Settings):
    """Chat model bound to the agent tools; the model must call exactly one tool per turn."""
    # max_retries covers 429/5xx with the SDK's own backoff
    model = ChatGoogleGenerativeAI(model=settings.model, temperature=0, timeout=30, max_retries=3)
    return model.bind_tools(TOOLS, tool_choice="any")

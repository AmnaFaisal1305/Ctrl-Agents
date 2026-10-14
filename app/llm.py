"""Gemini client via langchain-google-genai (P0.2). Reads GOOGLE_API_KEY from the environment, temperature 0."""
from app.config import Settings


def make_llm(settings: Settings):
    raise NotImplementedError("P0.2")

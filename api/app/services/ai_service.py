import logging
import httpx
from app.config import get_settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """
You are an expert copywriter and content manager for our brand's ecommerce store.

Your task: The user will provide a brief prompt or summary of an event, product, or thought.
You must expand this into a short, engaging, professional 2-3 paragraph blog post written in the brand's voice.
Keep it exciting and focused on the community or industry.
Output ONLY the plain text of the blog post. Do not output HTML tags, markdown headings, or conversational filler like "Here is your post:".
Just the raw text, with paragraphs separated by blank lines.
"""

async def generate_blog_post(prompt: str) -> str:
    """Generate a blog post from a prompt using the configured AI provider."""
    settings = get_settings()
    
    if settings.openai_api_key:
        return await _generate_with_openai(prompt, settings.openai_api_key)
    elif settings.gemini_api_key:
        return await _generate_with_gemini(prompt, settings.gemini_api_key)
    else:
        raise ValueError("No AI provider configured. Please set OPENAI_API_KEY or GEMINI_API_KEY in your environment.")

async def _generate_with_openai(prompt: str, api_key: str) -> str:
    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "gpt-4o",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.7,
        "max_tokens": 500
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(url, headers=headers, json=payload, timeout=30.0)
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"].strip()

async def _generate_with_gemini(prompt: str, api_key: str) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    headers = {
        "Content-Type": "application/json"
    }
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": SYSTEM_PROMPT + "\n\nUser Prompt: " + prompt}
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 500
        }
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(url, headers=headers, json=payload, timeout=30.0)
        response.raise_for_status()
        data = response.json()
        return data["candidates"][0]["content"]["parts"][0]["text"].strip()

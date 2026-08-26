# Same Claude-call pattern as tailor.py, different prompt/output: plain-text
# cover letter instead of edited LaTeX. Optionally style-matched via RAG —
# pulls the user's most relevant past cover letters from ChromaDB (style_memory)
# if any exist, degrades gracefully to a plain professional letter if not.

import anthropic

from style_memory import query_samples

client = anthropic.Anthropic()

COVER_LETTER_SYSTEM_PROMPT = """You write cover letters in the user's own voice, based on their resume and writing style.

Rules:
- Keep it under 350 words, professional but not generic/corporate.
- Reference specific, real details from the resume — never invent experience.
- Tie the candidate's background directly to the job description.
- If past writing samples are provided, match their tone, phrasing style, and voice as closely as possible.
- Return only the cover letter body text, no salutation placeholders like "[Your Name]", no commentary before or after."""


def generate_cover_letter(resume_tex: str, job_description: str) -> str:
    samples = query_samples(job_description, sample_type="cover_letter")

    style_block = ""
    if samples:
        joined = "\n---\n".join(samples)
        style_block = f"Examples of the candidate's past writing style:\n{joined}\n\n"

    response = client.messages.create(
        model="claude-opus-5",
        max_tokens=1024,
        system=COVER_LETTER_SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": f"{style_block}Resume:\n{resume_tex}\n\nJob description:\n{job_description}"
        }],
    )

    text = next((block.text for block in response.content if block.type == "text"), "")

    return text

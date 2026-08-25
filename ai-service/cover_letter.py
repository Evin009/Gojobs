# Same Claude-call pattern as tailor.py, different prompt/output: plain-text
# cover letter instead of edited LaTeX.

import anthropic

client = anthropic.Anthropic()

COVER_LETTER_SYSTEM_PROMPT = """You write cover letters in the user's own voice, based on their resume and writing style.

Rules:
- Keep it under 350 words, professional but not generic/corporate.
- Reference specific, real details from the resume — never invent experience.
- Tie the candidate's background directly to the job description.
- Return only the cover letter body text, no salutation placeholders like "[Your Name]", no commentary before or after."""


def generate_cover_letter(resume_tex: str, job_description: str) -> str:
    response = client.messages.create(
        model="claude-opus-5",
        max_tokens=1024,
        system=COVER_LETTER_SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": f"Resume:\n{resume_tex}\n\nJob description:\n{job_description}"
        }],
    )

    text = next((block.text for block in response.content if block.type == "text"), "")

    return text

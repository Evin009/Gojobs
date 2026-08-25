# Sends a resume + job description to Claude and gets back a tailored .tex.
# The system prompt constrains edits to bullet-point wording only — no
# structural changes, no invented experience.

import anthropic

client = anthropic.Anthropic()

TAILOR_SYSTEM_PROMPT = """You are editing a LaTeX resume to better match a job description.

Rules:
- Only edit the text INSIDE existing bullet points (\\item lines) — rewrite wording or insert relevant keywords from the job description.
- Do not add, remove, or reorder \\item lines, sections, or any LaTeX commands/structure.
- Do not invent experience, skills, or achievements that aren't already present — only rephrase what's there.
- Return the COMPLETE .tex file, unchanged outside of bullet text, with no commentary before or after it."""


def tailor_resume(resume_tex: str, job_description: str) -> str:
    response = client.messages.create(
        model="claude-opus-5",
        max_tokens=4096,
        system=TAILOR_SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": f"Resume:\n{resume_tex}\n\nJob description:\n{job_description}"
        }],
    )

    text = next((block.text for block in response.content if block.type == "text"), "")

    return text

import anthropic

client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from the environment

# constrains Claude to bullet-only edits so the resume's LaTeX structure/formatting
# never breaks — only wording inside existing \item lines can change
TAILOR_SYSTEM_PROMPT = """You are editing a LaTeX resume to better match a job description.

Rules:
- Only edit the text INSIDE existing bullet points (\\item lines) — rewrite wording or insert relevant keywords from the job description.
- Do not add, remove, or reorder \\item lines, sections, or any LaTeX commands/structure.
- Do not invent experience, skills, or achievements that aren't already present — only rephrase what's there.
- Return the COMPLETE .tex file, unchanged outside of bullet text, with no commentary before or after it."""


def tailor_resume(resume_tex: str, job_description: str) -> str:
    """Send a resume + job description to Claude, return the tailored .tex text."""
    response = client.messages.create(
        model="claude-opus-5",
        max_tokens=4096,
        system=TAILOR_SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": f"Resume:\n{resume_tex}\n\nJob description:\n{job_description}"
        }],
    )

    # response.content is a list of blocks (text, thinking, ...) — grab the text one
    text = next((block.text for block in response.content if block.type == "text"), "")

    return text

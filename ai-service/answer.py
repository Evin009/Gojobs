# Answers a single open-ended question from a job application, using the user's
# resume and profile as grounding. Same Claude-call shape as cover_letter.py.

import os

import anthropic

client = anthropic.Anthropic()

ANSWER_SYSTEM_PROMPT = """You are filling in one field of a job application on the candidate's behalf.

Rules:
- Answer ONLY from the resume and profile facts given. Never invent experience, dates, or qualifications.
- Match the question's expected format: yes/no questions get "Yes" or "No", short fields get a phrase, essay fields get 2-4 sentences.
- Write in the candidate's first person voice.
- If the provided context genuinely doesn't contain the answer, reply with exactly: UNKNOWN
- Return only the answer text, no preamble, no quotes, no commentary."""


def answer_question(question: str, resume: str, profile: dict) -> str:
    # ANSWER_STUB=1 returns canned text instead of calling Claude, so the
    # extension's fill path can be exercised without credits. See the same
    # flag pattern in route_question.py.
    if os.getenv("ANSWER_STUB") == "1":
        return f"[stub answer for: {question[:60]}]"

    response = client.messages.create(
        model="claude-opus-5",
        max_tokens=512,
        system=ANSWER_SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": f"question:\n{question}\nresume:\n{resume}\nprofile:\n{profile}"
        }],
    )
    
    text = next((block.text for block in response.content if block.type == "text"), "")
    
    return text
   
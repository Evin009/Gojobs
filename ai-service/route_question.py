# Decides what a form question actually wants: an answer the user already gave
# (a stored key), or a written response.
#
# Claude only *routes* here — it picks from the keys we hand it or says none.
# It never decides what a declaration says; that stays the user's answer.

import os

import anthropic

client = anthropic.Anthropic()


# Set ROUTE_STUB=1 in .env to answer without calling Claude at all.
#
# This exists so the extension's fill logic can be built and tested before the
# API is reachable. It separates two failure sources: with the stub on, any bug
# is in our own plumbing, because the routing answer is known in advance.
# Delete the flag to get real judgment back.
_STUB_HINTS = {
    "work_authorization": ["legally authorized", "authorized to work", "right to work"],
    "visa_sponsorship": ["sponsorship", "visa"],
    "gender": ["gender"],
    "ethnicity": ["ethnicity", "race", "hispanic"],
    "veteran_status": ["veteran"],
    "disability_status": ["disability"],
    "email": ["email"],
    "phone": ["your phone", "mobile number"],
}


def _stub_route(question: str, keys: list[str]) -> str:
    label = question.lower()

    for key in keys:
        # matched on distinctive phrases, not on the key name — an earlier
        # version looked for the key's first word, and "want to work at this
        # company" matched work_authorization. A stub that answers wrongly is
        # worse than none: you end up debugging the extension over a fake bug.
        if any(hint in label for hint in _STUB_HINTS.get(key, [])):
            return key

    return "GENERATE" if len(question) > 40 else "SKIP"

ROUTE_SYSTEM_PROMPT = """You route a job application question to a stored answer, or say it needs writing.

You are given a question and a list of stored answer keys the candidate has already filled in.

Rules:
- If the question is asking for one of the stored keys — even worded very differently — reply with exactly that key and nothing else.
- Examples: "Do you presently have the right to work in the US?" -> work_authorization. "Will you require immigration sponsorship?" -> visa_sponsorship.
- If the question is open-ended and needs a written answer (e.g. "Why do you want to work here?"), reply with exactly: GENERATE
- If it is neither — a question you cannot safely map or write (e.g. asking for a reference's phone number) — reply with exactly: SKIP
- Reply with one word only. No punctuation, no explanation."""


def route_question(question: str, keys: list[str]) -> str:
    if os.getenv("ROUTE_STUB") == "1":
        return _stub_route(question, keys)

    response = client.messages.create(
        model="claude-opus-5",
        max_tokens=20,
        system=ROUTE_SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": f"Question:\n{question}\n\nStored keys:\n{', '.join(keys)}"
        }]
    )
        
    text = next((block.text for block in response.content if block.type == "text"), "")
        
    return text.strip()
   

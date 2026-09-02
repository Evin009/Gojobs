# Decides what a form question actually wants: an answer the user already gave
# (a stored key), or a written response.
#
# Claude only *routes* here — it picks from the keys we hand it or says none.
# It never decides what a declaration says; that stays the user's answer.

import anthropic

client = anthropic.Anthropic()

ROUTE_SYSTEM_PROMPT = """You route a job application question to a stored answer, or say it needs writing.

You are given a question and a list of stored answer keys the candidate has already filled in.

Rules:
- If the question is asking for one of the stored keys — even worded very differently — reply with exactly that key and nothing else.
- Examples: "Do you presently have the right to work in the US?" -> work_authorization. "Will you require immigration sponsorship?" -> visa_sponsorship.
- If the question is open-ended and needs a written answer (e.g. "Why do you want to work here?"), reply with exactly: GENERATE
- If it is neither — a question you cannot safely map or write (e.g. asking for a reference's phone number) — reply with exactly: SKIP
- Reply with one word only. No punctuation, no explanation."""


def route_question(question: str, keys: list[str]) -> str:
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
   

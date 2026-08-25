from fastapi import FastAPI
from pydantic import BaseModel
from dotenv import load_dotenv
import anthropic

load_dotenv()

app = FastAPI()
client = anthropic.Anthropic()


@app.get("/health")
def health():
    return {"status": "ok"}


class AskRequest(BaseModel):
    prompt: str


@app.post("/ask")
def ask(request: AskRequest):
    response = client.messages.create(
        model="claude-opus-5",
        max_tokens=1024,
        messages=[{"role": "user", "content": request.prompt}],
    )

    text = next((block.text for block in response.content if block.type == "text"), "")
    return {"response": text}

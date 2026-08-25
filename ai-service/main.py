from fastapi import FastAPI
from fastapi.responses import Response
from pydantic import BaseModel
from dotenv import load_dotenv
import anthropic

from tailor import tailor_resume
from latex import compile_latex

load_dotenv()  # loads ANTHROPIC_API_KEY from .env into the environment

app = FastAPI()
client = anthropic.Anthropic()


@app.get("/health")
def health():
    return {"status": "ok"}


# simple direct Claude call — request body validated automatically via Pydantic
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


# full resume-tailoring pipeline: tailor via Claude, then compile the result to PDF
class TailorRequest(BaseModel):
    resume_text: str
    job_description: str


@app.post("/tailor-resume")
def tailor_resume_endpoint(request: TailorRequest):
    tailored_tex = tailor_resume(request.resume_text, request.job_description)
    pdf_bytes = compile_latex(tailored_tex)

    # raw PDF bytes, not JSON — media_type tells the client how to interpret them
    return Response(content=pdf_bytes, media_type="application/pdf")

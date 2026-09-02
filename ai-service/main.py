# FastAPI entry point. /ask is a plain direct Claude call; /tailor-resume
# chains tailor_resume -> save_resume -> compile_latex into one pipeline.

from fastapi import FastAPI
from fastapi.responses import Response
from pydantic import BaseModel
from dotenv import load_dotenv
import anthropic

from tailor import tailor_resume
from latex import compile_latex
from db import save_resume
from cover_letter import generate_cover_letter
from answer import answer_question

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


class TailorRequest(BaseModel):
    resume_text: str
    job_description: str
    job_id: str | None = None


@app.post("/tailor-resume")
def tailor_resume_endpoint(request: TailorRequest):
    tailored_tex = tailor_resume(request.resume_text, request.job_description)
    save_resume(tailored_tex, request.job_id)
    pdf_bytes = compile_latex(tailored_tex)

    return Response(content=pdf_bytes, media_type="application/pdf")


class CoverLetterRequest(BaseModel):
    resume_text: str
    job_description: str


@app.post("/cover-letter")
def cover_letter_endpoint(request: CoverLetterRequest):
    letter = generate_cover_letter(request.resume_text, request.job_description)
    return {"cover_letter": letter}


# One application question at a time. The extension calls this per question
# field it finds, rather than sending the whole form — keeps each answer
# grounded in just its own question.
class AnswerRequest(BaseModel):
    question: str
    resume_text: str = ""
    profile: dict = {}


@app.post("/answer")
def answer_endpoint(request: AnswerRequest):
    text = answer_question(request.question, request.resume_text, request.profile)

    # the prompt returns UNKNOWN when the context can't support an answer;
    # surface that as empty so the extension leaves the field blank rather
    # than typing a guess onto a real application
    if text.strip().upper() == "UNKNOWN":
        return {"answer": ""}

    return {"answer": text}

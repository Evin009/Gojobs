import psycopg
import os


def save_resume(content: str, job_id: str | None = None) -> str:
    with psycopg.connect(os.getenv("DATABASE_URL")) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO resumes (content, job_id) VALUES (%s, %s) RETURNING id",
                (content, job_id)
            )
            resume_id = cur.fetchone()[0]
        conn.commit()
    return str(resume_id)

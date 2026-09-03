# Direct Postgres access to the same Supabase DB the Go backend uses (not via
# the REST API). Saves tailored/base resumes as new rows in `resumes`.

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


def get_guidelines() -> list[dict]:
    """The active scoring rubric, ordered so prompt output stays comparable."""
    with psycopg.connect(os.getenv("DATABASE_URL")) as conn:
        rows = conn.execute(
            "SELECT id, category, guideline, weight FROM resume_guidelines "
            "WHERE active ORDER BY category, guideline"
        ).fetchall()

    return [
        {"id": str(r[0]), "category": r[1], "guideline": r[2], "weight": r[3]}
        for r in rows
    ]


def save_score(resume_id: str, job_id: str | None, score: int, failed_ids: list[str]) -> str:
    """Records one scoring run so a rewrite decision stays reviewable."""
    with psycopg.connect(os.getenv("DATABASE_URL")) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO resume_scores (resume_id, job_id, score, failed_ids) "
                "VALUES (%s, %s, %s, %s) RETURNING id",
                (resume_id, job_id, score, failed_ids),
            )
            score_id = cur.fetchone()[0]
        conn.commit()
    return str(score_id)


def get_guideline_texts(ids: list[str]) -> list[str]:
    """Guideline text for the ids a score marked as failed."""
    if not ids:
        return []

    with psycopg.connect(os.getenv("DATABASE_URL")) as conn:
        rows = conn.execute(
            "SELECT guideline FROM resume_guidelines WHERE id = ANY(%s) "
            "ORDER BY weight DESC",
            (ids,),
        ).fetchall()

    return [r[0] for r in rows]

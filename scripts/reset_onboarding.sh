#!/usr/bin/env bash
# Wipes everything onboarding wrote, so the next run starts from the landing
# page. Server-side only — also clear the browser's copy, printed at the end.
set -euo pipefail

cd "$(dirname "$0")/.."

~/.venvs/gojobs/bin/python - <<'PY'
import os
import psycopg
from dotenv import load_dotenv

load_dotenv("ai-service/.env")

with psycopg.connect(os.environ["DATABASE_URL"], autocommit=True) as conn:
    profile = conn.execute("DELETE FROM profile").rowcount
    # base resumes only — tailored ones belong to applications already sent
    resumes = conn.execute("DELETE FROM resumes WHERE job_id IS NULL").rowcount

print(f"cleared {profile} profile rows, {resumes} base resumes")
PY

cat <<'MSG'

Now clear the browser's copy. On any ordinary website, open the console and run:

  chrome.storage.local.clear()

then reload the page.
MSG

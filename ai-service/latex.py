import subprocess
import tempfile
import os


def compile_latex(tex_content: str) -> bytes:
    with tempfile.TemporaryDirectory() as tmpdir:
        tex_path = os.path.join(tmpdir, "resume.tex")

        with open(tex_path, "w") as f:
            f.write(tex_content)

        result = subprocess.run(
            ["tectonic", tex_path], cwd=tmpdir, capture_output=True
        )
        if result.returncode != 0:
            raise RuntimeError(f"LaTeX compile failed: {result.stderr.decode()}")

        pdf_path = os.path.join(tmpdir, "resume.pdf")
        with open(pdf_path, "rb") as f:
            return f.read()

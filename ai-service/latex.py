import subprocess
import tempfile
import os


def compile_latex(tex_content: str) -> bytes:
    """Compile a LaTeX .tex string into PDF bytes using tectonic."""
    # temp dir auto-deletes when this block exits, even on error
    with tempfile.TemporaryDirectory() as tmpdir:
        tex_path = os.path.join(tmpdir, "resume.tex")

        # write the .tex source to a real file — tectonic needs a file path, not a string
        with open(tex_path, "w") as f:
            f.write(tex_content)

        # run `tectonic resume.tex` inside tmpdir so output files land there too
        result = subprocess.run(
            ["tectonic", tex_path], cwd=tmpdir, capture_output=True
        )
        if result.returncode != 0:
            raise RuntimeError(f"LaTeX compile failed: {result.stderr.decode()}")

        # tectonic writes resume.pdf next to resume.tex on success
        pdf_path = os.path.join(tmpdir, "resume.pdf")
        with open(pdf_path, "rb") as f:  # "rb" — PDF is binary, not text
            return f.read()

# Vector store for past writing samples (Chroma, embedded — no separate server).
# Embedding happens automatically: pass plain text in, Chroma embeds + stores it.
# sample_type filters retrieval so a cover-letter query doesn't pull back
# resume-bullet-style text just because the topic overlaps.

import chromadb
from datetime import datetime, timezone

client = chromadb.PersistentClient(path="./chroma_data")
collection = client.get_or_create_collection("writing_samples")


def add_sample(sample_id: str, text: str, sample_type: str) -> None:
    collection.add(
        documents=[text],
        ids=[sample_id],
        metadatas=[{
            "type": sample_type,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }],
    )


def query_samples(query_text: str, sample_type: str, n_results: int = 3) -> list[str]:
    results = collection.query(
        query_texts=[query_text],
        n_results=n_results,
        where={"type": sample_type},
    )
    return results["documents"][0]

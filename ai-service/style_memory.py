# Vector store for past writing samples (Chroma, embedded — no separate server).
# Embedding happens automatically: pass plain text in, Chroma embeds + stores it.

import chromadb

client = chromadb.PersistentClient(path="./chroma_data")
collection = client.get_or_create_collection("writing_samples")


def add_sample(sample_id: str, text: str) -> None:
    collection.add(documents=[text], ids=[sample_id])


def query_samples(query_text: str, n_results: int = 3) -> list[str]:
    results = collection.query(query_texts=[query_text], n_results=n_results)
    return results["documents"][0]

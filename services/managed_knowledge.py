"""Atomic, immutable snapshots for documents managed through Knowledge Hub."""
import json
import os
import threading
import uuid
from pathlib import Path

import faiss
import numpy as np

_write_lock = threading.Lock()


def generation(directory):
    manifest = Path(directory) / 'managed' / 'current.json'
    return manifest.read_text(encoding='utf-8') if manifest.exists() else None


def read_snapshot(directory, dimension, token=None):
    token = generation(directory) if token is None else token
    if token is None:
        return faiss.IndexFlatIP(dimension), []
    name = json.loads(token)['generation']
    if str(uuid.UUID(name)) != name:
        raise ValueError('Invalid knowledge generation')
    root = Path(directory) / 'managed'
    index = faiss.read_index(str(root / f'{name}.faiss'))
    records = json.loads((root / f'{name}.json').read_text(encoding='utf-8'))
    if index.d != dimension or index.ntotal != len(records):
        raise ValueError('Knowledge snapshot does not match its metadata')
    return index, records


def replace_document(directory, dimension, document_id, chunks, vectors=None, family_id=None,
                     operation_id=None, replace_family=True):
    """Replace one document, preserving other documents. Empty chunks archive it."""
    with _write_lock:
        token = generation(directory)
        manifest = json.loads(token) if token else {}
        controls = manifest.get('operations', {})
        family = family_id or document_id
        previous = controls.get(family)
        kind = 'publish' if chunks else 'withdraw'
        if previous:
            if operation_id is None or operation_id < previous['id']:
                raise ValueError('Stale knowledge operation')
            if operation_id == previous['id']:
                if previous['document_id'] != document_id or previous['kind'] != kind:
                    raise ValueError('Operation identity does not match')
                return manifest['generation']
        index, records = read_snapshot(directory, dimension, token)
        keep = [i for i, chunk in enumerate(records)
                if chunk['document_id'] != document_id
                and (not replace_family or family_id is None or chunk.get('family_id', chunk['document_id']) != family_id)]
        updated = faiss.IndexFlatIP(dimension)
        if keep:
            updated.add(np.asarray([index.reconstruct(i) for i in keep], dtype=np.float32))
        if chunks:
            vectors = np.asarray(vectors, dtype=np.float32)
            if vectors.shape != (len(chunks), dimension) or not np.isfinite(vectors).all():
                raise ValueError('Invalid embedding response')
            if np.any(np.linalg.norm(vectors, axis=1) == 0):
                raise ValueError('Embedding response contains a zero vector')
            faiss.normalize_L2(vectors)
            updated.add(vectors)
        new_records = [records[i] for i in keep] + chunks
        root = Path(directory) / 'managed'
        root.mkdir(parents=True, exist_ok=True)
        name = str(uuid.uuid4())
        faiss.write_index(updated, str(root / f'{name}.faiss'))
        (root / f'{name}.json').write_text(json.dumps(new_records, ensure_ascii=False), encoding='utf-8')
        temporary = root / f'{name}.manifest'
        if operation_id is not None:
            controls[family] = {'id': operation_id, 'document_id': document_id, 'kind': kind}
        temporary.write_text(json.dumps({'generation': name, 'operations': controls}), encoding='utf-8')
        os.replace(temporary, root / 'current.json')
        return name


def stage_document(directory, document_id, chunks, vectors):
    """Persist embedded chunks without making them visible to retrieval."""
    root = Path(directory) / 'managed' / 'staged'
    root.mkdir(parents=True, exist_ok=True)
    chunks_path = root / f'{document_id}.json'
    vectors_path = root / f'{document_id}.npy'
    vectors = np.asarray(vectors, dtype=np.float32)
    if vectors.ndim != 2 or len(vectors) != len(chunks) or not np.isfinite(vectors).all():
        raise ValueError('Invalid staged embedding response')
    if np.any(np.linalg.norm(vectors, axis=1) == 0):
        raise ValueError('Staged embeddings contain a zero vector')
    evidence_root = Path(directory) / 'managed' / 'revisions'
    evidence_root.mkdir(parents=True, exist_ok=True)
    evidence = evidence_root / f'{document_id}.json'
    if evidence.exists():
        original = json.loads(evidence.read_text(encoding='utf-8'))
        stable = lambda rows: [{k: v for k, v in row.items() if k != 'updated_at'} for row in rows]
        if stable(original) != stable(chunks):
            raise ValueError('Revision content and metadata are immutable; create a new revision')
        chunks = original
    temporary_vectors = root / f'{document_id}.npy.tmp'
    with temporary_vectors.open('wb') as stream:
        np.save(stream, vectors, allow_pickle=False)
    os.replace(temporary_vectors, vectors_path)
    temporary_chunks = root / f'{document_id}.json.tmp'
    temporary_chunks.write_text(json.dumps(chunks, ensure_ascii=False), encoding='utf-8')
    os.replace(temporary_chunks, chunks_path)
    if not evidence.exists():
        temporary_evidence = evidence.with_suffix('.tmp')
        temporary_evidence.write_text(json.dumps(chunks, ensure_ascii=False), encoding='utf-8')
        os.replace(temporary_evidence, evidence)


def publish_staged_document(directory, dimension, document_id, operation_id=None):
    root = Path(directory) / 'managed' / 'staged'
    chunks_path = root / f'{document_id}.json'
    vectors_path = root / f'{document_id}.npy'
    if not chunks_path.exists() or not vectors_path.exists():
        raise FileNotFoundError('Staged document is unavailable; retry processing')
    chunks = json.loads(chunks_path.read_text(encoding='utf-8'))
    vectors = np.load(vectors_path, allow_pickle=False)
    family_id = chunks[0].get('family_id', document_id)
    if any(c.get('family_id', c['document_id']) != family_id or c['document_id'] != document_id for c in chunks):
        raise ValueError('Revision metadata does not match the publication request')
    published = [{**c, 'review_status': 'approved', 'publication_status': 'published'} for c in chunks]
    generation_name = replace_document(directory, dimension, document_id, published, vectors, family_id=family_id, operation_id=operation_id)
    # Keep staged vectors so a lost publication response can be retried without embedding again.
    return generation_name, len(chunks)


def discard_staged_document(directory, document_id):
    root = Path(directory) / 'managed' / 'staged'
    (root / f'{document_id}.json').unlink(missing_ok=True)
    (root / f'{document_id}.npy').unlink(missing_ok=True)

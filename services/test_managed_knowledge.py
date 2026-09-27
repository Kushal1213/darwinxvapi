import importlib.util
import json
import os
import tempfile
import unittest
import uuid
from pathlib import Path
from unittest.mock import patch
from types import SimpleNamespace

import faiss
import numpy as np
from fastapi.testclient import TestClient
from managed_knowledge import generation, read_snapshot, replace_document, stage_document, publish_staged_document


def service(name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).parent / name / 'main.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class KnowledgeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.env = patch.dict(os.environ, {'FAISS_INDEX_PATH': str(self.root), 'GEMINI_API_KEY': ''})
        self.env.start()
        self.addCleanup(self.env.stop)

    def test_atomic_replace_retry_archive_and_validation(self):
        first, second = str(uuid.uuid4()), str(uuid.uuid4())
        replace_document(self.root, 3, first, [{'document_id': first}], [[1, 0, 0]])
        replace_document(self.root, 3, second, [{'document_id': second}], [[0, 1, 0]])
        replace_document(self.root, 3, first, [{'document_id': first}], [[0, 0, 1]])
        index, rows = read_snapshot(self.root, 3)
        self.assertEqual(index.ntotal, 2)
        token = generation(self.root)
        with patch('managed_knowledge.os.replace', side_effect=OSError('disk failure')):
            with self.assertRaises(OSError):
                replace_document(self.root, 3, first, [])
        self.assertEqual(generation(self.root), token)
        replace_document(self.root, 3, first, [])
        self.assertEqual([r['document_id'] for r in read_snapshot(self.root, 3)[1]], [second])
        with self.assertRaises(ValueError):
            replace_document(self.root, 3, second, [{'document_id': second}], [[float('nan'), 0, 0]])

    def test_publication_operations_fence_stale_retries_and_survive_manifest_failure(self):
        first, second = str(uuid.uuid4()), str(uuid.uuid4())
        stage_document(self.root, first, [{'document_id': first, 'family_id': first}], [[1, 0, 0]])
        stage_document(self.root, second, [{'document_id': second, 'family_id': first}], [[0, 1, 0]])
        publish_staged_document(self.root, 3, first, operation_id=10)
        initial = generation(self.root)
        publish_staged_document(self.root, 3, first, operation_id=10)
        self.assertEqual(generation(self.root), initial)
        with patch('managed_knowledge.os.replace', side_effect=OSError('disk failure')):
            with self.assertRaises(OSError):
                publish_staged_document(self.root, 3, second, operation_id=20)
        self.assertEqual(generation(self.root), initial)
        publish_staged_document(self.root, 3, second, operation_id=20)
        with self.assertRaises(ValueError):
            publish_staged_document(self.root, 3, first, operation_id=10)
        # Withdrawal and its fence become visible in the SAME manifest swap.
        replace_document(self.root, 3, second, [], family_id=first, operation_id=30, replace_family=False)
        withdrawn = generation(self.root)
        with self.assertRaises(ValueError):
            publish_staged_document(self.root, 3, second, operation_id=20)
        with self.assertRaises(ValueError):
            publish_staged_document(self.root, 3, second)
        replace_document(self.root, 3, second, [], family_id=first, operation_id=30, replace_family=False)
        self.assertEqual(generation(self.root), withdrawn)
        self.assertEqual(read_snapshot(self.root, 3)[0].ntotal, 0)

    def test_ingestion_short_text_retry_errors_and_pii(self):
        ingestion = service('ingestion-service')
        ingestion.GEMINI_API_KEY = 'fake-test-key'
        doc = str(uuid.uuid4())
        def embed(**kwargs):
            return {'embedding': [[1.0] + [0.0] * 3071 for _ in kwargs['content']]}
        with patch.object(ingestion.genai, 'embed_content', side_effect=embed), TestClient(ingestion.app) as client:
            def upload(content, filename='policy.txt'):
                return client.put('/documents/' + doc, data={'title': 'Policy'},
                                  files={'file': (filename, content)})
            for attempt in range(2):
                response = upload(b'Contact policy@example.test')
                self.assertEqual(response.status_code, 200, response.text)
                self.assertEqual(response.json()['chunks_added'], 1)
                self.assertTrue(response.json()['pii_detected'])
                self.assertTrue(response.json()['staged'])
                self.assertEqual(read_snapshot(self.root, 3072)[0].ntotal, attempt)
                self.assertEqual(client.post('/documents/' + doc + '/publish').status_code, 200)
            self.assertEqual(len(client.get('/documents/' + doc + '/chunks').json()['chunks']), 1)
            self.assertEqual(upload(b'').status_code, 422)
            self.assertEqual(upload(b'not a PDF', 'policy.pdf').status_code, 422)
            self.assertEqual(upload(b'x', 'policy.exe').status_code, 400)
            with patch.object(ingestion.genai, 'embed_content', side_effect=RuntimeError('provider')):
                self.assertEqual(upload(b'Updated policy').status_code, 503)
            self.assertEqual(read_snapshot(self.root, 3072)[0].ntotal, 1)
            self.assertEqual(client.delete('/documents/' + doc).status_code, 200)
            self.assertEqual(len(client.get('/documents/' + doc + '/chunks').json()['chunks']), 1)
            self.assertEqual(read_snapshot(self.root, 3072)[0].ntotal, 0)

    def test_revisions_replace_atomically_and_preserve_evidence_and_citations(self):
        ingestion = service('ingestion-service')
        ingestion.GEMINI_API_KEY = 'fake-test-key'
        rag = service('rag-service')
        first, second, unrelated = [str(uuid.uuid4()) for _ in range(3)]
        def embed(**kwargs):
            return {'embedding': [[1.0] + [0.0] * 3071 for _ in kwargs['content']]}
        with patch.object(ingestion.genai, 'embed_content', side_effect=embed), TestClient(ingestion.app) as client, TestClient(rag.app) as reader:
            def upload(doc, family, revision, content):
                return client.put('/documents/' + doc, data={'title': 'Policy', 'family_id': family, 'revision': revision}, files={'file': ('policy.txt', content)})
            self.assertEqual(upload(first, first, 1, b'Personal loan minimum age is 21 years.').status_code, 200)
            self.assertEqual(client.post('/documents/' + first + '/publish').status_code, 200)
            self.assertEqual(upload(unrelated, unrelated, 1, b'Other policy covers insurance.').status_code, 200)
            self.assertEqual(client.post('/documents/' + unrelated + '/publish').status_code, 200)
            self.assertEqual(upload(second, first, 2, b'Personal loan minimum age is 25 years.').status_code, 200)
            def answer():
                return reader.post('/retrieve', json={'query': 'What is the minimum age for personal loan?', 'market': 'india', 'top_k': 1}).json()
            self.assertEqual(answer()['sources'][0]['document_id'], first)
            token = generation(self.root)
            with patch('managed_knowledge.os.replace', side_effect=OSError('disk failure')):
                self.assertEqual(client.post('/documents/' + second + '/publish').status_code, 503)
            self.assertEqual(generation(self.root), token)
            self.assertEqual(answer()['sources'][0]['document_id'], first)
            for _ in range(2):
                self.assertEqual(client.post('/documents/' + second + '/publish').status_code, 200)
                self.assertEqual(read_snapshot(self.root, 3072)[0].ntotal, 2)
            source = answer()['sources'][0]
            self.assertEqual(source['document_id'], second)
            self.assertEqual(source['family_id'], first)
            self.assertEqual(source['revision'], 2)
            self.assertEqual(len(source['content_hash']), 64)
            self.assertIn('21 years', client.get('/documents/' + first + '/chunks').json()['chunks'][0]['content'])
            self.assertEqual(upload(second, first, 2, b'Changed behind approval.').status_code, 503)
            self.assertEqual(client.delete('/documents/' + first).status_code, 200)
            self.assertEqual(answer()['sources'][0]['document_id'], second)
            self.assertEqual(client.delete('/documents/' + second).status_code, 200)
            self.assertEqual([row['document_id'] for row in read_snapshot(self.root, 3072)[1]], [unrelated])
            self.assertIn('25 years', client.get('/documents/' + second + '/chunks').json()['chunks'][0]['content'])
            self.assertEqual(client.post('/documents/' + second + '/publish').status_code, 409)

    def test_staged_ingestion_is_invisible_until_explicit_publication(self):
        ingestion = service('ingestion-service')
        ingestion.GEMINI_API_KEY = 'fake-test-key'
        doc = str(uuid.uuid4())
        content = b'Veyra staged policy content remains private before approval.'
        def embed(**kwargs):
            return {'embedding': [[1.0] + [0.0] * 3071 for _ in kwargs['content']]}
        with patch.object(ingestion.genai, 'embed_content', side_effect=embed), TestClient(ingestion.app) as client:
            result = client.put('/documents/' + doc, data={'title': 'Staged'},
                                files={'file': ('staged.txt', content)})
            self.assertEqual(result.status_code, 200, result.text)
            self.assertTrue(result.json()['staged'])
            self.assertEqual(read_snapshot(self.root, 3072)[0].ntotal, 0)
            self.assertEqual(client.get('/documents/' + doc + '/chunks').json()['chunks'][0]['content'], content.decode())
            published = client.post('/documents/' + doc + '/publish')
            self.assertEqual(published.status_code, 200, published.text)
            self.assertEqual(read_snapshot(self.root, 3072)[0].ntotal, 1)
            self.assertEqual(client.get('/documents/' + doc + '/chunks').json()['chunks'][0]['content'], content.decode())
            with patch.object(ingestion.genai, 'embed_content', side_effect=AssertionError('Must reuse completed embeddings')):
                evidence = self.root / 'managed' / 'revisions' / f'{doc}.json'
                evidence.unlink()
                resumed = client.put('/documents/' + doc, data={'title': 'Staged'}, files={'file': ('staged.txt', content)})
                self.assertEqual(resumed.status_code, 200, resumed.text)
                self.assertTrue(resumed.json()['reused'])
                self.assertEqual(json.loads(evidence.read_text())[0]['content'], content.decode())

    def test_pdf_pages_preserve_text_without_treating_blank_pages_as_content(self):
        ingestion = service('ingestion-service')
        with patch.object(ingestion, 'PdfReader', return_value=SimpleNamespace(pages=[
            SimpleNamespace(extract_text=lambda: 'Short policy.'),
            SimpleNamespace(extract_text=lambda: ''),
        ])):
            self.assertEqual(ingestion.extract_pdf_text(b'fixture'), '[PAGE 1]\n\nShort policy.')
        with patch.object(ingestion, 'PdfReader', return_value=SimpleNamespace(pages=[
            SimpleNamespace(extract_text=lambda: None),
        ])):
            self.assertEqual(ingestion.extract_pdf_text(b'fixture'), '')

    def test_rag_reload_preserves_legacy_and_fails_closed(self):
        legacy = faiss.IndexFlatIP(3072)
        legacy.add(np.ones((1, 3072), dtype=np.float32))
        faiss.write_index(legacy, str(self.root / 'index.faiss'))
        (self.root / 'metadata.json').write_text(json.dumps([{
            'content': 'Legacy policy', 'source': 'legacy', 'market': 'india',
        }]), encoding='utf-8')
        rag = service('rag-service')
        with TestClient(rag.app) as client:
            doc = str(uuid.uuid4())
            replace_document(self.root, 3072, doc, [{
                'document_id': doc, 'chunk_id': doc + ':0', 'source': 'new.txt',
                'content': 'Zircon policy is active.', 'market': 'india',
            }], np.ones((1, 3072)))
            result = client.post('/retrieve', json={'query': 'zircon'}).json()
            self.assertEqual(result['sources'][0]['document_id'], doc)
            replace_document(self.root, 3072, doc, [])
            result = client.post('/retrieve', json={'query': 'zircon'}).json()
            self.assertEqual(result['sources'], [])
            self.assertEqual(rag.load_index()[0].ntotal, 1)
            (self.root / 'managed' / 'current.json').write_text('broken', encoding='utf-8')
            self.assertEqual(client.post('/retrieve', json={'query': 'policy'}).status_code, 503)

    def test_retrieval_enforces_market_product_and_abstains_without_evidence(self):
        rag = service('rag-service')
        india = {'content': 'India personal loan age minimum is 21.', 'source': 'india', 'market': 'india', 'product': 'personal-loan'}
        philippines = {'content': 'Philippines personal loan age minimum is 25.', 'source': 'ph', 'market': 'philippines', 'product': 'personal-loan'}
        auto = {'content': 'Auto loan age minimum is 18.', 'source': 'auto', 'market': 'india', 'product': 'auto-loan'}
        insurance = {'content': 'Insurance grace period is 30 days.', 'source': 'ins', 'market': 'india', 'product': 'life-insurance'}
        draft = {'content': 'Draft loan fee is 99.', 'source': 'draft', 'market': 'india', 'product': 'personal-loan', 'publication_status': 'unpublished', 'review_status': 'draft'}

        self.assertEqual(rag.canonical_market('india-loan'), 'india')
        self.assertEqual(rag.canonical_market('india-insurance'), 'india')
        self.assertEqual(rag.select_market_chunks([india, philippines], 'india', 2), [india])
        self.assertEqual(rag.select_market_chunks([india, auto], 'india', 2, 'personal-loan'), [india])
        self.assertEqual(rag.select_market_chunks([india, auto], 'india-loan', 2, 'loan'), [india, auto])
        self.assertEqual(rag.select_market_chunks([india, insurance], 'india-insurance', 2, 'insurance'), [insurance])
        self.assertEqual(rag.select_market_chunks([draft, india], 'india', 2, 'personal-loan'), [india])
        self.assertEqual(rag.lexical_candidates('personal loan age minimum', 'india', [india, philippines, auto, draft], 'personal-loan')[0]['source'], 'india')
        self.assertIn('couldn\'t find a clear answer', rag.synthesize_direct_knowledge_answer('What is the interest rate?', [india]))
        self.assertEqual(rag.abstention_reason(rag.synthesize_direct_knowledge_answer('What is the interest rate?', [india])), 'insufficient_support')
        self.assertNotIn('70%', rag.synthesize_direct_knowledge_answer('What is the LTV for property?', [india]))

        with TestClient(rag.app) as client:
            self.assertEqual(client.post('/retrieve', json={'query': 'loan', 'market': 'mars'}).status_code, 422)

    def test_short_query_terms_and_product_filters_in_both_retrieval_modes(self):
        rag = service('rag-service')
        records = [
            {'document_id': 'loan', 'source': 'loan', 'market': 'india', 'product': 'personal-loan', 'content': 'Minimum age: 25 years.\nThe fee is 50 rupees.'},
            {'document_id': 'insurance', 'source': 'insurance', 'market': 'india', 'product': 'life-insurance', 'content': 'Minimum age: 18 years.\nThe grace period is 30 days.'},
            {'document_id': 'unclassified', 'source': 'unclassified', 'market': 'india', 'content': 'Minimum age: 99 years.'},
        ]
        for record in records:
            replace_document(self.root, 3072, record['document_id'], [record], np.ones((1, 3072)))
        with TestClient(rag.app) as client:
            for mode in ['lexical', 'vector']:
                rag.GEMINI_API_KEY = '' if mode == 'lexical' else 'test-fixture'
                with patch.object(rag, 'embed_query_fast', return_value=np.ones((1, 3072), dtype=np.float32)):
                    for question in ['What is the minimum age?', 'What is the minimum age for a personal loan?', 'What is the fee?']:
                        result = client.post('/retrieve', json={'query': question, 'market': 'india-loan'}).json()
                        self.assertEqual(result['retrieval_mode'], mode)
                        self.assertEqual([s['source'] for s in result['sources']], ['loan'])
                        self.assertNotIn('99', result['answer'])
                    unsupported = client.post('/retrieve', json={'query': 'What is the insurance grace period?', 'market': 'india', 'product': 'loan'}).json()
                    self.assertEqual(unsupported['sources'], [])
                    self.assertIsNotNone(unsupported['abstention_reason'])
            self.assertEqual(client.post('/retrieve', json={'query': ' ', 'market': 'india'}).status_code, 422)
            self.assertEqual(client.post('/retrieve', json={'query': 'age', 'market': 'india-loan', 'product': 'insurance'}).status_code, 422)
        self.assertFalse(rag.product_is_eligible(None, 'loan'))
        self.assertTrue(rag.product_is_eligible('general', 'loan'))
        self.assertIn("couldn't find", rag.synthesize_direct_knowledge_answer('What is the fee?', [{'content': 'Our feedback system is available.'}]))

    def test_empty_knowledge_is_an_explicit_abstention_not_a_service_outage(self):
        rag = service('rag-service')
        with TestClient(rag.app) as client:
            result = client.post('/retrieve', json={'query': 'What is the minimum age?', 'market': 'india-loan'})
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.json()['sources'], [])
            self.assertEqual(result.json()['abstention_reason'], 'knowledge_empty')


if __name__ == '__main__':
    unittest.main()

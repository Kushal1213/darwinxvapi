import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from gemini_provider import GeminiProvider


class GeminiProviderTests(unittest.TestCase):
    def test_embedding_contract_preserves_shape_and_retrieval_configuration(self):
        client = Mock()
        client.models.embed_content.return_value = SimpleNamespace(embeddings=[
            SimpleNamespace(values=[1.0, 2.0]),
            SimpleNamespace(values=[3.0, 4.0]),
        ])
        with patch('gemini_provider.genai.Client', return_value=client) as factory:
            provider = GeminiProvider()
            provider.configure('fixture-key')
            result = provider.embed_content(
                model='models/gemini-embedding-001',
                content=['one', 'two'],
                task_type='retrieval_document',
            )

        factory.assert_called_once_with(api_key='fixture-key')
        self.assertEqual(result, {'embedding': [[1.0, 2.0], [3.0, 4.0]]})
        call = client.models.embed_content.call_args.kwargs
        self.assertEqual(call['model'], 'models/gemini-embedding-001')
        self.assertEqual(call['contents'], ['one', 'two'])
        self.assertEqual(call['config'].task_type, 'RETRIEVAL_DOCUMENT')
        self.assertEqual(call['config'].output_dimensionality, 3072)

    def test_single_embedding_and_generation_have_stable_service_shapes(self):
        client = Mock()
        client.models.embed_content.return_value = SimpleNamespace(
            embeddings=[SimpleNamespace(values=[0.25, 0.75])]
        )
        client.models.generate_content.return_value = SimpleNamespace(text=' Grounded answer. ')
        with patch('gemini_provider.genai.Client', return_value=client):
            provider = GeminiProvider()
            provider.configure('fixture-key')
            embedding = provider.embed_content(
                model='models/gemini-embedding-001',
                content='question',
                task_type='retrieval_query',
            )
            answer = provider.generate_content(
                model='models/gemini-2.5-flash',
                content='prompt',
                temperature=0.2,
                max_output_tokens=300,
            )

        self.assertEqual(embedding, {'embedding': [0.25, 0.75]})
        self.assertEqual(answer, 'Grounded answer.')
        generation = client.models.generate_content.call_args.kwargs
        self.assertEqual(generation['contents'], 'prompt')
        self.assertEqual(generation['config'].temperature, 0.2)
        self.assertEqual(generation['config'].max_output_tokens, 300)

    def test_reconfiguration_closes_the_old_client_and_missing_key_fails_closed(self):
        first, second = Mock(), Mock()
        with patch('gemini_provider.genai.Client', side_effect=[first, second]):
            provider = GeminiProvider()
            with self.assertRaisesRegex(RuntimeError, 'not configured'):
                provider.embed_content(model='embedding', content='text', task_type='retrieval_query')
            provider.configure('first')
            provider.configure('second')
            first.close.assert_called_once_with()
            provider.close()
            second.close.assert_called_once_with()
            self.assertFalse(provider.configured)


if __name__ == '__main__':
    unittest.main()

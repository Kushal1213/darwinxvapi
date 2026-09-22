import express from 'express';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';
import axios from 'axios';
import { logger } from '../index.js';

const router = express.Router();
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * GET /api/vapi/assistant-config
 * Returns { assistantId } — created/upserted server-side via Vapi REST API.
 * Frontend calls vapi.start(assistantId) which is more reliable than inline config.
 *
 * Falls back to inline config object if VAPI_API_KEY is not set.
 */
router.get('/assistant-config', async (req, res) => {
  try {
    const market = req.query.market || 'india-loan';

    const agentMap = {
      'india-loan':       { name: 'Aria',  lang: 'en-IN', voice: 'aura-asteria-en' },
      'india-insurance':  { name: 'Priya', lang: 'en-IN', voice: 'aura-luna-en' },
      'ph-bancassurance': { name: 'Maria', lang: 'en-US', voice: 'aura-luna-en' },
      'id-finance':       { name: 'Dewi',  lang: 'id',    voice: 'aura-luna-en' },
    };
    const agent = agentMap[market] || agentMap['india-loan'];

    // Load system prompt
    let systemPrompt = `You are ${agent.name}, a professional AI voice agent for Darwix AI Financial Services helping customers with home loans and personal loans in India. Be concise — max 2 sentences per response. No bullet points or markdown.`;
    try {
      const promptsPath = join(__dirname, '../../../../services/rag-service/config/prompts.yaml');
      const yaml = readFileSync(promptsPath, 'utf-8');
      const parsed = parseYaml(yaml);
      if (parsed?.system_prompt) {
        systemPrompt = parsed.system_prompt + '\nBe concise. Max 2 sentences. No markdown or bullet points in voice.';
      }
    } catch (_e) { /* use default */ }

    const privateKey = process.env.VAPI_API_KEY;
    const publicUrl = process.env.PUBLIC_WEBHOOK_URL || '';
    const hasPublicUrl = publicUrl && !publicUrl.includes('localhost') && publicUrl.startsWith('https://');

    // ── Option A: Use Vapi REST API to create assistant (most reliable) ──
    if (privateKey && privateKey !== 'your_vapi_api_key') {
      try {
        const assistantPayload = {
          name: `Darwix-${agent.name}-${market}`,
          firstMessage: `Hello! I'm ${agent.name}, your Darwix AI financial assistant. How can I help you today?`,
          transcriber: {
            provider: 'deepgram',
            model: 'nova-2',
            language: agent.lang,
            smartFormat: true,
          },
          model: hasPublicUrl
            ? {
                provider: 'custom-llm',
                url: `${publicUrl}/api/voice/vapi-llm`,
                model: 'darwix-rag',
                messages: [{ role: 'system', content: systemPrompt }],
                temperature: 0.2,
                maxTokens: 200,
              }
            : {
                provider: 'openai',
                model: 'gpt-4o-mini',
                messages: [{ role: 'system', content: systemPrompt }],
                temperature: 0.2,
                maxTokens: 150,
              },
          voice: {
            provider: 'deepgram',
            voiceId: agent.voice,
          },
          silenceTimeoutSeconds: 30,
          maxDurationSeconds: 600,
          endCallMessage: `Thank you for speaking with ${agent.name}. Have a great day!`,
          ...(hasPublicUrl && {
            serverUrl: `${publicUrl}/api/voice/webhook`,
          }),
        };

        // Upsert: check if assistant already exists for this market
        const listResp = await axios.get('https://api.vapi.ai/assistant', {
          headers: { Authorization: `Bearer ${privateKey}` },
          params: { limit: 100 },
          timeout: 8000,
        });

        const existing = listResp.data?.find?.(a => a.name === assistantPayload.name);

        let assistantId;
        if (existing) {
          // Update existing assistant
          const updateResp = await axios.patch(
            `https://api.vapi.ai/assistant/${existing.id}`,
            assistantPayload,
            { headers: { Authorization: `Bearer ${privateKey}` }, timeout: 8000 }
          );
          assistantId = updateResp.data.id;
          logger.info({ assistantId, market }, 'Vapi assistant updated');
        } else {
          // Create new assistant
          const createResp = await axios.post(
            'https://api.vapi.ai/assistant',
            assistantPayload,
            { headers: { Authorization: `Bearer ${privateKey}` }, timeout: 8000 }
          );
          assistantId = createResp.data.id;
          logger.info({ assistantId, market }, 'Vapi assistant created');
        }

        return res.json({ assistantId, mode: hasPublicUrl ? 'rag-grounded' : 'built-in' });
      } catch (vapiErr) {
        logger.error({ err: vapiErr?.response?.data || vapiErr.message }, 'Vapi API call failed, falling back to inline config');
        // Fall through to inline config
      }
    }

    // ── Option B: Inline config fallback (no Vapi API key or API call failed) ──
    logger.warn('Using inline assistant config fallback');
    const inlineConfig = {
      name: `${agent.name} - Darwix AI Voice Agent`,
      firstMessage: `Hello! I'm ${agent.name}, your Darwix AI financial assistant. How can I help?`,
      transcriber: { provider: 'deepgram', model: 'nova-2', language: agent.lang },
      model: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemPrompt }],
        temperature: 0.2,
        maxTokens: 150,
      },
      voice: { provider: 'deepgram', voiceId: agent.voice },
      silenceTimeoutSeconds: 30,
      maxDurationSeconds: 600,
    };
    res.json(inlineConfig);

  } catch (err) {
    logger.error(err, 'Failed to build Vapi assistant config');
    res.status(500).json({ error: 'Config generation failed', message: err.message });
  }
});

export default router;

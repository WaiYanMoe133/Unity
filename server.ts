import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {GoogleGenAI, ThinkingLevel, Type} from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

function getConfiguredApiKeys(): string[] {
  const candidates = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_BACKUP,
    process.env.gemini,
  ];
  const unique: string[] = [];
  for (const key of candidates) {
    if (
      typeof key === 'string' &&
      key.trim() !== '' &&
      key !== 'MY_GEMINI_API_KEY' &&
      !unique.includes(key.trim())
    ) {
      unique.push(key.trim());
    }
  }
  return unique;
}

function createGeminiClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function extractErrorInfo(err: unknown): {status: number; message: string} {
  const message = err instanceof Error ? err.message : String(err ?? 'Unknown error');
  const rawStatus =
    typeof err === 'object' && err !== null && 'status' in err
      ? Number((err as {status?: unknown}).status)
      : NaN;

  if (!Number.isNaN(rawStatus) && rawStatus >= 400) {
    return {status: rawStatus, message};
  }
  if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
    return {status: 429, message};
  }
  if (message.includes('503') || message.includes('UNAVAILABLE')) {
    return {status: 503, message};
  }
  if (message.includes('403') || message.includes('PERMISSION_DENIED')) {
    return {status: 403, message};
  }
  if (message.includes('400') || message.includes('API_KEY_INVALID') || message.includes('INVALID_ARGUMENT')) {
    return {status: 400, message};
  }
  return {status: 500, message};
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let preferredKeyIndex = 0;

const GEMINI_FALLBACK_MODELS = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'] as const;

async function generateWithResilience<T>(
  operation: (ai: GoogleGenAI, model: string) => Promise<T>,
  models: readonly string[] = GEMINI_FALLBACK_MODELS,
): Promise<T> {
  const keys = getConfiguredApiKeys();
  if (keys.length === 0) {
    const missingErr = new Error('Gemini API key is not configured in Settings > Secrets.');
    (missingErr as Error & {code?: string}).code = 'MISSING_API_KEY';
    throw missingErr;
  }

  // Try the most recently working key first to avoid repeated 429/403 delays
  const order = keys.map((_, idx) => (preferredKeyIndex + idx) % keys.length);

  let lastError: unknown;
  for (let mIdx = 0; mIdx < models.length; mIdx++) {
    const model = models[mIdx];
    for (let i = 0; i < order.length; i++) {
      const keyIdx = order[i];
      const ai = createGeminiClient(keys[keyIdx]);
      try {
        const result = await operation(ai, model);
        preferredKeyIndex = keyIdx;
        return result;
      } catch (err: unknown) {
        lastError = err;
        const {status} = extractErrorInfo(err);
        // On 429, 403, 400, or 503 try next key, then next fallback model
        if (status === 429 || status === 403 || status === 400 || status === 503) {
          continue;
        }
        throw err;
      }
    }
    if (mIdx < models.length - 1) {
      await sleep(300);
    }
  }
  throw lastError;
}

function parseJsonPayload(rawText: string): unknown {
  const trimmed = rawText.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(candidate);
}

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function encodeMimeHeaderUtf8(text: string): string {
  const clean = sanitizeHeaderValue(text);
  // RFC 2047 UTF-8 Base64 header encoding for Burmese/Unicode subjects
  if (/^[\x20-\x7E]*$/.test(clean)) {
    return clean;
  }
  return `=?UTF-8?B?${Buffer.from(clean, 'utf8').toString('base64')}?=`;
}

function wrapBase64(b64: string, lineLen = 76): string {
  const lines: string[] = [];
  for (let i = 0; i < b64.length; i += lineLen) {
    lines.push(b64.slice(i, i + lineLen));
  }
  return lines.join('\r\n');
}

type ExternalSearchProvider = 'tavily' | 'serper' | 'brave';

interface ExternalSearchEntry {
  provider: ExternalSearchProvider;
  label: string;
  apiKey: string;
}

interface WebSearchSnippet {
  title: string;
  uri: string;
  snippet: string;
}

function getExternalSearchEntries(): ExternalSearchEntry[] {
  const entries: ExternalSearchEntry[] = [];
  const candidates: {provider: ExternalSearchProvider; label: string; keys: (string | undefined)[]}[] = [
    {
      provider: 'tavily',
      label: 'Tavily Search API',
      keys: [process.env.TAVILY_API_KEY, process.env.tavily],
    },
    {
      provider: 'serper',
      label: 'Serper Google Search API',
      keys: [process.env.SERPER_API_KEY, process.env.serper],
    },
    {
      provider: 'brave',
      label: 'Brave Search API',
      keys: [process.env.BRAVE_SEARCH_API_KEY, process.env.brave],
    },
  ];

  for (const c of candidates) {
    const valid = c.keys.find(
      (k) => typeof k === 'string' && k.trim() !== '' && !k.trim().startsWith('MY_'),
    );
    if (valid) {
      entries.push({provider: c.provider, label: c.label, apiKey: valid.trim()});
    }
  }
  return entries;
}

function isSafeHttpUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

async function searchWithTavily(query: string, apiKey: string): Promise<WebSearchSnippet[]> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: 'basic',
      max_results: 3,
      include_answer: false,
    }),
    signal: AbortSignal.timeout(6000),
  });
  const data = (await res.json().catch(() => ({}))) as {
    results?: {title?: string; url?: string; content?: string}[];
    detail?: {error?: string} | string;
    error?: string;
  };
  if (!res.ok) {
    const detail =
      typeof data.detail === 'string'
        ? data.detail
        : data.detail?.error || data.error || `HTTP ${res.status}`;
    throw new Error(`Tavily Search error (${res.status}): ${detail}`);
  }
  const results = Array.isArray(data.results) ? data.results : [];
  return results
    .filter((r) => isSafeHttpUrl(r.url))
    .map((r) => ({
      title: String(r.title || r.url),
      uri: String(r.url),
      snippet: String(r.content || '').slice(0, 360),
    }));
}

async function searchWithSerper(query: string, apiKey: string): Promise<WebSearchSnippet[]> {
  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({q: query, num: 3}),
    signal: AbortSignal.timeout(6000),
  });
  const data = (await res.json().catch(() => ({}))) as {
    organic?: {title?: string; link?: string; snippet?: string; date?: string}[];
    message?: string;
  };
  if (!res.ok) {
    throw new Error(`Serper Search error (${res.status}): ${data.message || `HTTP ${res.status}`}`);
  }
  const organic = Array.isArray(data.organic) ? data.organic : [];
  return organic
    .filter((r) => isSafeHttpUrl(r.link))
    .map((r) => ({
      title: String(r.title || r.link),
      uri: String(r.link),
      snippet: `${r.date ? `[${r.date}] ` : ''}${String(r.snippet || '')}`.slice(0, 360),
    }));
}

async function searchWithBrave(query: string, apiKey: string): Promise<WebSearchSnippet[]> {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=3`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'X-Subscription-Token': apiKey,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(6000),
  });
  const data = (await res.json().catch(() => ({}))) as {
    web?: {results?: {title?: string; url?: string; description?: string}[]};
    message?: string;
  };
  if (!res.ok) {
    throw new Error(`Brave Search error (${res.status}): ${data.message || `HTTP ${res.status}`}`);
  }
  const results = Array.isArray(data.web?.results) ? data.web.results : [];
  return results
    .filter((r) => isSafeHttpUrl(r.url))
    .map((r) => ({
      title: String(r.title || r.url),
      uri: String(r.url),
      snippet: String(r.description || '').slice(0, 360),
    }));
}

async function buildSearchQueries(prompt: string): Promise<string[]> {
  // Strip email addresses before sending any query to external search APIs
  const sanitized = prompt
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, ' ')
    .replace(/\bopenclew\b/gi, 'OpenClaw')
    .trim();

  const lower = sanitized.toLowerCase();
  const entityQueries: string[] = [];
  if (lower.includes('activepieces')) {
    entityQueries.push('Activepieces 2026 workflow automation AI MCP pricing license updates');
  }
  if (lower.includes('n8n')) {
    entityQueries.push('n8n 2026 AI agents MCP workflow automation pricing license updates');
  }
  if (lower.includes('openclaw')) {
    entityQueries.push('OpenClaw 2026 AI agent framework architecture license features updates');
  }
  if (entityQueries.length > 0) {
    return entityQueries;
  }

  // Extract ASCII keywords if mixed language; otherwise ask Gemini (without grounding) for clean queries
  const asciiWords = sanitized.match(/[a-zA-Z0-9._-]+/g)?.filter((w) => w.length > 1) ?? [];
  if (asciiWords.length >= 2) {
    const joined = asciiWords.join(' ').slice(0, 140);
    return [joined.includes('2026') ? joined : `${joined} 2026`];
  }

  try {
    const queryResp = await generateWithResilience((ai, model) =>
      ai.models.generateContent({
        model,
        contents: `Convert this research request into 2 concise English web search queries (no email addresses, max 10 words each):\n\n"${sanitized}"`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              queries: {type: Type.ARRAY, items: {type: Type.STRING}},
            },
            required: ['queries'],
          },
        },
      }),
    );
    const parsed = parseJsonPayload(queryResp.text ?? '{}') as {queries?: unknown};
    if (Array.isArray(parsed.queries) && parsed.queries.length > 0) {
      return parsed.queries
        .filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
        .slice(0, 3);
    }
  } catch {
    // Fall back to sanitized prompt
  }

  return [sanitized.slice(0, 140)];
}

async function runExternalWebSearch(prompt: string): Promise<{
  providerLabel: string;
  snippets: WebSearchSnippet[];
}> {
  const providers = getExternalSearchEntries();
  if (providers.length === 0) {
    throw new Error('NO_EXTERNAL_SEARCH_KEY');
  }

  const queries = await buildSearchQueries(prompt);
  let lastErr: unknown;

  for (const entry of providers) {
    try {
      const searchFn =
        entry.provider === 'tavily'
          ? searchWithTavily
          : entry.provider === 'serper'
            ? searchWithSerper
            : searchWithBrave;

      const batches = await Promise.all(queries.map((q) => searchFn(q, entry.apiKey)));
      const deduped: WebSearchSnippet[] = [];
      const seen = new Set<string>();

      for (const batch of batches) {
        for (const item of batch) {
          if (!seen.has(item.uri)) {
            seen.add(item.uri);
            deduped.push(item);
          }
        }
      }

      if (deduped.length === 0) {
        throw new Error(`${entry.label} returned 0 web results.`);
      }

      return {
        providerLabel: entry.label,
        snippets: deduped.slice(0, 9),
      };
    } catch (err: unknown) {
      lastErr = err;
      console.error(`[external-search:${entry.provider}]`, err instanceof Error ? err.message : err);
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error('External web search failed.');
}

async function startServer() {
  const app = express();
  app.use(express.json({limit: '12mb'}));

  app.get('/api/health', (_req, res) => {
    const keys = getConfiguredApiKeys();
    const ext = getExternalSearchEntries();
    res.json({
      status: 'ok',
      plannerReady: keys.length > 0,
      backupKeyConfigured: keys.length > 1,
      externalSearchReady: ext.length > 0,
      searchProvider: ext[0]?.label ?? 'Gemini Search Grounding',
      providers: {
        tavily: ext.some((e) => e.provider === 'tavily'),
        serper: ext.some((e) => e.provider === 'serper'),
        brave: ext.some((e) => e.provider === 'brave'),
      },
      model: 'gemini-4-hydrogen',
    });
  });

  app.post('/api/plan-task', async (req, res) => {
    try {
      const {prompt, operatingMode = 'hybrid', targetOs = 'windows'} = req.body ?? {};

      if (typeof prompt !== 'string' || prompt.trim().length < 3) {
        res.status(400).json({
          error: 'Please enter a valid task instruction (at least 3 characters).',
        });
        return;
      }

      const keys = getConfiguredApiKeys();
      if (keys.length === 0) {
        res.status(503).json({
          error:
            'Gemini API key is not configured in Settings > Secrets. You can still test the full execution engine using any of the Preset Scenarios.',
          code: 'MISSING_API_KEY',
        });
        return;
      }

      const adapterPriority =
        targetOs === 'windows'
          ? 'Office.js (Primary) -> Microsoft Office COM (Secondary) -> Direct OOXML'
          : targetOs === 'linux'
            ? 'LibreOffice UNO (Primary) -> Direct OOXML / Filesystem'
            : 'Office.js (Primary) -> AppleScript / LibreOffice UNO -> Direct OOXML';

      const systemInstruction = `You are the Planner Agent inside the Moe Technologies Universal AI Workforce Platform (Technical Blueprint v2.0).
Your strict architectural rule: The AI Brain decides WHAT should be done by emitting a validated Universal Task IR v1.0 JSON plan. You NEVER emit raw shell commands or bypass capability negotiation.

Context:
- Operating Mode: ${operatingMode} (local = local LLM/ONNX priority, hybrid = cloud reasoning + local execution, cloud = cloud-enhanced)
- Target OS: ${targetOs}
- Office/OS Adapter Priority: ${adapterPriority}

Risk Classification Rules (Blueprint Section 13):
- LOW: Read permitted files, search, analyze documents. (approval.required = false)
- MEDIUM: Create documents, edit files, modify spreadsheet data. (approval.required = true)
- HIGH: Send emails, publish content, delete files, modify important system settings. (approval.required = true)
- CRITICAL: Execute unknown native code, access protected credentials, destructive system operations. (approval.required = true)

If the user asks to research online, create a report/Excel table, or send an email, set liveResearchMode=true and extract emailRecipient if an email address is mentioned.
Generate a concise, realistic Universal Task IR v1.0 plan with 4 to 6 semantic execution steps assigned across Moe's specialized agents and an accurate preview of the final output artifact.`;

      const response = await generateWithResilience((ai, model) =>
        ai.models.generateContent({
          model,
          contents: `Plan this user directive into Universal Task IR v1.0:\n\n"${prompt.trim()}"`,
          config: {
            systemInstruction,
            thinkingConfig: {thinkingLevel: ThinkingLevel.LOW},
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: {type: Type.STRING},
                summary: {type: Type.STRING},
                selectedModel: {type: Type.STRING},
                routingRationale: {type: Type.STRING},
                liveResearchMode: {type: Type.BOOLEAN},
                emailRecipient: {type: Type.STRING},
                ir: {
                  type: Type.OBJECT,
                  properties: {
                    schema_version: {type: Type.STRING},
                    task_id: {type: Type.STRING},
                    action: {type: Type.STRING},
                    capability: {type: Type.STRING},
                    target: {
                      type: Type.OBJECT,
                      properties: {
                        resources: {type: Type.ARRAY, items: {type: Type.STRING}},
                        output_path: {type: Type.STRING},
                      },
                      required: ['resources', 'output_path'],
                    },
                    execution: {
                      type: Type.OBJECT,
                      properties: {
                        mode: {type: Type.STRING},
                        retry_limit: {type: Type.INTEGER},
                        timeout_seconds: {type: Type.INTEGER},
                        idempotency_key: {type: Type.STRING},
                      },
                      required: ['mode', 'retry_limit', 'timeout_seconds', 'idempotency_key'],
                    },
                    permissions: {
                      type: Type.OBJECT,
                      properties: {
                        filesystem: {type: Type.ARRAY, items: {type: Type.STRING}},
                        network: {type: Type.ARRAY, items: {type: Type.STRING}},
                        connectors: {type: Type.ARRAY, items: {type: Type.STRING}},
                      },
                      required: ['filesystem', 'network', 'connectors'],
                    },
                    risk_level: {type: Type.STRING},
                    approval: {
                      type: Type.OBJECT,
                      properties: {
                        required: {type: Type.BOOLEAN},
                        reason: {type: Type.STRING},
                      },
                      required: ['required', 'reason'],
                    },
                  },
                  required: [
                    'schema_version',
                    'task_id',
                    'action',
                    'capability',
                    'target',
                    'execution',
                    'permissions',
                    'risk_level',
                    'approval',
                  ],
                },
                steps: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      step_id: {type: Type.STRING},
                      agent: {type: Type.STRING},
                      action_label: {type: Type.STRING},
                      semantic_milestone: {type: Type.STRING},
                      capability: {type: Type.STRING},
                      adapter_resolved: {type: Type.STRING},
                      estimated_ms: {type: Type.INTEGER},
                      idempotency_key: {type: Type.STRING},
                      checkpoint_safe: {type: Type.BOOLEAN},
                      external_side_effect: {type: Type.BOOLEAN},
                    },
                    required: [
                      'step_id',
                      'agent',
                      'action_label',
                      'semantic_milestone',
                      'capability',
                      'adapter_resolved',
                      'estimated_ms',
                      'idempotency_key',
                      'checkpoint_safe',
                      'external_side_effect',
                    ],
                  },
                },
                artifactPreview: {
                  type: Type.OBJECT,
                  properties: {
                    kind: {type: Type.STRING},
                    filename: {type: Type.STRING},
                    headline: {type: Type.STRING},
                    summaryMetrics: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          label: {type: Type.STRING},
                          value: {type: Type.STRING},
                        },
                        required: ['label', 'value'],
                      },
                    },
                    sections: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          heading: {type: Type.STRING},
                          detail: {type: Type.STRING},
                        },
                        required: ['heading', 'detail'],
                      },
                    },
                  },
                  required: ['kind', 'filename', 'headline', 'summaryMetrics', 'sections'],
                },
              },
              required: [
                'title',
                'summary',
                'selectedModel',
                'routingRationale',
                'ir',
                'steps',
                'artifactPreview',
              ],
            },
          },
        }),
      );

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        res.status(502).json({error: 'Model returned an empty Universal IR payload.'});
        return;
      }

      const parsed = parseJsonPayload(rawText);
      res.json(parsed);
    } catch (err: unknown) {
      const {status, message} = extractErrorInfo(err);
      console.error('[api/plan-task] Error:', status, message);
      if (status === 429) {
        res.status(429).json({
          error:
            'Gemini API quota limit reached (429 RESOURCE_EXHAUSTED). Please select a billing-enabled API key under GEMINI_API_KEY in Settings > Secrets, or wait briefly and retry.',
          detail: message,
        });
        return;
      }
      if (status === 403 || status === 400) {
        res.status(status).json({
          error:
            'Gemini API rejected the configured key (403/400). Please check GEMINI_API_KEY in Settings > Secrets.',
          detail: message,
        });
        return;
      }
      if (status === 503) {
        res.status(503).json({
          error: 'Gemini model is temporarily overloaded (503 UNAVAILABLE). Please retry in a few seconds.',
          detail: message,
        });
        return;
      }
      res.status(500).json({
        error: `Gemini Task Planner failed: ${message}`,
      });
    }
  });

  // Live 2026 Web Search Grounding + Bilingual Burmese/English Report & Comparison Table
  app.post('/api/execute-research', async (req, res) => {
    try {
      const {prompt} = req.body ?? {};
      if (typeof prompt !== 'string' || prompt.trim().length < 3) {
        res.status(400).json({error: 'A valid research prompt is required.'});
        return;
      }

      const keys = getConfiguredApiKeys();
      if (keys.length === 0) {
        res.status(503).json({
          error: 'Gemini API key is not configured in Settings > Secrets.',
          code: 'MISSING_API_KEY',
        });
        return;
      }

      const REPORT_RESPONSE_SCHEMA = {
        type: Type.OBJECT,
        properties: {
          reportTitleEn: {type: Type.STRING},
          reportTitleMm: {type: Type.STRING},
          executiveSummaryEn: {type: Type.STRING},
          executiveSummaryMm: {type: Type.STRING},
          excelFilename: {type: Type.STRING},
          tableRows: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                criterion_en: {type: Type.STRING},
                criterion_mm: {type: Type.STRING},
                activepieces: {type: Type.STRING},
                n8n: {type: Type.STRING},
                openclaw: {type: Type.STRING},
                notes_mm: {type: Type.STRING},
              },
              required: [
                'criterion_en',
                'criterion_mm',
                'activepieces',
                'n8n',
                'openclaw',
                'notes_mm',
              ],
            },
          },
          detailedSections: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                headingEn: {type: Type.STRING},
                headingMm: {type: Type.STRING},
                bodyEn: {type: Type.STRING},
                bodyMm: {type: Type.STRING},
              },
              required: ['headingEn', 'headingMm', 'bodyEn', 'bodyMm'],
            },
          },
        },
        required: [
          'reportTitleEn',
          'reportTitleMm',
          'executiveSummaryEn',
          'executiveSummaryMm',
          'excelFilename',
          'tableRows',
          'detailedSections',
        ],
      };

      const buildSynthesisPrompt = (userPrompt: string, providerLabel: string, snippets: WebSearchSnippet[]) => {
        const groundedContext = snippets
          .slice(0, 8)
          .map(
            (s, idx) =>
              `[${idx + 1}] Title: ${s.title}\nURL: ${s.uri}\nSnippet: ${s.snippet}`,
          )
          .join('\n\n');

        return `Using ONLY the live 2026 web search results below (retrieved via ${providerLabel}), synthesize an accurate, crisp bilingual English and natural Myanmar (Burmese) report and comparison matrix.

User Request:
"${userPrompt}"

Live Web Search Results:
${groundedContext}

Requirements:
- Base facts strictly on the retrieved web snippets above and current 2026 data.
- Keep text crisp for fast readability and Excel formatting:
  * executiveSummaryEn & executiveSummaryMm: 2-3 clear sentences each.
  * tableRows: exactly 7 high-value comparison rows (Core Focus & Architecture, 2026 AI & MCP Support, Licensing & Self-Hosting, Execution & Durability, Ecosystem & Integrations, Security & Sandboxing, Ideal Use Case & Pricing). Keep activepieces/n8n/openclaw cell values concise (under 15 words) and notes_mm to 1 clear Burmese sentence.
  * detailedSections: 3 concise sections (2-3 sentences each in English and natural Myanmar).`;
      };

      const externalProviders = getExternalSearchEntries();

      if (externalProviders.length > 0) {
        // Path A: External live web search (Tavily / Serper / Brave) + free-tier compatible Gemini synthesis
        const {providerLabel, snippets} = await runExternalWebSearch(prompt.trim());

        const synthesisResponse = await generateWithResilience((ai, model) =>
          ai.models.generateContent({
            model,
            contents: buildSynthesisPrompt(prompt.trim(), providerLabel, snippets),
            config: {
              thinkingConfig: {thinkingLevel: ThinkingLevel.LOW},
              responseMimeType: 'application/json',
              responseSchema: REPORT_RESPONSE_SCHEMA,
            },
          }),
        );

        const formattedJson = (synthesisResponse.text ?? '').trim();
        if (!formattedJson) {
          res.status(502).json({error: 'Failed to format bilingual research report.'});
          return;
        }

        const structured = parseJsonPayload(formattedJson) as Record<string, unknown>;
        res.json({
          ...structured,
          sources: snippets.map((s) => ({title: s.title, uri: s.uri})),
          searchProvider: providerLabel,
          generatedAt: new Date().toISOString(),
        });
        return;
      }

      // Path B: Native Gemini Google Search Grounding (requires Gemini quota/billing for googleSearch)
      const researchResponse = await generateWithResilience((ai, model) =>
        ai.models.generateContent({
          model,
          contents: `Perform live 2026 web research to answer this user request accurately with current facts, version updates, architecture, licensing, AI/MCP/agent support, pricing, and trade-offs, then format the result as a bilingual English and natural Myanmar (Burmese) report and comparison matrix.

User Request:
"${prompt.trim()}"

Requirements:
- Provide accurate English AND natural, clear Myanmar (Burmese) translations for the report title, executive summary, detailed sections, and comparison matrix rows.
- Include at least 7 high-value comparison rows in tableRows covering: Core Focus & Architecture, 2026 AI & MCP Support, Licensing & Self-Hosting, Execution & Durability, Ecosystem & Integrations, Security & Sandboxing, and Ideal Use Case / Pricing.
- For tableRows columns (activepieces, n8n, openclaw), keep values crisp and scannable for both web display and an Excel (.xlsx) workbook, and use notes_mm for clear Burmese commentary on each row.`,
          config: {
            tools: [{googleSearch: {}}],
            responseMimeType: 'application/json',
            responseSchema: REPORT_RESPONSE_SCHEMA,
          },
        }),
      );

      const rawChunks =
        researchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const sources: {title: string; uri: string}[] = [];
      const seenUris = new Set<string>();
      for (const chunk of rawChunks) {
        const web = chunk?.web;
        if (web?.uri && !seenUris.has(web.uri)) {
          seenUris.add(web.uri);
          sources.push({
            title: web.title || web.uri,
            uri: web.uri,
          });
        }
      }

      const formattedJson = (researchResponse.text ?? '').trim();
      if (!formattedJson) {
        res.status(502).json({error: 'Failed to format bilingual research report.'});
        return;
      }

      const structured = parseJsonPayload(formattedJson) as Record<string, unknown>;
      res.json({
        ...structured,
        sources,
        searchProvider: 'Gemini Google Search Grounding',
        generatedAt: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const {status, message} = extractErrorInfo(err);
      console.error('[api/execute-research] Error:', status, message);
      if (status === 429) {
        res.status(429).json({
          error:
            'Gemini Free Tier hit 429 RESOURCE_EXHAUSTED on Google Search Grounding. Add a free TAVILY_API_KEY, SERPER_API_KEY, or BRAVE_SEARCH_API_KEY in Settings > Secrets to run live web search with your existing Gemini key.',
          detail: message,
        });
        return;
      }
      if (status === 403 || status === 400) {
        res.status(status).json({
          error:
            'API rejected the configured key (403/400). Please check your search or Gemini key in Settings > Secrets.',
          detail: message,
        });
        return;
      }
      if (status === 503) {
        res.status(503).json({
          error: 'Model or search service is temporarily overloaded (503 UNAVAILABLE). Please retry in a few seconds.',
          detail: message,
        });
        return;
      }
      res.status(500).json({error: `Live 2026 Web Research failed: ${message}`});
    }
  });

  // Step 1: Fast External Web Search only (Tavily / Serper / Brave)
  app.post('/api/web-search', async (req, res) => {
    try {
      const {prompt} = req.body ?? {};
      if (typeof prompt !== 'string' || prompt.trim().length < 3) {
        res.status(400).json({error: 'A valid research prompt is required.'});
        return;
      }
      const externalProviders = getExternalSearchEntries();
      if (externalProviders.length === 0) {
        res.json({
          externalSearchReady: false,
          providerLabel: null,
          snippets: [],
          searchMs: 0,
        });
        return;
      }
      const started = Date.now();
      const {providerLabel, snippets} = await runExternalWebSearch(prompt.trim());
      res.json({
        externalSearchReady: true,
        providerLabel,
        snippets,
        searchMs: Date.now() - started,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'External web search failed.';
      console.error('[api/web-search] Error:', message);
      res.status(502).json({error: `Web Search API failed: ${message}`});
    }
  });

  // Step 2: Fast Bilingual English + Burmese Synthesis from retrieved web snippets
  app.post('/api/synthesize-report', async (req, res) => {
    try {
      const {prompt, providerLabel = 'Web Search', snippets} = req.body ?? {};
      if (typeof prompt !== 'string' || prompt.trim().length < 3) {
        res.status(400).json({error: 'A valid prompt is required.'});
        return;
      }
      if (!Array.isArray(snippets) || snippets.length === 0) {
        res.status(400).json({error: 'Retrieved search snippets are required.'});
        return;
      }

      const validSnippets: WebSearchSnippet[] = snippets
        .filter((s) => s && isSafeHttpUrl(s.uri))
        .slice(0, 8)
        .map((s) => ({
          title: String(s.title || s.uri),
          uri: String(s.uri),
          snippet: String(s.snippet || '').slice(0, 360),
        }));

      const started = Date.now();
      const groundedContext = validSnippets
        .map(
          (s, idx) => `[${idx + 1}] Title: ${s.title}\nURL: ${s.uri}\nSnippet: ${s.snippet}`,
        )
        .join('\n\n');

      const synthesisResponse = await generateWithResilience((ai, model) =>
        ai.models.generateContent({
          model,
          contents: `Using ONLY the live 2026 web search results below (retrieved via ${String(providerLabel)}), synthesize an accurate, crisp bilingual English and natural Myanmar (Burmese) report and comparison matrix.

User Request:
"${prompt.trim()}"

Live Web Search Results:
${groundedContext}

Requirements:
- Base facts strictly on the retrieved web snippets above and current 2026 data.
- Keep text crisp for fast readability and Excel formatting:
  * executiveSummaryEn & executiveSummaryMm: 2-3 clear sentences each.
  * tableRows: 7 high-value comparison rows (Core Focus & Architecture, 2026 AI & MCP Support, Licensing & Self-Hosting, Execution & Durability, Ecosystem & Integrations, Security & Sandboxing, Ideal Use Case & Pricing). Keep activepieces/n8n/openclaw cells concise (under 15 words) and notes_mm to 1 clear Burmese sentence.
  * detailedSections: 3 concise sections (2-3 sentences each in English and natural Myanmar).`,
          config: {
            thinkingConfig: {thinkingLevel: ThinkingLevel.LOW},
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                reportTitleEn: {type: Type.STRING},
                reportTitleMm: {type: Type.STRING},
                executiveSummaryEn: {type: Type.STRING},
                executiveSummaryMm: {type: Type.STRING},
                excelFilename: {type: Type.STRING},
                tableRows: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      criterion_en: {type: Type.STRING},
                      criterion_mm: {type: Type.STRING},
                      activepieces: {type: Type.STRING},
                      n8n: {type: Type.STRING},
                      openclaw: {type: Type.STRING},
                      notes_mm: {type: Type.STRING},
                    },
                    required: [
                      'criterion_en',
                      'criterion_mm',
                      'activepieces',
                      'n8n',
                      'openclaw',
                      'notes_mm',
                    ],
                  },
                },
                detailedSections: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      headingEn: {type: Type.STRING},
                      headingMm: {type: Type.STRING},
                      bodyEn: {type: Type.STRING},
                      bodyMm: {type: Type.STRING},
                    },
                    required: ['headingEn', 'headingMm', 'bodyEn', 'bodyMm'],
                  },
                },
              },
              required: [
                'reportTitleEn',
                'reportTitleMm',
                'executiveSummaryEn',
                'executiveSummaryMm',
                'excelFilename',
                'tableRows',
                'detailedSections',
              ],
            },
          },
        }),
      );

      const formattedJson = (synthesisResponse.text ?? '').trim();
      if (!formattedJson) {
        res.status(502).json({error: 'Gemini returned an empty report.'});
        return;
      }

      const structured = parseJsonPayload(formattedJson) as Record<string, unknown>;
      res.json({
        ...structured,
        sources: validSnippets.map((s) => ({title: s.title, uri: s.uri})),
        searchProvider: String(providerLabel),
        synthesisMs: Date.now() - started,
        generatedAt: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const {status, message} = extractErrorInfo(err);
      console.error('[api/synthesize-report] Error:', status, message);
      if (status === 429) {
        res.status(429).json({
          error:
            'Gemini API quota limit reached (429 RESOURCE_EXHAUSTED) during report synthesis. Please wait a moment and click Retry Execution.',
          detail: message,
        });
        return;
      }
      if (status === 503) {
        res.status(503).json({
          error: 'Gemini model is temporarily overloaded (503 UNAVAILABLE). Please retry in a few seconds.',
          detail: message,
        });
        return;
      }
      res.status(500).json({error: `Bilingual report synthesis failed: ${message}`});
    }
  });

  // Real Gmail API Send (with optional .xlsx Excel attachment) using client-provided OAuth Bearer token
  app.post('/api/send-gmail', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.length < 20) {
        res.status(401).json({
          error: 'Google sign-in is required before sending emails via Gmail.',
        });
        return;
      }

      const {to, subject, textBody, htmlBody, xlsxBase64, xlsxFilename} = req.body ?? {};
      if (typeof to !== 'string' || !isValidEmail(sanitizeHeaderValue(to))) {
        res.status(400).json({error: 'Please provide a valid recipient email address.'});
        return;
      }
      if (typeof subject !== 'string' || subject.trim().length === 0) {
        res.status(400).json({error: 'Email subject cannot be empty.'});
        return;
      }

      const normalizedAttachment =
        typeof xlsxBase64 === 'string' ? xlsxBase64.replace(/\s+/g, '') : '';
      if (normalizedAttachment && !/^[A-Za-z0-9+/=]+$/.test(normalizedAttachment)) {
        res.status(400).json({error: 'Invalid base64 Excel attachment payload.'});
        return;
      }

      const cleanTo = sanitizeHeaderValue(to);
      const cleanSubject = encodeMimeHeaderUtf8(subject);
      const cleanFilename = sanitizeHeaderValue(xlsxFilename || 'Research_Report_2026.xlsx').replace(
        /[^a-zA-Z0-9._-]/g,
        '_',
      );

      const mixedBoundary = `moe_mixed_${Date.now()}`;
      const altBoundary = `moe_alt_${Date.now()}`;

      const mimeLines: string[] = [
        `To: ${cleanTo}`,
        `Subject: ${cleanSubject}`,
        'MIME-Version: 1.0',
      ];

      if (normalizedAttachment.length > 0) {
        mimeLines.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`);
        mimeLines.push('');
        mimeLines.push(`--${mixedBoundary}`);
        mimeLines.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
        mimeLines.push('');
        mimeLines.push(`--${altBoundary}`);
        mimeLines.push('Content-Type: text/plain; charset="UTF-8"');
        mimeLines.push('Content-Transfer-Encoding: base64');
        mimeLines.push('');
        mimeLines.push(wrapBase64(Buffer.from(String(textBody || ''), 'utf8').toString('base64')));
        mimeLines.push('');
        mimeLines.push(`--${altBoundary}`);
        mimeLines.push('Content-Type: text/html; charset="UTF-8"');
        mimeLines.push('Content-Transfer-Encoding: base64');
        mimeLines.push('');
        mimeLines.push(wrapBase64(Buffer.from(String(htmlBody || ''), 'utf8').toString('base64')));
        mimeLines.push('');
        mimeLines.push(`--${altBoundary}--`);
        mimeLines.push('');
        mimeLines.push(`--${mixedBoundary}`);
        mimeLines.push(
          `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet; name="${cleanFilename}"`,
        );
        mimeLines.push(`Content-Disposition: attachment; filename="${cleanFilename}"`);
        mimeLines.push('Content-Transfer-Encoding: base64');
        mimeLines.push('');
        mimeLines.push(wrapBase64(normalizedAttachment));
        mimeLines.push('');
        mimeLines.push(`--${mixedBoundary}--`);
      } else {
        mimeLines.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
        mimeLines.push('');
        mimeLines.push(`--${altBoundary}`);
        mimeLines.push('Content-Type: text/plain; charset="UTF-8"');
        mimeLines.push('Content-Transfer-Encoding: base64');
        mimeLines.push('');
        mimeLines.push(wrapBase64(Buffer.from(String(textBody || ''), 'utf8').toString('base64')));
        mimeLines.push('');
        mimeLines.push(`--${altBoundary}`);
        mimeLines.push('Content-Type: text/html; charset="UTF-8"');
        mimeLines.push('Content-Transfer-Encoding: base64');
        mimeLines.push('');
        mimeLines.push(wrapBase64(Buffer.from(String(htmlBody || ''), 'utf8').toString('base64')));
        mimeLines.push('');
        mimeLines.push(`--${altBoundary}--`);
      }

      const rawMessage = Buffer.from(mimeLines.join('\r\n'), 'utf8').toString('base64url');

      const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({raw: rawMessage}),
      });

      const gmailPayload = await gmailRes.json().catch(() => ({}));
      if (!gmailRes.ok) {
        const errMsg =
          gmailPayload?.error?.message || `Gmail API returned HTTP ${gmailRes.status}`;
        res.status(gmailRes.status).json({
          error: `Gmail send failed: ${errMsg}`,
        });
        return;
      }

      res.json({
        messageId: gmailPayload.id,
        threadId: gmailPayload.threadId,
        sentTo: cleanTo,
        attachment: normalizedAttachment ? cleanFilename : null,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send email via Gmail.';
      console.error('[api/send-gmail] Error:', message);
      res.status(500).json({error: message});
    }
  });

  // Ensure unmatched /api/* routes always return JSON rather than SPA index.html
  app.use('/api', (_req, res) => {
    res.status(404).json({error: 'API route not found.'});
  });

  if (isProduction) {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {middlewareMode: true},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Moe Workforce server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

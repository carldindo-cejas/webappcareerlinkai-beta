// Cloudflare Workers AI + Vectorize helpers.
// All LLM and embedding calls route through the AI Gateway for logging.

export type AiBindings = {
  AI: Ai;
  KNOWLEDGE: VectorizeIndex;
  AI_GATEWAY_ID: string;
};

const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';
const LLM_MODEL = '@cf/meta/llama-3.1-8b-instruct';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export async function embed(env: AiBindings, text: string): Promise<number[] | null> {
  const input = text.trim();
  if (!input) return null;
  try {
    const res = await env.AI.run(
      EMBEDDING_MODEL,
      { text: [input] },
      { gateway: { id: env.AI_GATEWAY_ID } }
    );
    const vec = (res as any)?.data?.[0];
    return Array.isArray(vec) ? vec : null;
  } catch (err) {
    console.warn('embed failed', err);
    return null;
  }
}

export async function embedBatch(env: AiBindings, texts: string[]): Promise<number[][] | null> {
  const input = texts.map(t => t.trim()).filter(Boolean);
  if (!input.length) return null;
  try {
    const res = await env.AI.run(
      EMBEDDING_MODEL,
      { text: input },
      { gateway: { id: env.AI_GATEWAY_ID } }
    );
    const data = (res as any)?.data;
    return Array.isArray(data) ? data : null;
  } catch (err) {
    console.warn('embedBatch failed', err);
    return null;
  }
}

export type RetrievedDoc = { text: string; kind: string; score: number; sourceUrl?: string };

export async function retrieveContext(
  env: AiBindings,
  question: string,
  topK = 4
): Promise<RetrievedDoc[]> {
  const vec = await embed(env, question);
  if (!vec) return [];
  try {
    const res = await env.KNOWLEDGE.query(vec, { topK, returnMetadata: true });
    const matches = (res as any)?.matches ?? [];
    return matches
      .map((m: any) => ({
        text: typeof m?.metadata?.text === 'string' ? m.metadata.text : '',
        kind: typeof m?.metadata?.kind === 'string' ? m.metadata.kind : 'doc',
        score: typeof m?.score === 'number' ? m.score : 0,
        sourceUrl: typeof m?.metadata?.source_url === 'string' ? m.metadata.source_url : undefined
      }))
      .filter((d: RetrievedDoc) => d.text.length > 0);
  } catch (err) {
    console.warn('KNOWLEDGE.query failed', err);
    return [];
  }
}

export async function runLlama(
  env: AiBindings,
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number } = {}
): Promise<string | null> {
  try {
    const res = await env.AI.run(
      LLM_MODEL,
      {
        messages,
        temperature: opts.temperature ?? 0.6,
        max_tokens: opts.maxTokens ?? 512
      },
      { gateway: { id: env.AI_GATEWAY_ID } }
    );
    const content = (res as any)?.response;
    if (typeof content !== 'string' || !content.trim()) return null;
    return content.trim();
  } catch (err) {
    console.warn('runLlama failed', err);
    return null;
  }
}

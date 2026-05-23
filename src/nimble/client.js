import '../config/env.js';

const DEFAULT_BASE_URL = 'https://sdk.nimbleway.com';

export class NimbleAPIError extends Error {
  constructor(statusCode, message, payload = {}) {
    super(message);
    this.name = 'NimbleAPIError';
    this.statusCode = statusCode;
    this.payload = payload;
  }
}

export class NimbleClient {
  constructor(apiKey = process.env.NIMBLE_API_KEY, baseUrl = DEFAULT_BASE_URL) {
    if (!apiKey) {
      throw new Error('NIMBLE_API_KEY is missing. Add it to .env (see .env.example).');
    }
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async search(payload) {
    return this.#post('/v1/search', payload);
  }

  async extract(payload, { timeoutMs } = {}) {
    return this.#post('/v1/extract', payload, { timeoutMs });
  }

  async #post(path, payload, { timeoutMs } = {}) {
    const url = `${this.baseUrl}${path}`;
    const defaultMs = payload.browser_actions?.length ? 240_000 : 120_000;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs ?? defaultMs),
    });

    let body;
    const text = await response.text();
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }

    if (response.ok) return body;

    const message = body.msg || body.message || text;
    throw new NimbleAPIError(response.status, String(message), body);
  }
}

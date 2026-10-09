/** Create the small JSON API client used by the hosted QuestAR app. */
export function createApiClient({ baseUrl = '', localOnly = false, fetchImpl = globalThis.fetch } = {}) {
  const base = String(baseUrl).replace(/\/+$/, '');

  async function request(path, { method = 'GET', body, timeoutMs = 12_000 } = {}) {
    if (localOnly) {
      throw new Error('This local demo uses on-device data and does not call the server API.');
    }
    if (typeof fetchImpl !== 'function') {
      throw new Error('Network requests are unavailable in this browser.');
    }

    const response = await fetchImpl(`${base}${path}`, {
      method,
      headers: body === undefined
        ? { Accept: 'application/json' }
        : { Accept: 'application/json', 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      const error = new Error(`API ${response.status}`);
      error.status = response.status;
      try {
        const payload = await response.json();
        if (typeof payload?.code === 'string') error.code = payload.code;
      } catch {
        // Keep the HTTP status when a server returns a non-JSON error page.
      }
      throw error;
    }

    return response.json();
  }

  return {
    get: (path) => request(path),
    post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  };
}

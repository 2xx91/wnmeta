const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";

function parseCookieLine(setCookieValue) {
  if (!setCookieValue) return null;
  const [pair] = setCookieValue.split(";");
  return pair?.trim() || null;
}

export function mergeCookieHeaders(...cookieHeaders) {
  const jar = new Map();

  for (const header of cookieHeaders) {
    if (!header) continue;

    for (const part of header.split(";")) {
      const [name, ...valueParts] = part.trim().split("=");
      if (!name || valueParts.length === 0) continue;
      jar.set(name, valueParts.join("="));
    }
  }

  return Array.from(jar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

export function extractCookieHeader(response) {
  const setCookies = response.headers.getSetCookie?.() ?? [];
  return setCookies.map(parseCookieLine).filter(Boolean).join("; ");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(url, options = {}) {
  const { ...fetchOptions } = options;

  return fetch(url, {
    ...fetchOptions,
    headers: {
      "user-agent": DEFAULT_USER_AGENT,
      ...fetchOptions.headers
    }
  });
}

export async function fetchText(url, options = {}) {
  const response = await request(url, {
    ...options,
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText} (${url})`);
  }

  return response.text();
}

export async function fetchJson(url, options = {}) {
  const response = await request(url, {
    ...options,
    headers: {
      accept: "application/json",
      ...options.headers
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText} (${url})`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();
  const snippet = body.slice(0, 200).replace(/\s+/g, " ").trim();

  if (!contentType.toLowerCase().includes("json")) {
    throw new Error(`Expected JSON but got ${contentType || "unknown"} (${url}) ${snippet}`);
  }

  try {
    return JSON.parse(body);
  } catch (error) {
    throw new Error(`Invalid JSON response (${url}) ${snippet}`);
  }
}
export { sleep };

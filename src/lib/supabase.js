const UPSERT_BATCH_SIZE = 50;
const SOURCE_IDS_PAGE_SIZE = 1000;

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY");
  }

  return { url, key };
}

export function assertSupabaseConfig() {
  return getSupabaseConfig();
}

function chunkArray(items, size) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

export async function upsertWebnovels(rows, { batchSize = UPSERT_BATCH_SIZE } = {}) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return 0;
  }

  const { url, key } = getSupabaseConfig();
  const endpoint = new URL("/rest/v1/webnovels", url);
  endpoint.searchParams.set("on_conflict", "platform,source_id");

  let upsertedCount = 0;

  for (const batch of chunkArray(rows, batchSize)) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
        prefer: "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify(batch)
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Supabase upsert failed: ${response.status} ${response.statusText} ${body}`
      );
    }

    upsertedCount += batch.length;
  }

  return upsertedCount;
}

function toPostgrestInFilterValue(values) {
  const items = values.map((value) => {
    const escaped = String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `"${escaped}"`;
  });

  return `(${items.join(",")})`;
}

export async function upsertWebnovelHistory(row) {
  if (row == null) {
    return 0;
  }

  const { url, key } = getSupabaseConfig();
  const endpoint = new URL("/rest/v1/webnovel_history", url);
  endpoint.searchParams.set("on_conflict", "platform,source_id,history_date");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify([row])
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Supabase webnovel-history upsert failed: ${response.status} ${response.statusText} ${body}`
    );
  }

  return 1;
}

async function listRows(
  platform,
  {
    status,
    excludeStatuses,
    fields = ["source_id"],
    pageSize = SOURCE_IDS_PAGE_SIZE
  } = {}
) {
  const { url, key } = getSupabaseConfig();
  const allRows = [];
  let offset = 0;

  while (true) {
    const endpoint = new URL("/rest/v1/webnovels", url);
    endpoint.searchParams.set("select", fields.join(","));
    endpoint.searchParams.set("platform", `eq.${platform}`);
    endpoint.searchParams.set("order", "source_id.asc");
    endpoint.searchParams.set("limit", String(pageSize));
    endpoint.searchParams.set("offset", String(offset));

    if (status != null) {
      endpoint.searchParams.set("status", `eq.${status}`);
    } else if (Array.isArray(excludeStatuses) && excludeStatuses.length > 0) {
      endpoint.searchParams.set("status", `not.in.${toPostgrestInFilterValue(excludeStatuses)}`);
    }

    const response = await fetch(endpoint, {
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        accept: "application/json"
      }
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Supabase row lookup failed: ${response.status} ${response.statusText} ${body}`
      );
    }

    const rows = await response.json();
    allRows.push(...rows);

    if (rows.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return allRows;
}

async function listSourceIds(
  platform,
  { status, excludeStatuses, pageSize = SOURCE_IDS_PAGE_SIZE } = {}
) {
  const sourceIds = new Set();
  const rows = await listRows(platform, {
    status,
    excludeStatuses,
    fields: ["source_id"],
    pageSize
  });

  for (const row of rows) {
    if (row?.source_id != null) {
      sourceIds.add(String(row.source_id));
    }
  }

  return sourceIds;
}

export async function listPlatformSourceIds(platform, options = {}) {
  return listSourceIds(platform, options);
}

export async function listOngoingSourceRows(platform) {
  return listRows(platform, {
    excludeStatuses: ["완결"],
    fields: ["source_id", "publisher"]
  });
}

export async function updateWebnovelStatus(platform, sourceId, status) {
  const { url, key } = getSupabaseConfig();
  const endpoint = new URL("/rest/v1/webnovels", url);
  endpoint.searchParams.set("platform", `eq.${platform}`);
  endpoint.searchParams.set("source_id", `eq.${sourceId}`);

  const response = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      prefer: "return=minimal"
    },
    body: JSON.stringify({ status })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase status update failed: ${response.status} ${response.statusText} ${body}`);
  }
}

export async function getPlatformLatestSerializedAt(platform) {
  const { url, key } = getSupabaseConfig();
  const endpoint = new URL("/rest/v1/webnovels", url);
  endpoint.searchParams.set("select", "last_serialized_at");
  endpoint.searchParams.set("platform", `eq.${platform}`);
  endpoint.searchParams.set("last_serialized_at", "not.is.null");
  endpoint.searchParams.set("order", "last_serialized_at.desc");
  endpoint.searchParams.set("limit", "1");

  const response = await fetch(endpoint, {
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      accept: "application/json"
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Supabase latest-date lookup failed: ${response.status} ${response.statusText} ${body}`
    );
  }

  const rows = await response.json();
  return rows[0]?.last_serialized_at ?? null;
}

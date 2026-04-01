import { resetFailureLog } from "./failure-log.js";
import { assertSupabaseConfig, listPlatformSourceIds } from "./supabase.js";

function parseCommandArguments(argv) {
  const positionals = [];
  const options = {};

  for (const arg of argv) {
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }

    const option = arg.slice(2);
    const separatorIndex = option.indexOf("=");
    if (separatorIndex === -1) {
      options[option] = "true";
      continue;
    }

    const key = option.slice(0, separatorIndex);
    const value = option.slice(separatorIndex + 1);
    options[key] = value;
  }

  return { positionals, options };
}

function parseOptionalNumber(value, label) {
  if (value == null) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }

  return parsed;
}

function hasFlag(options, key) {
  return options[key] === "true";
}

function getSelectedGenres(options, genres) {
  return genres.filter((genre) => hasFlag(options, genre));
}

export function getKstDateOnly({ now = new Date() } = {}) {
  const formatter = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = formatter.formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Failed to format KST date");
  }

  return `${year}-${month}-${day}`;
}

export function shiftDateByDays(dateOnly, days) {
  if (dateOnly == null) {
    return null;
  }

  const baseDate = new Date(`${dateOnly}T00:00:00Z`);
  if (Number.isNaN(baseDate.getTime())) {
    throw new Error(`Invalid date: ${dateOnly}`);
  }

  baseDate.setUTCDate(baseDate.getUTCDate() + days);
  return baseDate.toISOString().slice(0, 10);
}

export async function loadExistingPlatformIds(platform, logPrefix) {
  assertSupabaseConfig();
  console.error(`[${logPrefix}] loading existing ids from db`);
  const existingIds = await listPlatformSourceIds(platform);
  console.error(`[${logPrefix}] existing ids total=${existingIds.size}`);
  return existingIds;
}

function parsePlatformCliArgs({ argv, genres, scriptPath, platformName }) {
  const { positionals, options } = parseCommandArguments(argv);
  const maxPages = parseOptionalNumber(positionals[0], "maxPages");
  const selectedGenres = getSelectedGenres(options, genres);
  const isLatest = hasFlag(options, "최신");

  if (isLatest && selectedGenres.length > 0) {
    throw new Error(`Use one mode flag or one ${platformName} genre flag`);
  }

  if (!isLatest && selectedGenres.length !== 1) {
    console.log(`Usage:
  node ${scriptPath} --무협 [maxPages]
  node ${scriptPath} --최신 [maxPages]`);
    return null;
  }

  return {
    genre: selectedGenres[0] ?? null,
    isLatest,
    maxPages
  };
}

export async function runPlatformCli({
  argv,
  platform,
  platformName,
  scriptPath,
  genres,
  syncLatest,
  syncGenre,
  loadExistingIds
}) {
  const parsed = parsePlatformCliArgs({
    argv,
    genres,
    scriptPath,
    platformName
  });

  if (parsed == null) {
    return false;
  }

  await resetFailureLog(platform);

  const result = parsed.isLatest
    ? await syncLatest({ maxPages: parsed.maxPages })
    : await syncGenre({
        genre: parsed.genre,
        maxPages: parsed.maxPages,
        existingIds: await loadExistingIds()
      });

  console.log(JSON.stringify(result, null, 2));
  return true;
}

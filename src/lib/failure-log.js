import { readFile, writeFile } from "node:fs/promises";

const FAILURE_LOG_URLS = {
  K: new URL("../../json/kakao-failed-ids.json", import.meta.url),
  N: new URL("../../json/naver-failed-ids.json", import.meta.url)
};

const failureSets = new Map();

function getFailureLogUrl(platform) {
  const failureLogUrl = FAILURE_LOG_URLS[platform];
  if (failureLogUrl == null) {
    throw new Error(`Unsupported failure-log platform: ${platform}`);
  }

  return failureLogUrl;
}

export async function resetFailureLog(platform) {
  const failureLogUrl = getFailureLogUrl(platform);
  failureSets.set(platform, new Set());
  await writeFile(failureLogUrl, "[]\n", "utf8");
}

export async function recordFailedSourceId(platform, sourceId) {
  const failureLogUrl = getFailureLogUrl(platform);
  let failureSet = failureSets.get(platform);

  if (failureSet == null) {
    try {
      const raw = await readFile(failureLogUrl, "utf8");
      const parsed = JSON.parse(raw);
      failureSet = new Set(Array.isArray(parsed) ? parsed.map((value) => String(value)) : []);
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error;
      }

      failureSet = new Set();
    }
  }

  failureSet.add(String(sourceId));
  failureSets.set(platform, failureSet);
  await writeFile(failureLogUrl, `${JSON.stringify(Array.from(failureSet), null, 2)}\n`, "utf8");
}

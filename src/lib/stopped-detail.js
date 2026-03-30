export async function filterStoppedDetail({
  detail,
  isStoppedDetail,
  updateStatus,
  platform,
  sourceId,
  logPrefix,
  sourceLabel,
  stoppedStatus = "중단",
  log = console.error
}) {
  if (!isStoppedDetail(detail)) {
    return detail;
  }

  try {
    await updateStatus(platform, sourceId, stoppedStatus);
    log(`[${logPrefix}] marked stopped ${sourceLabel}=${sourceId}`);
  } catch (error) {
    log(`[${logPrefix}] stopped ${sourceLabel}=${sourceId} ${error.message}`);
  }

  return null;
}

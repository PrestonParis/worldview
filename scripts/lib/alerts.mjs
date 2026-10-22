// Operator alerts for the close-races ingest (docs/elections/ga-close-races.md, "Ingest").
// Each alert is stored once in tracked_alerts (deduped by key) and, when
// ALERT_WEBHOOK_URL is set, posted to it. The body adapts to the target:
// Discord wants `content`, ntfy.sh a plain-text body, Slack (and anything
// else) `text`.

export function webhookRequest(url, message) {
  if (/discord(app)?\.com\/api\/webhooks/.test(url)) {
    return { headers: { "content-type": "application/json" }, body: JSON.stringify({ content: message }) };
  }
  if (/ntfy\./.test(url)) {
    return { headers: { "content-type": "text/plain; charset=utf-8", Title: "Writ close races" }, body: message };
  }
  return { headers: { "content-type": "application/json" }, body: JSON.stringify({ text: message }) };
}

export async function sendWebhook(message, url = process.env.ALERT_WEBHOOK_URL) {
  if (!url) return false;
  try {
    const { headers, body } = webhookRequest(url, message);
    const res = await fetch(url, { method: "POST", headers, body, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) console.warn(`  alert webhook -> ${res.status}`);
    return res.ok;
  } catch (err) {
    console.warn(`  alert webhook failed: ${err.message}`);
    return false;
  }
}

const ICON = { info: "ℹ️", warning: "⚠️", critical: "🚨" };

// Returns true when the alert is new (and was sent).
export async function raiseAlert(pg, { election, key, kind, severity = "warning", contestId = null, message, payload = {} }, { dryRun = false } = {}) {
  const line = `${ICON[severity] ?? ""} [${election}] ${message}`;
  if (dryRun) {
    console.log(`  alert (dry run): ${line}`);
    return false;
  }
  const { rows } = await pg.query(
    `insert into tracked_alerts (source_election_id, dedupe_key, kind, severity, contest_id, message, payload)
     values ($1, $2, $3, $4, $5, $6, $7) on conflict (dedupe_key) do nothing returning id`,
    [election, `${election}:${key}`, kind, severity, contestId, message, JSON.stringify(payload)],
  );
  if (!rows.length) return false;
  console.log(`  alert: ${line}`);
  if (await sendWebhook(line)) await pg.query("update tracked_alerts set sent_at = now() where id = $1", [rows[0].id]);
  return true;
}

// A time bucket for alerts that may legitimately repeat (stale feeds): one
// alert per bucket rather than one per poll.
export const bucket = (minutes, at = Date.now()) => Math.floor(at / (minutes * 60_000));

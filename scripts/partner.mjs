// Admin CLI for institutional data partners (docs/data-hosting.md):
// register an institution, approve it, issue API keys, and create / publish
// the datasets it may write to. Partner datasets are namespaced by the
// partner slug (e.g. "cis-detention-audit") so they can never collide with a
// built-in public import.
//
// Usage (prefix ENV_FILE=.env.cloud to target cloud):
//   node scripts/partner.mjs list
//   node scripts/partner.mjs add <partner> --name="Center for X" [--kind=university|think-tank|government|nonprofit|newsroom|other]
//                                [--website=] [--email=] [--description=]
//   node scripts/partner.mjs approve <partner>        | suspend <partner>
//   node scripts/partner.mjs key <partner> [--label=]  (prints the key once)
//   node scripts/partner.mjs revoke-key <key prefix>
//   node scripts/partner.mjs dataset <partner> <dataset> --title= --topic= [--description= --methodology=
//                                    --source-url= --license= --cadence=]
//   node scripts/partner.mjs publish <dataset>         | unpublish <dataset> | retire <dataset>

import { createHash, randomBytes } from "node:crypto";
import { arg, connectPg, loadEnv } from "./lib/bulk.mjs";

const KINDS = ["university", "think-tank", "government", "nonprofit", "newsroom", "other"];
const SLUG = /^[a-z0-9][a-z0-9-]{1,47}$/;
const [cmd, a1, a2] = process.argv.slice(2).filter((x) => !x.startsWith("--"));

function newKey() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  // 40 chars from 256-way bytes, rejection-sampled to stay uniform.
  let out = "";
  while (out.length < 40) for (const b of randomBytes(64)) if (b < 248 && out.length < 40) out += alphabet[b % 62];
  return `wvp_${out}`;
}

const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};

loadEnv();
const pg = await connectPg();
const one = async (q, p) => (await pg.query(q, p)).rows[0];
const partnerBySlug = async (slug) =>
  (await one("select * from data_partners where slug = $1", [slug])) ?? fail(`No partner "${slug}".`);

try {
  switch (cmd) {
    case "list": {
      const { rows } = await pg.query(`
        select p.slug, p.name, p.kind, p.status,
          (select count(*) from partner_keys k where k.partner_id = p.id and k.revoked_at is null)::int as keys,
          coalesce((select string_agg(d.slug || ' (' || d.status || ')', ', ') from datasets d where d.partner_id = p.id), '') as datasets
        from data_partners p order by p.created_at`);
      console.table(rows);
      break;
    }
    case "add": {
      if (!a1 || !SLUG.test(a1)) fail("Partner slug must be lowercase letters, digits, and dashes.");
      const name = arg("name", "") || fail("--name is required.");
      const kind = arg("kind", "other");
      if (!KINDS.includes(kind)) fail(`--kind must be one of ${KINDS.join(", ")}`);
      await pg.query(
        `insert into data_partners (slug, name, kind, website, contact_email, description)
         values ($1, $2, $3, $4, $5, $6)`,
        [a1, name, kind, arg("website", null), arg("email", null), arg("description", null)],
      );
      console.log(`Added ${name} (${a1}) — pending. Approve with: node scripts/partner.mjs approve ${a1}`);
      break;
    }
    case "approve":
    case "suspend": {
      const p = await partnerBySlug(a1);
      await pg.query(
        `update data_partners set status = $2, approved_at = case when $2 = 'approved' then now() else approved_at end,
           updated_at = now() where id = $1`,
        [p.id, cmd === "approve" ? "approved" : "suspended"],
      );
      console.log(`${p.name}: ${cmd === "approve" ? "approved" : "suspended"}`);
      break;
    }
    case "key": {
      const p = await partnerBySlug(a1);
      const key = newKey();
      await pg.query("insert into partner_keys (partner_id, key_prefix, key_hash, label) values ($1, $2, $3, $4)", [
        p.id, key.slice(0, 12), createHash("sha256").update(key).digest("hex"), arg("label", null),
      ]);
      console.log(`API key for ${p.name} (shown once — store it now):\n\n  ${key}\n`);
      if (p.status !== "approved") console.log(`Note: ${a1} is ${p.status}; the key works once the partner is approved.`);
      break;
    }
    case "revoke-key": {
      const r = await pg.query("update partner_keys set revoked_at = now() where key_prefix = $1 and revoked_at is null", [a1]);
      console.log(r.rowCount ? `Revoked ${r.rowCount} key(s) with prefix ${a1}.` : `No active key with prefix ${a1}.`);
      break;
    }
    case "dataset": {
      const p = await partnerBySlug(a1);
      if (!a2?.startsWith(`${a1}-`) || !SLUG.test(a2)) fail(`Dataset slug must start with "${a1}-" (e.g. ${a1}-detention-audit).`);
      const title = arg("title", "") || fail("--title is required.");
      const topic = arg("topic", "") || fail("--topic is required (immigration, crime, demographics, ...).");
      const existing = await one("select partner_id from datasets where slug = $1", [a2]);
      if (existing && existing.partner_id !== p.id) fail(`Dataset "${a2}" belongs to another partner.`);
      await pg.query(
        `insert into datasets (slug, title, topic, publisher, partner_id, description, methodology, source_url, license, cadence)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         on conflict (slug) do update set title = excluded.title, topic = excluded.topic, publisher = excluded.publisher,
           description = coalesce(excluded.description, datasets.description),
           methodology = coalesce(excluded.methodology, datasets.methodology),
           source_url = coalesce(excluded.source_url, datasets.source_url),
           license = coalesce(excluded.license, datasets.license),
           cadence = coalesce(excluded.cadence, datasets.cadence), updated_at = now()`,
        [a2, title, topic, p.name, p.id, arg("description", null), arg("methodology", null), arg("source-url", null),
          arg("license", null), arg("cadence", null)],
      );
      console.log(`Dataset ${a2} saved for ${p.name} (draft until: node scripts/partner.mjs publish ${a2}).`);
      break;
    }
    case "publish":
    case "unpublish":
    case "retire": {
      const status = { publish: "published", unpublish: "draft", retire: "retired" }[cmd];
      const r = await pg.query("update datasets set status = $2, updated_at = now() where slug = $1 and partner_id is not null", [a1, status]);
      console.log(r.rowCount ? `${a1}: ${status}` : `No partner dataset "${a1}".`);
      break;
    }
    default:
      console.log("Commands: list | add | approve | suspend | key | revoke-key | dataset | publish | unpublish | retire");
      console.log("See the header of scripts/partner.mjs for usage.");
  }
} finally {
  await pg.end();
}

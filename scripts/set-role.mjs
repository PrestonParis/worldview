// Grants or removes shared-data editing for an account (docs/auth-plan.md).
// New accounts are members; editors can change shared records.
//
// Usage: npm run auth:role -- <email> editor|member
//        ENV_FILE=.env.cloud npm run auth:role -- <email> editor

process.loadEnvFile(process.env.ENV_FILE || ".env.local");

import { Client } from "pg";

const [email, role] = process.argv.slice(2);
if (!email || !["editor", "member"].includes(role)) {
  console.error("usage: npm run auth:role -- <email> editor|member");
  process.exit(1);
}

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const { rows } = await client.query(
    `update profiles p set role = $2
       from auth.users u
      where u.id = p.id and lower(u.email) = lower($1)
      returning p.id`,
    [email.trim(), role],
  );
  if (rows.length) console.log(`${email} is now ${role === "editor" ? "an editor" : "a member"}.`);
  else {
    console.error(`No account for ${email}. They need to sign in once first.`);
    process.exitCode = 1;
  }
} finally {
  await client.end();
}

import neo4j, { type Driver } from "neo4j-driver";

let driver: Driver | undefined;

export function getDriver(): Driver {
  if (driver) return driver;

  const uri = process.env.NEO4J_URI;
  const user = process.env.NEO4J_USER;
  const password = process.env.NEO4J_PASSWORD;

  if (!uri || !user || !password) {
    throw new Error(
      "NEO4J_URI / NEO4J_USER / NEO4J_PASSWORD are not set. Copy .env.example to " +
        ".env.local and fill it in (run `npm run infra:up` first if you're using the local stack).",
    );
  }

  // Fail fast when the instance is unreachable (Aura Free pauses after 3 idle
  // days) so pages hit their error boundary instead of hanging.
  driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
    connectionTimeout: 10_000,
    connectionAcquisitionTimeout: 15_000,
  });
  return driver;
}

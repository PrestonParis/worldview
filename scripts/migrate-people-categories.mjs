import nextEnv from "@next/env";
import neo4j from "neo4j-driver";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const { NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD } = process.env;

if (!NEO4J_URI || !NEO4J_USER || !NEO4J_PASSWORD) {
  throw new Error("NEO4J_URI, NEO4J_USER, and NEO4J_PASSWORD are required");
}

const driver = neo4j.driver(
  NEO4J_URI,
  neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD),
);
const session = driver.session();

try {
  const result = await session.run(`
    MATCH (e:Entity {type: "person"})
    WITH e,
      toLower(coalesce(e.description, "")) AS description,
      coalesce(e.metadata, "") AS metadata
    SET e.type = CASE
      WHEN metadata CONTAINS '"office"'
        OR metadata CONTAINS '"party"'
        OR description CONTAINS "president of"
        OR description CONTAINS "prime minister"
        OR description CONTAINS "governor of"
        THEN "politician"
      WHEN description =~ ".*(journalist|reporter|correspondent|news anchor).*"
        THEN "journalist"
      ELSE "pundit"
    END,
    e.updatedAt = datetime()
    RETURN e.type AS type, count(*) AS count
    ORDER BY type
  `);

  for (const record of result.records) {
    console.log(`${record.get("type")}: ${record.get("count").toNumber()}`);
  }
} finally {
  await session.close();
  await driver.close();
}

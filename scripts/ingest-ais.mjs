#!/usr/bin/env node

// Long-running AIS ingest worker. It owns one upstream WebSocket connection,
// normalizes the latest position per MMSI, and flushes batched upserts to
// Postgres. Browsers read snapshots from /api/geography/providers/ais-ships;
// they never receive the provider key or create upstream subscriptions.

import { existsSync } from "node:fs";
import pg from "pg";
import WebSocket from "ws";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const apiKey = process.env.AISSTREAM_API_KEY;
const connectionString = process.env.DATABASE_URL;
if (!apiKey) throw new Error("AISSTREAM_API_KEY is required.");
if (!connectionString) throw new Error("DATABASE_URL is required.");

const box = (process.env.AIS_BOUNDING_BOX || "-90,-180,90,180").split(",").map(Number);
if (box.length !== 4 || box.some((value) => !Number.isFinite(value))) {
  throw new Error("AIS_BOUNDING_BOX must be south,west,north,east.");
}
const [south, west, north, east] = box;
if (south < -90 || north > 90 || west < -180 || east > 180 || south > north) {
  throw new Error("AIS_BOUNDING_BOX coordinates are outside valid bounds.");
}
const pool = new pg.Pool({ connectionString, max: 3 });
const pending = new Map();
const staticByMmsi = new Map();
let socket = null;
let stopped = false;
let reconnectAttempt = 0;
let received = 0;
let written = 0;
let lastMessageAt = 0;

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function cleanText(value, maximum = 200) {
  const text = typeof value === "string" ? value.replace(/[@\0]/g, "").trim() : "";
  return text ? text.slice(0, maximum) : null;
}

function messageTime(metadata) {
  const candidate = metadata?.time_utc ?? metadata?.TimeUtc ?? metadata?.timestamp;
  const date = candidate ? new Date(candidate) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function ingest(raw) {
  let envelope;
  try { envelope = JSON.parse(raw); } catch { return; }
  const type = envelope.MessageType;
  const metadata = envelope.MetaData ?? {};
  const mmsi = String(metadata.MMSI ?? metadata.Mmsi ?? "").padStart(9, "0");
  if (!/^\d{9}$/.test(mmsi)) return;
  const message = envelope.Message?.[type] ?? envelope.Message ?? {};

  if (type === "ShipStaticData" || type === "StaticDataReport") {
    staticByMmsi.set(mmsi, {
      shipName: cleanText(message.Name ?? message.ShipName ?? metadata.ShipName),
      callSign: cleanText(message.CallSign, 32),
      shipType: finite(message.Type ?? message.ShipType),
      destination: cleanText(message.Destination),
    });
    if (staticByMmsi.size > 100_000) staticByMmsi.delete(staticByMmsi.keys().next().value);
    return;
  }

  if (!/PositionReport|StandardClassBPositionReport|ExtendedClassBPositionReport/.test(type)) return;
  const longitude = finite(message.Longitude ?? metadata.longitude ?? metadata.Longitude);
  const latitude = finite(message.Latitude ?? metadata.latitude ?? metadata.Latitude);
  if (longitude === null || latitude === null || Math.abs(longitude) > 180 || Math.abs(latitude) > 90) return;
  const known = staticByMmsi.get(mmsi) ?? {};
  pending.set(mmsi, {
    mmsi,
    shipName: cleanText(metadata.ShipName) ?? known.shipName ?? null,
    callSign: known.callSign ?? null,
    shipType: known.shipType ?? finite(message.Type ?? message.ShipType),
    destination: known.destination ?? null,
    navigationalStatus: finite(message.NavigationalStatus),
    longitude,
    latitude,
    speedKnots: finite(message.Sog ?? message.SpeedOverGround),
    course: finite(message.Cog ?? message.CourseOverGround),
    heading: finite(message.TrueHeading),
    observedAt: messageTime(metadata),
  });
  received += 1;
}

async function flush() {
  if (!pending.size) return;
  const rows = [...pending.values()].slice(0, 1000);
  const fields = ["mmsi", "shipName", "callSign", "shipType", "destination", "navigationalStatus", "longitude", "latitude", "speedKnots", "course", "heading", "observedAt"];
  const values = [];
  const tuples = rows.map((row, rowIndex) => {
    const placeholders = fields.map((field, fieldIndex) => {
      values.push(row[field]);
      return `$${rowIndex * fields.length + fieldIndex + 1}`;
    });
    return `(${placeholders.join(",")}, now())`;
  });
  await pool.query(`
    INSERT INTO ais_vessel_positions
      (mmsi, ship_name, call_sign, ship_type, destination, navigational_status,
       longitude, latitude, speed_knots, course, heading, observed_at, received_at)
    VALUES ${tuples.join(",")}
    ON CONFLICT (mmsi) DO UPDATE SET
      ship_name = COALESCE(EXCLUDED.ship_name, ais_vessel_positions.ship_name),
      call_sign = COALESCE(EXCLUDED.call_sign, ais_vessel_positions.call_sign),
      ship_type = COALESCE(EXCLUDED.ship_type, ais_vessel_positions.ship_type),
      destination = COALESCE(EXCLUDED.destination, ais_vessel_positions.destination),
      navigational_status = EXCLUDED.navigational_status,
      longitude = EXCLUDED.longitude,
      latitude = EXCLUDED.latitude,
      speed_knots = EXCLUDED.speed_knots,
      course = EXCLUDED.course,
      heading = EXCLUDED.heading,
      observed_at = EXCLUDED.observed_at,
      received_at = now()
    WHERE EXCLUDED.observed_at >= ais_vessel_positions.observed_at
  `, values);
  // Only delete the exact observation that was written. If a newer message
  // arrived during the query, its object has replaced this one and must stay
  // queued for the next flush.
  for (const row of rows) {
    if (pending.get(row.mmsi) === row) pending.delete(row.mmsi);
  }
  written += rows.length;
}

function connect() {
  if (stopped) return;
  socket = new WebSocket("wss://stream.aisstream.io/v0/stream", { perMessageDeflate: true });
  socket.addEventListener("open", () => {
    reconnectAttempt = 0;
    lastMessageAt = Date.now();
    socket.send(JSON.stringify({
      APIKey: apiKey,
      BoundingBoxes: [[[south, west], [north, east]]],
      FilterMessageTypes: ["PositionReport", "StandardClassBPositionReport", "ExtendedClassBPositionReport", "ShipStaticData", "StaticDataReport"],
    }));
    console.log(`ais: connected; bbox=${south},${west},${north},${east}`);
  });
  socket.addEventListener("message", (event) => { lastMessageAt = Date.now(); ingest(String(event.data)); });
  socket.addEventListener("pong", () => { lastMessageAt = Date.now(); });
  socket.addEventListener("error", () => socket?.close());
  socket.addEventListener("close", () => {
    if (stopped) return;
    const delay = Math.min(30_000, 1000 * 2 ** reconnectAttempt) + Math.floor(Math.random() * 500);
    reconnectAttempt += 1;
    console.warn(`ais: disconnected; reconnecting in ${delay}ms`);
    setTimeout(connect, delay);
  });
}

const flushTimer = setInterval(() => flush().catch((error) => console.error("ais: flush failed", error)), 2000);
const reportTimer = setInterval(() => console.log(`ais: received=${received} written=${written} pending=${pending.size}`), 60_000);
const heartbeatTimer = setInterval(() => {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  if (Date.now() - lastMessageAt > 90_000) socket.terminate();
  else socket.ping();
}, 30_000);
const cleanupTimer = setInterval(() => {
  pool.query("delete from ais_vessel_positions where received_at < now() - interval '24 hours'")
    .catch((error) => console.error("ais: cleanup failed", error));
}, 60 * 60_000);

async function shutdown(signal) {
  if (stopped) return;
  stopped = true;
  clearInterval(flushTimer);
  clearInterval(reportTimer);
  clearInterval(heartbeatTimer);
  clearInterval(cleanupTimer);
  socket?.close();
  await flush().catch(() => undefined);
  await pool.end();
  console.log(`ais: stopped (${signal})`);
}

process.on("SIGINT", () => void shutdown("SIGINT").then(() => process.exit(0)));
process.on("SIGTERM", () => void shutdown("SIGTERM").then(() => process.exit(0)));
connect();

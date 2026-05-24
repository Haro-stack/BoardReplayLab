#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  convertDinoBoardReplayToGemTable,
  convertGemTableReplayToDinoBoard,
  DINOBOARD_SCHEMA
} from "../lib/dinoboard-splendor2p-bridge.mjs";

function usage() {
  return [
    "Usage:",
    "  node splendor/scripts/convert-dinoboard-splendor.mjs --direction gemtable-to-dinoboard --in replay.json [--out ./dinoboard-replays] [--ai-seat 1]",
    "  node splendor/scripts/convert-dinoboard-splendor.mjs --direction dinoboard-to-gemtable --in framed-replay.json [--out ./gemtable-replays]",
    "",
    "Notes:",
    "  - Supports Splendor 2P only.",
    "  - gemtable-to-dinoboard emits DinoBoard AI observation wire data.",
    "  - dinoboard-to-gemtable requires framed DinoBoard replay input; action_history-only data is rejected."
  ].join("\n");
}

function parseArgs(argv) {
  const args = { direction: "", input: "", out: "", aiSeat: 1 };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--direction" || value === "-d") args.direction = argv[++index] || "";
    else if (value === "--in" || value === "-i") args.input = argv[++index] || "";
    else if (value === "--out" || value === "-o") args.out = argv[++index] || "";
    else if (value === "--ai-seat") args.aiSeat = Number(argv[++index]);
    else if (value === "--help" || value === "-h") {
      console.log(usage());
      process.exit(0);
    }
  }
  return args;
}

function outputName(inputPath, direction) {
  const base = path.basename(inputPath).replace(/\.[^.]+$/, "");
  if (direction === "gemtable-to-dinoboard") return `dinoboard-splendor2p-${base}.json`;
  return `gemtable-dinoboard-${base}.json`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input || !args.direction) {
    console.error(usage());
    process.exit(1);
  }
  const inputPath = path.resolve(process.cwd(), args.input);
  const payload = JSON.parse(await readFile(inputPath, "utf8"));
  let converted;
  if (args.direction === "gemtable-to-dinoboard") {
    converted = convertGemTableReplayToDinoBoard(payload, { aiSeat: args.aiSeat });
  } else if (args.direction === "dinoboard-to-gemtable") {
    converted = convertDinoBoardReplayToGemTable(payload);
  } else {
    throw new Error(`Unknown conversion direction: ${args.direction}`);
  }

  const outputDir = path.resolve(process.cwd(), args.out || (converted.schema === DINOBOARD_SCHEMA ? "dinoboard-replays" : "gemtable-replays"));
  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, outputName(inputPath, args.direction));
  await writeFile(outputPath, JSON.stringify(converted), "utf8");
  console.log(`Saved ${outputPath}`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

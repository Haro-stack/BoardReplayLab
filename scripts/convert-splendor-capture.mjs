#!/usr/bin/env node
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAW_SCHEMA = "zephyrlabs-bga-replay-crawler-v1";
const GEMTABLE_SCHEMA = "zephyrlabs-gemtable-bga-v1";
const COLORS = ["white", "blue", "green", "red", "black"];
const ALL_TOKENS = COLORS.concat(["gold"]);

function usage() {
  return [
    "Usage:",
    "  node scripts/convert-splendor-capture.mjs --in ./bga-replays/bga-table-854928957-replay.json [--out ./gemtable-replays]",
    "",
    "Notes:",
    "  - Converts BGA archive log captures into ZephyrLabs Gem Table replay JSON.",
    "  - Only base-game Splendor captures are supported.",
    "  - Explicit active expansion flags such as isCitiesActivate=true are rejected.",
    "  - Descriptive text such as a noble_desc mentioning Silk Road is ignored unless an active flag is true."
  ].join("\n");
}

function parseArgs(argv) {
  const args = { input: "", out: "gemtable-replays" };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--in" || value === "-i") args.input = argv[++index] || "";
    else if (value === "--out" || value === "-o") args.out = argv[++index] || args.out;
    else if (value === "--help" || value === "-h") {
      console.log(usage());
      process.exit(0);
    }
  }
  return args;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function emptyCounts(includeGold) {
  const counts = {};
  COLORS.forEach((color) => {
    counts[color] = 0;
  });
  if (includeGold) counts.gold = 0;
  return counts;
}

function normalizeCost(cost) {
  const normalized = emptyCounts(false);
  COLORS.forEach((color) => {
    normalized[color] = Math.max(0, Number(cost && cost[color]) || 0);
  });
  return normalized;
}

function tokenCountForPlayers(playerCount) {
  if (playerCount === 2) return 4;
  if (playerCount === 3) return 5;
  return 7;
}

function scoreFor(player) {
  return player.purchased.reduce((sum, card) => sum + (Number(card.points) || 0), 0) +
    player.nobles.reduce((sum, noble) => sum + (Number(noble.points) || 0), 0);
}

function gameStateTextFor(game) {
  if (game.gameOver) return "Game finished";
  return "BGA replay import";
}

function compactSourceState(game) {
  return {
    schema: GEMTABLE_SCHEMA,
    table_seed: game.table_seed,
    next_move_id: game.next_move_id,
    players: clone(game.players),
    bank: clone(game.bank),
    decks: clone(game.decks),
    market: clone(game.market),
    nobles: clone(game.nobles),
    current: game.current,
    round: game.round,
    log: Array.isArray(game.log) ? game.log.slice() : [],
    moves: [],
    initial_gamedatas: null,
    awaitingDiscard: false,
    awaitingNobleChoice: null,
    endTriggered: false,
    finalTurnsLeft: null,
    gameOver: !!game.gameOver,
    turnTransition: null,
    aiThinking: null,
    mode: "live"
  };
}

function toGamedatas(game, includeSourceState) {
  const players = {};
  game.players.forEach((player, index) => {
    players[player.id] = {
      id: player.id,
      no: index + 1,
      name: player.name,
      score: scoreFor(player),
      tokens: clone(player.tokens),
      bonuses: clone(player.bonuses),
      reserved: clone(player.reserved),
      purchased_count: player.purchased.length,
      purchased: clone(player.purchased),
      nobles: clone(player.nobles),
      ai: clone(player.ai || { enabled: false, mode: null, level: "balanced", available: false })
    };
  });
  const data = {
    schema: GEMTABLE_SCHEMA,
    table: {
      player_count: game.players.length,
      round: game.round,
      current_player_id: game.players[game.current] ? game.players[game.current].id : null,
      active_player_id: game.players[game.current] ? game.players[game.current].id : null,
      next_move_id: game.next_move_id,
      mode: "replay"
    },
    gamestate: {
      name: game.gameOver ? "gameEnd" : "playerTurn",
      description: gameStateTextFor(game),
      active_player: game.players[game.current] ? game.players[game.current].id : null
    },
    players,
    playerorder: game.players.map((player) => player.id),
    bank: clone(game.bank),
    market: clone(game.market),
    nobles: clone(game.nobles),
    decks_remaining: { 1: game.decks[1].length, 2: game.decks[2].length, 3: game.decks[3].length },
    awaiting: { discard: false, noble_choice: null },
    end: { triggered: false, final_turns_left: null, game_over: !!game.gameOver },
    log: game.log.slice()
  };
  if (includeSourceState) data.source_state = compactSourceState(game);
  return data;
}

function extractBgaReplayData(payload) {
  if (payload && payload.data && Array.isArray(payload.data.logs)) return payload.data;
  const responses = payload && Array.isArray(payload.responses) ? payload.responses : [];
  for (const response of responses) {
    const parsed = response && response.parsed_json;
    if (parsed && parsed.data && Array.isArray(parsed.data.logs)) return parsed.data;
  }
  return null;
}

function expansionLabelFor(value) {
  const text = String(value || "");
  const patterns = [
    { label: "Silk Road", re: /silk[_\-\s]?road|silkroad/i },
    { label: "Cities", re: /cities|city/i },
    { label: "Orient", re: /orient/i },
    { label: "Trading", re: /trading/i },
    { label: "Strongholds", re: /stronghold/i },
    { label: "Expansion", re: /expansion|extension/i }
  ];
  const match = patterns.find((entry) => entry.re.test(text));
  return match ? match.label : "";
}

function isActiveExpansionValue(value) {
  if (value === true) return true;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") return /^(true|1|yes|on|enabled|active)$/i.test(value.trim());
  return false;
}

function activeExpansionFlags(payload) {
  const active = [];
  function push(entry) {
    if (!active.some((item) => item.path === entry.path && item.label === entry.label)) active.push(entry);
  }
  function walk(value, pathName) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.slice(0, 1000).forEach((item, index) => walk(item, `${pathName}[${index}]`));
      return;
    }
    Object.keys(value).forEach((key) => {
      const child = value[key];
      const path = pathName ? `${pathName}.${key}` : key;
      if (path === "compatibility" || path.startsWith("compatibility.")) return;
      const label = expansionLabelFor(key);
      if (label && (typeof child !== "object" || child === null) && isActiveExpansionValue(child)) {
        push({ label, path, value: child });
      }
      walk(child, path);
    });
  }
  walk(payload, "");
  return active;
}

function bgaGemColor(code) {
  return {
    C: "white",
    S: "blue",
    E: "green",
    R: "red",
    O: "black",
    G: "gold"
  }[String(code || "").trim().toUpperCase()] || "";
}

function bgaTierFromCard(card, args) {
  const location = String(card && card.location || "");
  const match = location.match(/(?:market|draw)_(\d+)/);
  if (match) return Math.max(1, Math.min(3, Number(match[1]) || 1));
  const drawpile = Number(args && args.drawpile);
  if (drawpile >= 1 && drawpile <= 3) return drawpile;
  const rank = String(args && args.rank || "");
  const circles = (rank.match(/[◯○]/g) || []).length;
  return circles >= 1 && circles <= 3 ? circles : 1;
}

function bgaCardId(card, fallback) {
  const raw = card && (card.type || card.id) || fallback;
  return `bga-${String(raw || "unknown")}`;
}

function bgaCoinsFromGap(items, sign) {
  const counts = emptyCounts(true);
  (items || []).forEach((item) => {
    if (!item || item.type !== "coins") return;
    const gap = item.args && item.args.gap || {};
    Object.keys(gap).forEach((code) => {
      const color = bgaGemColor(code);
      const amount = Number(gap[code]) || 0;
      if (!color || amount * sign <= 0) return;
      counts[color] += Math.abs(amount);
    });
  });
  return counts;
}

function bgaTokenListFromCounts(counts) {
  const colors = [];
  ALL_TOKENS.forEach((color) => {
    for (let index = 0; index < (Number(counts[color]) || 0); index += 1) colors.push(color);
  });
  return colors;
}

function bgaCardFromNotification(item, groupItems, fallback) {
  const args = item && item.args || {};
  const card = args.card || fallback && fallback.card || {};
  const scoreItem = groupItems.find((entry) =>
    entry && entry.type === "updateScore" && String(entry.args && entry.args.player_id) === String(args.player_id || fallback && fallback.player_id)
  );
  const color = bgaGemColor(args.gem_type) || fallback && fallback.color || "gold";
  return {
    id: bgaCardId(card, fallback && fallback.id),
    bga_id: String(card.type || card.id || fallback && fallback.id || ""),
    tier: bgaTierFromCard(card, args),
    color,
    points: Math.max(0, Number(scoreItem && scoreItem.args && scoreItem.args.amount_vp) || 0),
    cost: normalizeCost({})
  };
}

function applyBgaCoinGaps(game, player, items) {
  (items || []).forEach((item) => {
    if (!item || item.type !== "coins") return;
    const gap = item.args && item.args.gap || {};
    Object.keys(gap).forEach((code) => {
      const color = bgaGemColor(code);
      const delta = Number(gap[code]) || 0;
      if (!color || !delta) return;
      player.tokens[color] = Math.max(0, (player.tokens[color] || 0) + delta);
      game.bank[color] = Math.max(0, (game.bank[color] || 0) - delta);
    });
  });
}

function buildBgaPlayerList(data) {
  const players = Array.isArray(data && data.players) ? data.players.slice(0, 4) : [];
  const byId = {};
  players.forEach((player) => {
    byId[String(player.id)] = true;
  });
  (data && data.logs || []).forEach((packet) => {
    (packet.data || []).forEach((entry) => {
      const args = entry.args || {};
      const id = args.player_id;
      if (!id || byId[String(id)]) return;
      byId[String(id)] = true;
      players.push({ id, name: args.player_name || `BGA Player ${players.length + 1}` });
    });
  });
  return players.slice(0, 4);
}

function groupBgaPacketsByMove(logs) {
  const groups = {};
  (logs || []).forEach((packet) => {
    const moveId = String(packet && packet.move_id || packet && packet.packet_id || "");
    if (!moveId) return;
    if (!groups[moveId]) groups[moveId] = { move_id: moveId, items: [] };
    groups[moveId].items = groups[moveId].items.concat(packet.data || []);
  });
  return Object.keys(groups)
    .sort((a, b) => (Number(a) || 0) - (Number(b) || 0))
    .map((key) => groups[key]);
}

function createGameFromBgaPlayers(tableId, bgaPlayers) {
  const tokenCount = tokenCountForPlayers(bgaPlayers.length);
  const game = {
    schema: GEMTABLE_SCHEMA,
    created_at: new Date().toISOString(),
    mode: "live",
    playerCount: bgaPlayers.length,
    table_seed: 0,
    next_move_id: 1,
    players: bgaPlayers.map((player, index) => ({
      id: `p${index + 1}`,
      bga_id: String(player.id),
      name: String(player.name || `BGA Player ${index + 1}`).slice(0, 28),
      tokens: emptyCounts(true),
      bonuses: emptyCounts(false),
      reserved: [],
      purchased: [],
      nobles: [],
      ai: { enabled: false, mode: null, level: "balanced", available: false }
    })),
    bank: emptyCounts(true),
    decks: { 1: [], 2: [], 3: [] },
    market: { 1: [], 2: [], 3: [] },
    nobles: [],
    current: 0,
    round: 1,
    log: [`Imported BGA table ${tableId || "unknown"} archive log.`],
    moves: [],
    initial_gamedatas: null,
    gameOver: false
  };
  COLORS.forEach((color) => {
    game.bank[color] = tokenCount;
  });
  game.bank.gold = 5;
  return game;
}

function applyBgaMoveGroup(game, group, playerLookup) {
  const items = group.items || [];
  const publicReserve = items.find((entry) => entry.type === "reserveCard" && (entry.log || entry.args && entry.args.player_name));
  const privateReserve = items.find((entry) => entry.type === "reserveCard" && entry.args && entry.args.card);
  const buy = items.find((entry) => entry.type === "buyCard");
  const claim = items.find((entry) => entry.type === "claimNoble");
  const end = items.find((entry) => entry.type === "simpleNode" && /end of game/i.test(entry.log || ""));
  const coins = items.filter((entry) => entry.type === "coins");
  const primary = buy || publicReserve || privateReserve || claim || coins[0] || end;
  if (!primary) return null;
  const primaryArgs = primary.args || {};
  let externalId = String(primaryArgs.player_id || "");
  if (!externalId && coins[0] && coins[0].args) externalId = String(coins[0].args.player_id || "");
  const player = playerLookup[externalId] || game.players[0];
  if (!player) return null;
  game.current = Math.max(0, game.players.indexOf(player));
  applyBgaCoinGaps(game, player, coins);

  if (buy) {
    const buyCard = bgaCardFromNotification(buy, items, { player_id: externalId });
    const fromHand = /hand/i.test(String(buy.args && buy.args.card && buy.args.card.location || ""));
    if (fromHand) {
      const reservedIndex = player.reserved.findIndex((card) =>
        card.bga_id && card.bga_id === buyCard.bga_id || card.id === buyCard.id
      );
      if (reservedIndex >= 0) {
        buyCard.reserved_from = player.reserved[reservedIndex].reserved_from;
        player.reserved.splice(reservedIndex, 1);
      } else {
        buyCard.reserved_from = "deck";
      }
    }
    if (COLORS.includes(buyCard.color)) player.bonuses[buyCard.color] += 1;
    player.purchased.push(buyCard);
    return {
      type: fromHand ? "buyReserved" : "buyMarket",
      player,
      args: {
        card_id: buyCard.id,
        card: buyCard,
        tier: buyCard.tier,
        reserved_from: buyCard.reserved_from || "market",
        payment: { tokens: bgaCoinsFromGap(coins, -1), gold_as: emptyCounts(false) }
      }
    };
  }

  if (publicReserve || privateReserve) {
    const reserveItem = publicReserve || privateReserve;
    const cardSource = privateReserve && privateReserve.args && privateReserve.args.card || reserveItem.args && reserveItem.args.card || {};
    const fromDeck = /^draw_/i.test(String(cardSource.location || "")) || !!(reserveItem.args && reserveItem.args.drawpile);
    const reserveCard = bgaCardFromNotification(reserveItem, items, { card: cardSource, id: cardSource.type || cardSource.id, player_id: externalId });
    reserveCard.reserved_from = fromDeck ? "deck" : "market";
    reserveCard.reserved_public = !fromDeck;
    if (player.reserved.length < 3) player.reserved.push(reserveCard);
    return {
      type: fromDeck ? "reserveDeck" : "reserveMarket",
      player,
      args: {
        card_id: reserveCard.id,
        card: reserveCard,
        tier: reserveCard.tier,
        took_gold: (bgaCoinsFromGap(coins, 1).gold || 0) > 0
      }
    };
  }

  if (claim) {
    const noble = {
      id: `bga-noble-${String(claim.args && claim.args.card && (claim.args.card.type || claim.args.card.id) || group.move_id)}`,
      name: String(claim.args && claim.args.noble_desc || "BGA noble"),
      points: 3,
      req: normalizeCost({})
    };
    player.nobles.push(noble);
    return { type: "chooseNoble", player, args: { noble_id: noble.name } };
  }

  if (coins.length) {
    return {
      type: "takeTokens",
      player,
      args: { colors: bgaTokenListFromCounts(bgaCoinsFromGap(coins, 1)) }
    };
  }

  if (end) {
    game.gameOver = true;
    return { type: "gameEnd", player, args: {} };
  }
  return null;
}

export function convertBgaCaptureToGemTableReplay(payload) {
  const activeFlags = activeExpansionFlags(payload);
  if (activeFlags.length) {
    const details = activeFlags.map((entry) => `${entry.label} at ${entry.path}`).join("; ");
    throw new Error(`Active expansion flag detected: ${details}`);
  }
  if (payload && payload.compatibility && payload.compatibility.expansion_detection && Array.isArray(payload.compatibility.expansion_detection.active) && payload.compatibility.expansion_detection.active.length) {
    const details = payload.compatibility.expansion_detection.active.map((entry) => `${entry.label || "Expansion"} at ${entry.path || "unknown path"}`).join("; ");
    throw new Error(`Active expansion flag detected: ${details}`);
  }
  const data = extractBgaReplayData(payload);
  if (!data) throw new Error("No BGA archive logs were found in the capture JSON.");
  const bgaPlayers = buildBgaPlayerList(data);
  if (bgaPlayers.length < 2) throw new Error("At least two BGA players are required for a Gem Table replay.");

  const game = createGameFromBgaPlayers(payload.table_id, bgaPlayers);
  const playerLookup = {};
  bgaPlayers.forEach((player, index) => {
    if (game.players[index]) playerLookup[String(player.id)] = game.players[index];
  });
  game.initial_gamedatas = toGamedatas(game, true);

  groupBgaPacketsByMove(data.logs).forEach((group) => {
    const converted = applyBgaMoveGroup(game, group, playerLookup);
    if (!converted) return;
    const actor = converted.player;
    const move = {
      move_id: game.next_move_id,
      type: converted.type,
      player_id: actor.id,
      args: converted.args || {},
      notification: {
        type: converted.type,
        log: "",
        args: Object.assign({ player_id: actor.id, player_name: actor.name, bga_move_id: group.move_id }, converted.args || {})
      },
      state_after: toGamedatas(game, true)
    };
    game.log.unshift(`${actor.name} ${converted.type} (BGA move ${group.move_id}).`);
    game.moves.push(move);
    game.next_move_id += 1;
  });

  if (!game.moves.length) throw new Error("No supported Splendor actions were found in the BGA archive logs.");
  return {
    schema: GEMTABLE_SCHEMA,
    next_move_id: game.next_move_id,
    gamedatas: game.initial_gamedatas,
    moves: game.moves,
    source: "BoardReplayLab",
    source_schema: payload.schema || RAW_SCHEMA,
    bga_table_id: payload.table_id || "",
    compatibility: {
      base_game_only: true,
      active_expansion_flags: [],
      notes: [
        "BGA archive logs do not expose the full private initial gamedatas object.",
        "Card costs that are not present in archive notifications are left empty.",
        "The output is ZephyrLabs Gem Table replay schema compatible, not an official BGA protocol clone."
      ]
    }
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) {
    console.error(usage());
    process.exit(1);
  }
  const inputPath = path.resolve(process.cwd(), args.input);
  const payload = JSON.parse(await readFile(inputPath, "utf8"));
  const replay = convertBgaCaptureToGemTableReplay(payload);
  const outputDir = path.resolve(process.cwd(), args.out);
  await mkdir(outputDir, { recursive: true });
  const tableId = String(replay.bga_table_id || path.basename(inputPath).replace(/\.[^.]+$/, ""));
  const outputPath = path.join(outputDir, `gemtable-bga-table-${tableId}-replay.json`);
  await writeFile(outputPath, JSON.stringify(replay), "utf8");
  console.log(`Saved ${outputPath}`);
  console.log(`Moves: ${replay.moves.length}`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

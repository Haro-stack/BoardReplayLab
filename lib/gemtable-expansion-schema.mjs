const GEMTABLE_BASE_SCHEMA = "zephyrlabs-gemtable-bga-v1";
const GEMTABLE_EXPANSION_SCHEMA = "zephyrlabs-gemtable-bga-v2";
const ORIENT_EXPANSION = "Orient";
const COLORS = ["white", "blue", "green", "red", "black"];

const MARKET_AREA_IDS = Object.freeze({
  BASE: "base",
  ORIENT: "orient"
});

const UNSUPPORTED_REASON_CODES = Object.freeze({
  ACTIVE_EXPANSION: "bga.active_expansion.unsupported",
  ORIENT_LIVE_IMPORT: "bga.orient.live_import_unsupported",
  ORIENT_ABILITY_METADATA_ONLY: "gemtable.orient.ability_metadata_only"
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function firstDefined() {
  for (let index = 0; index < arguments.length; index += 1) {
    if (arguments[index] !== undefined && arguments[index] !== null && arguments[index] !== "") {
      return arguments[index];
    }
  }
  return undefined;
}

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function areaIdFor(value) {
  const text = normalizeKey(value);
  if (text.includes("orient")) return MARKET_AREA_IDS.ORIENT;
  return MARKET_AREA_IDS.BASE;
}

function areaLabel(area) {
  return area === MARKET_AREA_IDS.ORIENT ? ORIENT_EXPANSION : null;
}

function parseTierFromLocation(value) {
  const match = String(value || "").match(/(?:market|row|draw|orient)[_\-\s]*(\d)/i);
  if (!match) return null;
  const tier = Number(match[1]);
  return tier >= 1 && tier <= 3 ? tier : null;
}

function toTier(value) {
  const tier = Number(value);
  if (tier >= 1 && tier <= 3) return tier;
  return 1;
}

function toSlotIndex(value) {
  const index = Number(value);
  if (Number.isInteger(index) && index >= 0) return index;
  return 0;
}

function emptyCounts() {
  return Object.fromEntries(COLORS.map((color) => [color, 0]));
}

function bgaGemColor(code) {
  return {
    C: "white",
    S: "blue",
    E: "green",
    R: "red",
    O: "black"
  }[String(code || "").trim().toUpperCase()] || "";
}

function bgaCardTypeColor(type) {
  return COLORS[Number(type)] || "";
}

function normalizeCost(cost) {
  const counts = emptyCounts();
  if (!cost) return counts;
  if (typeof cost === "string") {
    cost.split("").forEach((code) => {
      const color = bgaGemColor(code);
      if (color) counts[color] += 1;
    });
    return counts;
  }
  Object.keys(cost).forEach((key) => {
    const color = bgaGemColor(key) || (COLORS.includes(key) ? key : "");
    if (color) counts[color] = Math.max(0, Number(cost[key]) || 0);
  });
  return counts;
}

function objectValues(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  return Object.keys(value).map((key) => value[key]);
}

function rawCardId(card, fallback) {
  return String(firstDefined(card && card.id, card && card.type_arg, card && card.type, fallback, "unknown"));
}

function bgaCardDbEntry(gamedatas, rawId) {
  const db = gamedatas && gamedatas.carddb || {};
  return db[String(rawId)] || null;
}

function hasOrientMarker(raw) {
  if (!raw || typeof raw !== "object") return false;
  return [
    raw.expansion,
    raw.module,
    raw.origin,
    raw.family,
    raw.location,
    raw.location_name,
    raw.deck,
    raw.source
  ].some((value) => /orient/i.test(String(value || ""))) ||
    raw.orient === true ||
    raw.orient === 1 ||
    String(raw.orient || "").toLowerCase() === "true";
}

function abilityValue(raw) {
  if (!raw || typeof raw !== "object") return undefined;
  return firstDefined(
    raw.ability_code,
    raw.ability,
    raw.power_code,
    raw.power,
    raw.effect_code,
    raw.effect,
    raw.special,
    raw.bonus_effect
  );
}

function abilityText(raw) {
  if (!raw || typeof raw !== "object") return "";
  return String(firstDefined(
    raw.ability_text,
    raw.abilityText,
    raw.power_text,
    raw.text,
    raw.description,
    raw.desc,
    raw.tooltip,
    raw.card_desc
  ) || "");
}

function abilityCodeFromValue(value) {
  if (!value) return "";
  if (typeof value === "string" || typeof value === "number") return normalizeKey(value);
  if (typeof value === "object") {
    return normalizeKey(firstDefined(value.code, value.id, value.type, value.name, value.label));
  }
  return "";
}

function abilityRawSnippet(raw, value) {
  if (!raw || typeof raw !== "object") return {};
  const snippet = {};
  [
    "ability_code",
    "ability",
    "ability_text",
    "power_code",
    "power",
    "power_text",
    "effect_code",
    "effect",
    "special",
    "bonus_effect",
    "orient"
  ].forEach((key) => {
    if (raw[key] !== undefined) snippet[key] = raw[key];
  });
  if (value && typeof value === "object") snippet.value = value;
  return clone(snippet);
}

function marketAreaTemplate(id) {
  return {
    id,
    expansion: areaLabel(id),
    tiers: { 1: [], 2: [], 3: [] }
  };
}

function rowCards(row) {
  if (!row) return [];
  if (Array.isArray(row)) return row;
  if (row.cards) return objectValues(row.cards);
  return objectValues(row);
}

function candidateRows(market, area, tier) {
  if (!market || typeof market !== "object") return [];
  if (area === MARKET_AREA_IDS.BASE) {
    return [
      market[`row_${tier}`],
      market[`market_${tier}`],
      market[tier]
    ].filter(Boolean);
  }
  const orient = market.orient || market.orient_rows || market.expansion_orient || {};
  return [
    market[`orient_row_${tier}`],
    market[`row_${tier}_orient`],
    market[`orient_${tier}`],
    orient[`row_${tier}`],
    orient[tier]
  ].filter(Boolean);
}

function normalizeBgaMarketCard(card, gamedatas, area, tier, index) {
  const rawId = rawCardId(card, index);
  const db = bgaCardDbEntry(gamedatas, rawId);
  const raw = Object.assign({}, db || {}, card || {});
  const slot = marketSlotIdentity({
    area,
    tier: firstDefined(raw.lvl, raw.tier, tier),
    index: firstDefined(raw.location_arg, raw.slot, raw.position, raw.pos, index),
    location: raw.location,
    cardId: rawId
  });
  const orientCard = slot.area === MARKET_AREA_IDS.ORIENT || hasOrientMarker(raw);
  return {
    id: `bga-${rawId}`,
    bga_id: rawId,
    tier: slot.tier,
    color: bgaCardTypeColor(raw.type) || String(raw.color || ""),
    points: Math.max(0, Number(raw.points) || 0),
    cost: normalizeCost(raw.cost),
    slot,
    ability: orientCard ? normalizeCardAbilityMetadata(raw, { expansion: ORIENT_EXPANSION }) : null
  };
}

export function marketSlotIdentity(input = {}) {
  const location = input.location || "";
  const area = areaIdFor(firstDefined(input.area, location));
  const tier = toTier(firstDefined(input.tier, parseTierFromLocation(location)));
  const index = toSlotIndex(firstDefined(input.index, input.slot, input.position));
  return {
    area,
    expansion: areaLabel(area),
    tier,
    index,
    slot_id: `${area}:t${tier}:s${index}`,
    card_id: input.cardId ? String(input.cardId) : "",
    legacy_args: area === MARKET_AREA_IDS.BASE ? { tier, market_index: index } : null
  };
}

export function unsupportedReason(code, details = {}) {
  if (code === UNSUPPORTED_REASON_CODES.ACTIVE_EXPANSION) {
    const label = details.label || "Expansion";
    const path = details.path || "unknown path";
    return {
      code,
      label,
      path,
      value: details.value,
      message: `Active expansion flag detected: ${label} at ${path}. Live BGA expansion conversion is not supported yet.`
    };
  }
  if (code === UNSUPPORTED_REASON_CODES.ORIENT_LIVE_IMPORT) {
    return {
      code,
      label: ORIENT_EXPANSION,
      message: "Orient market and ability metadata can be normalized for fixtures, but live BGA Orient replay import is not supported yet."
    };
  }
  if (code === UNSUPPORTED_REASON_CODES.ORIENT_ABILITY_METADATA_ONLY) {
    const abilityCode = details.ability_code || "unknown_orient_ability";
    return {
      code,
      label: ORIENT_EXPANSION,
      ability_code: abilityCode,
      message: `Orient ability ${abilityCode} is preserved as metadata only and is not executable by the base-game converter.`
    };
  }
  return {
    code,
    message: details.message || "Unsupported conversion feature."
  };
}

export function activeExpansionUnsupportedReason(flag = {}) {
  return unsupportedReason(UNSUPPORTED_REASON_CODES.ACTIVE_EXPANSION, flag);
}

export function normalizeCardAbilityMetadata(raw = {}, options = {}) {
  const value = abilityValue(raw);
  const code = abilityCodeFromValue(value) || "unknown_orient_ability";
  const text = abilityText(raw);
  const expansion = options.expansion || ORIENT_EXPANSION;
  return {
    expansion,
    code,
    label: String(firstDefined(value && value.label, value && value.name, raw.ability_label, code) || code),
    text,
    triggers: Array.isArray(raw.triggers) ? raw.triggers.slice() : [],
    effects: Array.isArray(raw.effects) ? raw.effects.slice() : [],
    support_status: "metadata_only",
    unsupported_reason: unsupportedReason(UNSUPPORTED_REASON_CODES.ORIENT_ABILITY_METADATA_ONLY, { ability_code: code }),
    raw: abilityRawSnippet(raw, value)
  };
}

export function normalizeBgaGamedatasForGemTableV2(gamedatas, options = {}) {
  const areas = {
    base: marketAreaTemplate(MARKET_AREA_IDS.BASE),
    orient: marketAreaTemplate(MARKET_AREA_IDS.ORIENT)
  };
  const market = gamedatas && gamedatas.market || {};
  [MARKET_AREA_IDS.BASE, MARKET_AREA_IDS.ORIENT].forEach((area) => {
    [1, 2, 3].forEach((tier) => {
      candidateRows(market, area, tier).forEach((row) => {
        rowCards(row).forEach((card, index) => {
          if (!card) return;
          areas[area].tiers[tier].push(normalizeBgaMarketCard(card, gamedatas, area, tier, index));
        });
      });
    });
  });
  const hasOrientArea = [1, 2, 3].some((tier) => areas.orient.tiers[tier].length > 0);
  const activeExpansions = (options.activeExpansions || (hasOrientArea ? [ORIENT_EXPANSION] : []))
    .map((value) => String(value || ""))
    .filter(Boolean);
  const unsupportedReasons = activeExpansions.includes(ORIENT_EXPANSION)
    ? [unsupportedReason(UNSUPPORTED_REASON_CODES.ORIENT_LIVE_IMPORT)]
    : [];
  return {
    schema: GEMTABLE_EXPANSION_SCHEMA,
    base_schema: GEMTABLE_BASE_SCHEMA,
    source: "bga-gamedatas",
    expansion_status: {
      active: activeExpansions,
      live_import_supported: false,
      unsupported_reasons: unsupportedReasons
    },
    market_areas: areas,
    card_ability_metadata: areas.orient.tiers[1]
      .concat(areas.orient.tiers[2], areas.orient.tiers[3])
      .map((card) => ({ card_id: card.id, slot_id: card.slot.slot_id, ability: card.ability }))
  };
}

export {
  COLORS,
  GEMTABLE_BASE_SCHEMA,
  GEMTABLE_EXPANSION_SCHEMA,
  MARKET_AREA_IDS,
  ORIENT_EXPANSION,
  UNSUPPORTED_REASON_CODES
};

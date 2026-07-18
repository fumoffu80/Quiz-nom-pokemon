#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import vm from "node:vm";

const target = process.argv[2] || "index.html";
const html = await readFile(target, "utf8");
const errors = [];

function check(condition, message) {
  if (!condition) errors.push(message);
}

function readJsonConstant(name) {
  const expression = new RegExp(`const ${name} = (.*);\\n`).exec(html)?.[1];
  if (!expression) {
    errors.push(`Constante ${name} introuvable.`);
    return null;
  }
  try {
    return JSON.parse(expression);
  } catch (error) {
    errors.push(`JSON invalide pour ${name}: ${error.message}`);
    return null;
  }
}

const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1];
check(Boolean(script), "Bloc JavaScript principal introuvable.");
if (script) {
  try {
    new vm.Script(script, { filename: target });
  } catch (error) {
    errors.push(`Syntaxe JavaScript invalide: ${error.message}`);
  }
}

const snapshot = readJsonConstant("OFFLINE_SNAPSHOT");
const sprites = readJsonConstant("LOCAL_SPRITES");
const minimumCount = 1025;
const expectedCount = snapshot?.count || 0;
const languages = ["fr", "en", "es", "de", "it", "ja"];

check(expectedCount >= minimumCount, `La base doit contenir au moins ${minimumCount} Pokémon.`);
check(snapshot?.identifiers?.length === expectedCount, "Nombre d'identifiants incorrect.");
if (snapshot?.schemaVersion >= 2) {
  check(snapshot?.generations?.length === expectedCount, "Attribution des générations incomplète.");
  check(snapshot?.generations?.every(Number.isInteger), "Une génération Pokémon est invalide.");
}
for (const language of languages) {
  check(snapshot?.names?.[language]?.length === expectedCount, `Traductions ${language} incomplètes.`);
  check(snapshot?.names?.[language]?.every(Boolean), `Un nom ${language} est vide.`);
}

check(Array.isArray(sprites) && sprites.length === expectedCount, "Nombre de sprites incorrect.");
if (Array.isArray(sprites)) {
  sprites.forEach((sprite, index) => {
    const signature = Buffer.from(sprite || "", "base64").subarray(0, 8).toString("hex");
    check(signature === "89504e470d0a1a0a", `Le sprite #${index + 1} n'est pas un PNG valide.`);
  });
}

const i18nStart = html.indexOf("const i18n = ");
const i18nEnd = html.indexOf("\n\n    /* Cette zone", i18nStart);
let translations;
try {
  const expression = html.slice(i18nStart + "const i18n = ".length, i18nEnd).trim().replace(/;$/, "");
  translations = vm.runInNewContext(`(${expression})`);
} catch (error) {
  errors.push(`Dictionnaire de traduction invalide: ${error.message}`);
}

if (translations?.fr) {
  const requiredKeys = Object.keys(translations.fr);
  for (const language of languages) {
    const missing = requiredKeys.filter(key => !translations[language]?.[key]);
    check(missing.length === 0, `Textes ${language} manquants: ${missing.join(", ")}`);
  }
}

const normalizeSource = script?.match(/function normalize\(str\) \{[\s\S]*?^    \}/m)?.[0];
let normalize;
try {
  normalize = vm.runInNewContext(`(${normalizeSource})`);
} catch (error) {
  errors.push(`Fonction de normalisation illisible: ${error.message}`);
}

if (normalize && snapshot) {
  const equivalentInputs = [
    ["Flabébé", "flabebe"],
    ["M. Mime", "m mime"],
    ["Ho-Oh", "ho oh"],
    ["Type:0", "type 0"],
    ["Sirfetch’d", "sirfetchd"],
    ["Nidoran♀", "nidoran femelle"],
    ["Nidoran♂", "nidoran male"]
  ];
  for (const [official, tolerant] of equivalentInputs) {
    check(normalize(official) === normalize(tolerant), `Saisie tolérante incorrecte: ${official} / ${tolerant}.`);
  }

  for (const language of languages) {
    const seen = new Map();
    snapshot.names[language].forEach((name, index) => {
      const normalized = normalize(name);
      const previous = seen.get(normalized);
      if (previous !== undefined) {
        errors.push(`Collision ${language}: #${previous + 1} et #${index + 1} (${name}).`);
      } else {
        seen.set(normalized, index);
      }
    });
  }
}

const generationRanges = [[1, 151], [152, 251], [252, 386], [387, 493], [494, 649], [650, 721], [722, 809], [810, 905], [906, 1025]];
check(generationRanges.at(-1)[1] === minimumCount, "Les générations historiques ne couvrent pas les 1025 Pokémon actuels.");

for (const id of [
  "generationSelect", "timerDialog", "timerPreset", "customHours", "customMinutes", "customSeconds",
  "welcomeScreen", "welcomeLanguage", "welcomeFlag", "welcomeGeneration", "welcomeStartButton",
  "pauseTimerBtn", "pauseOverlay", "resumeTimerButton", "victoryDialog"
]) {
  check(html.includes(`id="${id}"`), `Contrôle #${id} absent.`);
}

check(/<link rel="icon"[^>]+image\/svg\+xml[^>]+data:image\/svg\+xml/i.test(html), "Favicon Poké Ball autonome absent.");
check(!html.includes('id="welcomeFeatureOffline"'), "L'ancienne carte d'autonomie est encore affichée sur l'accueil.");
check(html.includes('class="pokedex-icon"'), "Pictogramme Pokédex absent de l'accueil.");
check(html.includes('background: rgba(3, 7, 18, 0.5)'), "Transparence à 50 % de l'accueil absente.");
check(html.includes('backdrop-filter: blur(16px)'), "Flou de protection derrière l'accueil absent.");
check(script?.includes("const REGION_NAMES ="), "Noms des régions Pokémon absents.");
check(script?.includes("function generationOptionLabel(number)"), "Régions non reliées aux générations.");
check(script?.includes("function findUniqueTypoMatch(value)"), "Validation automatique des petites fautes absente.");
check(script?.includes("function pauseTimeAttack()"), "Pause du chronomètre absente.");
check(script?.includes("function checkVictory()"), "Écran de victoire absent.");

for (const forbidden of ["updateButton", "checkForUpdates", "indexedDB", "POKEAPI_COUNT_URL", "fetch("]) {
  check(!html.includes(forbidden), `Accès réseau ou mise à jour navigateur interdit: ${forbidden}.`);
}
check(!/<(?:script|link|img)[^>]+(?:src|href)=["']https?:/i.test(html), "Une ressource externe empêche l'autonomie complète.");

if (errors.length) {
  console.error(`Validation échouée (${errors.length} erreur${errors.length > 1 ? "s" : ""}) :`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

const generationCount = snapshot?.generations ? new Set(snapshot.generations).size : 9;
console.log(`Validation réussie : ${expectedCount} Pokémon, ${languages.length} langues, ${sprites.length} sprites PNG, ${generationCount} générations avec régions, accueil flouté, saisie tolérante, pause et victoire.`);

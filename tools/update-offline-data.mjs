#!/usr/bin/env node

import { access, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const target = resolve(process.argv[2] || "index.html");
const csvBase = "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv";
const spriteBase = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";
const languages = { fr: 5, en: 9, es: 7, de: 6, it: 8, ja: 1 };
const START = "/*__OFFLINE_DATA_START__*/";
const END = "/*__OFFLINE_DATA_END__*/";

async function fetchWithRetry(url, options = {}, attempts = 4) {
  let lastError;
  const mayUseGitHubToken = process.env.GITHUB_TOKEN && new URL(url).hostname === "api.github.com";
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          "User-Agent": "pokemon-quiz-offline-updater",
          ...(mayUseGitHubToken ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
          ...(options.headers || {})
        }
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText} — ${url}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise(resolveDelay => setTimeout(resolveDelay, attempt * 750));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  const headers = rows.shift();
  return rows.filter(values => values.some(Boolean)).map(values =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]))
  );
}

function safeJson(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function disableBrowserUpdater(html) {
  let updated = html;

  // Retirer entièrement le bouton et son statut, même si le bouton avait été
  // seulement masqué avec l'attribut hidden dans une version précédente.
  updated = updated.replace(
    /\n\s*<button id="updateButton"[^>]*>[\s\S]*?<\/button>\n\s*<div id="syncStatus"[^>]*>[\s\S]*?<\/div>/,
    ""
  );

  updated = updated.replace(
    /\n    \.sync-status \{[\s\S]*?    #updateButton:disabled \{[^\n]*\}\n/,
    "\n"
  );
  updated = updated.replace(
    /^\s{8}(?:update|localReady|checking|updated|offline): .*?,\r?\n/gm,
    ""
  );
  updated = updated.replace(
    /^    let activeSnapshot = .*?\r?\n    let syncState = .*?\r?\n    let syncInProgress = .*?\r?\n    const spriteObjectUrls = .*?\r?\n/m,
    ""
  );
  updated = updated.replace(
    /^      document\.getElementById\('updateButton'\).*?\r?\n      setSyncStatus\(.*?\);\r?\n/m,
    ""
  );

  const startMarker = "    const UPDATE_INTERVAL = 7 * 24 * 60 * 60 * 1000;";
  const endMarker = '    window.addEventListener("DOMContentLoaded", loadPokemonList);';
  const start = updated.indexOf(startMarker);
  const end = updated.indexOf(endMarker, start);
  if (start >= 0 && end >= start) {
    const localOnlyRuntime = `    const LOCAL_LANGUAGES = ["fr", "en", "es", "de", "it", "ja"];
    const EMPTY_SPRITE = svgDataUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="12" fill="#111827"/><path fill="#4b5563" d="M48 17a31 31 0 1 0 0 62 31 31 0 0 0 0-62Zm0 8a23 23 0 0 1 21.6 15H55a10 10 0 0 0-14 0H26.4A23 23 0 0 1 48 25Zm0 46a23 23 0 0 1-21.6-15H41a10 10 0 0 0 14 0h14.6A23 23 0 0 1 48 71Zm0-23a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z"/></svg>');

    function isValidSnapshot(snapshot) {
      return snapshot
        && Number.isInteger(snapshot.count)
        && snapshot.count > 0
        && Array.isArray(snapshot.identifiers)
        && snapshot.identifiers.length >= snapshot.count
        && snapshot.names
        && LOCAL_LANGUAGES.every(language =>
          Array.isArray(snapshot.names[language]) && snapshot.names[language].length >= snapshot.count
        );
    }

    function pokemonFromSnapshot(snapshot) {
      return Array.from({ length: snapshot.count }, (_, index) => ({
        id: index + 1,
        defaultName: snapshot.identifiers[index] || snapshot.names.en[index],
        names: LOCAL_LANGUAGES.map(language => ({
          language: { name: language === "ja" ? "ja-Hrkt" : language },
          name: snapshot.names[language][index]
        }))
      }));
    }

    function applySnapshot(snapshot) {
      if (!isValidSnapshot(snapshot)) return false;
      MAX_POKEMON = snapshot.count;
      pokemonList = pokemonFromSnapshot(snapshot);
      totalElement.textContent = pokemonList.length;
      updateLanguageUI();
      createCards();
      restoreFoundPokemon();
      return true;
    }

    function localSpriteSource(id) {
      const encoded = LOCAL_SPRITES[id - 1];
      return encoded ? \`data:image/png;base64,\${encoded}\` : EMPTY_SPRITE;
    }

    function spriteSource(id) {
      return localSpriteSource(id);
    }

    function loadPokemonList() {
      loadProgress();
      applySnapshot(OFFLINE_SNAPSHOT);
    }

    window.addEventListener("DOMContentLoaded", loadPokemonList);`;
    updated = updated.slice(0, start)
      + localOnlyRuntime
      + updated.slice(end + endMarker.length);
  }

  return updated;
}

function extractExisting(html) {
  const blockStart = html.indexOf(START);
  const blockEnd = html.indexOf(END);
  if (blockStart < 0 || blockEnd < blockStart) return {};
  const block = html.slice(blockStart, blockEnd);
  const snapshotMatch = block.match(/const OFFLINE_SNAPSHOT = (\{.*?\});\n/s);
  const spritesMatch = block.match(/const LOCAL_SPRITES = (\[.*\]);\n/s);
  try {
    return {
      snapshot: snapshotMatch ? JSON.parse(snapshotMatch[1]) : null,
      sprites: spritesMatch ? JSON.parse(spritesMatch[1]) : null
    };
  } catch {
    return {};
  }
}

async function getSpriteCommit() {
  const response = await fetchWithRetry(
    "https://api.github.com/repos/PokeAPI/sprites/commits?path=sprites/pokemon&per_page=1",
    { headers: { Accept: "application/vnd.github+json" } }
  );
  const commits = await response.json();
  if (!commits[0]?.sha) throw new Error("Commit des sprites introuvable.");
  return commits[0].sha;
}

async function hasLocalSprite(directory, id) {
  if (!directory) return false;
  try {
    await access(resolve(directory, `${id}.png`));
    return true;
  } catch {
    return false;
  }
}

async function loadSprites(count) {
  const directory = process.env.POKE_SPRITES_DIR ? resolve(process.env.POKE_SPRITES_DIR) : null;
  const sprites = new Array(count);
  let cursor = 1;
  const workers = Array.from({ length: 24 }, async () => {
    while (true) {
      const id = cursor;
      cursor += 1;
      if (id > count) return;
      let bytes;
      if (await hasLocalSprite(directory, id)) {
        bytes = await readFile(resolve(directory, `${id}.png`));
      } else {
        const response = await fetchWithRetry(`${spriteBase}/${id}.png`);
        bytes = Buffer.from(await response.arrayBuffer());
      }
      sprites[id - 1] = bytes.toString("base64");
      if (id % 100 === 0 || id === count) process.stdout.write(`Sprites: ${id}/${count}\n`);
    }
  });
  await Promise.all(workers);
  return sprites;
}

async function main() {
  const html = await readFile(target, "utf8");
  if (!html.includes(START) || !html.includes(END)) {
    throw new Error(`Marqueurs ${START} et ${END} absents de ${target}.`);
  }
  const existing = extractExisting(html);
  const spriteCommitPromise = process.env.POKE_SPRITE_COMMIT
    ? Promise.resolve(process.env.POKE_SPRITE_COMMIT)
    : getSpriteCommit().catch(error => {
        console.warn(`Version GitHub des sprites indisponible (${error.message}); conservation de la référence locale.`);
        return existing.snapshot?.spriteCommit || `embedded-${new Date().toISOString().slice(0, 10)}`;
      });

  const localCsvDirectory = process.env.POKE_CSV_DIR ? resolve(process.env.POKE_CSV_DIR) : null;
  let countResponse, speciesText, namesText, spriteCommit;
  if (localCsvDirectory) {
    [speciesText, namesText, spriteCommit] = await Promise.all([
      readFile(resolve(localCsvDirectory, "pokemon_species.csv"), "utf8"),
      readFile(resolve(localCsvDirectory, "pokemon_species_names.csv"), "utf8"),
      spriteCommitPromise
    ]);
    countResponse = {
      json: async () => ({ count: parseCsv(speciesText).length }),
      headers: new Headers({ "x-pokeapi-hash": process.env.POKEAPI_HASH || "local-csv-snapshot" })
    };
  } else {
    [countResponse, speciesText, namesText, spriteCommit] = await Promise.all([
      fetchWithRetry("https://pokeapi.co/api/v2/pokemon-species?limit=1"),
      fetchWithRetry(`${csvBase}/pokemon_species.csv`).then(response => response.text()),
      fetchWithRetry(`${csvBase}/pokemon_species_names.csv`).then(response => response.text()),
      spriteCommitPromise
    ]);
  }
  const countPayload = await countResponse.json();
  const speciesRows = parseCsv(speciesText);
  const namesRows = parseCsv(namesText);
  const count = Math.min(Number(countPayload.count) || speciesRows.length, speciesRows.length);
  const identifiers = new Array(count);
  const names = Object.fromEntries(Object.keys(languages).map(language => [language, new Array(count)]));

  for (const row of speciesRows) {
    const id = Number(row.id);
    if (id >= 1 && id <= count) identifiers[id - 1] = row.identifier;
  }
  const languageById = Object.fromEntries(Object.entries(languages).map(([key, id]) => [id, key]));
  for (const row of namesRows) {
    const id = Number(row.pokemon_species_id);
    const language = languageById[Number(row.local_language_id)];
    if (language && id >= 1 && id <= count) names[language][id - 1] = row.name;
  }
  for (let id = 1; id <= count; id += 1) {
    const fallback = names.en[id - 1] || identifiers[id - 1] || `pokemon-${id}`;
    for (const language of Object.keys(names)) names[language][id - 1] ||= fallback;
  }

  const canReuseSprites = existing.snapshot?.spriteCommit === spriteCommit
    && Array.isArray(existing.sprites)
    && existing.sprites.length >= count;
  const sprites = canReuseSprites ? existing.sprites.slice(0, count) : await loadSprites(count);
  const snapshotCore = {
    schemaVersion: 1,
    pokeApiHash: countResponse.headers.get("x-pokeapi-hash") || "",
    spriteCommit,
    count,
    identifiers,
    names
  };
  const existingCore = existing.snapshot ? { ...existing.snapshot } : null;
  if (existingCore) delete existingCore.generatedAt;
  const sameSnapshot = existingCore && safeJson(existingCore) === safeJson(snapshotCore);
  const snapshot = {
    ...snapshotCore,
    generatedAt: sameSnapshot && existing.snapshot.generatedAt
      ? existing.snapshot.generatedAt
      : new Date().toISOString()
  };
  const replacement = `${START}\nconst OFFLINE_SNAPSHOT = ${safeJson(snapshot)};\nconst LOCAL_SPRITES = ${safeJson(sprites)};\n${END}`;
  const updatedWithData = html.slice(0, html.indexOf(START))
    + replacement
    + html.slice(html.indexOf(END) + END.length);
  const updated = disableBrowserUpdater(updatedWithData);
  await writeFile(target, updated, "utf8");
  process.stdout.write(`Mise à jour terminée: ${count} Pokémon, ${Buffer.byteLength(updated)} octets.\n`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

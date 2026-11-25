// main.ts — hands the Mie Kilat entry in: copies game/ and screenshots/
// from beside this file into the output directory and writes
// dossier.json with buildDossier from vendor/makefun-game.ts.
// Node 22 standard library only; runs twice and writes identical bytes.

import { chmodSync, cpSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoDir = dirname(fileURLToPath(import.meta.url));
const outputDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

mkdirSync(outputDir, { recursive: true });

for (const name of ['game', 'screenshots']) {
  cpSync(join(repoDir, name), join(outputDir, name), { recursive: true });
}

const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

writeFileSync(join(outputDir, 'dossier.json'), dossier, { mode: 0o644 });

// Modes must not depend on the caller's umask: every output file 0644,
// every output directory 0755, so both runs write identical modes too.
function setModes(dir: string): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      chmodSync(path, 0o755);
      setModes(path);
    } else {
      chmodSync(path, 0o644);
    }
  }
}

chmodSync(join(outputDir, 'dossier.json'), 0o644);
setModes(outputDir);

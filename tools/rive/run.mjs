#!/usr/bin/env node
/** Run the workspace-local Rive CLI with the sandbox's user-local libraries. */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const engine = path.join(root, 'tools', 'rive', 'engine', 'current', 'rive');
const libraries = path.join(root, 'tools', 'rive', 'runtime-libs');
if (!fs.existsSync(engine)) {
  console.error('Rive CLI belum terpasang. Jalankan: npm run rive:cli:install');
  process.exit(2);
}
const env = { ...process.env };
if (fs.existsSync(libraries)) {
  env.LD_LIBRARY_PATH = [libraries, env.LD_LIBRARY_PATH].filter(Boolean).join(':');
  // Headless --screenshot/--bench butuh driver Vulkan SwiftShader; tanpa ini
  // loader tidak menemukan ICD dan eglInitialize gagal (no display server).
  if (!env.VK_ICD_FILENAMES) {
    const icd = path.join(libraries, 'vk_swiftshader_icd.json');
    if (fs.existsSync(icd)) env.VK_ICD_FILENAMES = icd;
  }
}
const result = spawnSync(engine, process.argv.slice(2), {
  cwd: root,
  env,
  stdio: 'inherit',
});
if (result.error) {
  console.error(`[rive] ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);

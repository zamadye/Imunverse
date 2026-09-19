#!/usr/bin/env node
/**
 * Install the official Rive CLI into the workspace without sudo.
 *
 * Preferred offline path (useful in restricted sandboxes):
 *   node tools/rive/install.mjs --archive /path/to/rive-linux-x64.tar.gz
 *
 * Online path:
 *   node tools/rive/install.mjs
 *
 * The official CLI is distributed as a platform tarball, not an npm package.
 * Keep the complete extracted tree because the binary resolves its docs and
 * samples relative to itself. The install is intentionally ignored by git.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const VERSION = process.env.RIVE_VERSION || '1.1.0';
const PLATFORM = 'linux-x64';
const EXPECTED_SHA256 = '9d3f272d7d17f0b59de3de3fbf502a60ae7335de8913bf17d73c393613097b84';
const DEFAULT_URL = `https://releases.rive.app/cli/v${VERSION}/rive-${PLATFORM}.tar.gz`;
const INSTALL_ROOT = path.join(ROOT, 'tools', 'rive', 'engine');
const VERSION_DIR = path.join(INSTALL_ROOT, VERSION);
const ARCHIVE = process.env.RIVE_TARBALL || null;

const log = (message) => console.log(`[rive:install] ${message}`);
const fail = (message) => {
  console.error(`[rive:install] ERROR ${message}`);
  process.exit(1);
};

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function parseArgs() {
  const args = process.argv.slice(2);
  const i = args.indexOf('--archive');
  if (i >= 0 && args[i + 1]) return path.resolve(args[i + 1]);
  const u = args.indexOf('--url');
  if (u >= 0 && args[u + 1]) return args[u + 1];
  return ARCHIVE || DEFAULT_URL;
}

async function download(url, destination) {
  log(`downloading ${url}`);
  let response;
  try {
    response = await fetch(url);
  } catch (error) {
    fail(`download failed (${error.message}). Provide a local archive with --archive.`);
  }
  if (!response.ok) fail(`download failed with HTTP ${response.status}`);
  fs.writeFileSync(destination, Buffer.from(await response.arrayBuffer()));
}

function validateArchive(archive) {
  const digest = sha256(archive);
  if (digest !== EXPECTED_SHA256) {
    fail(`SHA-256 mismatch for ${archive}\nexpected ${EXPECTED_SHA256}\nactual   ${digest}`);
  }
  const members = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' })
    .split('\n').map((value) => value.trim()).filter(Boolean);
  for (const member of members) {
    if (member.startsWith('/') || member.includes('\\') || member.split('/').includes('..')) {
      fail(`unsafe archive member: ${member}`);
    }
  }
  if (!members.some((member) => member === 'rive' || member.endsWith('/rive'))) {
    fail('archive does not contain a rive binary');
  }
}

function findBinary(dir) {
  const direct = path.join(dir, 'rive');
  if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const candidate = findBinary(path.join(dir, entry.name));
    if (candidate) return candidate;
  }
  return null;
}

const source = parseArgs();
const temp = fs.mkdtempSync(path.join('/tmp', 'rive-cli-'));
const archive = path.join(temp, 'rive.tar.gz');
try {
  if (/^https?:\/\//i.test(source)) await download(source, archive);
  else {
    if (!fs.existsSync(source)) fail(`archive not found: ${source}`);
    fs.copyFileSync(source, archive);
  }

  validateArchive(archive);
  const extracted = path.join(temp, 'extracted');
  fs.mkdirSync(extracted, { recursive: true });
  execFileSync('tar', ['-xzf', archive, '-C', extracted]);
  const binary = findBinary(extracted);
  if (!binary) fail('could not locate rive after extraction');

  fs.rmSync(VERSION_DIR, { recursive: true, force: true });
  fs.mkdirSync(INSTALL_ROOT, { recursive: true });
  fs.cpSync(path.dirname(binary), VERSION_DIR, { recursive: true });
  const installedBinary = path.join(VERSION_DIR, 'rive');
  if (!fs.existsSync(installedBinary)) {
    // The tarball normally has rive at its root; retain this fallback for a
    // future archive that nests its payload one directory deeper.
    fs.copyFileSync(binary, installedBinary);
  }
  fs.chmodSync(installedBinary, 0o755);
  fs.rmSync(path.join(INSTALL_ROOT, 'current'), { force: true });
  fs.symlinkSync(VERSION_DIR, path.join(INSTALL_ROOT, 'current'), 'dir');
  fs.writeFileSync(path.join(INSTALL_ROOT, 'VERSION'), `${VERSION}\n`);

  log(`installed ${VERSION} at ${installedBinary}`);
  try {
    const runtimeLibs = path.join(ROOT, 'tools', 'rive', 'runtime-libs');
    const env = { ...process.env };
    if (fs.existsSync(runtimeLibs)) {
      env.LD_LIBRARY_PATH = [runtimeLibs, env.LD_LIBRARY_PATH].filter(Boolean).join(':');
    }
    execFileSync(installedBinary, ['--version'], { cwd: VERSION_DIR, stdio: 'inherit', env });
  } catch {
    fail('binary was unpacked but --version failed; run npm run rive:cli:runtime and retry');
  }
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

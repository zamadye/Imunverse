#!/usr/bin/env node
/**
 * Prepare user-local libraries for the official Rive CLI in this sandbox.
 *
 * The CLI binary links EGL/GLES, Wayland and xkbcommon even for commands that
 * do not open a window. The sandbox does not ship those system libraries. The
 * SwiftShader libraries come from the npm registry package used by Chromium;
 * tiny Wayland/xkbcommon compatibility shims are used only for headless CLI
 * startup, where no window is opened.
 *
 * This output is ignored by git. It is a runtime workaround, not a replacement
 * for the real system libraries on a normal Linux workstation.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const out = path.join(root, 'tools', 'rive', 'runtime-libs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rive-runtime-'));
const packageName = '@sparticuz/chromium@138.0.2';
const log = (message) => console.log(`[rive:runtime] ${message}`);

const xkbSource = `
#include <stddef.h>
void *xkb_state_unref(void){return NULL;}
void *xkb_compose_state_reset(void){return NULL;}
void *xkb_compose_state_unref(void){return NULL;}
void *xkb_compose_state_get_status(void){return NULL;}
void *xkb_compose_state_new(void){return NULL;}
void *xkb_keymap_key_repeats(void){return NULL;}
void *xkb_compose_table_new_from_locale(void){return NULL;}
void *xkb_keymap_unref(void){return NULL;}
void *xkb_state_mod_name_is_active(void){return NULL;}
void *xkb_state_new(void){return NULL;}
void *xkb_context_new(void){return NULL;}
void *xkb_state_update_mask(void){return NULL;}
void *xkb_state_key_get_one_sym(void){return NULL;}
void *xkb_keymap_new_from_string(void){return NULL;}
void *xkb_compose_table_unref(void){return NULL;}
void *xkb_state_key_get_utf8(void){return NULL;}
void *xkb_compose_state_get_utf8(void){return NULL;}
void *xkb_compose_state_feed(void){return NULL;}
void *xkb_context_unref(void){return NULL;}
`;
const waylandSource = `
struct wl_interface { const char *name; int version; int method_count; const void *methods; int event_count; const void *events; };
struct wl_interface wl_registry_interface={0};
struct wl_interface wl_callback_interface={0};
struct wl_interface wl_seat_interface={0};
struct wl_interface wl_compositor_interface={0};
struct wl_interface wl_keyboard_interface={0};
struct wl_interface wl_data_device_manager_interface={0};
struct wl_interface wl_data_source_interface={0};
struct wl_interface wl_surface_interface={0};
struct wl_interface wl_data_device_interface={0};
struct wl_interface wl_pointer_interface={0};
struct wl_interface wl_output_interface={0};
void *wl_display_prepare_read(void){return 0;}
void *wl_proxy_set_user_data(void){return 0;}
void *wl_proxy_get_version(void){return 0;}
void *wl_display_flush(void){return 0;}
void *wl_proxy_marshal_flags(void){return 0;}
void *wl_display_disconnect(void){return 0;}
void *wl_display_get_fd(void){return 0;}
void *wl_display_dispatch(void){return 0;}
void *wl_display_read_events(void){return 0;}
void *wl_proxy_add_listener(void){return 0;}
void *wl_display_roundtrip(void){return 0;}
void *wl_egl_window_destroy(void){return 0;}
void *wl_display_connect(void){return 0;}
void *wl_display_cancel_read(void){return 0;}
void *wl_proxy_get_user_data(void){return 0;}
void *wl_egl_window_create(void){return 0;}
void *wl_display_dispatch_pending(void){return 0;}
void *wl_egl_window_resize(void){return 0;}
void *wl_display_get_error(void){return 0;}
void *wl_proxy_destroy(void){return 0;}
`;

function run(command, args, options = {}) {
  execFileSync(command, args, { stdio: 'inherit', ...options });
}

try {
  fs.mkdirSync(out, { recursive: true });
  const npmDir = path.join(tmp, 'npm');
  fs.mkdirSync(npmDir);
  log(`fetching ${packageName} from npm`);
  run('npm', ['pack', packageName, '--silent'], { cwd: npmDir });
  const archive = fs.readdirSync(npmDir).find((file) => file.endsWith('.tgz'));
  if (!archive) throw new Error('Chromium npm archive was not created');
  run('tar', ['-xzf', path.join(npmDir, archive), '-C', tmp]);

  const compressed = path.join(tmp, 'package', 'bin', 'swiftshader.tar.br');
  const swiftTar = path.join(tmp, 'swiftshader.tar');
  fs.writeFileSync(swiftTar, zlib.brotliDecompressSync(fs.readFileSync(compressed)));
  run('tar', ['-xf', swiftTar, '-C', out]);
  for (const [target, link] of [['libEGL.so', 'libEGL.so.1'], ['libGLESv2.so', 'libGLESv2.so.2']]) {
    const linkPath = path.join(out, link);
    fs.rmSync(linkPath, { force: true });
    fs.symlinkSync(target, linkPath, 'file');
  }

  const xkbC = path.join(tmp, 'xkb.c');
  const xkbMap = path.join(tmp, 'xkb.ver');
  fs.writeFileSync(xkbC, xkbSource);
  fs.writeFileSync(xkbMap, 'V_0.5.0 { global: xkb_*; };\n');
  run('gcc', ['-shared', '-fPIC', xkbC, `-Wl,--version-script=${xkbMap}`, '-Wl,-soname,libxkbcommon.so.0', '-o', path.join(out, 'libxkbcommon.so.0')]);

  const waylandC = path.join(tmp, 'wayland.c');
  fs.writeFileSync(waylandC, waylandSource);
  run('gcc', ['-shared', '-fPIC', waylandC, '-Wl,-soname,libwayland-client.so.0', '-o', path.join(out, 'libwayland-client.so.0')]);
  run('gcc', ['-shared', '-fPIC', waylandC, '-Wl,-soname,libwayland-egl.so.1', '-o', path.join(out, 'libwayland-egl.so.1')]);

  log(`runtime libraries ready: ${out}`);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

# Workspace-local Rive CLI

The official Rive CLI is a native Linux x86_64 binary distributed as a tarball.
It is not published as an npm package, so it cannot be installed using the same
`npm pack` route as the Godot WebAssembly package.

The workspace installer keeps the binary and its adjacent `docs/` and `samples/`
folders under the ignored `tools/rive/engine/` directory:

```bash
# When the sandbox can reach releases.rive.app:
node tools/rive/install.mjs

# Offline/restricted-network path:
node tools/rive/install.mjs --archive /path/to/rive-linux-x64.tar.gz
```

The archive is verified against the official SHA-256 before extraction. The
installer does not require sudo and runs `rive --version` after unpacking.

After installation, prepare the sandbox's user-local graphics libraries:

```bash
npm run rive:cli:runtime
```

Then run the CLI through the workspace wrapper:

```bash
npm run rive:cli -- --version
npm run rive:cli -- myproject --verify
npm run rive:cli -- myproject --once
npm run rive:cli -- myproject --screenshot=preview.png --advance=1
```

`--once` writes a local `.riv`; it does not require a Rive account. Mako's
source project can be rebuilt and checked with:

```bash
npm run rive
npm run verify:rive
```

The output is `assets/character-anim-src/mako/mako-rive-draft.riv`, which is the
visible artboard consumed by gameplay. The official CLI links EGL/GLES, Wayland,
and xkbcommon even for headless startup. The runtime setup uses Chromium's
SwiftShader npm payload for EGL/GLES and local compatibility shims for the
non-window headless path. It is ignored by Git and is only needed in this
restricted sandbox; a normal Linux machine should use its system libraries.
Watch-mode preview is not claimed to work with these headless shims.

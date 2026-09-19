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

After installation, an authoring project can be built headlessly with:

```bash
tools/rive/engine/current/rive myproject --verify
tools/rive/engine/current/rive myproject --once
tools/rive/engine/current/rive myproject --screenshot=preview.png --advance=1
```

`--once` writes a local `.riv`; it does not require a Rive account. The CLI's
watch window may need system EGL/GLES/X11 libraries, but headless build and
screenshot modes do not need the watch window.

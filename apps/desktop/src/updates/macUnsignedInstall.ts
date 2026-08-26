// @effect-diagnostics nodeBuiltinImport:off - The helper must be a detached OS process that outlives this Electron process.
import * as NodeChildProcess from "node:child_process";
import * as NodeUtil from "node:util";

import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

const execFileAsync = NodeUtil.promisify(NodeChildProcess.execFile);

export type MacCodeSignatureKind = "developer-id" | "adhoc" | "unsigned";

export class MacUnsignedUpdateInstallError extends Schema.TaggedErrorClass<MacUnsignedUpdateInstallError>()(
  "MacUnsignedUpdateInstallError",
  {
    zipPath: Schema.String,
    appBundlePath: Schema.String,
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    return "Failed to start the unsigned macOS update installer.";
  }
}

export const isMacUnsignedUpdateInstallError = Schema.is(MacUnsignedUpdateInstallError);

/**
 * Squirrel.Mac only installs updates signed with the same Developer ID as the
 * running app. Unsigned and ad-hoc GitHub builds therefore download fine and
 * then fail at quitAndInstall. Those builds swap the .app from the downloaded
 * zip after this process exits.
 */
export const MAC_UNSIGNED_UPDATE_SCRIPT = [
  "set -euo pipefail",
  'pid="$T3_UPDATE_PID"',
  'zip="$T3_UPDATE_ZIP"',
  'app="$T3_UPDATE_APP"',
  'while kill -0 "$pid" 2>/dev/null; do',
  "  sleep 0.2",
  "done",
  'extract="$(mktemp -d)"',
  'cleanup() { rm -rf "$extract"; }',
  "trap cleanup EXIT",
  'ditto -xk "$zip" "$extract"',
  'app_name="$(basename "$app")"',
  'new_app="$extract/$app_name"',
  'if [[ ! -d "$new_app" ]]; then',
  '  new_app=""',
  "  while IFS= read -r candidate; do",
  '    new_app="$candidate"',
  "    break",
  "  done < <(find \"$extract\" -maxdepth 2 -name '*.app' -type d)",
  "fi",
  'if [[ -z "$new_app" || ! -d "$new_app" ]]; then',
  '  echo "unsigned macOS update zip did not contain an app bundle" >&2',
  "  exit 1",
  "fi",
  'backup="${app}.updating"',
  'rm -rf "$backup"',
  'mv "$app" "$backup"',
  'if ! mv "$new_app" "$app"; then',
  '  mv "$backup" "$app"',
  "  exit 1",
  "fi",
  'xattr -cr "$app" || true',
  'rm -rf "$backup"',
  'open "$app"',
].join("\n");

export function resolveMacAppBundlePath(appPath: string): string | null {
  const marker = ".app/Contents/";
  const markerIndex = appPath.lastIndexOf(marker);
  if (markerIndex >= 0) {
    return appPath.slice(0, markerIndex + ".app".length);
  }
  if (appPath.endsWith(".app")) {
    return appPath;
  }
  return null;
}

export function parseMacCodeSignature(output: string, exitCode: number): MacCodeSignatureKind {
  if (/Authority=Developer ID Application/.test(output)) {
    return "developer-id";
  }
  if (/Signature=adhoc|\(adhoc\)/.test(output)) {
    return "adhoc";
  }
  if (exitCode !== 0) {
    return "unsigned";
  }
  return "unsigned";
}

export function shouldUseMacZipSwapInstall(
  platform: NodeJS.Platform,
  signatureKind: MacCodeSignatureKind,
): boolean {
  return platform === "darwin" && signatureKind !== "developer-id";
}

export class MacUnsignedUpdateInstaller extends Context.Service<
  MacUnsignedUpdateInstaller,
  {
    readonly signatureKind: (appBundlePath: string) => Effect.Effect<MacCodeSignatureKind>;
    readonly install: (input: {
      readonly zipPath: string;
      readonly appBundlePath: string;
    }) => Effect.Effect<void, MacUnsignedUpdateInstallError>;
  }
>()("@t3tools/desktop/updates/macUnsignedInstall/MacUnsignedUpdateInstaller") {}

const readMacCodeSignature = Effect.fn("desktop.updates.readMacCodeSignature")(function* (
  appBundlePath: string,
) {
  const result = yield* Effect.promise(async () => {
    try {
      const { stdout, stderr } = await execFileAsync(
        "codesign",
        ["-dv", "--verbose=2", appBundlePath],
        { encoding: "utf8" },
      );
      return { output: `${stderr}${stdout}`, exitCode: 0 };
    } catch (cause) {
      const error = cause as {
        readonly stderr?: string;
        readonly stdout?: string;
        readonly status?: number | null;
        readonly code?: string | number;
      };
      const exitCode =
        typeof error.status === "number" ? error.status : error.code === "ENOENT" ? 127 : 1;
      return {
        output: `${error.stderr ?? ""}${error.stdout ?? ""}`,
        exitCode,
      };
    }
  });

  return parseMacCodeSignature(result.output, result.exitCode);
});

export const make = MacUnsignedUpdateInstaller.of({
  signatureKind: (appBundlePath) => readMacCodeSignature(appBundlePath),
  install: Effect.fn("desktop.updates.installUnsignedMacZip")(function* (input: {
    readonly zipPath: string;
    readonly appBundlePath: string;
  }) {
    yield* Effect.try({
      try: () => {
        const child = NodeChildProcess.spawn("/bin/bash", ["-c", MAC_UNSIGNED_UPDATE_SCRIPT], {
          detached: true,
          env: {
            ...process.env,
            T3_UPDATE_PID: String(process.pid),
            T3_UPDATE_ZIP: input.zipPath,
            T3_UPDATE_APP: input.appBundlePath,
          },
          stdio: "ignore",
        });
        child.unref();
      },
      catch: (cause) =>
        new MacUnsignedUpdateInstallError({
          zipPath: input.zipPath,
          appBundlePath: input.appBundlePath,
          cause,
        }),
    });
    process.exit(0);
  }),
});

export const layer = Layer.succeed(MacUnsignedUpdateInstaller, make);

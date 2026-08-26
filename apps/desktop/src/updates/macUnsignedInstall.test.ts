import { assert, describe, it } from "@effect/vitest";

import {
  MAC_UNSIGNED_UPDATE_SCRIPT,
  parseMacCodeSignature,
  resolveMacAppBundlePath,
  shouldUseMacZipSwapInstall,
} from "./macUnsignedInstall.ts";

describe("macUnsignedInstall", () => {
  it("resolves the app bundle from a packaged asar path", () => {
    assert.equal(
      resolveMacAppBundlePath("/Applications/T3 Code (Nightly).app/Contents/Resources/app.asar"),
      "/Applications/T3 Code (Nightly).app",
    );
    assert.equal(
      resolveMacAppBundlePath("/Applications/T3 Code (Nightly).app"),
      "/Applications/T3 Code (Nightly).app",
    );
    assert.isNull(resolveMacAppBundlePath("/repo/apps/desktop"));
  });

  it("classifies Developer ID, ad-hoc, and unsigned codesign output", () => {
    assert.equal(
      parseMacCodeSignature("Authority=Developer ID Application: T3 Tools, Inc.\n", 0),
      "developer-id",
    );
    assert.equal(
      parseMacCodeSignature("CodeDirectory v=20400 flags=0x2(adhoc)\nSignature=adhoc\n", 0),
      "adhoc",
    );
    assert.equal(parseMacCodeSignature("code object is not signed at all\n", 1), "unsigned");
    assert.equal(parseMacCodeSignature("", 1), "unsigned");
  });

  it("uses zip-swap install for unsigned macOS builds and keeps Squirrel for Developer ID", () => {
    assert.isTrue(shouldUseMacZipSwapInstall("darwin", "adhoc"));
    assert.isTrue(shouldUseMacZipSwapInstall("darwin", "unsigned"));
    assert.isFalse(shouldUseMacZipSwapInstall("darwin", "developer-id"));
    assert.isFalse(shouldUseMacZipSwapInstall("linux", "unsigned"));
    assert.isFalse(shouldUseMacZipSwapInstall("win32", "adhoc"));
  });

  it("keeps the helper script on env vars instead of interpolating paths", () => {
    assert.include(MAC_UNSIGNED_UPDATE_SCRIPT, 'pid="$T3_UPDATE_PID"');
    assert.include(MAC_UNSIGNED_UPDATE_SCRIPT, 'zip="$T3_UPDATE_ZIP"');
    assert.include(MAC_UNSIGNED_UPDATE_SCRIPT, 'app="$T3_UPDATE_APP"');
    assert.include(MAC_UNSIGNED_UPDATE_SCRIPT, "ditto -xk");
    assert.include(MAC_UNSIGNED_UPDATE_SCRIPT, "xattr -cr");
    assert.notInclude(MAC_UNSIGNED_UPDATE_SCRIPT, "/Applications/");
  });
});

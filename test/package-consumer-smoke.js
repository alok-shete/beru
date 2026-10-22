const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const packagePath = path.resolve(__dirname, "../dist");
const esmManifestPath = path.join(packagePath, "esm", "package.json");
const esmManifest = JSON.parse(fs.readFileSync(esmManifestPath, "utf8"));
assert.equal(
  esmManifest.type,
  "module",
  "The generated ESM directory must have an explicit module type"
);
const consumerPath = fs.mkdtempSync(
  path.join(os.tmpdir(), "beru-package-consumer-")
);
const modulesPath = path.join(consumerPath, "node_modules");
fs.mkdirSync(modulesPath);
fs.symlinkSync(
  packagePath,
  path.join(modulesPath, "beru"),
  process.platform === "win32" ? "junction" : "dir"
);

try {
  const cjsResult = spawnSync(
    process.execPath,
    [
      "-e",
      "const api = require('beru'); if (typeof api.create !== 'function') process.exit(1)",
    ],
    { cwd: consumerPath, encoding: "utf8" }
  );
  assert.equal(
    cjsResult.status,
    0,
    `The generated CommonJS package could not be required:\n${cjsResult.stderr}`
  );

  const esmResult = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      "const api = await import('beru'); if (typeof api.create !== 'function') process.exit(1)",
    ],
    { cwd: consumerPath, encoding: "utf8" }
  );
  assert.equal(
    esmResult.status,
    0,
    `The generated ESM package could not be imported:\n${esmResult.stderr}`
  );

  const consumerFile = path.join(consumerPath, "consumer.ts");
  fs.writeFileSync(
    consumerFile,
    'import { create } from "beru";\nconst store = create({ count: 0 });\nstore.set({ count: 1 });\n'
  );
  const typeCheck = spawnSync(
    process.execPath,
    [
      path.resolve(__dirname, "../node_modules/typescript/bin/tsc"),
      "--noEmit",
      "--strict",
      "--skipLibCheck",
      "--moduleResolution",
      "node",
      "--module",
      "commonjs",
      "--target",
      "ES2019",
      "consumer.ts",
    ],
    { cwd: consumerPath, encoding: "utf8" }
  );
  assert.equal(
    typeCheck.status,
    0,
    `The package declarations failed in a TypeScript consumer:\n${typeCheck.stdout}${typeCheck.stderr}`
  );
} finally {
  fs.rmSync(consumerPath, { recursive: true, force: true });
}

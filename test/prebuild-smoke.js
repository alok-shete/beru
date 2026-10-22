const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repositoryRoot = path.resolve(__dirname, "..");
const command =
  process.platform === "win32" ? process.env.ComSpec || "cmd.exe" : "npm";
const args =
  process.platform === "win32"
    ? ["/d", "/s", "/c", "npm.cmd run prebuild"]
    : ["run", "prebuild"];
const result = spawnSync(command, args, {
  cwd: repositoryRoot,
  encoding: "utf8",
});

assert.equal(
  result.status,
  0,
  `The prebuild cleanup command failed:\n${result.stdout}${result.stderr}`
);

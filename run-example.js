// scripts/run-example.ts (or .js if you prefer)
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const exampleName = process.argv[2];
const examplesDir = path.join(__dirname,'examples');

function listExampleFolders() {
  try {
    return fs.readdirSync(examplesDir).filter((name) => {
      const fullPath = path.join(examplesDir, name);
      return fs.statSync(fullPath).isDirectory();
    });
  } catch {
    return [];
  }
}

if (!exampleName) {
  console.error("❌ Please provide an example name. Example: yarn run example counter");
  console.log("📂 Available examples:");
  listExampleFolders().forEach((name) => console.log(" -", name));
  process.exit(1);
}

const examplePath = path.join(examplesDir, exampleName);

if (!fs.existsSync(examplePath) || !fs.statSync(examplePath).isDirectory()) {
  console.error(`❌ Example "${exampleName}" does not exist in /examples.`);
  console.log("📂 Available examples:");
  listExampleFolders().forEach((name) => console.log(" -", name));
  process.exit(1);
}

console.log(`🚀 Running example: ${exampleName}`);

const command = `npx vite dev`;

const child = exec(command, { cwd: examplePath });

if (child.stdout) child.stdout.pipe(process.stdout);
if (child.stderr) child.stderr.pipe(process.stderr);

const { promisify } = require("util");
const path = require("path");
const fs = require("fs");

const destinationPath = path.join(__dirname, "dist");

const readFile = async (filePath) =>
  await promisify(fs.readFile)(filePath, "utf8");

const writeFile = async (filePath, data) =>
  await promisify(fs.writeFile)(filePath, data);

const copyFileAsync = async (source, destination) => {
  try {
    await fs.promises.copyFile(source, destination);
    console.log(`Copied ${source} to ${destination}`);
  } catch (error) {
    console.error(`Error copying ${source} to ${destination}: ${error}`);
    process.exit(1);
  }
};

const build = async () => {
  const packageJson = JSON.parse(await readFile("./package.json"));

  delete packageJson.scripts;
  delete packageJson.devDependencies;
  delete packageJson.files;

  packageJson.main = "./cjs/index.js"; // CommonJS
  packageJson.module = "./esm/index.js"; // ESM
  packageJson.types = "./cjs/index.d.ts"; // Type declarations

  // dist/cjs/middleware/devtools
  packageJson.exports = {
    ".": {
      import: "./esm/index.js",
      require: "./cjs/index.js",
      types: "./cjs/index.d.ts",
    },
    "./persistence": {
      import: "./esm/middleware/persistence/index.js",
      require: "./cjs/middleware/persistence/index.js",
      types: "./cjs/middleware/persistence/index.d.ts",
    },
    "./devtools": {
      import: "./esm/middleware/devtools/index.js",
      require: "./cjs/middleware/devtools/index.js",
      types: "./cjs/middleware/devtools/index.d.ts",
    },
    "./utils": {
      import: "./esm/utils/index.js",
      require: "./cjs/utils/index.js",
      types: "./cjs/utils/index.d.ts",
    },
  };

  await writeFile("./dist/package.json", JSON.stringify(packageJson, null, 2));

  await copyFileAsync(
    path.join(__dirname, "README.md"),
    path.join(destinationPath, "README.md")
  );

  await copyFileAsync(
    path.join(__dirname, "LICENSE"),
    path.join(destinationPath, "LICENSE")
  );
};

build();

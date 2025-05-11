import path from "path";
import fs from "fs";
import { defineConfig } from "tsup";
import { promisify } from "util";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    persistence: "src/middleware/persistence/index.ts",
    devtools: "src/middleware/devtools/index.ts",
  },
  format: ["cjs", "esm"],
  dts: true,
  minify: "terser",
  clean: true,
  sourcemap: true,
  treeshake: true,
  splitting: true,
  target: "es2020",
  onSuccess: async () => await build(),
});

// Call the function to read the package.json file
const build = async () => {
  const packageJson = JSON.parse(await readFile("./package.json"));

  // Modify package.json as needed
  delete packageJson.scripts;
  delete packageJson.devDependencies;
  delete packageJson.files;
  packageJson.main = "index.js";
  packageJson.module = "index.mjs";
  packageJson.types = "index.d.ts";

  packageJson.exports = {
    ".": {
      import: "./index.mjs",
      require: "./index.js",
      types: "./index.d.ts",
    },
    "./persistence": {
      import: "./persistence.mjs",
      require: "./persistence.js",
      types: "./persistence.d.ts",
    },
    "./devtools": {
      import: "./devtools.mjs",
      require: "./devtools.js",
      types: "./devtools.d.ts",
    },
  };

  // Convert the modified packageJson object back to a JSON string
  const updatedPackageJson = JSON.stringify(packageJson, null, 2);

  // Call the function to write the updated data to a new file
  await writeFile("./dist/package.json", updatedPackageJson);

  // Copy README.md
  const readmeSource = path.join(__dirname, "README.md");
  const readmeDestination = path.join(destinationPath, "README.md");
  copyFileAsync(readmeSource, readmeDestination);

  // Copy LICENSE
  const licenseSource = path.join(__dirname, "LICENSE");
  const licenseDestination = path.join(destinationPath, "LICENSE");
  copyFileAsync(licenseSource, licenseDestination);
};

const destinationPath = path.join(__dirname, "dist");

// Function to read file asynchronously
async function readFile(filePath) {
  // Promisify the fs.readFile method
  const readFileAsync = promisify(fs.readFile);

  try {
    // Read the package.json file asynchronously
    const data = await readFileAsync(filePath, "utf8");
    return data;
  } catch (error) {
    // Handle any errors that occur during reading or parsing
    throw new Error(`Error reading or parsing package.json: ${error.message}`);
  }
}

// Function to write data to a file asynchronously
async function writeFile(filePath, data) {
  // Promisify the fs.writeFile method
  const writeFileAsync = promisify(fs.writeFile);

  try {
    // Write data to the specified file asynchronously
    await writeFileAsync(filePath, data);

    console.log(`File created successfully at ${filePath}`);
  } catch (error) {
    // Handle any errors that occur during writing
    throw new Error(`Error writing to file: ${error.message}`);
  }
}

// Function to copy files asynchronously

const copyFileAsync = async (source, destination) => {
  try {
    await fs.promises.copyFile(source, destination);
    console.log(`Copied ${source} to ${destination}`);
  } catch (error) {
    console.error(`Error copying ${source} to ${destination}: ${error}`);
    process.exit(1);
  }
};

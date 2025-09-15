// convert-csv-to-json.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import csv from "csv-parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Input and output file paths
const inputFile = path.join(__dirname, "mal_anime_data.csv");
const outputFile = path.join(__dirname, "anime-data.json");

const results = [];

fs.createReadStream(inputFile)
  .pipe(csv())
  .on("data", (row) => {
    results.push(row);
  })
  .on("end", () => {
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2), "utf-8");
    console.log(`✅ Conversion complete! JSON saved to ${outputFile}`);
  })
  .on("error", (err) => {
    console.error("❌ Error reading CSV:", err);
  });

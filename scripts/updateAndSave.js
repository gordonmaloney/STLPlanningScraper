// scripts/updateAndSave.js
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

// Node ≥18 has global fetch; otherwise `npm install node‑fetch` and `import fetch from 'node-fetch'`

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)




function normalisePostcode(pc) {
  if (!pc) return "";
  // Trim, collapse spaces, uppercase. postcodes.io is flexible, but be tidy.
  return pc.toString().trim().replace(/\s+/g, " ").toUpperCase();
}

async function fetchLatLon(app) {
  const postcode = normalisePostcode(app.postcode);
  if (postcode && (!app.latitude || !app.longitude)) {
    try {
      const res = await fetch(
        `https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`
      );
      const json = await res.json();
      if (json.status === 200 && json.result) {
        app.latitude = String(json.result.latitude);
        app.longitude = String(json.result.longitude);
      } else {
        console.warn(
          `⚠️  Lookup failed for ${
            app.refNo || app.reference || "unknown ref"
          } (${postcode}):`,
          json?.error || json
        );
      }
    } catch (err) {
      console.error(`❌  Error fetching postcode ${postcode}:`, err);
    }
  }
  return app;
}

function transformForFrontend(app) {
  // Keep existing fields, but rename to the shape your frontend expects.
  // Remove legacy fields after mapping to avoid duplicates.
  const out = {
    ...app,
    link: app.link, // keep as-is
    reference: app.refNo, // new canonical name
    title: app.proposal, // new canonical name
  };

  // Remove old keys your frontend no longer needs
  delete out.refNo;
  delete out.proposal;
  delete out.url; // ensure no stray url field remains

  return out;
}

async function readJsonOrEmpty(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") {
      console.warn(`⚠️  Missing file: ${filePath} (skipping)`);
      return [];
    }
    throw err;
  }
}

async function writePrettyJSON(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

async function writeJSXArray(filePath, exportName, data) {
  const contents = `export const ${exportName} = ${JSON.stringify(
    data,
    null,
    2
  )};\n`;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents, "utf8");
}

/**
 * Process one dataset end-to-end:
 *  - read source JSON
 *  - enrich with lat/lon
 *  - write back the enriched source JSON
 *  - create *NewData.json and *NewData.jsx for the frontend
 */
async function processDataset({
  label, // for logs e.g. "Edinburgh" or "Highland"
  srcFile, // e.g. ../data/applications.json
  outJsonFile, // e.g. ../data/NewData.json
  outJsxFile, // e.g. ../data/NewData.jsx
  exportName, // e.g. "PlanningApps" or "HL_PlanningApps"
}) {
  console.log(`\n🔄  Processing ${label}…`);
  const apps = await readJsonOrEmpty(srcFile);

  if (!Array.isArray(apps)) {
    throw new Error(`${label}: Source data is not an array: ${srcFile}`);
  }

  // Enrich with lat/lon
  const withLatLon = await Promise.all(apps.map(fetchLatLon));

  // Persist the enrichment back to the source file
  await writePrettyJSON(srcFile, withLatLon);
  console.log(
    `✅  Updated source: ${path.relative(process.cwd(), srcFile)} (${
      withLatLon.length
    } records)`
  );

  // Transform for frontend
  const modified = withLatLon.map(transformForFrontend);

  // Write frontend JSON + JSX
  await writePrettyJSON(outJsonFile, modified);
  console.log(`✅  Wrote JSON: ${path.relative(process.cwd(), outJsonFile)}`);

  await writeJSXArray(outJsxFile, exportName, modified);
  console.log(`✅  Wrote JSX:  ${path.relative(process.cwd(), outJsxFile)}`);
}

// ──────────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🏁  Running combined update…");

  const dataDir = path.resolve(__dirname, "../data");

  // Edinburgh (existing)
  await processDataset({
    label: "Edinburgh",
    srcFile: path.join(dataDir, "applications.json"),
    outJsonFile: path.join(dataDir, "NewData.json"),
    outJsxFile: path.join(dataDir, "NewData.jsx"),
    exportName: "PlanningApps",
  });

  // Highland (NEW)
  await processDataset({
    label: "Highland",
    srcFile: path.join(dataDir, "HL_applications.json"),
    outJsonFile: path.join(dataDir, "HL_NewData.json"),
    outJsxFile: path.join(dataDir, "HL_NewData.jsx"),
    exportName: "HL_PlanningApps",
  });

  // Highland (NEW)
  await processDataset({
    label: "CnE",
    srcFile: path.join(dataDir, "CnE_applications.json"),
    outJsonFile: path.join(dataDir, "CnE_NewData.json"),
    outJsxFile: path.join(dataDir, "CnE_NewData.jsx"),
    exportName: "CnE_PlanningApps",
  });

  console.log("\n🎉  All done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
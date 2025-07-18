#!/usr/bin/env node
// scripts/updateAndSave.js

const fs = require("fs/promises");
const path = require("path");

// Node ≥18 has global fetch

async function fetchLatLon(app) {
  if (app.postcode && (!app.latitude || !app.longitude)) {
    try {
      const res = await fetch(
        `https://api.postcodes.io/postcodes/${app.postcode}`
      );
      const json = await res.json();
      if (json.status === 200) {
        app.latitude = json.result.latitude.toString();
        app.longitude = json.result.longitude.toString();
      } else {
        console.warn(`⚠️ Lookup failed for ${app.refNo}:`, json);
      }
    } catch (err) {
      console.error(`❌ Error fetching postcode ${app.postcode}:`, err);
    }
  }
  return app;
}

async function main() {
  console.log("🔄 Running combined update…");

  // 1) Load scraped data
  const dataPath = path.resolve(__dirname, "../data/applications.json");
  const raw = await fs.readFile(dataPath, "utf8");
  const apps = JSON.parse(raw);

  // 2) Enrich with lat/lon
  const withLatLon = await Promise.all(apps.map(fetchLatLon));

  // 3) Write back JSON
  await fs.writeFile(dataPath, JSON.stringify(withLatLon, null, 2), "utf8");
  console.log(`✅ applications.json updated (${withLatLon.length} records)`);

  // 4) Massage for frontend
  const modified = withLatLon.map((app) => ({
    ...app,
    link: app.link,
    reference: app.refNo,
    title: app.proposal,
    url: undefined,
    refNo: undefined,
    proposal: undefined,
  }));
  const fileContent = `export const PlanningApps = ${JSON.stringify(
    modified,
    null,
    2
  )};`;

  // 5) Dump into frontend/src/NewData.jsx
  const frontendDir = path.resolve(__dirname, "../../frontend/src");
  await fs.mkdir(frontendDir, { recursive: true });
  const outFile = path.join(frontendDir, "NewData.jsx");
  await fs.writeFile(outFile, fileContent, "utf8");
  console.log(`✅ NewData.jsx written to ${outFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

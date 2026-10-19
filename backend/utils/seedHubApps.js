import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import HubApp from "../models/HubApp.model.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectsPath = path.resolve(
  __dirname,
  "../../frontend/src/data/projects.json",
);

/** Apps that typically don't need a user login form */
const NO_AUTH_IDS = new Set([
  "n8n-email-formater",
  "n8n-penggunaan-app",
  "csi-hub",
]);

export async function seedHubAppsIfEmpty() {
  const count = await HubApp.countDocuments();
  if (count > 0) return { seeded: false, count };

  let projects = [];
  try {
    projects = JSON.parse(fs.readFileSync(projectsPath, "utf8"));
  } catch (err) {
    console.warn("[seedHubApps] cannot read projects.json:", err.message);
    return { seeded: false, count: 0 };
  }

  const docs = projects.map((p, index) => ({
    id: p.id,
    title: p.title,
    description: p.description || "",
    url: p.url,
    iconUrl: p.iconUrl || null,
    authRequired: !NO_AUTH_IDS.has(p.id),
    sortOrder: index,
    active: true,
  }));

  if (!docs.length) return { seeded: false, count: 0 };
  await HubApp.insertMany(docs);
  console.log(`[seedHubApps] seeded ${docs.length} apps`);
  return { seeded: true, count: docs.length };
}

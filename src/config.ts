import { promises as fs } from "fs";
import { parse, parseDocument, stringify } from "yaml";
import type { Config, Watchers } from "./types.js";

export async function loadConfig(configPath = "./config.yml"): Promise<Config> {
  const content = await fs.readFile(configPath, "utf-8");
  return parse(content) as Config;
}

export async function loadWatchers(watchersPath = "watchers.yml"): Promise<Watchers> {
  const content = await fs.readFile(watchersPath, "utf-8");
  const doc = parseDocument(content);
  const watchers = doc.toJS() as Watchers;

  // Backward compatibility: migrate legacy `last_seen` → `success_since`
  if (watchers?.sites) {
    for (const site of Object.values(watchers.sites)) {
      if (site.last_seen !== undefined && site.success_since === undefined) {
        site.success_since = site.last_seen;
      }
      delete site.last_seen;
    }
  }

  return watchers;
}

export async function saveWatchers(watchers: Watchers, watchersPath = "watchers.yml"): Promise<void> {
  // Read existing file to preserve comments
  const existingContent = await fs.readFile(watchersPath, "utf-8");
  const doc = parseDocument(existingContent);

  // Update sites in the document, dropping legacy `last_seen` if present
  if (doc.contents && typeof doc.contents === 'object') {
    const yamlMap = doc.contents as any;
    const sites = yamlMap.get('sites');
    if (sites && typeof sites === 'object') {
      Object.keys(watchers.sites).forEach(key => {
        const siteData = { ...watchers.sites[key] } as Record<string, unknown>;
        delete siteData.last_seen; // never persist legacy field
        sites.set(key, siteData);
      });
    }
  }

  const content = stringify(doc);
  await fs.writeFile(watchersPath, content, "utf-8");
}

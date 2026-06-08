import { promises as fs } from "fs";
import { parse, parseDocument, stringify, YAMLMap, Scalar } from "yaml";
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

  // Update sites in the document, preserving existing AST comments
  if (doc.contents instanceof YAMLMap) {
    const sites = doc.contents.get('sites');
    if (sites instanceof YAMLMap) {
      Object.keys(watchers.sites).forEach(key => {
        const siteData = { ...watchers.sites[key] } as Record<string, unknown>;
        delete siteData.last_seen; // never persist legacy field

        // Find existing site node in the AST
        let siteMap: YAMLMap | undefined;
        for (const item of sites.items) {
          const itemKey = (item.key as Scalar | undefined)?.value;
          if (itemKey === key && item.value instanceof YAMLMap) {
            siteMap = item.value;
            break;
          }
        }

        if (siteMap) {
          // Update individual fields on the existing AST node.
          // This preserves comments on other fields and inline comments.
          for (const [k, v] of Object.entries(siteData)) {
            siteMap.set(k, v);
          }

          // Remove fields that are no longer present in the data
          // (handles legacy `last_seen` and any removed fields)
          const existingKeys = new Set<string>();
          for (const item of siteMap.items) {
            const k = (item.key as Scalar | undefined)?.value;
            if (k !== undefined) existingKeys.add(String(k));
          }
          for (const existingKey of existingKeys) {
            if (!(existingKey in siteData)) {
              siteMap.delete(existingKey);
            }
          }
        } else {
          // Fallback: site node not found in AST — create new
          (sites as any).set(key, siteData);
        }
      });
    }
  }

  const content = stringify(doc);
  await fs.writeFile(watchersPath, content, "utf-8");
}

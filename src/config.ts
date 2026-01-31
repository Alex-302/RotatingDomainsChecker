import { readFileSync, writeFileSync } from "fs";
import { parse, parseDocument, stringify } from "yaml";
import type { Config, Watchers } from "./types.js";

export function loadConfig(configPath = "./config.yml"): Config {
  const content = readFileSync(configPath, "utf-8");
  return parse(content) as Config;
}

export function loadWatchers(watchersPath = "watchers.yml"): Watchers {
  const content = readFileSync(watchersPath, "utf-8");
  const doc = parseDocument(content);
  return doc.toJS() as Watchers;
}

export function saveWatchers(watchers: Watchers, watchersPath = "watchers.yml"): void {
  // Read existing file to preserve comments
  const existingContent = readFileSync(watchersPath, "utf-8");
  const doc = parseDocument(existingContent);
  
  // Update sites in the document
  if (doc.contents && typeof doc.contents === 'object') {
    const yamlMap = doc.contents as any;
    const sites = yamlMap.get('sites');
    if (sites && typeof sites === 'object') {
      // Update each site
      Object.keys(watchers.sites).forEach(key => {
        sites.set(key, watchers.sites[key]);
      });
    }
  }
  
  const content = stringify(doc);
  writeFileSync(watchersPath, content, "utf-8");
}

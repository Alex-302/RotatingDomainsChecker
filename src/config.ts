import { readFileSync, writeFileSync } from "fs";
import { load, dump } from "js-yaml";
import type { Config, Watchers } from "./types.js";

export function loadConfig(configPath = "./config.yml"): Config {
  const content = readFileSync(configPath, "utf-8");
  return load(content) as Config;
}

export function loadWatchers(watchersPath = "watchers.yml"): Watchers {
  const content = readFileSync(watchersPath, "utf-8");
  return load(content) as Watchers;
}

export function saveWatchers(watchers: Watchers, watchersPath = "watchers.yml"): void {
  const content = dump(watchers, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
  });
  writeFileSync(watchersPath, content, "utf-8");
}

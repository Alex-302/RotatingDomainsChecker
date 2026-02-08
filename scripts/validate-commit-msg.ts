import { readFileSync } from "fs";
import { validateCommitMessage } from "../src/commit-msg-validate.js";

const msgFile = process.argv[2];
if (!msgFile) {
  console.error("Usage: validate-commit-msg.ts <commit-msg-file>");
  process.exit(1);
}

const message = readFileSync(msgFile, "utf-8").trim();
const result = validateCommitMessage(message);

if (!result.valid) {
  console.error(`❌ ${result.error}`);
  process.exit(1);
}

console.log("✅ Commit message is valid");

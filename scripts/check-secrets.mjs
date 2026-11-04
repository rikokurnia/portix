import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
// Compares exact local secret values without ever printing them.
const secrets = [];
for (const file of [
  ".env",
  ".env.local",
  "contracts/.env",
  "contracts/.env.local",
]) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Za-z_][\w]*)\s*=\s*(.*?)\s*$/);
    if (!match || !/PRIVATE.*KEY|SECRET|PASSWORD|API_KEY/i.test(match[1]))
      continue;
    const value = match[2].replace(/^['"]|['"]$/g, "");
    if (value.length >= 16) secrets.push({ name: match[1], value });
  }
}
const tracked = execFileSync("git", ["ls-files", "-z"])
  .toString()
  .split("\0")
  .filter(Boolean);
const forbidden = tracked.filter(
  (file) =>
    (/(^|\/)\.env($|\.)/.test(file) && !/\.example$/.test(file)) ||
    /^contracts\//.test(file) ||
    /\.(?:pem|key|keystore)$/.test(file),
);
const files = [
  ...tracked.filter((file) => fs.existsSync(file)),
  ...walk(".next"),
];
let failures = 0;
for (const file of [...new Set(files)]) {
  if (!fs.statSync(file).isFile()) continue;
  const data = fs.readFileSync(file);
  for (const secret of secrets) {
    const values = [
      secret.value,
      ...(secret.value.startsWith("0x") ? [secret.value.slice(2)] : []),
    ];
    if (
      values.some(
        (v) =>
          data.includes(v) ||
          (/^[a-f\d]{64}$/i.test(v) &&
            data.toString("latin1").toLowerCase().includes(v.toLowerCase())),
      )
    ) {
      console.error(`Secret value detected: ${secret.name} in ${file}`);
      failures++;
    }
  }
}
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
    );
}
if (process.argv.includes("--history")) {
  const objects = execFileSync("git", ["rev-list", "--objects", "--all"])
    .toString()
    .trim()
    .split("\n")
    .map((line) => line.split(" ")[0]);
  let checked = 0;
  for (const oid of objects) {
    if (
      execFileSync("git", ["cat-file", "-t", oid]).toString().trim() !== "blob"
    )
      continue;
    const content = execFileSync("git", ["cat-file", "blob", oid], {
      maxBuffer: 200 * 1024 * 1024,
    });
    checked++;
    for (const secret of secrets) {
      const values = [
        secret.value,
        ...(secret.value.startsWith("0x") ? [secret.value.slice(2)] : []),
      ];
      if (values.some((value) => content.includes(value))) {
        console.error(
          `Historical secret value detected: ${secret.name}, blob ${oid}`,
        );
        failures++;
      }
    }
  }
  console.log(`Historical secret-value check: ${checked} Git blobs checked.`);
}
if (forbidden.length) {
  console.error("Forbidden tracked files:", forbidden.join(", "));
  failures += forbidden.length;
}
console.log(
  `Secret-value check: ${files.length} source/build files checked; ${secrets.length} local secret entries compared; ${failures} findings. Values were not printed.`,
);
if (failures) process.exitCode = 1;

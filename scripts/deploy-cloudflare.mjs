// Deploys the app to Cloudflare Workers + D1: `pnpm deploy:cf`.
// Requires a one-time `pnpm exec wrangler login` (or CLOUDFLARE_API_TOKEN).
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const configPath = path.join(root, "cloudflare.deploy.json");
const wranglerBin = path.join(root, "node_modules/wrangler/bin/wrangler.js");
process.chdir(root);
process.env.WRANGLER_SEND_METRICS ??= "false";

function run(label, file, args, { capture = false } = {}) {
  if (label) console.log(`\n▶ ${label}`);
  const result = spawnSync(process.execPath, [file, ...args], {
    encoding: "utf8",
    stdio: capture ? ["inherit", "pipe", "pipe"] : "inherit",
  });
  if (result.error) throw result.error;
  return { status: result.status ?? 1, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

function fail(message) {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

function wrangler(label, args, options) {
  return run(label, wranglerBin, args, options);
}

function findDatabase(name) {
  const { status, output } = wrangler("", ["d1", "list", "--json"], { capture: true });
  if (status !== 0) fail(`D1 목록을 가져오지 못했습니다.\n${output}`);
  const start = output.indexOf("[");
  const list = JSON.parse(output.slice(start, output.lastIndexOf("]") + 1));
  return list.find((database) => database.name === name);
}

const config = JSON.parse(readFileSync(configPath, "utf8"));

const who = wrangler("Cloudflare 로그인 확인", ["whoami"], { capture: true });
if (who.status !== 0 || /not authenticated/i.test(who.output)) {
  fail("Cloudflare에 로그인되어 있지 않습니다. 먼저 `pnpm exec wrangler login` 을 실행해 주세요.");
}

if (!config.database_id) {
  console.log(`\n▶ D1 데이터베이스 준비: ${config.database_name}`);
  let database = findDatabase(config.database_name);
  if (!database) {
    const created = wrangler("", ["d1", "create", config.database_name]);
    if (created.status !== 0) fail("D1 데이터베이스를 만들지 못했습니다.");
    database = findDatabase(config.database_name);
  }
  if (!database?.uuid) fail("D1 데이터베이스 ID를 확인하지 못했습니다.");
  config.database_id = database.uuid;
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  console.log(`  database_id 저장: ${config.database_id}`);
}

// wrangler resolves migrations_dir relative to the config file it is given.
const migrationDirectory = path.join(root, ".wrangler/deploy");
const migrationConfig = path.join(migrationDirectory, "d1-migrations.json");
mkdirSync(migrationDirectory, { recursive: true });
writeFileSync(migrationConfig, JSON.stringify({
  name: config.name,
  d1_databases: [{
    binding: "DB",
    database_name: config.database_name,
    database_id: config.database_id,
    migrations_dir: "../../drizzle",
  }],
}, null, 2));

const migrated = wrangler("D1 마이그레이션 적용", [
  "d1", "migrations", "apply", config.database_name, "--remote", "--config", migrationConfig,
]);
if (migrated.status !== 0) fail("마이그레이션 적용에 실패했습니다.");

const built = run("프로덕션 빌드", path.join(root, "scripts/run-framework.mjs"), ["build"]);
if (built.status !== 0) fail("빌드에 실패했습니다.");

const generated = JSON.parse(readFileSync(path.join(root, "dist/server/wrangler.json"), "utf8"));
if (generated.d1_databases?.[0]?.database_id !== config.database_id) {
  fail("빌드 결과의 D1 ID가 cloudflare.deploy.json 과 다릅니다. 다시 빌드해 주세요.");
}

const deployed = wrangler("Cloudflare Workers 배포", ["deploy", "--config", "dist/server/wrangler.json"]);
if (deployed.status !== 0) fail("배포에 실패했습니다.");
console.log("\n✔ 배포 완료. 위에 표시된 workers.dev 주소로 접속해 보세요.");

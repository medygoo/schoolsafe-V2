const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const http = require("node:http");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const appRoot = path.join(projectRoot, "app");

async function allocatePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

function waitForOutput(child, expected, timeoutMs = 8_000) {
  return new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${expected}. Output: ${output}`)), timeoutMs);
    const collect = (chunk) => {
      output += chunk.toString();
      if (output.includes(expected)) {
        clearTimeout(timer);
        resolve(output);
      }
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.once("exit", (code) => {
      if (!output.includes(expected)) {
        clearTimeout(timer);
        reject(new Error(`Server exited with ${code}. Output: ${output}`));
      }
    });
  });
}

function requestText(port) {
  return new Promise((resolve, reject) => {
    const request = http.get(`http://127.0.0.1:${port}/`, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => resolve({ statusCode: response.statusCode, body }));
    });
    request.setTimeout(3_000, () => request.destroy(new Error("HTTP request timed out")));
    request.on("error", reject);
  });
}

function powershellPath() {
  const bundled = path.join(
    process.env.USERPROFILE || "",
    ".cache",
    "codex-runtimes",
    "codex-primary-runtime",
    "dependencies",
    "native",
    "powershell",
    "pwsh.exe"
  );
  return fs.existsSync(bundled) ? bundled : "powershell.exe";
}

function runPowerShell(script, port) {
  return spawnSync(
    powershellPath(),
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, "-Port", String(port)],
    { cwd: appRoot, encoding: "utf8", timeout: 20_000 }
  );
}

async function waitForProcessExit(pid, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0);
    } catch {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Process ${pid} did not exit`);
}

test("the official app directory serves the SchoolSafe interface", async (t) => {
  await fsp.access(path.join(appRoot, "index.html"));
  await fsp.access(path.join(appRoot, "server.mjs"));

  const port = await allocatePort();
  const child = spawn(process.execPath, ["server.mjs"], {
    cwd: appRoot,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"]
  });
  t.after(() => {
    if (child.exitCode === null) child.kill();
  });

  await waitForOutput(child, `http://127.0.0.1:${port}`);
  const response = await requestText(port);
  assert.equal(response.statusCode, 200);
  assert.match(response.body, /SchoolSafe/i);
});

test("the permanent server defaults to local port 4175", async (t) => {
  const environment = { ...process.env };
  delete environment.PORT;
  const child = spawn(process.execPath, ["server.mjs"], {
    cwd: appRoot,
    env: environment,
    stdio: ["ignore", "pipe", "pipe"]
  });
  t.after(() => {
    if (child.exitCode === null) child.kill();
  });

  await waitForOutput(child, "http://127.0.0.1:4175");
  const response = await requestText(4175);
  assert.equal(response.statusCode, 200);
});

test("the launcher starts one local server and the health check reports its state", async () => {
  const startScript = path.join(appRoot, "start-schoolsafe.ps1");
  const checkScript = path.join(appRoot, "check-schoolsafe.ps1");
  await fsp.access(startScript);
  await fsp.access(checkScript);

  const port = await allocatePort();
  const start = runPowerShell(startScript, port);
  assert.equal(start.status, 0, start.stderr || start.stdout);
  assert.match(start.stdout, new RegExp(`http://127\\.0\\.0\\.1:${port}`));

  const pidPath = path.join(os.tmpdir(), "SchoolSafeV2", `server-${port}.pid`);
  const pid = Number((await fsp.readFile(pidPath, "utf8")).trim());
  assert.ok(Number.isInteger(pid) && pid > 0, `Invalid PID: ${pid}`);

  try {
    const response = await requestText(port);
    assert.equal(response.statusCode, 200);

    const healthy = runPowerShell(checkScript, port);
    assert.equal(healthy.status, 0, healthy.stderr || healthy.stdout);
    assert.match(healthy.stdout, /ACTIVE/i);

    const secondStart = runPowerShell(startScript, port);
    assert.equal(secondStart.status, 0, secondStart.stderr || secondStart.stdout);
    assert.match(secondStart.stdout, /ALREADY ACTIVE/i);
    const unchangedPid = Number((await fsp.readFile(pidPath, "utf8")).trim());
    assert.equal(unchangedPid, pid);
  } finally {
    try { process.kill(pid); } catch {}
    await waitForProcessExit(pid);
  }

  const stopped = runPowerShell(checkScript, port);
  assert.equal(stopped.status, 1, stopped.stderr || stopped.stdout);
  assert.match(stopped.stdout, /INACTIVE/i);
});

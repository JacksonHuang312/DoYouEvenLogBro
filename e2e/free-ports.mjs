// Stops a leftover Firebase emulator from a previous e2e run (on Windows, `emulators:exec` can leave
// the Firestore java process behind, and the next run then fails with "port taken"). It only
// touches processes whose command line mentions the demo-dyelb project, never anything else.
import { execFileSync } from "node:child_process";

const PORTS = [8080, 9099];
const win = process.platform === "win32";

function run(cmd, args) {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

for (const port of PORTS) {
  const pids = win
    ? run("powershell", ["-NoProfile", "-Command", `(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue).OwningProcess`]).split(/\s+/)
    : run("lsof", ["-ti", `tcp:${port}`, "-sTCP:LISTEN"]).split(/\s+/);
  for (const pid of pids.filter(Boolean)) {
    const cmdline = win
      ? run("powershell", ["-NoProfile", "-Command", `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine`])
      : run("ps", ["-p", pid, "-o", "args="]);
    if (!cmdline.includes("demo-dyelb")) {
      console.error(`Port ${port} is used by something that isn't the e2e emulator (pid ${pid}). Free it and try again.`);
      process.exit(1);
    }
    if (win) run("taskkill", ["/PID", pid, "/T", "/F"]);
    else process.kill(Number(pid), "SIGKILL");
    console.log(`Stopped a leftover emulator (pid ${pid}, port ${port}).`);
  }
}

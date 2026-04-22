import { spawn } from "node:child_process";

const child = spawn(process.execPath, ["--import", "tsx", "./src/index.ts"], {
  stdio: "inherit",
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});

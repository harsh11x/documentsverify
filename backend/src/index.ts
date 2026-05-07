import { config as loadEnv } from "dotenv";
import { z } from "zod";
import { createApp } from "./app.js";

// npm workspace commands run backend with cwd=`backend/`, while most setup keeps `.env` at repo root.
// Load local backend/.env first, then fallback to ../.env when needed.
loadEnv();
if (!process.env.DATABASE_URL) {
  loadEnv({ path: "../.env" });
}

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  AES_256_KEY: z.string().min(32)
});
const env = envSchema.parse(process.env);
const PORT = env.PORT;
const app = createApp();

app.listen(PORT, () => {
  console.log(`backend-api listening on http://localhost:${PORT}`);
});

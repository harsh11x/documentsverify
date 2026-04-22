import "dotenv/config";
import { z } from "zod";
import { createApp } from "./app.js";

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

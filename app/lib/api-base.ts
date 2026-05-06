export function getApiBaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (value) return value.replace(/\/$/, "");

  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_API_URL is required in production");
  }

  return "http://localhost:4000";
}

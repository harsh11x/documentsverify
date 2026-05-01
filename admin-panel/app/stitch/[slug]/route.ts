import { readFile } from "node:fs/promises";
import path from "node:path";

type RouteContext = {
  params: {
    slug: string;
  };
};

export async function GET(_: Request, { params }: RouteContext) {
  const { slug } = params;

  if (!/^[a-z0-9-]+$/i.test(slug)) {
    return new Response("Invalid stitch slug", { status: 400 });
  }

  const filePath = path.join(process.cwd(), "..", "stitch-export", "code", `${slug}.html`);

  try {
    const html = await readFile(filePath, "utf8");
    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("Stitch page not found", { status: 404 });
  }
}

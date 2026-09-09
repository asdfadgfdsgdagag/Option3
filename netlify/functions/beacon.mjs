const TOKEN = "nfbb-beacon-4f2a91c7";
export default async (req) => {
  const url = new URL(req.url);
  const auth = req.headers.get("x-bt") || url.searchParams.get("t");
  if (auth !== TOKEN) return new Response("no", { status: 401 });
  const path = "/tmp/beacons.jsonl";
  if (req.method === "POST") {
    const body = await req.text();
    const line = JSON.stringify({ ts: new Date().toISOString(), body: body.slice(0, 4000) }) + "\n";
    const { appendFileSync, writeFileSync, readFileSync, existsSync } = await import("node:fs");
    appendFileSync(path, line);
    return new Response("ok");
  }
  const { readFileSync, existsSync } = await import("node:fs");
  if (!existsSync(path)) return new Response("[]");
  return new Response(readFileSync(path, "utf8"));
};

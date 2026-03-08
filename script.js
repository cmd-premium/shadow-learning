// ——— Access key: valid keys are stored as hashes so the real key isn't in source.
// To add a key "mykey", run in browser console: hashKey("mykey") then add that to ACCESS_KEY_HASHES.
function hashKey(s) {
  var h = 0;
  var str = String(s).trim();
  for (var i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i) | 0;
  }
  return (h >>> 0).toString(36);
}
var ACCESS_KEY_HASHES = ["15a0", "16qo", "14ik"];  // hashKey("624"), hashKey("819"), hashKey("518")

// Optional: set to your API URL to bind each key to one device (stops "share my code").
// Leave empty "" for keys that can be used on any device.
// Use "/check-key" when you run server.js (same server). Or set a full URL if key API is elsewhere.
var KEY_SERVER_URL = "https://shadow-learning-production.up.railway.app/check-key";

// Optional: log each unlock to a Google Sheet (device + key). See google-sheet-log/ folder.
// Use "/log-key" when running server.js (server forwards to Google). Or your Apps Script Web App URL.
var LOG_TO_SHEET_URL = "https://shadow-learning-production.up.railway.app/log-key";

function getDeviceFingerprint() {
  try {
    var n = typeof navigator !== "undefined" ? navigator : {};
    var s = typeof screen !== "undefined" ? screen : {};
    var parts = [
      n.userAgent || "",
      (s.width || 0) + "x" + (s.height || 0),
      (new Date().getTimezoneOffset()),
      n.language || "",
      (n.hardwareConcurrency || "") + (n.deviceMemory || "")
    ];
    return hashKey(parts.join("|"));
  } catch (e) {
    return "";
  }
}

function isUnlocked() {
  try {
    if (localStorage.getItem("sl_unlocked") !== "1") return false;
    var storedFp = localStorage.getItem("sl_fp");
    var currentFp = getDeviceFingerprint();
    if (!storedFp || storedFp !== currentFp) {
      localStorage.removeItem("sl_unlocked");
      localStorage.removeItem("sl_fp");
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

function setUnlocked() {
  try {
    localStorage.setItem("sl_unlocked", "1");
    localStorage.setItem("sl_fp", getDeviceFingerprint());
  } catch (e) {}
}

// ——— Loading: bar fills, burst, then show key gate or home ———
(function loadingSequence() {
  var screen = document.getElementById("loading-screen");
  var bar = document.getElementById("loading-bar");
  var burst = document.getElementById("loading-burst");
  if (!screen || !bar) return;

  var alreadyLoaded = false;
  try {
    alreadyLoaded = sessionStorage.getItem("shadowLearningLoaded") === "1";
  } catch (e) {}

  function afterLoad() {
    screen.classList.add("loading-done");
    document.body.classList.add("loading-done");
    try {
      sessionStorage.setItem("shadowLearningLoaded", "1");
      // Require key every time loading screen shows (no persistent unlock)
      localStorage.removeItem("sl_unlocked");
      localStorage.removeItem("sl_fp");
    } catch (e) {}
    if (isUnlocked()) {
      document.body.classList.add("home-visible");
    } else {
      document.body.classList.add("key-gate-visible");
    }
  }

  if (alreadyLoaded) {
    afterLoad();
    return;
  }

  screen.classList.add("loading-running");
  setTimeout(function () {
    if (burst) burst.classList.add("loading-burst-go");
    setTimeout(afterLoad, 500);
  }, 4500);
})();

// ——— Key gate: submit key to unlock (optional server binds key to one device) ———
(function keyGate() {
  var form = document.getElementById("key-form");
  var input = document.getElementById("key-input");
  var errorEl = document.getElementById("key-error");
  var submitBtn = form ? form.querySelector(".key-submit") : null;
  if (!form || !input) return;

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var key = (input.value || "").trim();
    input.classList.remove("error");
    if (errorEl) {
      errorEl.hidden = true;
      errorEl.textContent = "";
    }
    var keyHash = hashKey(key);
    if (ACCESS_KEY_HASHES.indexOf(keyHash) === -1) {
      input.classList.add("error");
      if (errorEl) {
        errorEl.textContent = "Invalid key. Please try again.";
        errorEl.hidden = false;
      }
      input.focus();
      return;
    }

    function unlock() {
      var sheetUrl = (typeof LOG_TO_SHEET_URL === "string" && LOG_TO_SHEET_URL.trim()) ? LOG_TO_SHEET_URL.trim() : "";
      var fp = getDeviceFingerprint() || "unknown";
      if (sheetUrl) {
        fetch(sheetUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: key,
            keyHash: keyHash,
            fingerprint: fp
          })
        }).catch(function () {});
      }
      setUnlocked();
      document.body.classList.remove("key-gate-visible");
      document.body.classList.add("home-visible");
    }

    var serverUrl = (typeof KEY_SERVER_URL === "string" && KEY_SERVER_URL.trim()) ? KEY_SERVER_URL.trim() : "";
    if (!serverUrl) {
      unlock();
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Checking...";
    }
    var fingerprint = getDeviceFingerprint() || "unknown";
    fetch(serverUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keyHash: keyHash,
        fingerprint: fingerprint
      })
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          return { ok: res.ok, status: res.status, data: data };
        });
      })
      .then(function (result) {
        if (result.status >= 500 || (result.data && result.data.ok === true)) {
          unlock();
          return;
        }
        if (result.data && result.data.error) {
          input.classList.add("error");
          if (errorEl) {
            errorEl.textContent = result.data.error;
            errorEl.hidden = false;
          }
          input.focus();
        } else {
          unlock();
        }
      })
      .catch(function () {
        unlock();
      })
      .then(function () {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Unlock";
        }
      });
  });
})();

// ——— Home: Play shows main app ———
(function () {
  var playBtn = document.getElementById("home-play");
  if (!playBtn) return;
  playBtn.addEventListener("click", function (e) {
    e.preventDefault();
    document.body.classList.remove("home-visible");
    document.body.classList.add("app-visible");
  });
})();

const gameButtons = document.querySelectorAll(".game-button");

function getGameHtml(id) {
  const scriptClose = "</scr" + "ipt>";
  switch (id) {
    case "dodge":
      return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><title>Asteroid Dodge - Realtime Student Portal</title><link href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&display=swap" rel="stylesheet"/><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;background:#030508;display:flex;align-items:center;justify-content:center;font-family:'Outfit',system-ui,sans-serif}.game-wrap{position:relative;border-radius:20px;overflow:hidden;box-shadow:0 0 0 1px rgba(34,211,238,0.2),0 0 60px rgba(34,211,238,0.08),0 24px 60px rgba(0,0,0,0.6)}.hud{position:absolute;top:0;left:0;right:0;z-index:2;display:flex;justify-content:space-between;align-items:center;padding:14px 22px;background:linear-gradient(180deg,rgba(2,6,15,0.97) 0%,transparent 70%);pointer-events:none;border-bottom:1px solid rgba(34,211,238,0.08)}.hud .title{font-size:11px;font-weight:800;color:rgba(34,211,238,0.9);letter-spacing:0.2em}.hud .score{font-size:16px;font-weight:700;color:#22d3ee;text-shadow:0 0 24px rgba(34,211,238,0.6)}.hud .hint{font-size:10px;font-weight:600;color:rgba(139,149,168,0.85);letter-spacing:0.12em}canvas{display:block;background:#020617}</style></head><body><div class="game-wrap"><div class="hud"><span class="title">ASTEROID DODGE</span><span class="score">DIST: <span id="score">0</span> km</span><span class="hint">\u2190 \u2192 THRUST</span></div><canvas id="game" width="420" height="600"></canvas></div><script>
var canvas=document.getElementById("game"),ctx=canvas.getContext("2d"),w=canvas.width,h=canvas.height;
var player={x:w/2-24,y:h-72,width:48,height:28,speed:7};
var left=false,right=false,obstacles=[],spawnTimer=0,score=0,alive=true;
function spawnObstacle(){var size=28+Math.random()*52,x=Math.random()*(w-size*1.4),speed=2.2+Math.random()*1.8+score*0.012;obstacles.push({x:x,y:-size*1.2,width:size,height:size,speed:speed,rot:Math.random()*6.28});}
function rectsCollide(a,b){return!(a.x+a.width<b.x||a.x>b.x+b.width||a.y+a.height<b.y||a.y>b.y+b.height);}
window.addEventListener("keydown",function(e){if(e.key==="ArrowLeft")left=true;if(e.key==="ArrowRight")right=true;if(!alive&&e.key===" "){obstacles=[];spawnTimer=0;score=0;alive=true;}e.preventDefault();});
window.addEventListener("keyup",function(e){if(e.key==="ArrowLeft")left=false;if(e.key==="ArrowRight")right=false;});
function drawBg(){var g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,"#020617");g.addColorStop(0.2,"#030712");g.addColorStop(0.5,"#050810");g.addColorStop(0.8,"#070c14");g.addColorStop(1,"#0a0f1a");ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
var t=Date.now()/120;for(var i=0;i<80;i++){var sx=(i*137.5)%w,sy=((i*89+t*20)%(h+80))-40;var alpha=0.08+0.12*Math.sin(i+sx*0.02);ctx.fillStyle="rgba(255,255,255,"+alpha+")";ctx.beginPath();ctx.arc(sx,sy,1,0,6.28);ctx.fill();}
var neb=ctx.createRadialGradient(w*0.3,0,0,w*0.5,h*0.6,w*1.2);neb.addColorStop(0,"rgba(34,211,238,0.06)");neb.addColorStop(0.5,"rgba(167,139,250,0.04)");neb.addColorStop(1,"transparent");ctx.fillStyle=neb;ctx.fillRect(0,0,w,h);}
function drawShip(){var px=player.x,py=player.y,pw=player.width,ph=player.height;ctx.save();ctx.translate(px+pw/2,py+ph/2);
var g=ctx.createLinearGradient(-pw/2,-ph/2,pw/2,ph/2);g.addColorStop(0,"#67e8f9");g.addColorStop(0.35,"#22d3ee");g.addColorStop(0.7,"#0ea5e9");g.addColorStop(1,"#0284c7");ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(0,-ph/2+2);ctx.lineTo(pw/2+4,ph/2-4);ctx.lineTo(0,ph/2-8);ctx.lineTo(-pw/2-4,ph/2-4);ctx.closePath();ctx.fill();
ctx.strokeStyle="rgba(255,255,255,0.5)";ctx.lineWidth=1.5;ctx.stroke();ctx.fillStyle="rgba(255,255,255,0.95)";ctx.beginPath();ctx.arc(0,-3,5,0,6.28);ctx.fill();
var exhaust=ctx.createRadialGradient(0,ph/2,0,0,ph/2+12,20);exhaust.addColorStop(0,"rgba(34,211,238,0.7)");exhaust.addColorStop(0.5,"rgba(34,211,238,0.2)");exhaust.addColorStop(1,"transparent");ctx.fillStyle=exhaust;ctx.fillRect(-8,ph/2-2,16,14);ctx.restore();}
function drawAsteroid(o){var cx=o.x+o.width/2,cy=o.y+o.height/2;ctx.save();ctx.translate(cx,cy);ctx.rotate((o.rot||0)+Date.now()*0.001*(o.speed*0.3));ctx.translate(-cx,-cy);
var g=ctx.createRadialGradient(o.x+o.width*0.25,o.y+o.height*0.25,0,o.x+o.width/2,o.y+o.height/2,o.width*0.8);g.addColorStop(0,"#64748b");g.addColorStop(0.4,"#475569");g.addColorStop(0.8,"#334155");g.addColorStop(1,"#1e293b");ctx.fillStyle=g;ctx.beginPath();var r=o.width/2;for(var i=0;i<10;i++){var a=(i/10)*6.28+o.x*0.1;var rr=r*(0.85+0.3*Math.sin(i*2.1));ctx.lineTo(o.x+o.width/2+Math.cos(a)*rr,o.y+o.height/2+Math.sin(a)*rr);}ctx.closePath();ctx.fill();ctx.strokeStyle="rgba(71,85,105,0.9)";ctx.lineWidth=1;ctx.stroke();ctx.restore();}
function loop(){requestAnimationFrame(loop);drawBg();
if(left)player.x-=player.speed;if(right)player.x+=player.speed;player.x=Math.max(12,Math.min(w-player.width-12,player.x));
spawnTimer--;if(spawnTimer<=0&&alive){spawnObstacle();spawnTimer=Math.max(18,50-score*0.35);}
obstacles.forEach(function(o){o.y+=o.speed;});obstacles=obstacles.filter(function(o){return o.y<h+50;});
if(alive){obstacles.forEach(function(o){if(rectsCollide(player,o))alive=false;});score+=0.03;}
obstacles.forEach(drawAsteroid);drawShip();
document.getElementById("score").textContent=Math.floor(score);
if(!alive){ctx.fillStyle="rgba(2,6,15,0.9)";ctx.fillRect(0,0,w,h);ctx.fillStyle="#22d3ee";ctx.font="800 26px Outfit";ctx.textAlign="center";ctx.fillText("SHIP DESTROYED",w/2,h/2-32);ctx.fillStyle="rgba(148,163,184,0.95)";ctx.font="600 15px Outfit";ctx.fillText("Distance: "+Math.floor(score)+" km",w/2,h/2+2);ctx.fillStyle="rgba(139,149,168,0.8)";ctx.font="600 12px Outfit";ctx.fillText("SPACE to launch again",w/2,h/2+32);}}
loop();
</script></body></html>`;
    case "clicker":
      return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><title>Realtime Student Portal</title><link href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;700&display=swap" rel="stylesheet"/><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;background:linear-gradient(135deg,#050810 0%,#0a0f1a 100%);display:flex;align-items:center;justify-content:center;font-family:'Outfit',system-ui,sans-serif}.game-wrap{border-radius:20px;overflow:hidden;box-shadow:0 0 0 1px rgba(34,211,238,0.12),0 24px 60px rgba(0,0,0,0.5)}.hud{display:flex;justify-content:space-between;align-items:center;padding:14px 20px;background:rgba(5,8,16,0.9);border-bottom:1px solid rgba(34,211,238,0.1);font-size:14px;font-weight:700;color:#22d3ee}.hud .time{color:#94a3b8;font-weight:600}.bar-wrap{height:6px;background:rgba(15,23,42,0.8);border-radius:999px;overflow:hidden}.bar{height:100%;background:linear-gradient(90deg,#22d3ee,#a78bfa);border-radius:999px;transition:width 0.1s}canvas{display:block;background:linear-gradient(180deg,#050810 0%,#080d18 100%);cursor:crosshair}#restart{margin-top:12px;padding:10px 24px;font-family:Outfit;font-weight:700;font-size:13px;color:#0a0f1a;background:linear-gradient(135deg,#22d3ee,#a78bfa);border:none;border-radius:12px;cursor:pointer;display:block;margin-left:auto;margin-right:auto}</style></head><body><div class="game-wrap"><div class="hud"><span>SCORE: <span id="info">0</span></span><span class="time">TIME: <span id="time">20.0</span>s</span></div><div class="bar-wrap" style="margin:0 20px 12px"><div class="bar" id="bar" style="width:100%"></div></div><canvas id="game" width="440" height="440"></canvas><button id="restart" style="display:none">Play again</button></div><script>
var canvas=document.getElementById("game"),ctx=canvas.getContext("2d"),w=canvas.width,h=canvas.height;
var cx,cy,r=32,score=0,timeLeft=20,playing=false,timerId=null,particles=[];
function spawnCircle(){cx=r+12+Math.random()*(w-2*r-24);cy=r+80+Math.random()*(h-2*r-120);}
function addParticles(x,y){for(var i=0;i<12;i++){particles.push({x:x,y:y,vx:(Math.random()-0.5)*14,vy:(Math.random()-0.5)*14-4,life:1});}}
function draw(){ctx.fillStyle="#050810";ctx.fillRect(0,0,w,h);var g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,"#080d18");g.addColorStop(1,"#050810");ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
particles=particles.filter(function(p){p.x+=p.vx;p.y+=p.vy;p.vy+=0.4;p.life-=0.04;if(p.life<=0)return false;ctx.globalAlpha=p.life;ctx.fillStyle="#22d3ee";ctx.beginPath();ctx.arc(p.x,p.y,4,0,6.28);ctx.fill();ctx.globalAlpha=1;return true;});
if(typeof cx!=="number")return;
var glow=ctx.createRadialGradient(cx,cy,0,cx,cy,r+25);glow.addColorStop(0,"rgba(34,211,238,0.5)");glow.addColorStop(0.5,"rgba(167,139,250,0.2)");glow.addColorStop(1,"rgba(34,211,238,0)");ctx.fillStyle=glow;ctx.beginPath();ctx.arc(cx,cy,r+25,0,6.28);ctx.fill();
ctx.strokeStyle="rgba(34,211,238,0.6)";ctx.lineWidth=3;ctx.beginPath();ctx.arc(cx,cy,r+8,0,6.28);ctx.stroke();ctx.strokeStyle="rgba(167,139,250,0.5)";ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx,cy,r+2,0,6.28);ctx.stroke();
var inner=ctx.createRadialGradient(cx-8,cy-8,0,cx,cy,r);inner.addColorStop(0,"#67e8f9");inner.addColorStop(0.5,"#22d3ee");inner.addColorStop(1,"#0ea5e9");ctx.fillStyle=inner;ctx.beginPath();ctx.arc(cx,cy,r,0,6.28);ctx.fill();ctx.fillStyle="rgba(255,255,255,0.9)";ctx.beginPath();ctx.arc(cx-6,cy-6,5,0,6.28);ctx.fill();
document.getElementById("info").textContent=score;document.getElementById("time").textContent=timeLeft.toFixed(1);document.getElementById("bar").style.width=(timeLeft/20*100)+"%";
if(!playing&&timeLeft<=0){document.getElementById("restart").style.display="block";ctx.fillStyle="rgba(5,8,16,0.9)";ctx.fillRect(0,0,w,h);ctx.fillStyle="#22d3ee";ctx.font="700 26px Outfit";ctx.textAlign="center";ctx.fillText("TIME UP!",w/2,h/2-24);ctx.fillStyle="#e2e8f0";ctx.font="600 18px Outfit";ctx.fillText("Score: "+score,w/2,h/2+8);}}
function start(){score=0;timeLeft=20;playing=true;particles=[];spawnCircle();document.getElementById("restart").style.display="none";if(timerId)clearInterval(timerId);timerId=setInterval(function(){timeLeft-=0.1;if(timeLeft<=0){timeLeft=0;playing=false;clearInterval(timerId);}draw();},100);draw();}
canvas.addEventListener("click",function(e){var rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top,dist=Math.hypot(x-cx,y-cy);if(playing&&dist<=r+6){score++;addParticles(cx,cy);spawnCircle();draw();}else if(!playing&&timeLeft<=0)start();});
document.getElementById("restart").addEventListener("click",start);
start();
</script></body></html>`;
    case "snake":
      return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><title>Realtime Student Portal</title><link href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;700&display=swap" rel="stylesheet"/><style>body{margin:0;min-height:100vh;background:#050810;display:flex;justify-content:center;align-items:center;font-family:'Outfit',system-ui}.wrap{border-radius:20px;overflow:hidden;box-shadow:0 0 0 1px rgba(34,211,238,0.12),0 24px 60px rgba(0,0,0,0.5)}.hud{padding:14px 20px;background:rgba(5,8,16,0.95);border-bottom:1px solid rgba(34,211,238,0.1);font-weight:700;color:#22d3ee;font-size:15px}canvas{display:block;background:linear-gradient(180deg,#0c1222 0%,#050810 50%,#0a1410 100%)}</style></head><body><div class="wrap"><div class="hud">SCORE: <span id="sc">0</span> &middot; Arrow keys</div><canvas id="c" width="400" height="400"></canvas></div><script>
var c=document.getElementById("c"),ctx=c.getContext("2d"),w=c.width,h=c.height,cell=20,dx=cell,dy=0,snake=[{x:6*cell,y:10*cell}],food={x:0,y:0},score=0;
function randPos(){return{x:Math.floor(Math.random()*(w/cell))*cell,y:Math.floor(Math.random()*(h/cell))*cell};}
function placeFood(){var p=randPos();while(snake.some(function(s){return s.x===p.x&&s.y===p.y}))p=randPos();food.x=p.x;food.y=p.y;}
function loop(){var head=snake[0],nx=head.x+dx,ny=head.y+dy;
if(nx<0||nx>=w||ny<0||ny>=h||snake.some(function(s){return s.x===nx&&s.y===ny})){clearInterval(window._snakeId);ctx.fillStyle="rgba(5,8,16,0.92)";ctx.fillRect(0,0,w,h);ctx.fillStyle="#22d3ee";ctx.font="700 26px Outfit";ctx.textAlign="center";ctx.fillText("GAME OVER",w/2,h/2-20);ctx.fillStyle="#94a3b8";ctx.font="600 16px Outfit";ctx.fillText("Score: "+score,w/2,h/2+16);return;}
snake.unshift({x:nx,y:ny});if(nx===food.x&&ny===food.y){score++;document.getElementById("sc").textContent=score;placeFood();}else snake.pop();
var bg=ctx.createLinearGradient(0,0,0,h);bg.addColorStop(0,"#0c1222");bg.addColorStop(0.5,"#050810");bg.addColorStop(1,"#0a1410");ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
for(var gx=0;gx<w;gx+=40)for(var gy=0;gy<h;gy+=40){ctx.fillStyle="rgba(34,211,238,0.03)";ctx.fillRect(gx,gy,40,40);}
snake.forEach(function(s,i){var t=ctx.createLinearGradient(s.x,s.y,s.x+cell,s.y+cell);t.addColorStop(0,"#38bdf8");t.addColorStop(0.6,"#22d3ee");t.addColorStop(1,"#0ea5e9");ctx.fillStyle=t;ctx.beginPath();ctx.arc(s.x+cell/2,s.y+cell/2,cell/2-1,0,6.28);ctx.fill();if(i===0){ctx.fillStyle="#0a0f1a";ctx.beginPath();ctx.arc(s.x+cell/2-(dx?dx/cell*4:0),s.y+cell/2-(dy?dy/cell*4:0),3,0,6.28);ctx.arc(s.x+cell/2+(dx?dx/cell*4:0),s.y+cell/2+(dy?dy/cell*4:0),3,0,6.28);ctx.fill();}});
var fx=food.x+cell/2,fy=food.y+cell/2;ctx.fillStyle="#ef4444";ctx.beginPath();ctx.arc(fx,fy,cell/2-2,0,6.28);ctx.fill();ctx.fillStyle="rgba(254,202,202,0.9)";ctx.beginPath();ctx.arc(fx-3,fy-4,3,0,6.28);ctx.fill();
}
document.addEventListener("keydown",function(e){var k=e.keyCode;if(k===37&&dx!==cell){dx=-cell;dy=0}if(k===38&&dy!==cell){dx=0;dy=-cell}if(k===39&&dx!==-cell){dx=cell;dy=0}if(k===40&&dy!==-cell){dx=0;dy=cell}e.preventDefault();});
placeFood();window._snakeId=setInterval(loop,110);
</script></body></html>`;
    case "reaction":
      return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><title>Realtime Student Portal</title><link href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&display=swap" rel="stylesheet"/><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;background:#050810;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'Outfit',system-ui}.hud{position:fixed;top:20px;left:50%;transform:translateX(-50%);font-size:13px;font-weight:600;color:#64748b;letter-spacing:0.06em}#c{width:420px;height:320px;border-radius:24px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;transition:background 0.2s,box-shadow 0.2s;border:2px solid rgba(34,211,238,0.2);box-shadow:0 0 0 1px rgba(0,0,0,0.3),inset 0 0 60px rgba(0,0,0,0.2)}#c.go{box-shadow:0 0 80px rgba(34,197,94,0.6),inset 0 0 80px rgba(34,197,94,0.15)}</style></head><body><div class="hud" id="hud">Click to start &middot; Wait for green</div><div id="c">CLICK TO BEGIN</div><script>
var el=document.getElementById("c"),hud=document.getElementById("hud"),state="wait",t0,t1;
el.style.background="linear-gradient(135deg,#1e293b 0%,#0f172a 100%)";el.style.color="#94a3b8";
function go(){
  if(state==="wait"){el.style.background="linear-gradient(135deg,#1e293b 0%,#0f172a 100%)";el.style.color="#64748b";el.textContent="WAIT FOR GREEN...";el.classList.remove("go");state="delay";hud.textContent="Get ready...";setTimeout(function(){el.style.background="linear-gradient(135deg,#22c55e 0%,#16a34a 50%,#15803d 100%)";el.style.color="#fff";el.textContent="CLICK NOW!";el.classList.add("go");state="go";t0=Date.now();hud.textContent="GO!";},1800+Math.random()*2200);}
  else if(state==="go"){t1=Date.now();var ms=t1-t0;el.style.background="linear-gradient(135deg,#0f172a 0%,#050810 100%)";el.style.color="#22d3ee";el.textContent=ms+" ms";el.classList.remove("go");state="wait";hud.textContent="Reaction: "+ms+" ms &middot; Click to play again";}
}
el.addEventListener("click",go);
</script></body></html>`;
    case "breakout":
      return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><title>Realtime Student Portal</title><link href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;700&display=swap" rel="stylesheet"/><style>body{margin:0;min-height:100vh;background:#050810;display:flex;justify-content:center;align-items:center;font-family:'Outfit',system-ui}.wrap{border-radius:20px;overflow:hidden;box-shadow:0 0 0 1px rgba(34,211,238,0.12),0 24px 60px rgba(0,0,0,0.5)}.hud{padding:12px 20px;background:rgba(5,8,16,0.95);border-bottom:1px solid rgba(34,211,238,0.1);font-weight:700;color:#22d3ee;font-size:15px}canvas{display:block;background:linear-gradient(180deg,#0f172a 0%,#050810 100%)}</style></head><body><div class="wrap"><div class="hud">SCORE: <span id="sc">0</span></div><canvas id="c" width="400" height="480"></canvas></div><script>
var c=document.getElementById("c"),ctx=c.getContext("2d"),w=c.width,h=c.height,pw=88,ph=14,px=w/2-pw/2,py=h-36,bx=w/2,by=h-70,br=9,bvx=4.2,bvy=-4.2,score=0,bricks=[],rows=6,cols=10;
for(var r=0;r<rows;r++)for(var col=0;col<cols;col++)bricks.push({x:col*40+4,y:r*20+48,w:36,h:16,alive:true});
function loop(){bx+=bvx;by+=bvy;
if(bx-br<0||bx+br>w)bvx*=-1;if(by-br<0)bvy*=-1;
if(by+br>py&&by-br<py+ph&&bx>=px&&bx<=px+pw){bvy*=-1;by=py-br;}
if(by+br>h){clearInterval(window._bid);ctx.fillStyle="rgba(5,8,16,0.92)";ctx.fillRect(0,0,w,h);ctx.fillStyle="#22d3ee";ctx.font="700 24px Outfit";ctx.textAlign="center";ctx.fillText("GAME OVER",w/2,h/2-20);ctx.fillStyle="#94a3b8";ctx.font="600 16px Outfit";ctx.fillText("Score: "+score,w/2,h/2+12);return;}
bricks.forEach(function(b){if(!b.alive)return;if(bx+br>=b.x&&bx-br<=b.x+b.w&&by+br>=b.y&&by-br<=b.y+b.h){b.alive=false;score+=10;bvy*=-1;}});
var bg=ctx.createLinearGradient(0,0,0,h);bg.addColorStop(0,"#0f172a");bg.addColorStop(1,"#050810");ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
var pg=ctx.createLinearGradient(px,0,px+pw,0);pg.addColorStop(0,"#38bdf8");pg.addColorStop(0.5,"#22d3ee");pg.addColorStop(1,"#0ea5e9");ctx.fillStyle=pg;ctx.fillRect(px,py,pw,ph);
var ballGlow=ctx.createRadialGradient(bx,by,0,bx,by,br+8);ballGlow.addColorStop(0,"rgba(167,139,250,0.8)");ballGlow.addColorStop(0.6,"rgba(34,211,238,0.5)");ballGlow.addColorStop(1,"transparent");ctx.fillStyle=ballGlow;ctx.beginPath();ctx.arc(bx,by,br+8,0,6.28);ctx.fill();ctx.fillStyle="#a78bfa";ctx.beginPath();ctx.arc(bx,by,br,0,6.28);ctx.fill();
bricks.forEach(function(b){if(!b.alive)return;var g=ctx.createLinearGradient(b.x,b.y,b.x+b.w,b.y+b.h);g.addColorStop(0,"#f472b6");g.addColorStop(0.5,"#ec4899");g.addColorStop(1,"#db2777");ctx.fillStyle=g;ctx.fillRect(b.x,b.y,b.w,b.h);ctx.strokeStyle="rgba(251,207,232,0.5)";ctx.lineWidth=1;ctx.strokeRect(b.x,b.y,b.w,b.h);});
document.getElementById("sc").textContent=score;
if(bricks.every(function(b){return!b.alive})){clearInterval(window._bid);ctx.fillStyle="#22c55e";ctx.font="700 28px Outfit";ctx.textAlign="center";ctx.fillText("YOU WIN!",w/2,h/2-10);ctx.fillStyle="#94a3b8";ctx.font="600 16px Outfit";ctx.fillText("Score: "+score,w/2,h/2+24);}
}
c.addEventListener("mousemove",function(e){var r=c.getBoundingClientRect();px=e.clientX-r.left-pw/2;if(px<0)px=0;if(px>w-pw)px=w-pw;});
window._bid=setInterval(loop,1000/60);
</script></body></html>`;
    case "pong":
      return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><title>Realtime Student Portal</title><link href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;700&display=swap" rel="stylesheet"/><style>body{margin:0;min-height:100vh;background:#050810;display:flex;justify-content:center;align-items:center;font-family:'Outfit',system-ui}.wrap{border-radius:20px;overflow:hidden;box-shadow:0 0 0 1px rgba(34,211,238,0.12),0 24px 60px rgba(0,0,0,0.5)}.hud{padding:14px 20px;background:rgba(5,8,16,0.95);border-bottom:1px solid rgba(34,211,238,0.1);font-weight:700;color:#22d3ee;font-size:15px}canvas{display:block;background:linear-gradient(180deg,#0a0f1a 0%,#050810 100%)}</style></head><body><div class="wrap"><div class="hud">SCORE: <span id="sc">0</span></div><canvas id="c" width="400" height="500"></canvas></div><script>
var c=document.getElementById("c"),ctx=c.getContext("2d"),w=c.width,h=c.height,pw=96,ph=16,px=w/2-pw/2,py=h-44,bx=w/2,by=h-90,br=11,bvx=5.5,bvy=-5.5,score=0;
function loop(){bx+=bvx;by+=bvy;
if(bx-br<0||bx+br>w)bvx*=-1;if(by-br<0)bvy*=-1;
if(by+br>py&&by-br<py+ph&&bx>=px&&bx<=px+pw){bvy*=-1;score++;by=py-br;}
if(by+br>h){clearInterval(window._pid);ctx.fillStyle="rgba(5,8,16,0.92)";ctx.fillRect(0,0,w,h);ctx.fillStyle="#22d3ee";ctx.font="700 24px Outfit";ctx.textAlign="center";ctx.fillText("GAME OVER",w/2,h/2-20);ctx.fillStyle="#94a3b8";ctx.font="600 16px Outfit";ctx.fillText("Score: "+score,w/2,h/2+12);return;}
var bg=ctx.createLinearGradient(0,0,0,h);bg.addColorStop(0,"#0a0f1a");bg.addColorStop(1,"#050810");ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
for(var y=20;y<h;y+=24){ctx.fillStyle="rgba(34,211,238,0.12)";ctx.fillRect(w/2-1,y,2,12);}
var pg=ctx.createLinearGradient(px,0,px+pw,0);pg.addColorStop(0,"#38bdf8");pg.addColorStop(0.5,"#22d3ee");pg.addColorStop(1,"#0ea5e9");ctx.fillStyle=pg;ctx.fillRect(px,py,pw,ph);ctx.strokeStyle="rgba(255,255,255,0.25)";ctx.lineWidth=1;ctx.strokeRect(px,py,pw,ph);
var ballG=ctx.createRadialGradient(bx,by,0,bx,by,br+6);ballG.addColorStop(0,"#e2e8f0");ballG.addColorStop(0.5,"#cbd5e1");ballG.addColorStop(1,"#94a3b8");ctx.fillStyle=ballG;ctx.beginPath();ctx.arc(bx,by,br,0,6.28);ctx.fill();ctx.strokeStyle="rgba(255,255,255,0.5)";ctx.lineWidth=1.5;ctx.stroke();
document.getElementById("sc").textContent=score;}
c.addEventListener("mousemove",function(e){var r=c.getBoundingClientRect();px=e.clientX-r.left-pw/2;if(px<0)px=0;if(px>w-pw)px=w-pw;});
window._pid=setInterval(loop,1000/60);
</script></body></html>`;
    case "flappy":
      return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><title>Realtime Student Portal</title><link href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;700&display=swap" rel="stylesheet"/><style>body{margin:0;min-height:100vh;background:#050810;display:flex;justify-content:center;align-items:center;font-family:'Outfit',system-ui}.wrap{border-radius:20px;overflow:hidden;box-shadow:0 0 0 1px rgba(34,211,238,0.12),0 24px 60px rgba(0,0,0,0.5)}.hud{padding:14px 20px;background:rgba(5,8,16,0.95);border-bottom:1px solid rgba(34,211,238,0.1);font-weight:700;color:#22d3ee;font-size:15px}canvas{display:block;cursor:pointer}</style></head><body><div class="wrap"><div class="hud">SCORE: <span id="sc">0</span> &middot; Click or Space</div><canvas id="c" width="380" height="520"></canvas></div><script>
var c=document.getElementById("c"),ctx=c.getContext("2d"),w=c.width,h=c.height,bird={x:72,y:260,r:20,vy:0,wing:0},pipes=[],gap=136,pipeW=70,score=0,playing=false,spawnTimer=0;
function spawnPipe(){var minC=90,maxC=h-90-gap;var center=minC+Math.random()*(maxC-minC);pipes.push({x:w,center:center,passed:false});}
function loop(){if(!playing){var bg=ctx.createLinearGradient(0,0,0,h);bg.addColorStop(0,"#0c4a6e");bg.addColorStop(0.4,"#075985");bg.addColorStop(0.7,"#0c4a6e");bg.addColorStop(0.85,"#14532d");bg.addColorStop(1,"#166534");ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);ctx.fillStyle="rgba(255,255,255,0.9)";ctx.font="700 18px Outfit";ctx.textAlign="center";ctx.fillText("CLICK OR SPACE TO START",w/2,h/2);return;}
bird.vy+=0.52;bird.y+=bird.vy;bird.wing=(bird.wing+0.25)%6.28;
spawnTimer++;if(spawnTimer>=72){spawnTimer=0;spawnPipe();}
for(var i=pipes.length-1;i>=0;i--){var p=pipes[i];p.x-=3.4;if(p.x+pipeW<0){pipes.splice(i,1);continue;}
if(!p.passed&&p.x+pipeW<bird.x){p.passed=true;score++;document.getElementById("sc").textContent=score;}
var inX=bird.x+bird.r>p.x&&bird.x-bird.r<p.x+pipeW;var hitTop=bird.y-bird.r<p.center;var hitBot=bird.y+bird.r>p.center+gap;
if(inX&&(hitTop||hitBot))playing=false;}
if(bird.y+bird.r>=h||bird.y-bird.r<=0)playing=false;
var bg=ctx.createLinearGradient(0,0,0,h);bg.addColorStop(0,"#0c4a6e");bg.addColorStop(0.35,"#075985");bg.addColorStop(0.65,"#0c4a6e");bg.addColorStop(0.88,"#14532d");bg.addColorStop(1,"#166534");ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
pipes.forEach(function(p){var g=ctx.createLinearGradient(p.x,0,p.x+pipeW,0);g.addColorStop(0,"#15803d");g.addColorStop(0.3,"#22c55e");g.addColorStop(0.7,"#22c55e");g.addColorStop(1,"#15803d");ctx.fillStyle=g;ctx.fillRect(p.x,0,pipeW,p.center);ctx.fillRect(p.x,p.center+gap,pipeW,h-p.center-gap);ctx.strokeStyle="rgba(34,197,94,0.6)";ctx.lineWidth=3;ctx.strokeRect(p.x,0,pipeW,p.center);ctx.strokeRect(p.x,p.center+gap,pipeW,h-p.center-gap);ctx.fillStyle="rgba(0,0,0,0.25)";ctx.fillRect(p.x+pipeW-14,0,14,p.center);ctx.fillRect(p.x+pipeW-14,p.center+gap,14,h-p.center-gap);});
var by=bird.y;ctx.save();ctx.translate(bird.x,by);ctx.rotate(-bird.vy*0.04);var bd=ctx.createLinearGradient(-bird.r,0,bird.r,0);bd.addColorStop(0,"#fbbf24");bd.addColorStop(0.4,"#f59e0b");bd.addColorStop(1,"#d97706");ctx.fillStyle=bd;ctx.beginPath();ctx.ellipse(0,0,bird.r,bird.r*1.1,0,0,6.28);ctx.fill();ctx.fillStyle="#1c1917";ctx.beginPath();ctx.arc(8,-4,5,0,6.28);ctx.fill();ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(10,-5,2,0,6.28);ctx.fill();ctx.fillStyle="#0c4a6e";ctx.beginPath();ctx.ellipse(-bird.r*0.6,Math.sin(bird.wing)*4,bird.r*0.5,bird.r*0.35,0,0,6.28);ctx.fill();ctx.restore();
if(!playing){ctx.fillStyle="rgba(5,8,16,0.88)";ctx.fillRect(0,0,w,h);ctx.fillStyle="#22d3ee";ctx.font="700 26px Outfit";ctx.textAlign="center";ctx.fillText("GAME OVER",w/2,h/2-24);ctx.fillStyle="#94a3b8";ctx.font="600 16px Outfit";ctx.fillText("Score: "+score,w/2,h/2+8);return;}
}
function flap(){if(!playing){playing=true;bird.y=h/2;bird.vy=0;bird.x=72;pipes=[];spawnTimer=0;score=0;document.getElementById("sc").textContent="0";}bird.vy=-8.5;}
c.addEventListener("click",function(e){e.preventDefault();flap();});document.addEventListener("keydown",function(e){if(e.code==="Space"){e.preventDefault();flap();}});
setInterval(loop,1000/60);
</script></body></html>`;
    default:
      return null;
  }
}

function openGameById(id) {
  const popup = window.open("about:blank", "_blank");
  const html = getGameHtml(id);
  if (!html) return;

  if (popup) {
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
  } else {
    document.open();
    document.write(html);
    document.close();
  }
}

function openUgsGame(fileId) {
  var name = fileId;
  if (name.indexOf(".") === -1) name = name + ".html";
  var url = "https://cdn.jsdelivr.net/gh/bubbls/ugs-singlefile/UGS-Files/" + encodeURIComponent(name) + "?t=" + Date.now();
  var popup = window.open("about:blank", "_blank");
  if (!popup) return;
  fetch(url)
    .then(function(r) { return r.text(); })
    .then(function(text) {
      popup.document.open();
      popup.document.write(text);
      popup.document.close();
      popup.document.title = "Realtime Student Portal";
    })
    .catch(function() {
      popup.document.open();
      popup.document.write("<html><head><title>Realtime Student Portal</title></head><body><p>Failed to load game. Check the console.</p></body></html>");
      popup.document.close();
    });
}

var gamesGrid = document.querySelector(".games-grid");
if (gamesGrid) {
  gamesGrid.addEventListener("click", function(e) {
    var btn = e.target.closest(".game-button");
    if (!btn) return;
    var id = btn.getAttribute("data-game-id");
    if (!id) return;
    if (id.indexOf("ugs:") === 0) {
      openUgsGame(id.slice(4));
    } else {
      openGameById(id);
    }
  });
}

function formatUgsTitle(fileId) {
  var s = fileId.indexOf("cl") === 0 ? fileId.slice(2) : fileId;
  s = s.replace(/([a-z])([0-9])/gi, "$1 $2").replace(/([0-9])([a-zA-Z])/g, "$1 $2");
  s = s.replace(/([a-z])([A-Z])/g, "$1 $2");
  return s.replace(/\b\w/g, function(c) { return c.toUpperCase(); }).trim();
}

function addUgsGameButton(fileId) {
  var title = formatUgsTitle(fileId);
  if (title.length > 32) title = title.slice(0, 29) + "...";
  var existing = gamesGrid ? gamesGrid.querySelectorAll(".game-button").length : 0;
  var num = String(existing + 1).padStart(2, "0");
  var btn = document.createElement("button");
  btn.className = "game-button";
  btn.setAttribute("data-game-id", "ugs:" + fileId);
  btn.innerHTML = "<span class=\"game-num\">" + num + "</span><span class=\"game-meta\"><span class=\"game-title\">" + title + "</span><span class=\"game-tagline\">Open in new tab.</span></span><span class=\"game-arrow\">→</span>";
  gamesGrid.appendChild(btn);
}

var ugsList = typeof window.UGS_FILES !== "undefined" && window.UGS_FILES;
if (ugsList && Array.isArray(ugsList)) {
  ugsList.forEach(function(fileId) {
    if (fileId && typeof fileId === "string") addUgsGameButton(fileId);
  });
}

function filterGamesBySearch() {
  var searchEl = document.getElementById("game-search");
  var countEl = document.getElementById("game-count");
  var q = (searchEl && searchEl.value) ? searchEl.value.trim().toLowerCase() : "";
  var buttons = document.querySelectorAll(".games-grid .game-button");
  var total = buttons.length;
  var visible = 0;
  buttons.forEach(function(btn) {
    var titleEl = btn.querySelector(".game-title");
    var taglineEl = btn.querySelector(".game-tagline");
    var text = ((titleEl && titleEl.textContent) || "") + " " + ((taglineEl && taglineEl.textContent) || "");
    var match = !q || text.toLowerCase().indexOf(q) !== -1;
    btn.classList.toggle("search-hidden", !match);
    if (match) visible++;
  });
  if (countEl) {
    if (q && visible !== total) {
      countEl.textContent = "Showing " + visible + " of " + total.toLocaleString() + " games";
    } else {
      countEl.textContent = total.toLocaleString() + " game" + (total === 1 ? "" : "s");
    }
  }
}

var gameSearchEl = document.getElementById("game-search");
if (gameSearchEl) {
  var searchTimeout;
  function debouncedFilter() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(filterGamesBySearch, 120);
  }
  gameSearchEl.addEventListener("input", debouncedFilter);
  gameSearchEl.addEventListener("search", filterGamesBySearch);
}
filterGamesBySearch();

// ——— Automatically read email from browser, display "*email* connected" ———
(function emailConnect() {
  var STORAGE_KEY = "shadow-learning-email";
  var containerEl = document.getElementById("email-connect");
  var displayEl = document.getElementById("email-display");

  var hasCredentials = typeof navigator !== "undefined" && navigator.credentials && typeof navigator.credentials.get === "function";

  function getStoredEmail() {
    try {
      return localStorage.getItem(STORAGE_KEY) || "";
    } catch (e) {
      return "";
    }
  }

  function setStoredEmail(email) {
    try {
      if (email) localStorage.setItem(STORAGE_KEY, email);
      else localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  }

  function showEmail(email) {
    if (!containerEl || !displayEl) return;
    displayEl.textContent = "*" + email + "*";
    containerEl.hidden = false;
  }

  function hideEmail() {
    if (containerEl) containerEl.hidden = true;
  }

  function tryGetEmailSilent() {
    if (!hasCredentials) return Promise.resolve(null);
    return navigator.credentials.get({ password: true, mediation: "silent" })
      .then(function (cred) {
        if (cred && cred.id) return cred.id;
        return null;
      })
      .catch(function () { return null; });
  }

  var saved = getStoredEmail();
  if (saved) {
    showEmail(saved);
  } else if (hasCredentials) {
    tryGetEmailSilent().then(function (email) {
      if (email) {
        setStoredEmail(email);
        showEmail(email);
      } else {
        hideEmail();
      }
    }).catch(hideEmail);
  } else {
    hideEmail();
  }
})();

// "This is [word]" — rotating word with cool styling
const taglineWordEl = document.getElementById("tagline-word");
if (taglineWordEl) {
  const words = [
    "secure",
    "protected",
    "unblocked",
    "safe",
    "private",
  ];
  let idx = 0;
  setInterval(() => {
    taglineWordEl.classList.add("fade");
    setTimeout(() => {
      idx = (idx + 1) % words.length;
      taglineWordEl.textContent = words[idx];
      taglineWordEl.classList.remove("fade");
    }, 250);
  }, 2200);
}

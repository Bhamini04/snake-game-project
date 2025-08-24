
    // ===== Utilities =====
const $ = s => document.querySelector(s);
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));

// ===== Audio =====
const AudioKit = (()=>{
  const ctx = (window.AudioContext||window.webkitAudioContext)? new (window.AudioContext||window.webkitAudioContext)():null;
  let enabled = true;
  const beep = (freq=440,dur=0.06,type='square',gain=0.03)=>{
    if(!ctx||!enabled) return;
    const t0=ctx.currentTime;
    const o=ctx.createOscillator();
    const g=ctx.createGain();
    o.type=type; o.frequency.value=freq;
    g.gain.value=gain; o.connect(g); g.connect(ctx.destination);
    o.start(t0); o.stop(t0+dur);
  };
  return {play:beep,set on(v){enabled=v},get on(){return enabled},resume:()=>ctx&&ctx.resume()};
})();

// ===== Game State =====
const canvas = $('#board'), ctx = canvas.getContext('2d');
const ui = {score:$('#score'),hi:$('#hi'),mode:$('#mode'),speed:$('#speed'),state:$('#state'),speedVal:$('#speedVal'),gridVal:$('#gridVal'),obsVal:$('#obsVal')};
let grid=24,speed=10,showGrid=true,mode='classic',obstacleDensity=8,soundOn=true,vibeOn=true;
const state={running:false,over:false,t:0,step:0,acc:0,cell:()=>Math.floor(canvas.width/grid),snake:[],dir:{x:1,y:0},pending:null,food:null,bonus:null,obstacles:new Set(),score:0,best:0};

// ===== Responsive Canvas =====
const resize=()=>{const size=Math.floor(document.querySelector('.board-wrap').clientWidth-32); const dpr=Math.min(2,window.devicePixelRatio||1); const px=Math.max(280,size); canvas.width=px*dpr; canvas.height=px*dpr; canvas.style.width=px+'px'; canvas.style.height=px+'px'; ctx.setTransform(dpr,0,0,dpr,0,0);}
window.addEventListener('resize',resize,{passive:true}); resize();

// ===== Storage =====
const keyFor=()=>`snakex::best::${mode}::g${grid}`;
const loadBest=()=>state.best=+localStorage.getItem(keyFor())||0;
const saveBest=()=>localStorage.setItem(keyFor(),String(state.best));

// ===== Snake/food/init =====
function randomCell(){return {x:Math.floor(Math.random()*grid),y:Math.floor(Math.random()*grid)}}
function initSnake(){const mid=Math.floor(grid/2); state.snake=[{x:mid-1,y:mid},{x:mid,y:mid},{x:mid+1,y:mid}]; state.dir={x:1,y:0}; state.pending=null;}
function genFood(){let p; do{p=randomCell()}while(occupied(p)||isObstacle(p)); state.food=p;}
function genBonus(){if(Math.random()<0.2){let p; do{p=randomCell()}while(occupied(p)||isObstacle(p)||same(p,state.food)); state.bonus={...p,t:Date.now(),life:8000};}}
function genObstacles(){state.obstacles.clear(); if(mode!=='obstacles'||obstacleDensity<=0) return; const cells=grid*grid; const count=Math.floor(cells*(obstacleDensity/100)); let i=0; while(i<count){const p=randomCell(); const k=key(p); if(!state.obstacles.has(k)&&!occupied(p)){state.obstacles.add(k); i++;}}}
function occupied(p){return state.snake.some(s=>s.x===p.x&&s.y===p.y);}
function same(a,b){return a&&b&&a.x===b.x&&a.y===b.y;}
function key(p){return `${p.x},${p.y}`;}
function isObstacle(p){return state.obstacles.has(key(p));}

// ===== Reset =====
function reset(){state.score=0;state.over=false;state.running=false;state.acc=0;state.step=0;state.bonus=null;initSnake(); genFood(); genObstacles(); loadBest(); updateBadges(); render();}

// ===== Game Loop =====
let last = performance.now();
function loop(now){const dt=(now-last)/1000; last=now; if(state.running&&!state.over){state.acc+=dt; const stepTime=1/speed; while(state.acc>=stepTime){tick(); state.acc-=stepTime;}} render(); requestAnimationFrame(loop);}
requestAnimationFrame(loop);

function tick(){
  const head={...state.snake[state.snake.length-1]};
  const next=state.pending||state.dir; state.dir=next; state.pending=null;
  head.x+=state.dir.x; head.y+=state.dir.y;

  if(mode==='wrap'){head.x=(head.x+grid)%grid; head.y=(head.y+grid)%grid;} else if(head.x<0||head.y<0||head.x>=grid||head.y>=grid){return gameOver();}

  if(occupied(head)||isObstacle(head)) return gameOver();
  state.snake.push(head);

  if(same(head,state.food)){state.score+=1; genFood(); genBonus(); AudioKit.play(660,.06,'square',.04); vibrate(8);}
  else if(state.bonus&&same(head,state.bonus)){state.score+=5; state.bonus=null; AudioKit.play(880,.10,'sawtooth',.05); vibrate(12);}
  else state.snake.shift();

  if(state.bonus&&Date.now()-state.bonus.t>state.bonus.life) state.bonus=null;
  if(state.score&&state.score%10===0){speed=clamp(speed+0.2,5,25);}
  if(state.score>state.best){state.best=state.score; saveBest();}
  updateBadges();
}

function gameOver(){state.over=true; state.running=false; AudioKit.play(140,.18,'triangle',.05); vibrate(20); $('#btn-pause').textContent='Play ▷'; $('#btn-pause-mobile').textContent='⏯'; updateBadges();}

// ===== Render =====
function drawCell(p,color){const c=state.cell(); ctx.fillStyle=color; ctx.fillRect(p.x*c,p.y*c,p.c?p.c:c,p.c?p.c:c);}
function shade(hex,amt){const c=hex.replace('#',''); const n=parseInt(c,16); let r=(n>>16)+amt,g=((n>>8)&255)+amt,b=(n&255)+amt; r=clamp(r,0,255); g=clamp(g,0,255); b=clamp(b,0,255); return '#'+(1<<24|(r<<16)|(g<<8)|b).toString(16).slice(1);}
function getCSS(name){return getComputedStyle(document.getElementById('app')).getPropertyValue(name).trim();}

function render(){
  const c=state.cell(); ctx.clearRect(0,0,canvas.width,canvas.height);
  if(showGrid){ctx.strokeStyle=getCSS('--grid'); ctx.lineWidth=1; ctx.beginPath(); for(let i=1;i<grid;i++){ctx.moveTo(i*c,0);ctx.lineTo(i*c,canvas.height);} for(let i=1;i<grid;i++){ctx.moveTo(0,i*c);ctx.lineTo(canvas.width,i*c);} ctx.stroke();}
  ctx.fillStyle=getCSS('--bad'); state.obstacles.forEach(k=>{const [x,y]=k.split(',').map(Number); ctx.fillRect(x*c,y*c,c,c);});
  if(state.food){const pulse=0.8+0.2*Math.sin(Date.now()/200); drawCell({...state.food,c:c*pulse},getCSS('--good'));}
  if(state.bonus){const pulse=0.8+0.2*Math.sin(Date.now()/150); drawCell({...state.bonus,c:c*pulse},'#f59e0b');}
  const snakeColor=getCSS('--accent'); state.snake.forEach((s,i)=>{const tone=i===state.snake.length-1?snakeColor:shade(snakeColor,-12+i); drawCell(s,tone);});
  if(!state.running){ctx.fillStyle='rgba(0,0,0,.35)'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.fillStyle='#fff'; ctx.font=`${Math.floor(canvas.width/25)}px system-ui`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(state.over?'Game Over — Press Restart or Play':'Press Play to Start',canvas.width/2,canvas.height/2);}
}

// ===== Input =====
const dirs={ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1},ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0}, w:{x:0,y:-1}, s:{x:0,y:1}, a:{x:-1,y:0}, d:{x:1,y:0}};
function turn(vec){const cur=state.dir; if(cur.x+vec.x===0&&cur.y+vec.y===0) return; state.pending=vec;}
window.addEventListener('keydown',e=>{if(dirs[e.key]){e.preventDefault();turn(dirs[e.key]);} else if(e.key===' '){togglePause();} else if(e.key==='r'||e.key==='R'){reset();} else if(e.key==='g'||e.key==='G'){showGrid=!showGrid} else if(e.key==='o'||e.key==='O'){setMode('obstacles')} else if(e.key==='w'||e.key==='W'){setMode(mode==='wrap'?'classic':'wrap');}});

document.querySelectorAll('[data-dir]').forEach(btn=>btn.addEventListener('click',()=>{turn({up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}}[btn.getAttribute('data-dir')]);}));
let touchStart=null;
canvas.addEventListener('touchstart',e=>{touchStart=[...e.touches][0];},{passive:true});
canvas.addEventListener('touchmove',e=>{if(!touchStart) return; const t=[...e.touches][0]; const dx=t.clientX-touchStart.clientX; const dy=t.clientY-touchStart.clientY; if(Math.hypot(dx,dy)>24){if(Math.abs(dx)>Math.abs(dy)) turn(dx>0?{x:1,y:0}:{x:-1,y:0}); else turn(dy>0?{x:0,y:1}:{x:0,y:-1}); touchStart=null;}},{passive:true});

// ===== UI Wiring =====
function updateBadges(){ui.score.innerHTML=`<small>Score</small> ${state.score}`; ui.hi.innerHTML=`<small>Best</small> ${state.best}`; ui.mode.innerHTML=`<small>Mode</small> ${mode.charAt(0).toUpperCase()+mode.slice(1)}`; ui.speed.innerHTML=`<small>Speed</small> ${speed.toFixed(0)}`; ui.state.innerHTML=`<small>Status</small> ${state.over?'Game Over':state.running?'Playing':'Ready'}`;}
function togglePause(){state.running=!state.running&&!state.over; $('#btn-pause').textContent=state.running?'Pause ❚❚':'Play ▷'; $('#btn-pause-mobile').textContent='⏯'; if(state.running){AudioKit.resume();AudioKit.play(520,.05,'square',.03);} updateBadges();}
function setMode(m){mode=m; $('#sel-mode').value=mode; reset();}

$('#rng-speed').addEventListener('input', e=>{speed=+e.target.value; ui.speedVal.textContent=speed; updateBadges();});
$('#rng-grid').addEventListener('input', e=>{grid=+e.target.value; ui.gridVal.textContent=grid; reset();});
$('#rng-obs').addEventListener('input', e=>{obstacleDensity=+e.target.value; ui.obsVal.textContent=obstacleDensity+'%'; if(mode==='obstacles') genObstacles();});
$('#sel-mode').addEventListener('change', e=> setMode(e.target.value));
$('#btn-grid').addEventListener('click', ()=>{ showGrid=!showGrid });
$('#btn-sound').addEventListener('click', ()=>{ soundOn=!soundOn; AudioKit.on=soundOn; $('#btn-sound').textContent='Sound: '+(soundOn?'On':'Off');});
$('#btn-vibe').addEventListener('click', ()=>{ vibeOn=!vibeOn; $('#btn-vibe').textContent='Vibrate: '+(vibeOn?'On':'Off');});
$('#btn-clear').addEventListener('click', ()=>{ localStorage.clear(); loadBest(); updateBadges(); });

$('#btn-theme').addEventListener('click', ()=>{ const root=$('#app'); const themes=['neon','retro','contrast','']; const cur=root.getAttribute('data-theme')||''; const idx=(themes.indexOf(cur)+1)%themes.length; root.setAttribute('data-theme',themes[idx]);});
$('#btn-pause').addEventListener('click', togglePause);
$('#btn-restart').addEventListener('click', reset);
$('#btn-pause-mobile').addEventListener('click', togglePause);

function vibrate(ms){if(vibeOn && navigator.vibrate) navigator.vibrate(ms);}

// ===== Start =====
reset();




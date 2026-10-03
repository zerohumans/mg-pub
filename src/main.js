import '@fontsource/barlow/latin-400.css';
import '@fontsource/barlow/latin-600.css';
import '@fontsource/barlow/latin-700.css';
import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/barlow-condensed/latin-800.css';
import '@fontsource/barlow-condensed/latin-800-italic.css';
import './style.css';
import { createTrack, TRACKS } from './track.js';
import { createRace, stepRace, resetCar, getPosition, formatTime } from './simulation.js';
import { World } from './world.js';
import { EngineAudio } from './audio.js';

const app=document.querySelector('#app'), canvas=document.querySelector('#world');
const icon=(name)=>({
  arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',
  sound:'<path d="m11 5-6 4H2v6h3l6 4V5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  muted:'<path d="m11 5-6 4H2v6h3l6 4V5Zm5 4 6 6m0-6-6 6"/>',
  settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>',
  flag:'<path d="M5 21V3m0 1c5-4 9 4 15 0v10c-6 4-10-4-15 0"/>',
  pause:'<path d="M8 5v14M16 5v14"/>',
  camera:'<path d="M4 7h4l2-3h4l2 3h4v13H4Z"/><circle cx="12" cy="13" r="4"/>',
  reset:'<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
}[name]||'');
const svg=(name)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon(name)}</svg>`;
const logo=`<span class="brand-symbol" aria-hidden="true">Λ</span><span>APEX<span class="brand-light">DRIVE</span><small>THE OPEN ROAD IS CALLING</small></span>`;
const paints=[{name:'Signal orange',hex:0xff623a},{name:'Glacier blue',hex:0x73d9d7},{name:'Porcelain white',hex:0xe4e5d7},{name:'Acid green',hex:0xc6e576}];
const storage={get(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}},set(key,v){try{localStorage.setItem(key,JSON.stringify(v));}catch{}}};
const saved=storage.get('apex-settings-v1',{});
const settings={track:TRACKS.some(t=>t.id===saved.track)?saved.track:'sunset',mode:['race','trial','free'].includes(saved.mode)?saved.mode:'race',difficulty:['casual','sport','pro'].includes(saved.difficulty)?saved.difficulty:'sport',paint:paints.some(p=>p.hex===saved.paint)?saved.paint:paints[0].hex,sound:saved.sound??true,quality:saved.quality==='low'?'low':'high'};
const persist=()=>storage.set('apex-settings-v1',settings);
let world,track=createTrack(settings.track),race=createRace(track,settings),screen='menu',keys={},touch={},lastTime=0,accumulator=0,hudTime=0,lastCountdown=4,lastLap=0,toastTimer;
const audio=new EngineAudio(); audio.enabled=settings.sound;

function mapPath(t) {
  const xs=t.samples.map(p=>p.x),zs=t.samples.map(p=>p.z),minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
  const scale=Math.min(110/(maxX-minX),80/(maxZ-minZ));
  return t.samples.filter((_,i)=>i%5===0).map((p,i)=>`${i?'L':'M'}${((p.x-(minX+maxX)/2)*scale+65).toFixed(1)},${((p.z-(minZ+maxZ)/2)*scale+47).toFixed(1)}`).join(' ')+' Z';
}
const trackMaps=Object.fromEntries(TRACKS.map(t=>[t.id,mapPath(createTrack(t.id))]));

function menu() {
  screen='menu'; document.body.classList.remove('playing'); keys={};touch={};race=createRace(track,settings);world.setupRace(race);
  const record=storage.get(`apex-record-${track.id}-${settings.mode}`,null);
  app.innerHTML=`<div class="menu-shade"></div>
    <header class="topbar"><a href="#" class="brand" aria-label="APEX DRIVE home">${logo}</a><div class="header-center"><i></i> BUILT FOR THE DRIVE</div><div class="header-actions"><button class="icon-button" data-action="sound" aria-label="${settings.sound?'Mute':'Enable'} sound">${svg(settings.sound?'sound':'muted')}</button><button class="icon-button" data-action="settings" aria-label="Open settings">${svg('settings')}</button><button class="help-button" data-action="help">HOW TO PLAY <span>↗</span></button></div></header>
    <main class="menu-content"><div class="hero-copy"><div class="eyebrow"><span class="orange-line"></span> PURE ARCADE RACING <span class="edition">VOL. 01</span></div><h1>CHASE THE<br><em>HORIZON.</em></h1><p>Less scrolling. More driving.<br>Find your line and leave the world behind.</p><div class="mode-tabs" role="group" aria-label="Game mode">${[['race','QUICK RACE'],['trial','TIME TRIAL'],['free','FREE DRIVE']].map(([id,title])=>`<button data-mode="${id}" class="${settings.mode===id?'active':''}" aria-pressed="${settings.mode===id}">${title}</button>`).join('')}</div><div class="start-row"><button id="start-race" class="primary-button" data-action="start">${settings.mode==='free'?'LET’S DRIVE':'START YOUR ENGINE'} ${svg('arrow')}</button><div class="race-meta">${settings.mode==='race'?'3 LAPS · 6 DRIVERS':settings.mode==='trial'?'3 LAPS · JUST YOU':'NO CLOCK · NO LIMITS'}<small>${record?`PERSONAL BEST ${formatTime(record.time)}`:'YOUR NEXT GREAT DRIVE STARTS HERE'}</small></div></div></div>
    <div class="vehicle-label"><span class="eyebrow">YOUR RIDE / 01</span><h2>PHANTOM <i>GT</i></h2><div class="vehicle-stats"><span><b>230</b> KM/H</span><span><b>3.4</b> SECONDS 0–100</span><span><b>RWD</b> DRIVETRAIN</span></div><div class="paint-options" role="group" aria-label="Car color">${paints.map(p=>`<button class="swatch ${settings.paint===p.hex?'selected':''}" style="--paint:#${p.hex.toString(16).padStart(6,'0')}" data-paint="${p.hex}" aria-label="${p.name}" aria-pressed="${settings.paint===p.hex}"></button>`).join('')}<span>MAKE IT YOURS.</span></div></div>
    <section class="track-selector" aria-label="Choose your circuit"><div class="section-label"><span>01 — CHOOSE YOUR ESCAPE</span><span>3 CIRCUITS. INFINITE POSSIBILITIES.</span></div><div class="track-grid">${TRACKS.map((t,i)=>`<button class="track-card ${settings.track===t.id?'selected':''}" data-track="${t.id}" aria-pressed="${settings.track===t.id}"><span class="track-number">0${i+1}</span><div class="track-card-copy"><small>${t.region}</small><h3>${t.name}</h3><span class="track-tag">${t.difficulty} <span>↗</span></span></div><svg class="track-outline" viewBox="0 0 130 95" aria-hidden="true"><path d="${trackMaps[t.id]}"/></svg><span class="selected-dot"></span></button>`).join('')}</div></section></main>
    <footer class="menu-footer"><span><span class="status-dot"></span> NO DOWNLOADS. JUST DRIVE.</span><span>W A S D <span class="dim">TO DRIVE</span> <span class="footer-divider">/</span> SHIFT <span class="dim">FOR NITRO</span></span><span>© 2026 APEX DRIVE</span></footer><div id="toast" role="status"></div>`;
}

function showDialog(type) {
  if(document.querySelector('dialog'))return;
  const dialog=document.createElement('dialog');dialog.className='modal';
  let content='';
  if(type==='help') content=`<span class="eyebrow">A LITTLE KNOW-HOW</span><h2>Find your line.</h2><p>Finish three laps. Beat five rivals in Quick Race, chase your personal best in Time Trial, or explore in Free Drive. Brake before corners, then accelerate out.</p><div class="key-grid">${[['W / ↑','Accelerate'],['S / ↓','Brake / reverse'],['A D / ← →','Steer'],['SHIFT','Nitro boost'],['SPACE','Handbrake'],['C','Change camera'],['R','Reset to track'],['P / ESC','Pause'],['M','Sound on / off']].map(([k,v])=>`<kbd>${k}</kbd><span>${v}</span>`).join('')}</div><p class="subtle">On mobile, use the on-screen steering and pedals. Nitro refills automatically. Stay on the circuit and cross checkpoints in order for a valid lap.</p>`;
  else content=`<span class="eyebrow">SET IT YOUR WAY</span><h2>Driver settings.</h2><label class="setting-row">Race difficulty<select id="difficulty"><option value="casual">Casual — a relaxed drive</option><option value="sport">Sport — a fair challenge</option><option value="pro">Pro — chase the limit</option></select></label><label class="setting-row">Graphics quality<select id="quality"><option value="high">High — shadows + smooth edges</option><option value="low">Performance — lighter rendering</option></select></label><label class="setting-row">Engine sound<input id="sound-setting" type="checkbox" ${settings.sound?'checked':''}></label><p class="subtle">Difficulty applies to your next race. Settings and personal records are saved on this device.</p>`;
  dialog.innerHTML=`<button class="icon-button close-modal" aria-label="Close dialog">${svg('close')}</button>${content}<button class="primary-button modal-done">GOT IT ${svg('arrow')}</button>`;document.body.append(dialog);dialog.showModal();
  dialog.querySelectorAll('.close-modal,.modal-done').forEach(b=>b.onclick=()=>dialog.close());dialog.addEventListener('close',()=>dialog.remove());
  if(type==='settings') {dialog.querySelector('#difficulty').value=settings.difficulty;dialog.querySelector('#quality').value=settings.quality;dialog.addEventListener('change',e=>{if(e.target.id==='difficulty')settings.difficulty=e.target.value;if(e.target.id==='quality'){settings.quality=e.target.value;world.setQuality(settings.quality);}if(e.target.id==='sound-setting'){settings.sound=e.target.checked;audio.setEnabled(settings.sound);}persist();});}
}

function startRace() {
  race=createRace(track,settings);world.setupRace(race);screen='game';keys={};touch={};accumulator=0;lastCountdown=4;lastLap=0;
  document.body.classList.add('playing');audio.start();
  app.innerHTML=`<div class="race-hud"><div class="race-top"><div class="race-brand">${logo}</div><div class="race-timing"><div><span>LAP</span><b id="lap-value">1 <small>/ 3</small></b></div><div><span>RACE TIME</span><b id="time-value">00:00.00</b></div><div class="best-timing"><span>BEST LAP</span><b id="best-value">—</b></div></div><div class="race-buttons"><button class="icon-button" data-action="camera" aria-label="Change camera">${svg('camera')}</button><button class="icon-button" data-action="pause" aria-label="Pause race">${svg('pause')}</button></div></div>
    <div class="position-block"><span>${race.mode==='race'?'POSITION':race.mode==='trial'?'TIME TRIAL':'FREE DRIVE'}</span><b id="position-value">${race.mode==='race'?'6<small>/ 6</small>':'SOLO'}</b><div id="opponent-list"></div></div>
    <div class="race-bottom"><div class="map-panel"><canvas id="minimap" width="220" height="200" aria-label="Circuit minimap"></canvas><span>${track.name.toUpperCase()}</span></div><div class="race-tip" id="race-tip">BRAKE BEFORE THE CORNER. POWER THROUGH THE EXIT.</div><div class="speed-panel"><div class="gear-line"><span id="gear-value">N</span><small>GEAR</small></div><div class="speed-number" id="speed-value">000</div><span class="speed-unit">KM/H</span><div class="rev-track"><div id="rev-fill"></div></div><div class="nitro-label"><span>NITRO <kbd>SHIFT</kbd></span><span id="nitro-value">100%</span></div><div class="nitro-track"><div id="nitro-fill"></div></div></div></div>
    <div class="touch-controls" aria-label="Touch driving controls"><div><button data-control="left" aria-label="Steer left">◀</button><button data-control="right" aria-label="Steer right">▶</button></div><button data-control="nitro" class="touch-nitro" aria-label="Nitro boost">N₂O</button><div><button data-control="brake" class="touch-brake" aria-label="Brake">BRK</button><button data-control="throttle" class="touch-throttle" aria-label="Accelerate">GAS</button></div></div>
    <div id="countdown" class="countdown" aria-live="polite"><small>READY TO FIND YOUR LIMIT?</small><b>3</b></div><div id="collision-flash"></div><div id="race-overlay"></div><div id="toast" role="status"></div></div>`;
  updateHUD();
}

function pauseRace() {
  if(screen!=='game'||!['racing','countdown'].includes(race.phase))return;
  race.resumePhase=race.phase;race.phase='paused';keys={};touch={};audio.update(race.player,false);
  document.querySelector('#race-overlay').innerHTML=`<div class="overlay-backdrop"><section class="result-card" role="dialog" aria-modal="true" aria-label="Race paused"><span class="eyebrow">TAKE A BREATHER</span><h2>Race paused.</h2><p>The road will be right here.</p><button class="primary-button" data-action="resume">BACK TO THE DRIVE ${svg('arrow')}</button><button class="secondary-button" data-action="restart">RESTART RACE</button><button class="text-button" data-action="quit">BACK TO GARAGE</button></section></div>`;
  document.querySelector('[data-action="resume"]').focus();
}
function resumeRace() {if(race.phase!=='paused')return;race.phase=race.resumePhase||'racing';document.querySelector('#race-overlay').innerHTML='';audio.start();keys={};touch={};lastTime=performance.now();accumulator=0;}
function showResults() {
  const key=`apex-record-${track.id}-${race.mode}`,old=storage.get(key,null),best=!old||race.elapsed<old.time;
  if(best) storage.set(key,{time:race.elapsed,date:new Date().toISOString(),lap:Math.min(...race.lapTimes)});
  const place=race.finishPosition||1, ordinal=['','1ST','2ND','3RD','4TH','5TH','6TH'][place];
  document.querySelector('#race-overlay').innerHTML=`<div class="overlay-backdrop"><section class="result-card" role="dialog" aria-modal="true" aria-label="Race results"><span class="eyebrow">${best?'NEW PERSONAL BEST':'THE FINISH LINE'}</span><h2>${race.mode==='race'?(place===1?'What a drive.':'That’s a finish.'):'Against the clock.'}</h2><p>${track.name} / ${race.mode==='race'?'QUICK RACE':'TIME TRIAL'}</p><div class="result-score">${race.mode==='race'?ordinal:formatTime(race.elapsed)}<small>${race.mode==='race'?'FINISHING POSITION':'TOTAL TIME'}</small></div><div class="result-stats"><div><span>RACE TIME</span><b>${formatTime(race.elapsed)}</b></div><div><span>BEST LAP</span><b>${formatTime(Math.min(...race.lapTimes))}</b></div></div><div class="lap-results">${race.lapTimes.map((t,i)=>`<span>LAP ${i+1}<b>${formatTime(t)}</b></span>`).join('')}</div><button class="primary-button" data-action="restart">ONE MORE DRIVE ${svg('arrow')}</button><button class="text-button" data-action="quit">BACK TO GARAGE</button></section></div>`;
  document.querySelector('[data-action="restart"]').focus();audio.beep(920,.4);
}
function toast(message) {const el=document.querySelector('#toast');if(!el)return;el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2500);}

function drawMap() {
  const canvas=document.querySelector('#minimap');if(!canvas)return;const ctx=canvas.getContext('2d'),points=track.samples;
  const xs=points.map(p=>p.x),zs=points.map(p=>p.z),cx=(Math.max(...xs)+Math.min(...xs))/2,cz=(Math.max(...zs)+Math.min(...zs))/2;
  const scale=Math.min(180/(Math.max(...xs)-Math.min(...xs)),160/(Math.max(...zs)-Math.min(...zs)));
  const xy=p=>[(p.x-cx)*scale+110,(p.z-cz)*scale+100];ctx.clearRect(0,0,220,200);ctx.lineJoin='round';ctx.beginPath();points.forEach((p,i)=>{const[x,y]=xy(p);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.closePath();ctx.strokeStyle='#edf0df35';ctx.lineWidth=7;ctx.stroke();ctx.strokeStyle='#b7c1b74a';ctx.lineWidth=1;ctx.stroke();
  const gate=track.at(race.nextCheckpoint/track.checkpointCount*track.length),[gx,gy]=xy(gate);ctx.fillStyle='#f3efda';ctx.fillRect(gx-2,gy-2,4,4);
  race.rivals.forEach(r=>{const[x,y]=xy(track.at(r.s));ctx.beginPath();ctx.arc(x,y,2.7,0,Math.PI*2);ctx.fillStyle=`#${r.color.toString(16)}`;ctx.fill();});
  const[x,y]=xy(race.player);ctx.beginPath();ctx.arc(x,y,5.5,0,Math.PI*2);ctx.fillStyle='#ff6a41';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=1.6;ctx.stroke();
}
function updateHUD() {
  if(screen!=='game')return;
  const p=race.player,speed=Math.round(Math.abs(p.speed)*3.6);
  document.querySelector('#speed-value').textContent=String(speed).padStart(3,'0');
  document.querySelector('#gear-value').textContent=p.speed<-1?'R':speed<2?'N':String(Math.min(6,Math.floor(speed/42)+1));
  document.querySelector('#time-value').textContent=formatTime(race.elapsed);
  document.querySelector('#lap-value').innerHTML=`${Math.min(race.completedLaps+1,race.mode==='free'?Infinity:race.laps)} <small>/ ${race.mode==='free'?'∞':race.laps}</small>`;
  document.querySelector('#best-value').textContent=race.lapTimes.length?formatTime(Math.min(...race.lapTimes)):'—';
  document.querySelector('#nitro-value').textContent=`${Math.round(p.nitro)}%`;document.querySelector('#nitro-fill').style.width=`${p.nitro}%`;
  document.querySelector('#rev-fill').style.width=`${Math.min(speed/240*100,100)}%`;
  document.querySelector('.speed-panel').classList.toggle('boosting',p.boosting);
  document.querySelector('#collision-flash').style.opacity=p.collision*.45;
  document.querySelector('#race-tip').textContent=p.offroad?'OFF TRACK — EASE BACK ONTO THE ASPHALT':p.boosting?'NITRO ENGAGED. MAKE IT COUNT.':race.elapsed<12?'W / ↑ TO ACCELERATE · A D / ← → TO STEER':'SHIFT · NITRO     C · CAMERA     R · RESET     P · PAUSE';
  if(race.mode==='race') {
    document.querySelector('#position-value').innerHTML=`${getPosition(race)}<small>/ 6</small>`;
    const standings=[{name:'YOU',s:race.completedLaps*track.length+p.s,you:true},...race.rivals].sort((a,b)=>b.s-a.s);
    document.querySelector('#opponent-list').innerHTML=standings.map((r,i)=>`<div class="${r.you?'you':''}"><span>0${i+1}</span><b>${r.name}</b><small>${r.you?'◀':(Math.abs(r.s-(race.completedLaps*track.length+p.s))/Math.max(p.speed,20)).toFixed(1)+'s'}</small></div>`).join('');
  }
  const countdown=document.querySelector('#countdown');
  if(race.phase==='countdown') {const n=Math.max(1,Math.ceil(race.countdown));countdown.hidden=false;countdown.querySelector('b').textContent=n;if(n!==lastCountdown){audio.beep(460,.1);lastCountdown=n;}}
  else if(race.elapsed<1&&race.phase==='racing'){countdown.hidden=false;countdown.querySelector('small').textContent='THE ROAD IS YOURS';countdown.querySelector('b').textContent='GO';if(lastCountdown!==0){audio.beep(920,.24);lastCountdown=0;}}
  else countdown.hidden=true;
  drawMap();
}

app.addEventListener('click',event=>{
  const b=event.target.closest('button');if(!b)return;
  if(b.dataset.track) {settings.track=b.dataset.track;persist();track=createTrack(settings.track);world.build(track);menu();return;}
  if(b.dataset.mode) {settings.mode=b.dataset.mode;persist();menu();return;}
  if(b.dataset.paint) {settings.paint=Number(b.dataset.paint);world.setPaint(settings.paint);persist();document.querySelectorAll('.swatch').forEach(el=>{const selected=Number(el.dataset.paint)===settings.paint;el.classList.toggle('selected',selected);el.setAttribute('aria-pressed',selected);});return;}
  switch(b.dataset.action){
    case 'start':case 'restart':startRace();break;
    case 'pause':pauseRace();break;case 'resume':resumeRace();break;
    case 'quit':menu();break;case 'help':showDialog('help');break;case 'settings':showDialog('settings');break;
    case 'sound':settings.sound=!settings.sound;audio.setEnabled(settings.sound);persist();menu();break;
    case 'camera':race.camera=(race.camera+1)%3;world.cameraInitialized=false;toast(['CHASE CAMERA','WIDE CAMERA','HOOD CAMERA'][race.camera]);break;
  }
});
app.addEventListener('pointerdown',e=>{const b=e.target.closest('[data-control]');if(!b)return;e.preventDefault();b.setPointerCapture(e.pointerId);touch[b.dataset.control]=true;b.classList.add('pressed');});
for(const name of ['pointerup','pointercancel','lostpointercapture']) app.addEventListener(name,e=>{const b=e.target.closest('[data-control]');if(b){touch[b.dataset.control]=false;b.classList.remove('pressed');}});
window.addEventListener('keydown',e=>{
  if(document.querySelector('dialog'))return;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)&&screen==='game')e.preventDefault();
  keys[e.code]=true;if(e.repeat)return;
  if(e.code==='KeyM'){settings.sound=!settings.sound;audio.setEnabled(settings.sound);persist();if(screen==='menu')menu();else toast(settings.sound?'SOUND ON':'SOUND OFF');}
  if(screen==='game'){
    if(e.code==='Escape'||e.code==='KeyP')race.phase==='paused'?resumeRace():pauseRace();
    if(e.code==='KeyR'&&race.phase==='racing'){resetCar(race);toast('BACK ON TRACK');}
    if(e.code==='KeyC'){race.camera=(race.camera+1)%3;world.cameraInitialized=false;toast(['CHASE CAMERA','WIDE CAMERA','HOOD CAMERA'][race.camera]);}
  }
});
window.addEventListener('keyup',e=>{keys[e.code]=false;});
window.addEventListener('blur',()=>{keys={};touch={};if(screen==='game')pauseRace();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&screen==='game')pauseRace();});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();if(screen==='game')pauseRace();toast('GRAPHICS INTERRUPTED — RELOAD TO CONTINUE');});

function frame(now) {
  const dt=lastTime?Math.min((now-lastTime)/1000,.1):1/60;lastTime=now;
  if(screen==='game') {
    const input={throttle:keys.KeyW||keys.ArrowUp||touch.throttle?1:0,brake:keys.KeyS||keys.ArrowDown||touch.brake?1:0,steer:(keys.KeyD||keys.ArrowRight||touch.right?1:0)-(keys.KeyA||keys.ArrowLeft||touch.left?1:0),nitro:keys.ShiftLeft||keys.ShiftRight||touch.nitro,handbrake:keys.Space};
    accumulator+=dt;const wasFinished=race.finished;
    while(accumulator>=1/120){stepRace(race,input,1/120);accumulator-=1/120;}
    if(race.completedLaps>lastLap&&!race.finished){lastLap=race.completedLaps;toast(`LAP ${lastLap} · ${formatTime(race.lapTimes.at(-1))}`);audio.beep(760,.2);}
    if(!wasFinished&&race.finished)showResults();
    hudTime+=dt;if(hudTime>.07){updateHUD();hudTime=0;}
  }
  world.render(race,screen==='menu',dt,now/1000);audio.update(race.player,screen==='game'&&race.phase==='racing');requestAnimationFrame(frame);
}

try {
  world=new World(canvas);world.setQuality(settings.quality);world.setPaint(settings.paint);world.build(track);menu();requestAnimationFrame(frame);
  // Test-only observability and deterministic controls are removed from the production build.
  if(import.meta.env.DEV) window.__APEX_TEST__={getRace:()=>race,getScreen:()=>screen,finish:()=>{race.phase='finished';race.finished=true;race.completedLaps=3;race.elapsed=123.45;race.lapTimes=[42,40,41.45];race.finishPosition=2;showResults();},crossNextGate:()=>{const p=track.at(race.nextCheckpoint/track.checkpointCount*track.length-1);Object.assign(race.player,{x:p.x,z:p.z,heading:p.heading,speed:35});},step:(input,dt)=>stepRace(race,input,dt)};
} catch(error) {
  app.innerHTML=`<div class="fallback"><div class="brand">${logo}</div><h1>Let’s get you<br>on the road.</h1><p>Your browser couldn’t start the 3D renderer. Enable hardware acceleration and WebGL 2, then reload. Current Chrome, Edge, Firefox, and Safari are supported.</p><button class="primary-button" onclick="location.reload()">TRY AGAIN ↗</button></div>`;
  console.error('APEX DRIVE failed to initialize:',error);
}

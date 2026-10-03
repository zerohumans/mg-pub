import { angleDifference, clamp, wrap } from './track.js';

export const DIFFICULTIES = { casual: .72, sport: .86, pro: 1 };
export const RIVALS = [
  {name:'NOVA', color:0x72ddcd}, {name:'KAI', color:0xdccf84}, {name:'RIVER', color:0xb6a0cf},
  {name:'JUNO', color:0xe5e8db}, {name:'AXEL', color:0xf38e5a},
];

export function createRace(track, options={}) {
  const p=track.at(0), mode=options.mode || 'race';
  return {
    track, mode, difficulty:options.difficulty || 'sport', phase:'countdown', countdown:3.4,
    elapsed:0, laps:3, completedLaps:0, nextCheckpoint:1, lapStarted:0, lapTimes:[],
    player:{x:p.x,z:p.z,heading:p.heading,speed:0,steer:0,nitro:100,boosting:false,offroad:false,s:0,collision:0},
    rivals: mode==='race' ? RIVALS.map((r,i)=>({...r,s:12+i*11,speed:0,offset:(i%2?1:-1)*4,finished:false,finishTime:null})) : [],
    finished:false, finishPosition:null, resetCount:0, camera:0, collisions:0,
  };
}

export function resetCar(race) {
  // Respawn behind the next valid checkpoint. Reset can never skip a gate or award a lap.
  const s=(race.nextCheckpoint-1)/race.track.checkpointCount*race.track.length;
  const p=race.track.at(s+1);
  Object.assign(race.player,{x:p.x,z:p.z,heading:p.heading,speed:0,steer:0,s:p.s,boosting:false,offroad:false});
  race.resetCount++;
}

export function getPosition(race) {
  const progress=race.completedLaps*race.track.length+race.player.s;
  return 1+race.rivals.filter(r=>r.s>progress || r.finished).length;
}

export function advanceCheckpoints(race, previous, current, near) {
  if(near.distance>race.track.width/2+3) return;
  const n=race.track.checkpointCount, gate=race.track.at(race.nextCheckpoint/n*race.track.length);
  const a=(previous.x-gate.x)*gate.tx+(previous.z-gate.z)*gate.tz;
  const b=(current.x-gate.x)*gate.tx+(current.z-gate.z)*gate.tz;
  const side=(current.x-gate.x)*gate.tz-(current.z-gate.z)*gate.tx;
  if(a<=0 && b>0 && Math.abs(side)<race.track.width/2+3 && Math.hypot(current.x-previous.x,current.z-previous.z)<15) {
    race.nextCheckpoint++;
    if(race.nextCheckpoint>n) {
      race.completedLaps++;
      race.lapTimes.push(race.elapsed-race.lapStarted); race.lapStarted=race.elapsed; race.nextCheckpoint=1;
      if(race.mode!=='free' && race.completedLaps>=race.laps) {
        race.finished=true; race.phase='finished'; race.finishPosition=getPosition(race);
      }
    }
  }
}

export function stepRace(race, input, dt) {
  if(!Number.isFinite(dt) || dt<=0) return;
  dt=Math.min(dt,.05);
  if(race.phase==='countdown') { race.countdown-=dt; if(race.countdown<=0) race.phase='racing'; return; }
  if(race.phase!=='racing') return;
  race.elapsed+=dt;
  const p=race.player, track=race.track, previous={x:p.x,z:p.z};
  const throttle=clamp(input.throttle || 0,0,1), brake=clamp(input.brake || 0,0,1);
  const nearBefore=track.nearest(p.x,p.z);
  p.offroad=nearBefore.distance>track.width/2+1;
  p.boosting=Boolean(input.nitro && throttle && p.nitro>1 && p.speed>8 && !p.offroad);
  p.nitro=clamp(p.nitro+(p.boosting?-30:10)*dt,0,100);
  const max=p.boosting?82:64, drag=.0018*p.speed*Math.abs(p.speed)+.04*p.speed;
  let acceleration=throttle*(p.boosting?18:10)-drag;
  if(brake) acceleration-=p.speed>1?49:13;
  if(!throttle && !brake && Math.abs(p.speed)<.15) p.speed=0;
  else p.speed=clamp(p.speed+acceleration*dt,-10,max);
  if(p.offroad) p.speed*=Math.exp(-1.15*dt);
  if(input.handbrake) p.speed*=Math.exp(-2.5*dt);
  p.steer+=(clamp(input.steer || 0,-1,1)-p.steer)*Math.min(1,dt*9);
  const turn=(.32+1.3/(1+Math.abs(p.speed)/26))*(input.handbrake?1.55:1);
  p.heading-=p.steer*turn*clamp(p.speed/10,-1,1)*dt;
  p.x+=Math.sin(p.heading)*p.speed*dt; p.z+=Math.cos(p.heading)*p.speed*dt;
  const near=track.nearest(p.x,p.z); p.s=near.s;
  // Solid trackside safety rails keep the car in reach of the circuit.
  if(near.distance>track.width/2+8) {
    const side=Math.sign(near.offset), limit=track.width/2+7.5;
    p.x=near.x+near.tz*side*limit; p.z=near.z-near.tx*side*limit;
    p.speed*=.48; p.collision=.55; race.collisions++;
    const heading=Math.atan2(near.tx,near.tz); p.heading+=angleDifference(heading,p.heading)*.15;
  }
  p.collision=Math.max(0,p.collision-dt);
  for(let i=0;i<race.rivals.length;i++) {
    const rival=race.rivals[i], a=track.at(rival.s), b=track.at(rival.s+22);
    const curve=Math.abs(angleDifference(b.heading,a.heading));
    const target=clamp(53-curve*54,27,55)*DIFFICULTIES[race.difficulty]*(.96+i*.013);
    rival.speed+=(target-rival.speed)*dt*.7; rival.s+=rival.speed*dt;
    if(!rival.finished && rival.s>=race.laps*track.length) { rival.finished=true; rival.finishTime=race.elapsed; }
    const rp=track.at(rival.s,rival.offset+Math.sin(rival.s*.01+i)*.6);
    if(Math.hypot(rp.x-p.x,rp.z-p.z)<3.1 && p.collision<=0) {
      p.speed*=.68; p.collision=.7; race.collisions++;
      const dx=p.x-rp.x,dz=p.z-rp.z,len=Math.hypot(dx,dz)||1;
      p.x+=dx/len*1.2; p.z+=dz/len*1.2;
    }
  }
  advanceCheckpoints(race,previous,p,near);
}

export function formatTime(seconds) {
  if(!Number.isFinite(seconds)) return '—';
  const ms=Math.floor(seconds*1000), min=Math.floor(ms/60000), sec=Math.floor(ms/1000)%60, frac=Math.floor(ms%1000/10);
  return `${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}.${String(frac).padStart(2,'0')}`;
}

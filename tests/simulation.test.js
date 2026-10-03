import test from 'node:test';
import assert from 'node:assert/strict';
import {createTrack,TRACKS,angleDifference,clamp} from '../src/track.js';
import {createRace,stepRace,resetCar,advanceCheckpoints,formatTime} from '../src/simulation.js';

test('every circuit is closed, finite, and projectable',()=>{
  for(const config of TRACKS){const t=createTrack(config.id);assert.ok(t.length>1500);assert.deepEqual(t.at(0),t.at(t.length));for(let s=0;s<t.length;s+=17){const p=t.at(s);const n=t.nearest(p.x,p.z);assert.ok(n.distance<.01);assert.ok(Number.isFinite(p.heading));}}
});
test('countdown holds both player and opponents until the race starts',()=>{
  const r=createRace(createTrack());stepRace(r,{throttle:1},.05);assert.equal(r.player.speed,0);assert.equal(r.elapsed,0);assert.equal(r.rivals[0].speed,0);
  for(let i=0;i<80;i++)stepRace(r,{throttle:1},.05);assert.equal(r.phase,'racing');assert.ok(r.player.speed>0);
});
test('throttle accelerates, braking slows, reverse works, pause freezes physics',()=>{
  const r=createRace(createTrack());r.phase='racing';for(let i=0;i<100;i++)stepRace(r,{throttle:1},1/60);assert.ok(r.player.speed>12);const before=r.player.speed;for(let i=0;i<12;i++)stepRace(r,{brake:1},1/60);assert.ok(r.player.speed<before);
  for(let i=0;i<120;i++)stepRace(r,{brake:1},1/60);assert.ok(r.player.speed<0);r.phase='paused';const frozen=JSON.stringify(r);stepRace(r,{throttle:1,nitro:true},.05);assert.equal(JSON.stringify(r),frozen);
});
test('nitro consumes charge only while moving, then regenerates',()=>{
  const r=createRace(createTrack(),{mode:'trial'});r.phase='racing';stepRace(r,{nitro:true},.02);assert.equal(r.player.nitro,100);r.player.speed=25;for(let i=0;i<40;i++)stepRace(r,{throttle:1,nitro:true},1/120);assert.ok(r.player.nitro<95);assert.equal(r.player.boosting,true);const remaining=r.player.nitro;for(let i=0;i<20;i++)stepRace(r,{},1/120);assert.ok(r.player.nitro>remaining);
});
test('a skipped checkpoint, reverse crossing or far-off-road crossing cannot award a lap',()=>{
  const t=createTrack(),r=createRace(t);r.phase='racing';const g=t.at(t.length/2),before={x:g.x-g.tx,z:g.z-g.tz},after={x:g.x+g.tx,z:g.z+g.tz};advanceCheckpoints(r,before,after,t.nearest(after.x,after.z));assert.equal(r.nextCheckpoint,1);
  const a=t.at(t.length/24);advanceCheckpoints(r,{x:a.x+a.tx,z:a.z+a.tz},{x:a.x-a.tx,z:a.z-a.tz},{distance:0});assert.equal(r.nextCheckpoint,1);
  advanceCheckpoints(r,{x:a.x-a.tx,z:a.z-a.tz},{x:a.x+a.tx,z:a.z+a.tz},{distance:50});assert.equal(r.nextCheckpoint,1);assert.equal(r.completedLaps,0);
});
test('three valid sequential laps finish exactly once; reset cannot advance progress',()=>{
  const t=createTrack(),r=createRace(t,{mode:'trial'});r.phase='racing';
  for(let lap=0;lap<3;lap++)for(let i=1;i<=24;i++){const g=t.at(i/24*t.length);r.elapsed+=2;r.player.s=g.s;advanceCheckpoints(r,{x:g.x-g.tx,z:g.z-g.tz},{x:g.x+g.tx,z:g.z+g.tz},{distance:0});}
  assert.equal(r.phase,'finished');assert.equal(r.completedLaps,3);assert.equal(r.lapTimes.length,3);assert.equal(r.elapsed,144);
  const fresh=createRace(t);fresh.nextCheckpoint=9;resetCar(fresh);assert.equal(fresh.nextCheckpoint,9);assert.equal(fresh.completedLaps,0);assert.equal(fresh.player.speed,0);assert.ok(t.nearest(fresh.player.x,fresh.player.z).distance<.01);
});
test('an actual physics-driven car can complete a full race on every circuit',()=>{
  for(const config of TRACKS){const track=createTrack(config.id),r=createRace(track,{mode:'trial'});r.phase='racing';
    for(let frame=0;frame<60000&&!r.finished;frame++){
      const p=r.player,n=track.nearest(p.x,p.z),aim=track.at(n.s+10+Math.abs(p.speed)*.2),heading=Math.atan2(aim.x-p.x,aim.z-p.z);
      const corner=Math.abs(angleDifference(track.at(n.s+38).heading,track.at(n.s).heading)),desired=clamp(48-corner*40,22,48);
      stepRace(r,{throttle:p.speed<desired?1:0,brake:p.speed>desired+3?1:0,steer:clamp(-angleDifference(heading,p.heading)*2.3,-1,1)},1/60);
    }
    assert.equal(r.finished,true,`${config.id}: completed=${r.completedLaps}, gate=${r.nextCheckpoint}`);assert.equal(r.lapTimes.length,3);assert.equal(r.collisions,0,`${config.id} should be driveable without rail impacts`);
  }
});
test('invalid timesteps do not poison state, and time formatting is stable',()=>{const r=createRace(createTrack());stepRace(r,{},NaN);assert.equal(r.countdown,3.4);assert.equal(formatTime(123.45),'02:03.45');assert.equal(formatTime(Infinity),'—');});

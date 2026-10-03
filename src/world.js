import * as THREE from 'three';
import { clamp } from './track.js';

const UP = new THREE.Vector3(0,1,0);
const material = (color, options={}) => new THREE.MeshStandardMaterial({color,roughness:.78,...options});

function box(parent, dimensions, position, mat, rotation=0) {
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(...dimensions),mat);
  mesh.position.set(...position); mesh.rotation.y=rotation; mesh.castShadow=true; mesh.receiveShadow=true; parent.add(mesh); return mesh;
}

export function makeCar(color=0xff623a) {
  const car=new THREE.Group();
  const paint=material(color,{metalness:.45,roughness:.27});
  const dark=material(0x10181e,{metalness:.3,roughness:.35});
  const glass=material(0x364951,{metalness:.85,roughness:.13});
  const chrome=material(0xa8b6b7,{metalness:.9,roughness:.28});
  box(car,[1.95,.34,4.22],[0,.66,0],paint);
  box(car,[2.01,.24,3.7],[0,.45,-.04],dark);
  box(car,[1.81,.26,1.33],[0,.88,1.34],paint);
  box(car,[1.8,.29,1.12],[0,.86,-1.42],paint);
  const cabin=box(car,[1.6,.44,1.9],[0,1.12,-.12],glass);
  const vertices=cabin.geometry.attributes.position;
  for(let i=0;i<vertices.count;i++) if(vertices.getY(i)>0){vertices.setX(i,vertices.getX(i)*.84);vertices.setZ(i,vertices.getZ(i)>0?.32:-.62);}
  vertices.needsUpdate=true;cabin.geometry.computeVertexNormals();
  box(car,[1.39,.07,.98],[0,1.365,-.27],paint);
  box(car,[1.18,.012,.76],[0,1.405,-.27],dark);
  box(car,[1.85,.12,.14],[0,1.09,-1.85],dark);
  for(const x of [-.73,.73]) box(car,[.08,.26,.08],[x,.94,-1.85],dark);
  box(car,[1.76,.1,.14],[0,.34,2.11],dark);
  for(const x of [-1,1]) {
    box(car,[.3,.14,.35],[x,1,.42],paint);
    box(car,[.58,.1,.045],[x*.64,.77,2.13],material(0xfcffe8,{emissive:0xffeeca,emissiveIntensity:2}));
    box(car,[.64,.09,.06],[x*.62,.73,-2.14],material(0xed170d,{emissive:0xed170d,emissiveIntensity:.5}));
    box(car,[.08,.05,2.6],[x*.7,.849,.2],dark);
  }
  const wheels=[];
  for(const x of [-1.01,1.01]) for(const z of [-1.33,1.36]) {
    const wheel=new THREE.Group(); wheel.position.set(x,.46,z);
    const tire=new THREE.Mesh(new THREE.CylinderGeometry(.44,.44,.32,16),material(0x141719)); tire.rotation.z=Math.PI/2; tire.castShadow=true; wheel.add(tire);
    const rim=new THREE.Mesh(new THREE.CylinderGeometry(.29,.29,.338,10),chrome); rim.rotation.z=Math.PI/2; wheel.add(rim);
    const hub=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,.347,8),dark); hub.rotation.z=Math.PI/2; wheel.add(hub);
    wheels.push(wheel); car.add(wheel);
  }
  const boost=[];
  for(const x of [-.55,.55]) {
    box(car,[.25,.15,.22],[x,.45,-2.12],chrome);
    const flame=new THREE.Mesh(new THREE.ConeGeometry(.14,1.3,7),new THREE.MeshBasicMaterial({color:0x63eaff,transparent:true,opacity:.9}));
    flame.rotation.x=-Math.PI/2; flame.position.set(x,.45,-2.73); flame.visible=false; car.add(flame); boost.push(flame);
  }
  car.userData={paint,wheels,boost}; return car;
}

function ribbon(track, low, high, elevation, mat, alternating=false) {
  const positions=[], colors=[], indices=[], count=track.samples.length;
  const colorA=new THREE.Color(track.accent), colorB=new THREE.Color(0xeae8d7);
  for(let i=0;i<=count;i++) {
    const p=track.samples[i%count];
    for(const offset of [low,high]) {
      positions.push(p.x+p.tz*offset,elevation,p.z-p.tx*offset);
      const c=Math.floor(p.s/6)%2?colorA:colorB; colors.push(c.r,c.g,c.b);
    }
    if(i<count) {const a=i*2; indices.push(a,a+2,a+1,a+1,a+2,a+3);}
  }
  const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3)); geo.setIndex(indices);
  if(alternating) geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geo.computeVertexNormals(); const mesh=new THREE.Mesh(geo,mat); mesh.receiveShadow=true; return mesh;
}

function signTexture(title, subtitle='', night=false) {
  const canvas=document.createElement('canvas'); canvas.width=1024; canvas.height=256;
  const ctx=canvas.getContext('2d'); ctx.fillStyle=night?'#182635':'#182021'; ctx.fillRect(0,0,1024,256);
  ctx.fillStyle='#ff683f'; ctx.fillRect(0,0,16,256); ctx.fillRect(1008,0,16,256);
  ctx.fillStyle='#eeeadd'; ctx.textAlign='center'; ctx.font='italic 900 94px Arial'; ctx.fillText(title,512,subtitle?125:161);
  if(subtitle) {ctx.fillStyle='#a6b9b2'; ctx.font='24px Arial'; ctx.fillText(subtitle,512,197);}
  const tex=new THREE.CanvasTexture(canvas); tex.colorSpace=THREE.SRGBColorSpace; return tex;
}

function rng(seed=12) { return ()=>{ seed=(seed*1664525+1013904223)>>>0; return seed/4294967296; }; }

export class World {
  constructor(canvas) {
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
    this.renderer.shadowMap.enabled=true; this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace; this.renderer.toneMapping=THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure=1.22;
    this.scene=new THREE.Scene(); this.camera=new THREE.PerspectiveCamera(52,1,.15,1400);
    this.look=new THREE.Vector3(); this.targetPosition=new THREE.Vector3(); this.targetLook=new THREE.Vector3();
    this.paint=0xff623a; this.quality='high'; this.menuTime=0;
    this.resize(); window.addEventListener('resize',()=>this.resize());
  }
  resize() { this.renderer.setSize(innerWidth,innerHeight,false); this.camera.aspect=innerWidth/innerHeight; this.camera.updateProjectionMatrix(); }
  setQuality(value) { this.quality=value; this.renderer.setPixelRatio(Math.min(devicePixelRatio,value==='high'?1.75:1)); this.renderer.shadowMap.enabled=value==='high'; this.resize(); }
  setPaint(value) { this.paint=value; if(this.player) this.player.userData.paint.color.setHex(value); }
  clear() {
    if(this.scene) this.scene.traverse(o=>{ if(o.geometry) o.geometry.dispose(); if(o.material) {for(const m of Array.isArray(o.material)?o.material:[o.material]) {if(m.map)m.map.dispose();m.dispose();}} });
    this.scene=new THREE.Scene();
  }
  build(track) {
    this.clear(); this.track=track;
    const scene=this.scene, night=track.id==='night';
    scene.background=new THREE.Color(track.sky); scene.fog=new THREE.Fog(track.fog,180,780);
    scene.add(new THREE.HemisphereLight(night?0x93c6ed:0xe7f7ff,night?0x233141:0x7c6951,night?2:2.6));
    this.sun=new THREE.DirectionalLight(night?0x99c8ff:0xffe1ac,night?2.1:3.8);
    this.sun.position.set(-130,220,-70); this.sun.castShadow=true; this.sun.shadow.mapSize.set(2048,2048);
    Object.assign(this.sun.shadow.camera,{left:-55,right:55,top:55,bottom:-55,near:1,far:450}); this.sun.shadow.bias=-.0004; scene.add(this.sun,this.sun.target);
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(3000,3000),material(track.ground)); ground.rotation.x=-Math.PI/2; ground.position.y=-.12; ground.receiveShadow=true; scene.add(ground);
    scene.add(ribbon(track,-19,19,-.03,material(night?0x343446:0xb4a688)));
    scene.add(ribbon(track,-11,11,0,material(track.road,{roughness:.95})));
    const curbMat=material(0xffffff,{vertexColors:true});
    scene.add(ribbon(track,-12.1,-11,.025,curbMat,true),ribbon(track,11,12.1,.025,curbMat,true));
    const lineMat=material(0xd8d9c9,{emissive:night?0x65dddf:0x000000,emissiveIntensity:.55});
    scene.add(ribbon(track,-10.65,-10.48,.032,lineMat),ribbon(track,10.48,10.65,.032,lineMat));
    const dummy=new THREE.Object3D();
    const dashes=Math.floor(track.length/14), dashMesh=new THREE.InstancedMesh(new THREE.BoxGeometry(.15,.015,4),material(0xc6c8b7),dashes);
    for(let i=0;i<dashes;i++) {const p=track.at(i*14);dummy.position.set(p.x,.018,p.z);dummy.rotation.set(0,p.heading,0);dummy.updateMatrix();dashMesh.setMatrixAt(i,dummy.matrix);} scene.add(dashMesh);
    const railsCount=Math.floor(track.length/8)*2;
    const rails=new THREE.InstancedMesh(new THREE.BoxGeometry(.26,.52,8.3),material(night?0x368f9f:0x8c9791,{metalness:.45}),railsCount);
    const posts=new THREE.InstancedMesh(new THREE.BoxGeometry(.34,1.2,.34),material(0x526260),railsCount);
    for(let i=0;i<railsCount;i++) { const p=track.at(Math.floor(i/2)*8,(i%2?1:-1)*19.5);dummy.rotation.set(0,p.heading,0);dummy.position.set(p.x,.85,p.z);dummy.updateMatrix();rails.setMatrixAt(i,dummy.matrix);dummy.position.y=.5;dummy.updateMatrix();posts.setMatrixAt(i,dummy.matrix); } scene.add(rails,posts);
    // Checkerboard line across the whole circuit.
    const start=track.at(0), stripe=new THREE.Group(); stripe.position.set(start.x,.05,start.z); stripe.rotation.y=start.heading;
    for(let row=0;row<3;row++) for(let i=0;i<22;i++) box(stripe,[1,.015,.7],[i-10.5,0,row*.7],material((row+i)%2?0x171d21:0xf0eadb)); scene.add(stripe);
    const gantry=new THREE.Group(), gp=track.at(8); gantry.position.set(gp.x,0,gp.z); gantry.rotation.y=gp.heading;
    const frame=material(0x1c292a); box(gantry,[.6,8,.6],[-13,4,0],frame);box(gantry,[.6,8,.6],[13,4,0],frame);box(gantry,[27,.6,.6],[0,8,0],frame);
    box(gantry,[25,3,.45],[0,7,0],material(0xffffff,{map:signTexture('APEX DRIVE','FIND YOUR LIMIT.  /  EST. 2026'),roughness:1})); scene.add(gantry);
    const random=rng(track.id==='sunset'?23:track.id==='alpine'?55:79);
    const trees=[];
    for(let i=0;i<750 && trees.length<210;i++) {
      const x=random()*1050-630,z=random()*1020-510;
      if(track.nearest(x,z).distance>30) trees.push({x,z,scale:2.4+random()*4.5});
    }
    const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.13,.2,1,5),material(0x574f40),trees.length);
    const crowns=new THREE.InstancedMesh(new THREE.ConeGeometry(.85,2.8,7),material(track.foliage),trees.length);
    trees.forEach((t,i)=>{dummy.rotation.set(0,random()*6,0);dummy.scale.set(t.scale,t.scale,t.scale);dummy.position.set(t.x,t.scale*.5,t.z);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);dummy.position.y=t.scale*1.7;dummy.updateMatrix();crowns.setMatrixAt(i,dummy.matrix);}); crowns.castShadow=true;scene.add(trunks,crowns);
    for(let i=0;i<38;i++) {
      const a=i/38*Math.PI*2,r=430+random()*170,h=80+random()*150;
      const px=-130+Math.cos(a)*r,pz=Math.sin(a)*r;if(track.nearest(px,pz).distance<105)continue;
      const peak=new THREE.Mesh(new THREE.ConeGeometry(55+random()*65,h,night?4:5),material(track.mountain)); peak.position.set(px,h/2-3,pz);peak.rotation.y=random()*Math.PI;scene.add(peak);
    }
    const rocks=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),material(track.mountain),110);
    for(let i=0;i<110;i++){const p=track.at(random()*track.length,(random()>.5?1:-1)*(28+random()*13)),size=1+random()*3;dummy.position.set(p.x,size*.3,p.z);dummy.scale.set(size,size*.8,size*1.3);dummy.rotation.set(random(),random()*6,random());dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);}rocks.castShadow=true;scene.add(rocks);
    if(night) {
      const windowMat=new THREE.MeshBasicMaterial({color:0x65c9cd});
      for(let i=0;i<65;i++) {const x=random()*900-520,z=random()*850-400;if(track.nearest(x,z).distance<47)continue;const h=15+random()*70;box(scene,[14,h,14],[x,h/2,z],material(0x293746)); for(let j=5;j<h;j+=7) box(scene,[14.1,.4,14.1],[x,j,z],windowMat);}
    }
    // Trackside sponsor signs, facing oncoming drivers.
    for(let i=1;i<10;i++) {const p=track.at(track.length*i/10,25); const s=new THREE.Group();s.position.set(p.x,0,p.z);s.rotation.y=p.heading;box(s,[8,2,.4],[0,2.7,0],material(0xffffff,{map:signTexture(i%2?'DRIVE.':'APEX / 01')}));box(s,[.15,2,.15],[0,1,0],frame);scene.add(s);}
    this.player=makeCar(this.paint); scene.add(this.player); this.opponents=[];
    this.cameraInitialized=false;
  }
  setupRace(race) {
    this.opponents.forEach(m=>this.scene.remove(m));
    this.opponents=race.rivals.map(r=>{const m=makeCar(r.color);this.scene.add(m);return m;}); this.cameraInitialized=false;
  }
  render(race, menu, dt, time) {
    const track=this.track, p=race.player, car=this.player;
    this.opponents.forEach(m=>{m.visible=!menu;});
    if(menu) { const start=track.at(-32);car.position.set(start.x,0,start.z);car.rotation.set(0,start.heading,0);
      const mobile=innerWidth<760;
      const angle=start.heading+.78+Math.sin(time*.12)*.08,distance=mobile?11.5:9;
      this.targetPosition.set(start.x+Math.sin(angle)*distance,mobile?4.2:3.6,start.z+Math.cos(angle)*distance);
      this.targetLook.set(start.x,.8,start.z);
      this.camera.fov=mobile?56:46;
      this.camera.setViewOffset(innerWidth,innerHeight,-innerWidth*(mobile?.14:.21),innerHeight*(mobile?-.025:.05),innerWidth,innerHeight);
    } else {
      if(this.camera.view?.enabled)this.camera.clearViewOffset();
      car.position.set(p.x,Math.sin(time*35)*Math.abs(p.speed)*.0003,p.z); car.rotation.set(0,p.heading,-p.steer*p.speed*.0006);
      const forward=new THREE.Vector3(Math.sin(p.heading),0,Math.cos(p.heading));
      const mode=race.camera;
      if(mode===0) {this.targetPosition.set(p.x-forward.x*10.5,5.3,p.z-forward.z*10.5);this.targetLook.set(p.x+forward.x*12,1,p.z+forward.z*12);}
      else if(mode===1) {this.targetPosition.set(p.x-forward.x*17,11,p.z-forward.z*17);this.targetLook.set(p.x+forward.x*10,0,p.z+forward.z*10);}
      else {this.targetPosition.set(p.x+forward.x*1.6,1.85,p.z+forward.z*1.6);this.targetLook.set(p.x+forward.x*25,1.7,p.z+forward.z*25);}
      const desired=mode===2?76:58+Math.abs(p.speed)*.15+(p.boosting?5:0); this.camera.fov+=(desired-this.camera.fov)*Math.min(dt*3,1);
      this.opponents.forEach((m,i)=>{const r=race.rivals[i], rp=track.at(r.s,r.offset+Math.sin(r.s*.01+i)*.6);m.position.set(rp.x,0,rp.z);m.rotation.y=rp.heading;m.userData.wheels.forEach(w=>w.rotation.x+=r.speed*dt/.44);});
    }
    car.userData.wheels.forEach((w,i)=>{w.rotation.x+=p.speed*dt/.44;if(i%2===1)w.rotation.y=-p.steer*.3;});
    car.userData.boost.forEach(f=>{f.visible=!menu&&p.boosting;f.scale.y=.7+Math.random()*.6;});
    const follow=!this.cameraInitialized||race.camera===2?1:1-Math.exp(-dt*6);
    this.camera.position.lerp(this.targetPosition,follow);this.look.lerp(this.targetLook,follow);this.camera.lookAt(this.look);this.camera.updateProjectionMatrix();this.cameraInitialized=true;
    this.sun.position.set(car.position.x-100,190,car.position.z-70);this.sun.target.position.copy(car.position);
    this.renderer.render(this.scene,this.camera);
  }
}

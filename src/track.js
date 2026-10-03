export const TRACKS = [
  { id: 'sunset', name: 'Sunset Canyon', tag: 'THE DESERT CIRCUIT', region: 'ARIZONA, USA', description: 'Fast straights. Sweeping corners. Endless golden hour.', difficulty: 'FLOWING', sky: 0xdac2a4, fog: 0xdac2a4, ground: 0xa59b70, mountain: 0x977d60, foliage: 0x465b48, road: 0x3b4142, accent: 0xff663c,
    points: [[0,0],[0,155],[-90,270],[-235,250],[-315,120],[-260,0],[-350,-145],[-260,-275],[-90,-260],[20,-175],[95,-115],[100,-40]] },
  { id: 'alpine', name: 'Alpine Rush', tag: 'THE MOUNTAIN CIRCUIT', region: 'DOLOMITES, ITALY', description: 'Technical bends through a cool mountain landscape.', difficulty: 'TECHNICAL', sky: 0xb7d6d8, fog: 0xb7d6d8, ground: 0x728d70, mountain: 0x718986, foliage: 0x2c5745, road: 0x3b4549, accent: 0x8cdbb0,
    points: [[0,0],[30,130],[-55,230],[-175,220],[-215,105],[-140,40],[-245,-30],[-270,-170],[-155,-255],[-35,-180],[85,-220],[165,-120],[115,-25]] },
  { id: 'night', name: 'Midnight Run', tag: 'THE AFTER-HOURS CIRCUIT', region: 'NEON DISTRICT, JAPAN', description: 'City lights, electric curbs, and a wide-open throttle.', difficulty: 'HIGH SPEED', sky: 0x0e1626, fog: 0x141e32, ground: 0x222b38, mountain: 0x232e44, foliage: 0x20464c, road: 0x293141, accent: 0x52e3db,
    points: [[0,0],[0,200],[-90,280],[-300,280],[-380,170],[-290,65],[-380,-90],[-310,-220],[-100,-260],[65,-170],[110,-60]] },
];

export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export const wrap = (v, n) => ((v % n) + n) % n;
export const angleDifference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return .5 * ((2*p1) + (-p0+p2)*t + (2*p0-5*p1+4*p2-p3)*t2 + (-p0+3*p1-3*p2+p3)*t3);
}

export function createTrack(id = 'sunset') {
  const config = TRACKS.find(t => t.id === id) || TRACKS[0];
  const points = config.points, samples = [], count = points.length * 60;
  for (let i=0; i<count; i++) {
    const u = i/count*points.length, k = Math.floor(u), t = u-k;
    const p = [-1,0,1,2].map(n => points[wrap(k+n, points.length)]);
    samples.push({ x: catmull(...p.map(a=>a[0]), t), z: catmull(...p.map(a=>a[1]), t), s: 0 });
  }
  let length = 0;
  for (let i=0; i<count; i++) {
    const a=samples[i], b=samples[(i+1)%count], dx=b.x-a.x, dz=b.z-a.z;
    a.s=length; a.len=Math.hypot(dx,dz); a.tx=dx/a.len; a.tz=dz/a.len;
    length+=a.len;
  }
  function at(distance, offset=0) {
    const s=wrap(distance,length);
    let lo=0, hi=count-1;
    while(lo<hi) { const mid=Math.ceil((lo+hi)/2); if(samples[mid].s<=s) lo=mid; else hi=mid-1; }
    const a=samples[lo], b=samples[(lo+1)%count], f=(s-a.s)/a.len;
    const tx=a.tx, tz=a.tz;
    return { x:a.x+(b.x-a.x)*f+tz*offset, z:a.z+(b.z-a.z)*f-tx*offset, tx,tz, heading:Math.atan2(tx,tz), s, index:lo };
  }
  function nearest(x,z) {
    let best=Infinity, result;
    for(let i=0;i<count;i++) {
      const a=samples[i], t=clamp(((x-a.x)*a.tx+(z-a.z)*a.tz)/a.len,0,1);
      const px=a.x+a.tx*a.len*t, pz=a.z+a.tz*a.len*t;
      const dx=x-px,dz=z-pz,d=dx*dx+dz*dz;
      if(d<best) { best=d; result={ x:px,z:pz,s:a.s+a.len*t,index:i,tx:a.tx,tz:a.tz,offset:dx*a.tz-dz*a.tx,distance:Math.sqrt(d) }; }
    }
    return result;
  }
  return { ...config, samples, length, width:22, at, nearest, checkpointCount:24 };
}

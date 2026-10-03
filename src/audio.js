export class EngineAudio {
  constructor() { this.enabled=true; this.context=null; }
  start() {
    if(!this.enabled) return;
    try {
      if(!this.context) {
        this.context=new (window.AudioContext || window.webkitAudioContext)();
        this.gain=this.context.createGain();this.gain.gain.value=0;this.gain.connect(this.context.destination);
        this.filter=this.context.createBiquadFilter();this.filter.type='lowpass';this.filter.frequency.value=400;this.filter.connect(this.gain);
        this.osc=this.context.createOscillator();this.osc.type='sawtooth';this.osc.frequency.value=45;this.osc.connect(this.filter);this.osc.start();
        this.sub=this.context.createOscillator();this.sub.type='triangle';this.sub.frequency.value=23;this.sub.connect(this.filter);this.sub.start();
      }
      this.context.resume().catch(()=>{});
    } catch { this.enabled=false; }
  }
  update(player,active) {
    if(!this.context) return;
    const t=this.context.currentTime,s=Math.abs(player.speed);
    this.gain.gain.setTargetAtTime(this.enabled && active ? .024+s*.00024 : 0,t,.12);
    const gear=Math.max(1,Math.min(6,Math.floor(s/12)+1)), rev=47+(s%12)*6+gear*5;
    this.osc.frequency.setTargetAtTime(rev+(player.boosting?25:0),t,.07);this.sub.frequency.setTargetAtTime(rev*.49,t,.1);
    this.filter.frequency.setTargetAtTime(210+s*12,t,.1);
  }
  beep(frequency=700,duration=.13) {
    if(!this.context||!this.enabled)return;
    const osc=this.context.createOscillator(),gain=this.context.createGain(),now=this.context.currentTime;
    osc.frequency.value=frequency;gain.gain.setValueAtTime(.06,now);gain.gain.exponentialRampToValueAtTime(.001,now+duration);osc.connect(gain);gain.connect(this.context.destination);osc.start();osc.stop(now+duration);
  }
  setEnabled(value) {this.enabled=value;if(value)this.start();else if(this.gain)this.gain.gain.setTargetAtTime(0,this.context.currentTime,.02);}
}

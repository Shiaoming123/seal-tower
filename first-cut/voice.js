// A tiny foley instrument. All taps, air, bronze partials and paper flutter are synthesized.
window.CutVoice=(()=>{
  let ac,noise,master,enabled=true;
  function unlock(){
    if(!enabled)return;
    try{
      if(!ac){
        const Constructor=window.AudioContext||window.webkitAudioContext; if(!Constructor)return;
        ac=new Constructor();master=ac.createGain();master.gain.value=.48;master.connect(ac.destination);
        noise=ac.createBuffer(1,Math.ceil(ac.sampleRate*.32),ac.sampleRate);
        const a=noise.getChannelData(0);let flag=31;
        for(let i=0;i<a.length;i++){flag=(Math.imul(flag,1664525)+1013904223)>>>0;a[i]=flag/2147483648-1}
      }
      if(ac.state!=="running")ac.resume().catch(()=>{});
    }catch{}
  }
  function pulse(from,to,len,vol,type="sine",offset=0){
    const tone=ac.createOscillator(),env=ac.createGain(),start=ac.currentTime+offset;
    tone.type=type;tone.frequency.setValueAtTime(from,start);tone.frequency.exponentialRampToValueAtTime(to,start+len);
    env.gain.setValueAtTime(.0001,start);env.gain.exponentialRampToValueAtTime(vol,start+.004);env.gain.exponentialRampToValueAtTime(.0001,start+len);
    tone.connect(env).connect(master);tone.onended=()=>{tone.disconnect();env.disconnect()};tone.start(start);tone.stop(start+len+.005);
  }
  function air(from,to,len,vol,q){
    const n=ac.createBufferSource(),f=ac.createBiquadFilter(),env=ac.createGain(),start=ac.currentTime;
    n.buffer=noise;f.type="bandpass";f.Q.value=q;f.frequency.setValueAtTime(from,start);f.frequency.exponentialRampToValueAtTime(to,start+len);
    env.gain.setValueAtTime(.001,start);env.gain.exponentialRampToValueAtTime(vol,start+len*.23);env.gain.exponentialRampToValueAtTime(.0001,start+len);
    n.connect(f).connect(env).connect(master);n.onended=()=>{n.disconnect();f.disconnect();env.disconnect()};n.start(start);n.stop(start+len);
  }
  function play(cue,focus=false){
    if(!enabled||!ac||ac.state!=="running"||document.hidden)return;
    if(cue==="abacus"){
      pulse(1150,530,.045,.16,"triangle");pulse(1700,710,.05,.12,"triangle",.057);
      if(focus>=2)pulse(1270,630,.045,.095,"triangle",.11);
      return;
    }
    if(cue==="stamp"){
      pulse(148,52,.125,.31,"triangle");air(1220,430,.064,.19,1.05);return;
    }
    if(cue==="grind"){
      air(510,2900,.40,.30,1.4);pulse(850,1170,.28,.075,"sine",.23);pulse(1460,1394,.42,.075,"sine",.34);return;
    }
    if(cue==="tie"){air(1470,520,.16,.14,1.4);pulse(622,523,.15,.04,"triangle",.08);return}
    if(cue==="take"){air(1600,500,.15,.15,.8);pulse(740,698,.25,.11,"sine",.09);return}
    if(cue==="paper"){air(850,2700,.18,.16,1.2);pulse(247,245,.45,.08,"triangle",.04);return}
    if(cue==="market"){pulse(330,327,.65,.12,"triangle");pulse(495,493,.62,.07,"sine",.21);return}
    if(cue==="scale"){pulse(1280,1260,.35,.13);pulse(1961,1915,.2,.04,"sine",.03);return}
    if(cue==="sell"){
      const notes=[740,932,1109,1480],{from,to}=focus;
      for(let i=from;i<to;i++){const hz=notes[i%notes.length];pulse(hz,hz*.975,.26,.105,"sine",(i-from)*.045)}
      return;
    }
    if(cue==="keep"){air(1700,380,.19,.2,.8);pulse(370,330,.27,.08,"triangle",.15);return}
    if(cue==="slash"){air(460,3900,.125,.55,.8);return}
    if(cue==="hit"){air(4300,680,.105,.86,.8);pulse(focus?128:105,40,.18,.5,"triangle");pulse(1568,1142,.18,.11);if(focus)pulse(2093,1830,.26,.12,"sine",.021);return}
    if(cue==="guard"){pulse(792,431,.21,.16,"triangle");pulse(1584,1432,.16,.08);return}
    if(cue==="reply"){air(840,2400,.085,.21,1.8);pulse(113,69,.105,.13,"triangle");return}
    if(cue==="ready"){pulse(930,1244,.12,.12);return}
    if(cue==="sealed"){pulse(622,621,.44,.11);pulse(933,930,.52,.065,"sine",.064)}
  }
  function toggle(){enabled=!enabled;if(enabled)unlock();if(master)master.gain.value=enabled?.48:0;return enabled}
  return {unlock,play,toggle,get enabled(){return enabled}};
})();
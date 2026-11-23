// A four-note tower motif is shared by the market, combat and the closing bell.
window.TowerSound = (() => {
  let context, timer, enabled = false, step = 0, currentPhase = "start";
  function note(frequency, duration, amplitude, type = "sine", delay = 0, endFrequency = frequency) {
    if (!enabled || !context || context.state !== "running" || document.hidden) return;
    const start = context.currentTime + delay;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency,start);
    osc.frequency.exponentialRampToValueAtTime(endFrequency,start + duration);
    gain.gain.setValueAtTime(.0001,start);
    gain.gain.exponentialRampToValueAtTime(amplitude,start + .012);
    gain.gain.exponentialRampToValueAtTime(.0001,start + duration);
    osc.connect(gain).connect(context.destination);
    osc.onended = () => {osc.disconnect();gain.disconnect();};
    osc.start(start); osc.stop(start + duration + .01);
  }
  function music() {
    if (document.hidden || !enabled) return;
    const motif = [146.83,0,220,0,196,0,164.81,0];
    const pitch = motif[step % motif.length];
    if (pitch) note(pitch * (currentPhase === "shop" ? 2 : 1),.7,.020,"triangle");
    if (currentPhase === "fight" && step % 4 === 3) note(90,.14,.039,"sine",0,45);
    step++;
  }
  function effect(id) {
    if (id === "focus-ready") {note(988,.16,.022);return;}
    if (id === "focus-hit" || id === "hit") {
      note(id==="focus-hit"?107:83,.21,.095,"triangle",0,38);
      note(1220,.065,.024,"square",.012,310);
      if(id==="focus-hit") note(1174.66,.36,.041,"sine",.025,880);
      return;
    }
    if (id === "hurt" || id === "parry") {
      note(id==="hurt"?109:690,.13,.041,"triangle",0,id==="hurt"?48:390);return;
    }
    if (id === "guard" || id === "shield") {note(132,.16,.075,"triangle",0,57);note(389,.25,.027,"sine",.06);return;}
    if (id === "strike" || id === "sword") {note(780,.11,.039,"sawtooth",0,170);note(133,.13,.065,"triangle",.09,52);return;}
    if (id === "cast" || id === "disc") {[293.66,440,587.33].forEach((f,i)=>note(f,.38,.043,"sine",i*.074));return;}
    if (id === "won" || id === "lost") {const f=id==="won"?196:98;[1,2.01,3.02].forEach((p,i)=>note(f*p,1.45-i*.2,.06/(i+1),"sine",.03));return;}
    if (id.startsWith("sell") || id==="mirror" || id==="potion") {note(880,.20,.032);note(1174.66,.33,.037,"sine",.10);return;}
    note(392,.16,.034,"triangle");note(587.33,.27,.026,"sine",.08);
  }
  async function toggle() {
    if (enabled) {
      enabled=false;clearInterval(timer);await context.suspend();return false;
    }
    const Audio=window.AudioContext||window.webkitAudioContext;
    if (!Audio) throw Error("Audio unavailable");
    context ??=new Audio();
    await context.resume();
    enabled=true;step=0;music();timer=setInterval(music,450);
    return true;
  }
  document.addEventListener("visibilitychange",()=>{
    if (!enabled || !context) return;
    (document.hidden?context.suspend():context.resume()).catch(()=>{});
  });
  return {toggle,effect,phase(value){currentPhase=value;}};
})();
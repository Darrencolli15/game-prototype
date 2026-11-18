"use strict";

const Sound=(()=>{
  let ctx,timer,step=0;
  const notes=[55,60,62,64,67,64,62,60,53,57,60,62,65,62,60,57];
  const tunes={
    tap:[330],deploy:[220,392],pump:[392,523,659],cast:[392,659,988],
    win:[392,523,659,784],loss:[370,294,247],reward:[523,659,880],
    chest:[196,311,392,622,784],common:[440,587],rare:[523,698,1047],
    epic:[440,660,880,1320],discovery:[494,659,880,1175]
  };
  function voice(hz,time,duration,volume,wave="triangle"){
    const osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.type=wave;osc.frequency.value=hz;
    gain.gain.setValueAtTime(.0001,time);
    gain.gain.exponentialRampToValueAtTime(volume,time+.023);
    gain.gain.exponentialRampToValueAtTime(.0001,time+duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(time);osc.stop(time+duration+.015);
  }
  function beat(){
    if(!ctx||ctx.state!=="running"||document.hidden)return;
    const i=step++%notes.length;
    const hz=440*2**((notes[i]-69)/12);
    voice(hz,ctx.currentTime,.37,.011,"sine");
    if(i%4===0)voice(hz/2,ctx.currentTime,.55,.009,"triangle");
  }
  function play(kind){
    const Audio=window.AudioContext||window.webkitAudioContext;
    if(!Audio)return;
    ctx??=new Audio();
    if(ctx.state==="suspended")ctx.resume().catch(()=>{});
    timer??=setInterval(beat,430);
    if(!tunes[kind])return;
    tunes[kind].forEach((hz,i)=>voice(hz,ctx.currentTime+i*.064,.22,kind==="tap"?.022:.048));
  }
  function stop(){
    clearInterval(timer);timer=null;
    if(ctx?.state==="running")ctx.suspend().catch(()=>{});
  }
  return {play,stop};
})();

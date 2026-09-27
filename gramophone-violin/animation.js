/* The Little Virtuoso — dependency-free SVG rig. Units: SVG user units; angles: degrees. */
(function () {
'use strict';
const DURATIONS={entrance:4.8,short:1.7,long:8,full:15.3,frustration:6.6};
const rad=Math.PI/180, mix=(a,b,t)=>a+(b-a)*t, clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n)), ease=t=>{t=clamp(t);return t*t*(3-2*t)}, rot=(p,a)=>[p[0]*Math.cos(a*rad)-p[1]*Math.sin(a*rad),p[0]*Math.sin(a*rad)+p[1]*Math.cos(a*rad)];
const point=(p,q,a)=>{const z=rot(q,a);return [p[0]+z[0],p[1]+z[1]]};
class GramophoneViolinPlayer {
 constructor(svg,{onUpdate=()=>{},onComplete=()=>{}}={}) {
  this.svg=svg;this.onUpdate=onUpdate;this.onComplete=onComplete;this.clip='entrance';this.time=4.8;this.rate=1;this.loop=false;this.playing=false;this.frame=null;this.previous=null;this.performance=null;this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;this.reducedPerformance=false;
  this.nodes={};svg.querySelectorAll('[id]').forEach(n=>this.nodes[n.id]=n);
  this.render();
 }
 transform(id,value){this.nodes[id].setAttribute('transform',value)}
 joint(id,p,a){this.transform(id,`translate(${p[0]} ${p[1]}) rotate(${a})`)}
 // This variant accepts explicit segment IDs so leg names stay compatible with the source rig.
 limb(aId,bId,root,target,l1,l2,sign){
  const dx=target[0]-root[0],dy=target[1]-root[1],raw=Math.hypot(dx,dy),d=clamp(raw,Math.abs(l1-l2)+.01,l1+l2-.01),theta=Math.atan2(dy,dx),off=Math.acos(clamp((l1*l1+d*d-l2*l2)/(2*l1*d),-1,1)),a=theta+sign*off,j=[root[0]+l1*Math.cos(a),root[1]+l1*Math.sin(a)];
  const end=raw>d? [root[0]+Math.cos(theta)*d,root[1]+Math.sin(theta)*d]:target;
  this.joint(aId,root,a/rad);this.joint(bId,j,Math.atan2(end[1]-j[1],end[0]-j[0])/rad);
  return {joint:j,end,reachError:Math.hypot(end[0]-target[0],end[1]-target[1])};
 }
 evaluate(){
  let phase=this.clip,t=this.time;
  if(phase==='full'){
   if(t<4.8)phase='entrance';else if(t<6.5){phase='short';t-=4.8}else if(t<7.3){phase='ready';t=0}else{phase='long';t-=7.3}
  }
  let rootX=0,bodyY=0,bodyAngle=0,hornAngle=0,raise=1,bowTravel=0,fingers=0,walk=0,phaseLabel='Ready to play';
  if(phase==='entrance'){
   raise=ease((t-3.2)/1.6);
   if(t<2.8){const brake=clamp((t-2.35)/.45);rootX=-1100+(1100/2.575)*(t-.45*(brake**3-.5*brake**4));walk=1-ease(brake);bodyY=15*walk-5*Math.cos(t/.55*Math.PI*4)*walk;bodyAngle=1.7*Math.sin(t/.55*Math.PI*2)*walk;hornAngle=2.5*Math.sin(t/.55*Math.PI*2-.6)*walk;phaseLabel='Walking in';}
   else if(t<3.2){bodyY=-5*Math.sin((t-2.8)/.4*Math.PI);phaseLabel='Finding his footing';}
   else {hornAngle=-2.5*Math.sin(raise*Math.PI);phaseLabel=raise<1?'Lifting the violin':'Ready to play';}
  }
  if(phase==='frustration'){
   // Lower the instrument, exhale, then leave with a slow reversed gait.
   const slump=ease(t/1.35),leave=clamp((t-2)/4.6);
   raise=1-slump;hornAngle=28*slump;bodyAngle=2*slump;bodyY=10*slump;
   rootX=-1200*ease(leave);
   walk=ease((t-2)/.45)*(1-ease((t-6.1)/.5));
   if(!this.reducedPerformance){
    bodyY+=2*Math.sin((t-2)/.8*Math.PI*2)*walk;
    hornAngle+=1.5*Math.sin((t-2)/.8*Math.PI*2)*walk;
   }
   phaseLabel=t<1.35?'Losing heart':t<2?'A defeated pause':t<6.6?'Leaving quietly':'Left the scene';
  }
  if(phase==='short'){
   // Compact stroke and return; zero displacement and velocity at both endpoints.
   const env=Math.sin(Math.PI*clamp(t/1.7))**2;
   bowTravel=38*Math.sin(2*Math.PI*t/1.7)*env;hornAngle=-2.8*env;bodyAngle=.6*env;fingers=env;phaseLabel=t<1.25?'One little note':'Returning to ready';
  }
  if(phase==='long'){
   const u=t/8,env=Math.sin(Math.PI*clamp(u))**2;
   bowTravel=76*Math.sin(2*Math.PI*t/2)*(.5+.5*env);bodyAngle=1.7*Math.sin(2*Math.PI*u)*env;bodyY=-3*env;hornAngle=3.5*Math.sin(2*Math.PI*u-.45)*env;fingers=(.5+.5*Math.sin(t*Math.PI*5))*env;phaseLabel='An eight-second phrase';
  }
  // Musical playback stays visibly connected to the bow under reduced motion,
  // with sway and stroke distance lowered instead of removing the performance.
  if(this.reducedPerformance&&(phase==='short'||phase==='long')){
   bowTravel*=.32;bodyAngle*=.2;bodyY*=.2;hornAngle*=.2;fingers*=.5;
   phaseLabel=phase==='short'?'Gentle short bow stroke':'Gentle sustained bowing';
  }
  const violinP=[mix(798,551,raise),mix(972,735,raise)],violinA=mix(-88,-16,raise);
  const leftWrist=point(violinP,[208,0],violinA),bowA=mix(78,74,raise);
  const readyOrigin=point(violinP,[bowTravel,-10],bowA),carryWrist=[331,875],carryOrigin=point(carryWrist,[-143,-10],78);
  const bowP=[mix(carryOrigin[0],readyOrigin[0],raise),mix(carryOrigin[1],readyOrigin[1],raise)],rightWrist=point(bowP,[143,10],bowA);
  return {phase,t,rootX,bodyY,bodyAngle,hornAngle,raise,bowTravel,fingers,walk,phaseLabel,violinP,violinA,leftWrist,rightWrist,bowP,bowA};
 }
 render(){
  const p=this.evaluate();this.pose=p;
  this.transform('locomotion-root',`translate(${p.rootX} 0)`);
  this.transform('torso-root',`translate(0 ${p.bodyY}) rotate(${p.bodyAngle} 556 900)`);
  this.transform('horn-root',`rotate(${p.hornAngle} 451 625)`);
  const world=q=>point([556,900+p.bodyY],[q[0]-556,q[1]-900],p.bodyAngle);
  let maxError=0;
  for(const [side,hip,ankle,shift] of [['left',[653,933],[693,1120],0],['right',[441,904],[427,1120],.5]]){
   let x=ankle[0],y=ankle[1],toe=0;
   if(p.walk>0){const gaitTime=p.phase==='frustration'?Math.max(0,p.t-2)/.8:p.t/.55;
    const u=((gaitTime+shift)%1),stance=.64;
    if(u<stance)x+=mix(70,-70,u/stance)*p.walk;
    else{const s=(u-stance)/(1-stance);x+=mix(-70,70,ease(s))*p.walk;y-=Math.sin(Math.PI*s)*63*p.walk;toe=-18*Math.sin(Math.PI*s)*p.walk;}
   }
   if(p.phase==='frustration'){x=2*ankle[0]-x;toe=-toe;}
   // A slight crouch keeps the maximum stride within the joint reach.
   const h=world([hip[0],hip[1]+14*p.walk]);const r=this.limb(side+'-thigh',side+'-shin',h,[x,y],114,112,side==='left'?-1:1);
   this.joint(side+'-foot',r.end,toe);maxError=Math.max(maxError,r.reachError);
  }
  for(const [side,s,w,sign] of [['left',[729,783],p.leftWrist,1],['right',[414,760],p.rightWrist,1]]){
   const r=this.limb(side+'-upper',side+'-forearm',s,w,135,140,sign);maxError=Math.max(maxError,r.reachError);
  }
  this.joint('violin-root',p.violinP,p.violinA);this.joint('bow-root',p.bowP,p.bowA);
  this.joint('left-hand',p.leftWrist,p.violinA+90);this.joint('left-fingers',p.leftWrist,p.violinA);
  this.joint('right-hand',p.rightWrist,p.bowA-90);
  for(let i=1;i<=3;i++)this.transform('finger-'+i,`translate(0 ${-p.fingers*(i===2?3:1.6)})`);
  this.maxReachError=maxError;
  this.svg.dataset.performance=this.playing?this.clip:'ready';
  this.onUpdate({clip:this.clip,time:this.time,duration:DURATIONS[this.clip],playing:this.playing,label:p.phaseLabel,reduced:this.reduced,reducedPerformance:this.reducedPerformance});
 }
 play(clip=this.clip, performance=null, allowReducedPerformance=false){if(!DURATIONS[clip])throw new Error('Unknown animation: '+clip);this.pause();this.performance=performance;this.reducedPerformance=this.reduced&&allowReducedPerformance;this.clip=clip;this.time=0;this.playing=true;this.svg.dispatchEvent(new CustomEvent('gramophone:clipstart',{detail:{clip}}));
  if(this.reduced&&!allowReducedPerformance){this.time=DURATIONS[clip];this.playing=false;this.render();this.complete();return}
  this.previous=null;this.render();this.frame=requestAnimationFrame(t=>this.tick(t));
 }
 tick(now){this.frame=null;if(!this.playing)return;if(!this.svg.isConnected){this.destroy();return}
  if(this.performance){this.time=clamp(this.performance.elapsed()/this.performance.duration)*DURATIONS[this.clip]}
  else if(this.previous!==null)this.time+=(now-this.previous)/1000*this.rate;this.previous=now;
  const duration=DURATIONS[this.clip];if(this.time>=duration){if(this.loop&&this.clip==='long'&&!this.performance){this.time%=duration}else{this.time=duration;this.playing=false;this.performance=null;this.render();this.complete();return}}
  this.render();this.frame=requestAnimationFrame(t=>this.tick(t));
 }
 complete(){this.onComplete(this.clip);this.svg.dispatchEvent(new CustomEvent('gramophone:clipcomplete',{detail:{clip:this.clip}}))}
 pause(){this.playing=false;if(this.frame!==null)cancelAnimationFrame(this.frame);this.frame=null;this.previous=null;this.performance=null;this.render()}
 resume(){if(this.playing)return;if(this.time>=DURATIONS[this.clip])return this.play(this.clip,null,true);this.reducedPerformance=this.reduced;this.playing=true;this.previous=null;this.render();this.frame=requestAnimationFrame(t=>this.tick(t))}
 seek(seconds){this.pause();this.time=clamp(seconds,0,DURATIONS[this.clip]);this.render()}
 ready(){this.pause();this.reducedPerformance=false;this.clip='entrance';this.time=4.8;this.render()}
 playShortViolinAnimation(schedule){this.play('short',schedule,true)}
 playLongViolinAnimation(schedule){this.play('long',schedule,true)}
 cancelViolinPerformance(){this.ready()}
 setViolinReadyPose(){this.ready()}
 destroy(){this.pause();this.onUpdate=()=>{};this.onComplete=()=>{}}
}
window.GramophoneViolinPlayer=GramophoneViolinPlayer;
const svg=document.getElementById('character-scene');
if(svg){
 const label=document.getElementById('phase'),time=document.getElementById('time'),scrub=document.getElementById('scrub'),toggle=document.getElementById('toggle');
 const player=new GramophoneViolinPlayer(svg,{onUpdate:s=>{if(!label)return;label.textContent=s.reduced?(s.reducedPerformance?`Reduced motion · ${s.label}`:'Reduced motion · ready pose (music remains available)'):s.label;time.textContent=`${s.time.toFixed(1)} / ${s.duration.toFixed(1)} s`;scrub.max=s.duration;scrub.value=s.time;toggle.textContent=s.playing?'Pause preview':'Play preview';toggle.setAttribute('aria-label',s.playing?'Pause animation':'Play animation');document.querySelectorAll('[data-clip]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.clip===s.clip));}});
 window.gramophone=player;
 // Clicking a study control explicitly requests motion, including with reduced motion enabled.
 document.querySelectorAll('[data-clip]').forEach(b=>b.addEventListener('click',()=>player.play(b.dataset.clip,null,true)));
 toggle?.addEventListener('click',()=>player.playing?player.pause():player.resume());
 document.getElementById('restart')?.addEventListener('click',()=>player.play(player.clip,null,true));
 document.getElementById('ready')?.addEventListener('click',()=>player.ready());
 scrub?.addEventListener('input',e=>player.seek(Number(e.target.value)));
 document.getElementById('speed')?.addEventListener('change',e=>player.rate=Number(e.target.value));
 document.getElementById('loop')?.addEventListener('change',e=>player.loop=e.target.checked);
 document.getElementById('background')?.addEventListener('click',()=>document.querySelector('.stage').classList.toggle('dark'));
 document.addEventListener('visibilitychange',()=>{if(document.hidden)player.pause()});
 const preference=matchMedia('(prefers-reduced-motion: reduce)');
 preference.addEventListener('change',e=>{player.reduced=e.matches;player.ready()});
 window.addEventListener('pagehide',()=>player.pause());
}
})();

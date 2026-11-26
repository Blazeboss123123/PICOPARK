// Player-like bot helpers for traversal tests.
const HP=require('../public/game.js');
const solidCh=(g,tx,ty)=>{if(ty<0||ty>=HP.ROWS||tx<0||tx>=g.W)return false;const r=HP.tileRect(g,tx,ty,{x:tx*10,y:ty*10-14,w:10,h:14,isPlayer:true,slot:-9},'y',1);return !!r};
function edgeOf(g,p){const ty=Math.floor((p.y+14+1)/10);let tx=Math.floor((p.x+9.9)/10);if(!solidCh(g,tx,ty))tx=Math.floor(p.x/10);while(solidCh(g,tx+1,ty))tx++;return (tx+1)*10}
function step(g,inputs){g.players.forEach(p=>{const v=inputs(p)||{};HP.setInput(g,p.slot,v.x||0,!!v.j,!!v.d)});HP.step(g,HP.STEP);HP.clearEdges(g);g.fx.length=0}
// each player runs right independently, jumping at its own ledge edge
function travel(g,target,maxT,opts){opts=opts||{};const st={};let t=0;const n0=g.S.deaths;
 while(t<maxT){if(g.S.deaths>n0)return false;if(g.players.every(p=>p.x>=target-14*(g.players.length-1)))return true;
  step(g,p=>{const s=st[p.slot]=st[p.slot]||{air:false};if(p.x>=target)return{x:0};if(opts.hold&&opts.hold(p))return{x:0};
   if(p.grounded){if(s.air){s.air=false;s.cool=0.08}if(s.cool>0){s.cool-=HP.STEP;return{x:1}}const e=edgeOf(g,p);if(p.x+10>=e-1.5&&p.vx>20){s.air=true;return{x:1,j:1}}return{x:1}}
   return{x:1,j:p.vy<0}});t+=HP.STEP}
 return g.players.every(p=>p.x>=target-14*(g.players.length-1))}
module.exports={travel,step,edgeOf};

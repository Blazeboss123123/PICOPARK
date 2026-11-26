const HP=require('../public/game.js');
function G(i,n){const g=HP.createGame(i,n);for(let s=0;s<n;s++)HP.addPlayer(g,s);return g;}
const P=(g,s)=>g.players.find(p=>p.slot===s);const put=(g,s,x,y)=>{const p=P(g,s);p.x=x;p.y=y;p.vx=p.vy=0;};
function run(g,sec,inp,watch){const n=Math.round(sec/HP.STEP);for(let k=0;k<n;k++){g.players.forEach(p=>{const v=inp?inp(p,k*HP.STEP):null;HP.setInput(g,p.slot,v?v.x||0:0,v?!!v.j:false,v?!!v.d:false);});HP.step(g,HP.STEP);HP.clearEdges(g);g.fx.length=0;if(watch)watch(g)}}
let pass=0,fail=0;const ok=(c,m)=>{if(c)pass++;else{fail++;console.log('FAIL',m)}};const f=v=>Math.round(v*100)/100;
const onScreen=g=>{const S=g.S,vw=HP.VW/S.zoom,vh=HP.VH/S.zoom;return g.players.every(p=>p.dead||p.inside||(p.x>=S.cam-2&&p.x+p.w<=S.cam+vw+2&&p.y+p.h>=S.camY-2&&p.y<=S.camY+vh+2))};
// the screenshot: orange on the high ledge, teal hopping on the ground
{const g=G(12,2);put(g,0,262,86);put(g,1,170,306);run(g,2);const z0=g.S.zoom,cy0=g.S.camY;let zmin=9,zmax=0,ymin=1e9,ymax=-1e9,off=0;
 run(g,8,(p,t)=>p.slot===1?{j:(t%0.9)<0.4}:null,g=>{zmin=Math.min(zmin,g.S.zoom);zmax=Math.max(zmax,g.S.zoom);ymin=Math.min(ymin,g.S.camY);ymax=Math.max(ymax,g.S.camY);if(!onScreen(g))off++});
 ok(zmax-zmin<0.001,'hopping does not change zoom ('+f(zmin)+'..'+f(zmax)+')');ok(ymax-ymin<0.5,'hopping does not move camera up/down ('+f(ymax-ymin)+')');ok(off===0,'both stay on screen while hopping (off '+off+')');}
// walking around together: zoom stays on a few fixed steps
{const g=G(0,2);const seen=new Set();let off=0;run(g,10,(p,t)=>({x:Math.sin(t*0.7+p.slot)>0?1:-1,j:(t*3+p.slot)%2<0.3}),g=>{if(Math.abs(g.S.zoom-[1,0.8,0.64,0.5].reduce((a,b)=>Math.abs(b-g.S.zoom)<Math.abs(a-g.S.zoom)?b:a))<0.001)seen.add(g.S.zoom.toFixed(2));if(!onScreen(g))off++});ok(off===0,'L1 everyone on screen while running about (off '+off+')');}
// lift ride, spring launch and a long fall stay on screen
{const g=G(12,2);put(g,0,225,306);put(g,1,60,306);let off=0;run(g,8,null,g=>{if(!onScreen(g))off++});ok(P(g,0).y<120,'SO rode lift up y='+f(P(g,0).y));ok(off===0,'SO lift ride on screen (off '+off+')');
 put(g,1,590,296);let off2=0;run(g,3,p=>p.slot===1?{x:-1}:null,g=>{if(!onScreen(g))off2++});ok(off2===0,'SO spring launch on screen (off '+off2+')');}
{const g=G(23,2);put(g,0,120,236);put(g,1,150,236);run(g,1);let off=0;run(g,3,p=>p.slot===0?{x:-1}:null,g=>{if(!onScreen(g))off++});ok(off===0,'tower drop on screen (off '+off+')');}
// zoom comes back in after the team regroups, but only after a pause
{const g=G(12,2);put(g,0,32,176);put(g,1,562,306);run(g,2);const zOut=g.S.zoom;put(g,0,100,306);put(g,1,130,306);run(g,0.6);const zSoon=g.S.zoom;run(g,4);ok(zOut<=0.51&&Math.abs(zSoon-zOut)<0.01&&g.S.zoom>zOut+0.1,'zooms back in after a pause '+f(zOut)+' '+f(zSoon)+' '+f(g.S.zoom));}
// walking on a rising lift or crusher never shoves you sideways (the old 'teleport to the edge')
{const g=G(6,5),l=g.S.lifts[0];[141,152,163,174].forEach((x,i)=>put(g,i,x,136));put(g,4,174,122);let worst=0,prev=P(g,1).x;
 run(g,3.4,(p,t)=>p.slot===1?{x:Math.sin(t*10)>0?1:-1}:null,g=>{const x=P(g,1).x;worst=Math.max(worst,Math.abs(x-prev));prev=x});ok(l.y<=81&&worst<=0.7,'walking on a rising lift: no sideways jumps (max '+f(worst)+' per step)');}
{const g=G(22,2),c=g.S.crush[4];put(g,0,688,136);put(g,1,600,136);let worst=0,prev=688,rode=false;
 run(g,5,(p,t)=>p.slot===0?{x:t>2.75&&t<3.05?-1:(t>3.3&&t<4.2?(Math.sin(t*9)>0?1:-1):0),j:t>2.72&&t<3.0}:null,g=>{const x=P(g,0).x;worst=Math.max(worst,Math.abs(x-prev));prev=x;if(P(g,0).on===c)rode=true});ok(rode&&worst<=0.7&&!g.S.deaths,'riding a rising crusher: no sideways jumps (max '+f(worst)+', rode '+rode+')');}
console.log('pass',pass,'fail',fail);

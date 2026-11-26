const HP=require('../public/game.js');const BOT=require('./bot.js');
function G(i,n=2){const g=HP.createGame(i);for(let s=0;s<n;s++)HP.addPlayer(g,s);return g;}
function run(g,sec,inp){const n=Math.round(sec/HP.STEP);for(let k=0;k<n;k++){g.players.forEach(p=>{const v=inp?inp(p,k*HP.STEP):null;HP.setInput(g,p.slot,v?v.x||0:0,v?!!v.j:false,v?!!v.d:false);});HP.step(g,HP.STEP);HP.clearEdges(g);g.fx.length=0;}}
const P=(g,s)=>g.players.find(p=>p.slot===s);
const put=(g,s,x,y)=>{const p=P(g,s);p.x=x;p.y=y;p.vx=p.vy=0;};
let pass=0,fail=0;const ok=(c,m)=>{if(c)pass++;else{fail++;console.log('FAIL',m)}};
const f=v=>Math.round(v*10)/10;
// group hop: all players walk right; when the LEADER nears its edge, everyone jumps together; hold right until all grounded
function groupHop(g,hops,opts){opts=opts||{};for(let h=0;h<hops;h++){const L=g.players.reduce((a,b)=>a.x>b.x?a:b);const tx=Math.floor((L.x+5)/10),ty=Math.floor((L.y+15)/10);let ex=tx;const solid=c=>c&&c!=='.'&&c!=='^';while(solid(g.grid[ty]&&g.grid[ty][ex+1]))ex++;const edge=(ex+1)*10;
 let k=0;while(L.x+10<edge-1&&k++<400)run(g,1/120,()=>({x:1}));run(g,0.1,()=>({x:1,j:1}));k=0;while(!g.players.every(p=>p.grounded)&&k++<300)run(g,1/120,()=>({x:1,j:1}));run(g,opts.brake||0.12,()=>({x:-1}));run(g,0.1);if(g.S.deaths)return false}return true}
// Tied together: platforms over spikes, roped, jumping together
{const g=G(5);put(g,0,465,96);put(g,1,450,96);run(g,0.3);const okh=BOT.travel(g,770,12);ok(okh,'rope platforms crossed '+f(P(g,0).x)+','+f(P(g,1).x)+' '+g.S.lastCause);}
// Springtime crumbles: run across crumble row together
{const g=G(8);put(g,0,225,56);put(g,1,212,56);run(g,0.3);const okh=BOT.travel(g,460,10);ok(okh,'crumbles crossed '+f(P(g,0).x)+','+f(P(g,1).x)+' '+g.S.lastCause);}
// Head count B: exact-1 ferry; second rider sends it back
{const g=G(9);const B=g.S.lifts[1];put(g,0,B.x+10,76);put(g,1,300,76);run(g,0.2);run(g,1.5);ok(B.x>380,'B moves with 1 rider x='+f(B.x));
 const g2=G(9);const B2=g2.S.lifts[1];put(g2,0,B2.x+5,76);put(g2,1,B2.x+17,76);run(g2,1.5);ok(B2.x<362,'B refuses 2 riders x='+f(B2.x));
 const g3=G(9);const D=g3.S.lifts[2];put(g3,0,D.x+10,76);put(g3,1,D.x+30,76);run(g3,0.2);run(g3,3);ok(D.y<=31,'D rises with all y='+f(D.y));run(g3,0.8,()=>({x:1}));ok(g3.players.every(p=>p.y<=16&&p.x>=712),'onto block top '+f(P(g3,0).x)+','+f(P(g3,0).y));}
// Flip-flop: two players cross the chain jumping together
{const g=G(13);put(g,0,88,136);put(g,1,76,136);run(g,0.2);const okh=groupHop(g,8);ok(okh&&g.players.every(p=>p.x>=500),'flip chain duo '+g.players.map(p=>f(p.x)).join(',')+' '+g.S.lastCause+' flip '+g.S.flip);
 // section 2: get key via red/blue steps with a single climber
 const g2=G(13,1);put(g2,0,640,136);run(g2,0.2);if(g2.S.flip===0){run(g2,0.6,(p,t)=>({j:t<0.2}));run(g2,0.3)}ok(g2.S.flip===1,'flip=1 before climbing');
 let k=0;while(P(g2,0).x<652&&k++<200)run(g2,1/120,()=>({x:1}));run(g2,0.05);run(g2,0.7,(p,t)=>({x:t<0.25?1:0,j:t<0.3}));run(g2,0.2);ok(P(g2,0).y<=116&&!g2.S.deaths,'on red step '+f(P(g2,0).x)+','+f(P(g2,0).y));
 run(g2,0.7,(p,t)=>({x:t<0.3?1:0,j:t<0.3}));run(g2,0.2);ok(P(g2,0).y<=96,'on blue step '+f(P(g2,0).x)+','+f(P(g2,0).y));
 run(g2,0.8,(p,t)=>({x:1,j:t<0.3}));run(g2,0.3);ok(g2.S.key.carrier===0,'flip key '+f(P(g2,0).x)+','+f(P(g2,0).y));}
// Row together: raft 2 reaches far bank
{const g=G(20);const r=g.S.rafts[1];put(g,0,r.x+12,136);put(g,1,r.x+30,136);run(g,0.2);let t=0;while(r.x<999&&t<40&&!g.S.deaths){let go=true;for(const sd of g.sawDefs){const s=HP.sawPos(g,sd),up=Math.sin(g.S.t*sd.spd)<0,over=s.x>r.x-8&&s.x<r.x+r.w+8,ahead=s.x-(r.x+r.w);if(!over&&ahead>0&&ahead<46&&!(up&&s.y<112))go=false}run(g,1/60,()=>({x:go?1:0}));t+=1/60}ok(r.x>=999&&!g.S.deaths,'raft2 to bank x='+f(r.x)+' '+g.S.lastCause);run(g,1.5,()=>({x:1}));ok(P(g,0).x>1060,'stepped off raft');}
// The peak: duo crosses flips, then drop onto raft
{const g=G(24);g.S.sig.a.latched=true;put(g,0,40,136);put(g,1,25,136);run(g,0.2);run(g,3,(p,t)=>({x:1,j:(t%0.5)<0.3}));ok(g.players.every(p=>p.y<=136-40)&&!g.S.deaths,'peak lever stairs get everyone up '+g.players.map(p=>f(p.x)+','+f(p.y)).join(' '));
 const g2=G(24);const r=g2.S.rafts[0];put(g2,0,1065,66);put(g2,1,1053,66);run(g2,0.2);run(g2,1.2,()=>({x:1}));run(g2,0.5);ok(!g2.S.deaths&&g2.players.every(p=>p.on===r),'dropped onto raft '+g2.players.map(p=>f(p.x)+','+f(p.y)).join(' ')+' '+g2.S.lastCause);}
// The climb: timed plate + crumble run with duo
{const g=G(23);put(g,0,282,126);put(g,1,250,166);run(g,0.3);ok(g.S.sig.c.on,'climb timer on');let k=0;while(k++<720&&!g.players.every(p=>p.x<62)){HP.players;BOT.step(g,p=>({x:-1}))}ok(g.players.every(p=>p.x<62)&&!g.S.deaths&&g.S.sig.c.on,'climb through gate C '+g.players.map(p=>f(p.x)).join(',')+' '+g.S.lastCause+' tmr '+f(g.S.sig.c.tmr));}
console.log('pass',pass,'fail',fail);

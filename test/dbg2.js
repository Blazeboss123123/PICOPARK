const HP=require('../public/game.js');
function G(i,n=2){const g=HP.createGame(i);for(let s=0;s<n;s++)HP.addPlayer(g,s);return g;}
const P=(g,s)=>g.players.find(p=>p.slot===s);
const put=(g,s,x,y)=>{const p=P(g,s);p.x=x;p.y=y;p.vx=p.vy=0;};
function run(g,sec,inp,log){const n=Math.round(sec/HP.STEP);for(let k=0;k<n;k++){g.players.forEach(p=>{const v=inp?inp(p,k*HP.STEP):null;HP.setInput(g,p.slot,v?v.x||0:0,v?!!v.j:false,v?!!v.d:false);});HP.step(g,HP.STEP);HP.clearEdges(g);if(log&&k%log===0)console.log((k*HP.STEP).toFixed(2),JSON.stringify(g.players.map(p=>[+p.x.toFixed(1),+p.y.toFixed(1),+p.vy.toFixed(0),p.grounded])),'flip',g.S.flip,g.fx.map(f=>f[0]).join(','),g.S.cause);g.fx.length=0;}}
console.log('--crush');{const g=G(22);put(g,0,575,136);put(g,1,40,136);run(g,0.5);console.log('plates',g.S.plates,'sig',JSON.stringify(g.S.sig.a),'crush',g.S.crush.map(c=>c.y.toFixed(1)).join(' '),'p0',P(g,0).x,P(g,0).y,P(g,0).dead,g.S.cause);}
console.log('--relay');{const g=G(17);put(g,0,115,136);put(g,1,90,136);run(g,0.6);run(g,0.7,p=>p.slot===0?{j:1,x:-1}:null,10);}
console.log('--flip');{const g=G(13,1);put(g,0,88,136);run(g,0.2);run(g,0.55,(p,t)=>({x:1,j:t<0.3}),8);run(g,0.25,null,10);run(g,0.6,(p,t)=>({x:1,j:t<0.3}),8);}

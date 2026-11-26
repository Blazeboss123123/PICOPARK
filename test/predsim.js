// Emulates the online client's prediction against a server with a round trip delay, and measures what the player would see.
const HP=require('../public/game.js');
function sim(li,n,me,setup,inputOf,seconds,RT){
  const g=HP.createGame(li,n);for(let s=0;s<n;s++)HP.addPlayer(g,s);setup(g);
  const snaps=[];let W=null,mp=null,off={x:0,y:0},maxJump=0,maxErr=0,prevShown=null,step=0;
  const total=Math.round(seconds/HP.STEP);
  for(;step<total;step++){
    g.players.forEach(p=>{const v=p.slot===me?inputOf(step*HP.STEP):{x:0,j:false};HP.setInput(g,p.slot,v.x||0,!!v.j,false)});HP.step(g,HP.STEP);HP.clearEdges(g);g.fx.length=0;
    if(step%4===0)snaps.push({at:step,d:JSON.parse(JSON.stringify({S:g.S,P:g.players.map(p=>({slot:p.slot,x:p.x,y:p.y,vx:p.vx,vy:p.vy,face:p.face,gr:p.grounded,co:p.coyote,bu:p.buffer,cut:p.cut,sq:p.squash,an:p.anim,row:p.row,dead:p.dead,ins:p.inside}))}))});
    // a snapshot arrives RT steps after it was taken; replay my inputs since then
    while(snaps.length&&snaps[0].at+RT<=step){const sn=snaps.shift(),d=sn.d;const w=Object.create(g);w.S=d.S;w.fx=[];w.noWalls=false;w.crateOn=w.S.crates.map(()=>null);
      w.players=d.P.map(q=>({slot:q.slot,x:q.x,y:q.y,w:HP.PW,h:HP.PH,vx:q.vx,vy:q.vy,face:q.face,grounded:q.gr,coyote:q.co,buffer:q.bu,cut:q.cut,squash:q.sq,anim:q.an,row:q.row||0,dead:q.dead?1:0,inside:!!q.ins,on:null,isPlayer:true,input:{x:0,jump:false,jumpP:false,downP:false}}));
      w.players.sort((a,b)=>b.y-a.y).forEach(p=>{if(p.grounded)p.on=HP.supportOf(w,p)});const m=w.players.find(p=>p.slot===me);
      const old=mp?{x:mp.x+off.x,y:mp.y+off.y}:null;
      for(let k=sn.at+1;k<=step;k++){const v=inputOf(k*HP.STEP),pv=inputOf((k-1)*HP.STEP);m.input.x=v.x||0;m.input.jump=!!v.j;m.input.jumpP=!!v.j&&!pv.j;HP.predictStep(w,m,HP.STEP)}
      W=w;mp=m;if(old){off.x=old.x-mp.x;off.y=old.y-mp.y}}
    if(W&&step%4!==0){} // prediction already advanced on arrival
    else if(W){} 
    if(W){const v=inputOf((step+1)*HP.STEP),pv=inputOf(step*HP.STEP);mp.input.x=v.x||0;mp.input.jump=!!v.j;mp.input.jumpP=!!v.j&&!pv.j;HP.predictStep(W,mp,HP.STEP)}
    if(W&&step%2===0){const dec=Math.exp(-1/60*10);off.x*=dec;off.y*=dec;const shown={x:mp.x+off.x,y:mp.y+off.y};
      if(prevShown)maxJump=Math.max(maxJump,Math.hypot(shown.x-prevShown.x,shown.y-prevShown.y));prevShown=shown;
      const sv=g.players.find(p=>p.slot===me);if(process.env.TRACE&&step%6===0)console.log((step*HP.STEP).toFixed(2),'pred',mp.x.toFixed(1),mp.y.toFixed(1),'srv',sv.x.toFixed(1),sv.y.toFixed(1),'crushP',W.S.crush[4]?W.S.crush[4].y.toFixed(1):'',' crushS',g.S.crush[4]?g.S.crush[4].y.toFixed(1):'');if(step>40)maxErr=Math.max(maxErr,Math.hypot(mp.x-sv.x,mp.y-sv.y))}
  }
  const sv=g.players.find(p=>p.slot===me);return {maxJump,maxErr,end:[sv.x,sv.y],deaths:g.S.deaths};
}
module.exports=sim;
if(require.main===module){
  const put=(g,s,x,y)=>{const p=g.players.find(q=>q.slot===s);p.x=x;p.y=y;p.vx=p.vy=0};
  // All aboard: I'm stacked on a friend, riding the lift up (like the screenshot)
  const A=sim(6,5,4,g=>{put(g,0,141,136);put(g,1,152,136);put(g,2,175,136);put(g,3,175,122);put(g,4,152,122)},()=>({x:0}),4,24);
  console.log('stacked on lift: biggest frame-to-frame jump',A.maxJump.toFixed(2),'worst prediction error',A.maxErr.toFixed(2));
  // standing on the lift next to friends, walking right onto the ledge at the top
  const B=sim(6,5,1,g=>{put(g,0,141,136);put(g,1,152,136);put(g,2,163,136);put(g,3,174,136);put(g,4,185,122)},t=>({x:t>3.2?1:0}),4.5,24);
  console.log('walk off at top: biggest jump',B.maxJump.toFixed(2),'worst error',B.maxErr.toFixed(2),'end',B.end.map(v=>v.toFixed(1)).join(','));
  // Crushers: ride the big crusher up (jump on while it rises)
  const C=sim(22,2,0,g=>{put(g,0,688,136);put(g,1,600,136)},t=>({x:t>2.75&&t<3.05?-1:0,j:t>2.72&&t<3.0}),5,24);
  console.log('crusher: biggest jump',C.maxJump.toFixed(2),'worst error',C.maxErr.toFixed(2),'deaths',C.deaths);
}

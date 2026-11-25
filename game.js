const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const titleScreen = document.getElementById('titleScreen');
const selectScreen = document.getElementById('selectScreen');
const gameScreen = document.getElementById('gameScreen');
const resultPanel = document.getElementById('resultPanel');
const roundText = document.getElementById('roundText');
const gameSettingsBtn = document.getElementById('gameSettingsBtn');
const gameSettingsPanel = document.getElementById('gameSettingsPanel');

const chars = {
  swordsman:{name:'검사',role:'근접 돌진형',color:'#ef5350',accent:'#ffffff',hp:1100,speed:330,jump:670,desc:'대각선 베기와 돌진을 이어 붙여 가까운 거리에서 강하게 압박한다.'},
  archer:{name:'궁수',role:'원거리 연사형',color:'#36b86f',accent:'#c9ff52',hp:930,speed:345,jump:680,desc:'화살 연사와 충전 다중사, 맵 전체를 덮는 화살비로 거리를 지배한다.'},
  valkyrie:{name:'발키리',role:'강화 변신형',color:'#7188ff',accent:'#ffe36d',hp:1050,speed:320,jump:700,desc:'도끼를 사용하는 돌진형 전사. 궁극기로 강림하면 일정 시간 모든 기술이 강화된다.'},
  mage:{name:'법사',role:'원소 전환형',color:'#a862e8',accent:'#71e7ff',hp:920,speed:305,jump:655,desc:'불·얼음·전기·땅을 전환하며 상태이상을 걸고 순간이동으로 거리를 조절한다.'}
};
const spriteSheets={};
Object.keys(chars).forEach(id=>{const image=new Image();image.src=`assets/sprites/${id}-combat.png`;spriteSheets[id]=image;});

let selection={p1:'swordsman',p2:'archer',map:0};
let activePlayer='p1';
const keys={};
const blocked=['KeyW','KeyA','KeyD','KeyQ','KeyE','KeyR','KeyF','KeyS','KeyI','KeyJ','KeyL','KeyU','KeyO','KeyP','Semicolon','KeyK','Space'];
addEventListener('keydown',e=>{keys[e.code]=true;if(blocked.includes(e.code))e.preventDefault();});
addEventListener('keyup',e=>{keys[e.code]=false;if(blocked.includes(e.code))e.preventDefault();});

function buildRoster(){
  const el=document.getElementById('characterRoster'); el.innerHTML='';
  Object.entries(chars).forEach(([id,c],index)=>{
    const card=document.createElement('article'); card.className='char-card'; card.dataset.id=id;
    card.tabIndex=0; card.setAttribute('role','group'); card.setAttribute('aria-label',`${c.name}. 좌클릭으로 1P 선택, 우클릭으로 2P 선택`); card.title='좌클릭: 1P 선택 · 우클릭: 2P 선택';
    card.innerHTML=`<div class="char-card-top"><span class="roster-index">0${index+1}</span><span class="char-icon" style="--char-color:${c.color};--char-accent:${c.accent}"><b>${c.name[0]}</b><i></i></span><span class="char-card-arrow">↗</span></div><strong>${c.name}</strong><small>${c.role}</small><div class="char-assign"><button type="button" data-player="p1">1P 선택</button><button type="button" data-player="p2">2P 선택</button></div>`;
    card.onclick=event=>{if(event.target.closest('button'))return;selection.p1=id;activePlayer='p1';updateSelect();};
    card.oncontextmenu=event=>{event.preventDefault();selection.p2=id;activePlayer='p2';updateSelect();};
    card.onkeydown=event=>{if(event.target===card&&(event.key==='Enter'||event.key===' ')){event.preventDefault();selection.p1=id;activePlayer='p1';updateSelect();}};
    card.querySelectorAll('[data-player]').forEach(button=>button.onclick=event=>{event.stopPropagation();selection[button.dataset.player]=id;activePlayer=button.dataset.player;updateSelect();});
    el.appendChild(card);
  });
  for(let index=4;index<8;index++){
    const card=document.createElement('article');
    card.className='char-card unreleased-card';
    card.setAttribute('aria-disabled','true');
    card.innerHTML=`<div class="char-card-top"><span class="roster-index">0${index+1}</span><span class="char-icon unreleased-icon"><b>?</b></span><span class="char-card-arrow">…</span></div><strong>미공개</strong><small>개발 중</small><div class="unreleased-badge">미공개 · 개발 중</div>`;
    el.appendChild(card);
  }
}
function updateSelect(){
  ['p1','p2'].forEach(p=>{
    const id=selection[p],c=chars[id];
    document.getElementById(`${p}NameSelect`).textContent=c.name;
    document.getElementById(`${p}Role`).textContent=c.role;
    document.getElementById(`${p}Desc`).textContent=c.desc;
    const avatar=document.getElementById(`${p}Avatar`);
    avatar.textContent=c.name[0];avatar.style.setProperty('--avatar-color',c.color);avatar.style.setProperty('--avatar-accent',c.accent);
    document.getElementById(`${p}Preview`).classList.toggle('active-player',activePlayer===p);
    document.querySelectorAll(`#characterRoster .char-card`).forEach(card=>{
      card.classList.toggle(`${p}-selected`,card.dataset.id===id);
      card.querySelector(`[data-player="${p}"]`)?.classList.toggle('assigned',card.dataset.id===id);
    });
  });
}
const combatFrameWidth=208,combatFrameHeight=164;
const combatOriginX=94,combatOriginY=108;
const spellArt=new Image();
spellArt.src='assets/sprites/mage-spells.png';
const combatArt=new Image();
combatArt.src='assets/sprites/combat-effects.png';
const goddessArt=new Image();
goddessArt.src='assets/sprites/valkyrie-goddess.png';
const actionRows={basic:0,s1:1,s2:2,release:2,ult:3,dodge:4};
const neutralRows={swordsman:5,valkyrie:10,mage:20,archer:13};
// The timestamps mark pose changes, including contact and projectile release.
const actionFrames={
  swordsman:{
    basic:[0,36,72,116,165,215],s1:[0,46,96,145,200,260],
    s2:[0,35,72,143,222,278],ult:[0,55,130,196,260,330],
    dodge:[0,35,73,115,168,220]
  },
  valkyrie:{
    basic:[0,36,72,120,175,225],s1:[0,55,110,170,240,320],
    ult:[0,140,300,420,570,730],dodge:[0,30,65,105,160,220]
  },
  archer:{
    basic:[0,30,62,105,155,200],s1:[0,45,105,150,210,255],
    release:[0,23,48,100,151,207],ult:[0,75,145,205,350,465],
    dodge:[0,35,75,115,172,230]
  },
  mage:{
    basic:[0,28,60,95,150,200],s1:[0,35,70,115,165,216],
    s2:[0,32,75,130,195,265],ult:[0,55,110,165,220,275],
    dodge:[0,32,65,100,140,185]
  }
};
function chargedArrowCount(elapsed){
  return Math.min(8,Math.max(1,Math.floor(elapsed/340)+1));
}
function frameAt(timestamps,elapsed){
  let frame=0;
  while(frame+1<timestamps.length&&elapsed>=timestamps[frame+1])frame++;
  return frame;
}
function spritePose(f,now){
  const awakened=f.id==='valkyrie'&&now<f.awakenedUntil&&now>=f.awakenedFrom;
  const elapsed=now-f.spriteActionStart;
  const action=now<f.spriteActionUntil?f.spriteAction:'';
  if(f.id==='valkyrie'&&now<f.spinningUntil){
    return [2+(awakened?5:0),Math.floor(elapsed/(awakened?60:72))%6];
  }
  if(f.charging)return [4+chargedArrowCount(now-f.chargeStart),0];
  const timestamps=actionFrames[f.id][action];
  if(timestamps){
    const element=f.id==='mage'?f.element:0;
    const row=actionRows[action]+element*5+(awakened?5:0);
    const earthCast=f.id==='mage'&&action==='s2'&&f.element===3;
    const frame=earthCast&&elapsed>=595&&elapsed<645?3:frameAt(timestamps,elapsed);
    return [row,frame];
  }
  const idle=neutralRows[f.id]+(f.id==='mage'?f.element*4:awakened?4:0);
  if(!f.onGround)return [idle+2,f.vy<-430?0:f.vy<-200?1:f.vy<-45?2:f.vy<100?3:f.vy<280?4:5];
  if(now<f.landUntil)return [idle+3,Math.min(5,Math.floor((now-f.landUntil+135)/23))];
  if(Math.abs(f.vx)>55)return [idle+1,Math.floor(f.stepDistance/(76/6))%6];
  return [idle,Math.floor(now/180)%6];
}
function drawSpriteCharacter(f,now){
  const sheet=spriteSheets[f.id];
  if(!sheet?.complete||!sheet.naturalWidth)return false;
  const [row,frame]=spritePose(f,now);
  ctx.drawImage(sheet,frame*combatFrameWidth,row*combatFrameHeight,
    combatFrameWidth,combatFrameHeight,-combatOriginX,f.h/2-combatOriginY,combatFrameWidth,combatFrameHeight);
  return true;
}
document.querySelectorAll('.fighter-preview').forEach(panel=>panel.onclick=()=>{activePlayer=panel.id==='p1Preview'?'p1':'p2';updateSelect();});
buildRoster();updateSelect();
document.getElementById('daidaiBtn').onclick=()=>{
  titleScreen.classList.remove('active');
  titleScreen.hidden=true;
  selectScreen.hidden=false;
  selectScreen.classList.add('active');
};
function returnToTitle(){
  running=false;
  titleScreen.hidden=false;
  titleScreen.classList.add('active');
  selectScreen.classList.remove('active');
  selectScreen.hidden=true;
  gameScreen.classList.remove('active');
  gameScreen.hidden=true;
  resultPanel.classList.add('hidden');
  gameSettingsPanel.hidden=true;
  gameSettingsBtn.setAttribute('aria-expanded','false');
}
document.getElementById('selectTitleBtn').onclick=returnToTitle;
gameSettingsBtn.onclick=()=>{
  gameSettingsPanel.hidden=!gameSettingsPanel.hidden;
  gameSettingsBtn.setAttribute('aria-expanded',String(!gameSettingsPanel.hidden));
};
document.getElementById('titleFromGameBtn').onclick=returnToTitle;
document.querySelectorAll('.map-btn').forEach(b=>b.onclick=()=>{selection.map=+b.dataset.map;document.querySelectorAll('.map-btn').forEach(x=>x.classList.toggle('active',x===b));});
document.getElementById('startBtn').onclick=startGame;
document.getElementById('rematchBtn').onclick=startGame;
document.getElementById('selectBtn').onclick=()=>{running=false;gameScreen.classList.remove('active');gameScreen.hidden=true;selectScreen.hidden=false;selectScreen.classList.add('active');};

const maps=[
  [[0,610,190,40],[1020,610,180,40],[250,535,260,30],[690,530,280,30],[25,385,170,30],[1000,370,170,30],[350,420,170,28],[720,420,160,28],[260,300,110,24],[820,300,110,24],[360,205,480,20]],
  [[0,610,250,40],[950,610,250,40],[300,535,220,28],[680,535,220,28],[110,440,220,26],[870,440,220,26],[455,390,290,26],[230,285,150,24],[820,285,150,24],[490,190,220,24]]
];
let fighters=[],projectiles=[],effects=[],platforms=[],running=false,last=0,winner=null;

class Fighter{
  constructor(player,id,x){
    const c=chars[id];
    Object.assign(this,{player,id,c,x,y:310,w:46,h:56,vx:0,vy:0,hp:c.hp,maxHp:c.hp,ult:0,facing:player===1?1:-1,onGround:false,inv:0,dodgeInv:0,hurtInv:0,lock:0,dead:false});
    this.cd={basic:0,s1:0,s2:0,ult:0,dodge:0};
    this.prev={}; this.burnUntil=0; this.nextBurn=0; this.slowUntil=0; this.stunUntil=0; this.defDownUntil=0;
    this.spriteAction='';this.spriteActionStart=0;this.spriteActionUntil=0;
    this.stepDistance=0;this.landUntil=0;
    this.awakenedUntil=0; this.awakenedFrom=0; this.element=0; this.chargeStart=0; this.charging=false; this.spinningUntil=0;
    this.bind=player===1?{left:'KeyA',right:'KeyD',jump:'KeyW',basic:'KeyQ',s1:'KeyE',s2:'KeyR',ult:'KeyF',dodge:'KeyS'}:{left:'KeyJ',right:'KeyL',jump:'KeyI',basic:'KeyU',s1:'KeyO',s2:'KeyP',ult:'Semicolon',dodge:'KeyK'};
  }
  down(name){return !!keys[this.bind[name]]}
  pressed(name){const c=this.bind[name];return !!keys[c]&&!this.prev[c]}
  released(name){const c=this.bind[name];return !keys[c]&&!!this.prev[c]}
  snapshot(){Object.values(this.bind).forEach(c=>this.prev[c]=!!keys[c]);}
  update(dt,now){
    if(this.dead)return;
    if(this.burnUntil>now&&now>=this.nextBurn){this.nextBurn=now+350;this.takeRaw(12);effects.push({type:'burst',x:this.x+23,y:this.y+20,color:'#ff6d3a',t:0,life:.18});}
    const stunned=now<this.stunUntil;

    // 궁수 2스킬 충전은 일반 행동 잠금(lock)과 별개로 계속 입력을 확인한다.
    // P/R을 누르고 있는 동안만 충전하고, 키를 떼는 순간에만 다중사를 발사한다.
    if(this.id==='archer'&&this.charging){
      // 다중사 충전 중에도 발키리 2스킬과 같은 비율(평소 이동속도의 42%)로 좌우 이동할 수 있다.
      // 충전 중에는 점프/다른 공격은 막고, 이동과 방향 전환만 허용한다.
      if(!stunned){
        const chargeSpeed=this.c.speed*(now<this.slowUntil?.62:1)*0.42;
        const chargeMove=(this.down('right')?1:0)-(this.down('left')?1:0);
        if(chargeMove){this.vx=chargeMove*chargeSpeed;this.facing=chargeMove}
        else this.vx*=0.72;
      }else this.vx*=0.55;
      if(this.released('s2'))this.releaseArcherCharge(now);
    }

    const spinning=this.id==='valkyrie'&&now<this.spinningUntil;
    if(!stunned&&spinning){
      // 도끼 돌리기 중에는 공격/점프 대신 평소보다 느린 속도로 좌우 이동만 가능하다.
      const spinSpeed=this.c.speed*(now<this.slowUntil?.62:1)*0.42;
      const m=(this.down('right')?1:0)-(this.down('left')?1:0);
      if(m){this.vx=m*spinSpeed;this.facing=m}else this.vx*=0.72;
    } else if(!stunned&&now>this.lock){
      const speed=this.c.speed*(now<this.slowUntil?.62:1);
      let m=(this.down('right')?1:0)-(this.down('left')?1:0);
      if(m&&!this.charging){this.vx=m*speed;this.facing=m}else if(!this.charging)this.vx*=0.72;
      if(this.pressed('jump')&&this.onGround&&!this.charging){this.vy=-this.c.jump;this.onGround=false;}

      // 궁수 2스킬은 누르는 동안 충전, 떼는 순간 발사
      if(this.id==='archer'){
        if(this.pressed('s2')&&now>=this.cd.s2&&!this.charging){
          this.charging=true;
          this.chargeStart=now;
          this.vx*=0.45;
        }
      } else if(this.pressed('s2')) this.attack('s2',now);

      if(!this.charging){
        if(this.pressed('basic'))this.attack('basic',now);
        if(this.pressed('s1'))this.attack('s1',now);
        if(this.pressed('ult'))this.attack('ult',now);
        if(this.pressed('dodge'))this.dodge(now);
      }
    }
    const wasGrounded=this.onGround, previousX=this.x;
    this.vy+=1750*dt;this.x+=this.vx*dt;this.y+=this.vy*dt;this.x=Math.max(10,Math.min(canvas.width-this.w-10,this.x));this.collide();
    if(this.onGround&&!wasGrounded){
      this.landUntil=now+135;
      this.stepDistance=0;
      effects.push({type:'footDust',x:this.x+this.w/2,y:this.y+this.h-5,t:0,life:.23,layer:'back'});
    }else if(this.onGround&&Math.abs(this.vx)>55){
      this.stepDistance=(this.stepDistance+Math.abs(this.x-previousX))%76;
    }else{
      this.stepDistance=0;
    }
    // 공허에 떨어지면 즉사하지 않고 최대 HP의 1/5을 잃은 뒤 다시 위로 튀어 오른다.
    if(this.y>canvas.height+45)this.bounceFromVoid(now);
    this.snapshot();
  }
  bounceFromVoid(now){
    const damage=Math.ceil(this.maxHp/5);
    this.hp=Math.max(0,this.hp-damage);
    if(this.hp<=0){
      this.dead=true;
      endGame(other(this));
      return;
    }

    // 화면 하단에서 다시 등장해, 탄도상 최소 화면 높이의 2/3 이상 올라가도록 속도를 준다.
    const gravity=1750;
    const minRise=canvas.height*(2/3);
    const bounceSpeed=Math.sqrt(2*gravity*minRise)*1.08;
    this.y=canvas.height-this.h-6;
    this.vy=-bounceSpeed;
    this.vx*=0.35;
    this.onGround=false;
    this.lock=Math.max(this.lock,now+120);

    effects.push({type:'burst',x:this.x+this.w/2,y:canvas.height-8,color:'#ffffff',t:0,life:.28});
  }
  releaseArcherCharge(now){
    const count=chargedArrowCount(now-this.chargeStart);
    this.charging=false;this.lock=now+220;this.cd.s2=now+3400;this.ult=Math.min(100,this.ult+6);
    this.spriteAction='release';this.spriteActionStart=now;this.spriteActionUntil=now+340;
    afterPose(this,48,()=>fireMultiShot(this,count));
  }
  collide(){
    this.onGround=false;const oldBottom=this.y+this.h-this.vy/60;
    for(const p of platforms){const[x,y,w,h]=p;if(this.vy>=0&&this.x+this.w>x&&this.x<x+w&&this.y+this.h>=y&&oldBottom<=y+8){this.y=y-this.h;this.vy=0;this.onGround=true;}}
  }
  attack(type,now){
    const base={basic:360,s1:1800,s2:3000,ult:8500}[type]; if(now<this.cd[type])return;if(type==='ult'&&this.ult<100)return;
    // 법사의 1스킬은 속성 전환이며 짧은 쿨타임
    const cd=this.id==='mage'&&type==='s1'?550:base;
    this.cd[type]=now+cd;this.lock=now+(type==='ult'?420:120);
    this.spriteAction=type;this.spriteActionStart=now;this.spriteActionUntil=now+({basic:265,s1:this.id==='mage'?265:390,s2:340,ult:980}[type]);
    if(this.id==='mage'&&type==='s2'&&this.element===3)this.spriteActionUntil=now+680;
    if(type==='ult')this.ult=0;else if(!(this.id==='mage'&&type==='s1'))this.ult=Math.min(100,this.ult+(type==='basic'?3:6));
    performAttack(this,type,now);
  }
  dodge(now){
    if(now<this.cd.dodge)return;this.cd.dodge=now+2100;this.lock=now+170;
    this.spriteAction='dodge';this.spriteActionStart=now;this.spriteActionUntil=now+300;
    const dir=this.down('left')?-1:this.down('right')?1:this.facing;
    this.facing=dir;
    if(this.id==='mage'){
      this.dodgeInv=now+250;this.inv=this.dodgeInv;
      effects.push({type:'teleport',x:this.x+23,y:this.y+23,element:this.element,t:0,life:.25});
      this.x=Math.max(10,Math.min(canvas.width-this.w-10,this.x+dir*190));
      effects.push({type:'teleport',x:this.x+23,y:this.y+23,element:this.element,t:0,life:.28});
      return;
    }
    this.dodgeInv=now+300;this.inv=this.dodgeInv;this.vx=dir*(this.id==='valkyrie'?760:690);
    dashWind(this,dir,.25,this.id==='valkyrie'&&now>=this.awakenedFrom&&now<this.awakenedUntil);
    if(this.id==='valkyrie'){
      const target=other(this);const awakened=now>=this.awakenedFrom&&now<this.awakenedUntil;
      setTimeout(()=>{if(running&&distance(this,target)<75){target.hit(awakened?72:45,dir*520,-120,this,{stun:awakened?520:0});}},85);
    }
  }
  takeRaw(dmg){this.hp=Math.max(0,this.hp-dmg);if(this.hp<=0&&!this.dead){this.dead=true;endGame(other(this));}}
  hit(dmg,kx,ky,src,status={}){
    const now=performance.now();
    // 회피기의 '진짜 무적'과 피격 직후의 짧은 중복피격 방지 시간을 분리한다.
    // 궁수 2스킬 다중사는 한 번에 여러 화살을 쏘는 기술이므로, 각 화살은 피격 무적만 무시하고
    // 회피 무적은 그대로 존중한다. 따라서 실제로 명중한 화살 수만큼 31 데미지가 각각 들어간다.
    if(this.dead||now<this.dodgeInv||(!status.ignoreHurtInv&&now<this.hurtInv))return false;
    const final=Math.round(dmg*(now<this.defDownUntil?1.23:1));
    this.hp=Math.max(0,this.hp-final);this.vx=kx;this.vy=ky;this.lock=now+210;
    this.hurtInv=now+95;this.inv=Math.max(this.dodgeInv,this.hurtInv);
    if(status.burn){this.burnUntil=Math.max(this.burnUntil,now+status.burn);this.nextBurn=now+250;}
    if(status.slow)this.slowUntil=Math.max(this.slowUntil,now+status.slow);
    if(status.stun)this.stunUntil=Math.max(this.stunUntil,now+status.stun);
    if(status.defDown)this.defDownUntil=Math.max(this.defDownUntil,now+status.defDown);
    this.ult=Math.min(100,this.ult+Math.max(7,final*.04));src.ult=Math.min(100,src.ult+Math.max(5,final*.03));
    effects.push({type:'burst',x:this.x+23,y:this.y+25,color:src.id==='mage'?elementColor(src.element):src.c.accent,t:0,life:.25});
    if(this.hp<=0){this.dead=true;endGame(src);}
    return true;
  }
  draw(now){
    const awakened=this.id==='valkyrie'&&now>=this.awakenedFrom&&now<this.awakenedUntil;
    ctx.save();ctx.globalAlpha=now<this.inv&&Math.floor(now/70)%2===0?.35:1;ctx.translate(this.x+this.w/2,this.y+this.h/2);ctx.scale(this.facing,1);
    if(awakened){ctx.shadowColor='#ffe45c';ctx.shadowBlur=24;}
    if(!drawSpriteCharacter(this,now)){
    ctx.fillStyle=awakened?'#ffd94f':this.c.color;ctx.beginPath();ctx.arc(0,-9,19,0,Math.PI*2);ctx.fill();ctx.fillRect(-15,8,30,24);ctx.shadowBlur=0;
    ctx.fillStyle='#07131b';ctx.fillRect(-9,-15,5,5);
    const weapon=awakened?'#ffe75e':(this.id==='mage'?elementColor(this.element):this.c.accent);ctx.strokeStyle=weapon;ctx.lineWidth=awakened?8:6;ctx.lineCap='round';
    if(this.id==='swordsman'){ctx.beginPath();ctx.moveTo(13,3);ctx.lineTo(47,-27);ctx.stroke();}
    else if(this.id==='archer'){ctx.beginPath();ctx.arc(27,0,18,-1.3,1.3);ctx.stroke();ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(31,-17);ctx.lineTo(31,17);ctx.stroke();}
    else if(this.id==='valkyrie'){ctx.beginPath();ctx.moveTo(8,2);ctx.lineTo(53,2);ctx.stroke();ctx.fillStyle=weapon;ctx.beginPath();ctx.moveTo(50,-13);ctx.lineTo(66,2);ctx.lineTo(50,17);ctx.closePath();ctx.fill();}
    else{ctx.beginPath();ctx.moveTo(10,5);ctx.lineTo(43,-8);ctx.stroke();ctx.fillStyle=weapon;ctx.beginPath();ctx.arc(45,-9,9,0,Math.PI*2);ctx.fill();}
    }
    ctx.restore();
    if(this.id==='archer'&&this.charging){
      const count=chargedArrowCount(now-this.chargeStart);
      const label=`장전 ${count}/8`;
      ctx.font='bold 12px "Noto Sans KR",Arial,sans-serif';ctx.textAlign='center';
      const labelWidth=ctx.measureText(label).width+12,labelX=this.x+this.w/2-labelWidth/2,labelY=this.y-76;
      ctx.fillStyle='rgba(7,19,27,.9)';roundRect(labelX,labelY,labelWidth,19,6);ctx.fill();
      ctx.fillStyle='#dfff62';ctx.fillText(label,this.x+this.w/2,labelY+13);
    }
    ctx.font='bold 16px Arial';ctx.textAlign='center';ctx.fillStyle=this.player===1?'#e40000':'#1537e6';ctx.fillText(`${this.player}P`,this.x+this.w/2,this.y-42);
    if(this.id==='mage'){ctx.font='bold 11px Arial';ctx.fillStyle=elementColor(this.element);ctx.fillText(['불','얼음','전기','땅'][this.element],this.x+23,this.y-59);}
    if(awakened){ctx.font='bold 11px Arial';ctx.fillStyle='#ffe45c';ctx.fillText('강림',this.x+23,this.y-59);}
  }
}

function other(u){return u===fighters[0]?fighters[1]:fighters[0]}
function distance(a,b){return Math.hypot((a.x+a.w/2)-(b.x+b.w/2),(a.y+a.h/2)-(b.y+b.h/2))}
function elementColor(e){return ['#ff6a3d','#70d8ff','#ffe655','#a9784d'][e]}

function afterPose(fighter,delay,callback){
  setTimeout(()=>{
    if(running&&!fighter.dead&&fighters.includes(fighter))callback();
  },delay);
}

function dashWind(fighter,dir,life,big=false){
  effects.push({type:'dashWind',owner:fighter,dir,big,t:0,life,layer:'back'});
}

function performAttack(u,type,now){const t=other(u),d=u.facing;
  if(u.id==='swordsman'){
    if(type==='basic')afterPose(u,72,()=>{effects.push({type:'diagSlash',x:u.x+u.w/2+d*45,y:u.y+20,color:'#fff',t:0,life:.2,dir:d});melee(u,t,64,76,58,70,420,-150);});
    if(type==='s1'){u.vx=d*760;dashWind(u,d,.23);setTimeout(()=>{if(running){effects.push({type:'swordCSlash',x:u.x+u.w/2+d*67,y:u.y+25,color:'#fff',t:0,life:.22,dir:d});melee(u,t,82,96,45,130,650,-180);}},145);}
    if(type==='s2'){
      // X자 베기는 캐릭터 바로 앞보다 한 걸음 더 먼 지점을 베도록 판정을 전방으로 이동.
      for(const [delay,stroke,damage,kx,ky] of [[72,1,58,300,-90],[222,-1,72,430,-190]]){
        afterPose(u,delay,()=>{
          effects.push({type:'diagSlash',x:u.x+u.w/2+d*92,y:u.y+25,color:'#fff',t:0,life:.24,dir:d*stroke});
          melee(u,t,104,74,72,damage,kx,ky);
        });
      }
    }
    if(type==='ult'){
      flash('#eefcff');u.vx=d*820;dashWind(u,d,.26);
      afterPose(u,130,()=>{
        effects.push({type:'thrust',x:u.x+u.w/2+d*72,y:u.y+22,color:'#ffffff',t:0,life:.23,dir:d});
        melee(u,t,90,110,48,120,300,-80);
      });
      afterPose(u,260,()=>{
        effects.push({type:'upslash',x:u.x+u.w/2+d*55,y:u.y+5,color:'#d8f7ff',t:0,life:.3,dir:d});
        melee(u,t,75,90,95,175,520,-650);
      });
    }
  }else if(u.id==='archer'){
    if(type==='basic')afterPose(u,62,()=>arrowShot(u,62,900,0));
    if(type==='s1')[0,1,2].forEach(i=>afterPose(u,45+i*105,()=>arrowShot(u,47,980,(i-1)*.025)));
    if(type==='ult'){flash('#c9ff52');afterPose(u,205,()=>effects.push({type:'bowVolley',x:u.x+23,y:u.y,color:'#ffeabb',t:0,life:.45}));const rainCount=56;for(let i=0;i<rainCount;i++){setTimeout(()=>{if(!running)return;projectiles.push({kind:'arrow',x:20+(i%(rainCount/2))*(1160/((rainCount/2)-1))+((Math.floor(i/(rainCount/2))%2)*10),y:-30-Math.random()*180,vx:(Math.random()-.5)*35,vy:720+Math.random()*170,w:5,h:26,color:'#eaffc9',owner:u,target:t,dmg:34,kx:(Math.random()-.5)*220,ky:140,life:2.0});},520+i*18);}}
  }else if(u.id==='valkyrie'){
    const aw=now>=u.awakenedFrom&&now<u.awakenedUntil;
    if(type==='basic')afterPose(u,72,()=>{effects.push({type:'axeArc',x:u.x+u.w/2+d*46,y:u.y+20,color:aw?'#ffe24c':'#f2f6ff',t:0,life:aw?.3:.22,dir:d,big:aw});melee(u,t,70,82,64,aw?105:76,aw?520:410,aw?-230:-160);});
    if(type==='s1'){u.vx=d*(aw?890:760);dashWind(u,d,.25,aw);setTimeout(()=>{if(!running)return;u.vx*=.2;effects.push({type:'slam',x:u.x+u.w/2+d*28,y:u.y+u.h,big:aw,color:aw?'#ffe24c':'#e9edf5',t:0,life:.34});melee(u,t,68,92,90,aw?170:125,aw?700:580,aw?-320:-230);},170);}
    if(type==='s2'){
      // 기존보다 살짝 더 오래 유지되고, 공격/시각 반경도 조금 넓어진다.
      // 도끼 돌리기 지속시간을 더 늘렸다. 타격 간격이 지나치게 벌어지지 않도록
      // 지속시간 증가 비율에 맞춰 타격 횟수도 함께 조정한다.
      const dur=aw?1850:1250;
      u.lock=now+dur;
      u.spinningUntil=now+dur;
      const hits=aw?9:5;
      // 기본 타원은 50% 투명도. 타원 둘레의 정확히 20% 길이를 차지하는
      // 밝은 곡선이 시계 방향으로 빠르게 돌며, 윗부분/아랫부분은 각각
      // 캐릭터 뒤/앞 레이어에 그려져 입체적으로 몸을 감싸는 것처럼 보인다.
      effects.push({type:'axeSpinHalf',owner:u,half:'top',layer:'back',color:aw?'#ffe24c':'#f6eedc',t:0,life:dur/1000,r:aw?100:82,big:aw});
      effects.push({type:'axeSpinHalf',owner:u,half:'bottom',layer:'front',color:aw?'#ffe24c':'#f6eedc',t:0,life:dur/1000,r:aw?100:82,big:aw});
      for(let i=0;i<hits;i++)setTimeout(()=>{
        if(!running)return;
        radial(u,t,aw?96:78,aw?42:35,250,-100);
      },i*(dur/hits));
    }
    if(type==='ult'){u.awakenedFrom=now+420;u.awakenedUntil=u.awakenedFrom+10500;u.lock=now+900;effects.push({type:'goddess',owner:u,color:'#ffe86a',t:0,life:1.05});afterPose(u,420,()=>effects.push({type:'blessing',x:u.x+23,y:u.y+25,color:'#ffe86a',t:0,life:.65}));}
  }else if(u.id==='mage'){
    if(type==='basic'){const element=u.element;afterPose(u,60,()=>magicShot(u,48,720,element));}
    if(type==='s1'){u.element=(u.element+1)%4;effects.push({type:'elementSwitch',x:u.x+23,y:u.y+20,element:u.element,color:elementColor(u.element),t:0,life:.45});u.lock=now+100;}
    if(type==='s2'){const element=u.element;afterPose(u,75,()=>elementSpell(u,t,element));}
    if(type==='ult'){flash('#f3f2ff');const cols=['#ff6a3d','#70d8ff','#ffe655','#a9784d'];for(let i=0;i<16;i++)setTimeout(()=>{if(!running)return;const e=i%4;projectiles.push({kind:'orb',element:e,x:u.x+23,y:u.y+18,vx:u.facing*(420+Math.random()*250),vy:(Math.random()-.5)*520,r:10,color:cols[e],owner:u,target:t,dmg:36,kx:u.facing*260,ky:-180,life:1.7,status:elementStatus(e)});},110+i*55);effects.push({type:'elementStorm',x:u.x+23,y:u.y+20,color:'#ffffff',t:0,life:1.25});}
  }
}

function melee(u,t,off,w,h,dmg,kx,ky){const cx=u.x+u.w/2+u.facing*off,cy=u.y+u.h/2;if(Math.abs(t.x+t.w/2-cx)<w&&Math.abs(t.y+t.h/2-cy)<h)t.hit(dmg,u.facing*kx,ky,u);}
function radial(u,t,r,dmg,kx,ky){const dx=(t.x+t.w/2)-(u.x+u.w/2),dy=(t.y+t.h/2)-(u.y+u.h/2);if(Math.hypot(dx,dy)<r)t.hit(dmg,Math.sign(dx||1)*kx,ky,u);}
function arrowShot(u,dmg,speed,angle=0){projectiles.push({kind:'arrow',x:u.x+u.w/2+u.facing*35,y:u.y+20,vx:u.facing*speed,vy:Math.sin(angle)*speed,w:22,h:5,color:'#f4f1df',owner:u,target:other(u),dmg,kx:u.facing*260,ky:-70,life:1.8});}
function fireMultiShot(u,count){for(let i=0;i<count;i++){const spread=(i-(count-1)/2)*.035;projectiles.push({kind:'arrow',x:u.x+u.w/2+u.facing*35,y:u.y+20+i*.7,vx:u.facing*(840-Math.abs(spread)*300),vy:spread*800,w:22,h:5,color:'#f5ffe3',owner:u,target:other(u),dmg:31,kx:u.facing*180,ky:-55,life:1.8,status:{ignoreHurtInv:true}});}effects.push({type:'multiShot',x:u.x+23+u.facing*40,y:u.y+20,color:'#c9ff52',t:0,life:.35,dir:u.facing});}
function magicShot(u,dmg,speed,e){projectiles.push({kind:'mageBasic',element:e,x:u.x+23+u.facing*34,y:u.y+19,vx:u.facing*speed,vy:0,r:9,color:elementColor(e),owner:u,target:other(u),dmg,kx:u.facing*230,ky:-95,life:1.8,status:elementStatus(e)});}
function elementStatus(e){return e===0?{burn:2200}:e===1?{slow:1800}:e===2?{stun:330}:{defDown:2600};}
function elementSpell(u,t,e){
  if(e===0){projectiles.push({kind:'fireball',x:u.x+23+u.facing*35,y:u.y+22,vx:u.facing*560,vy:0,r:18,color:'#ff6335',owner:u,target:t,dmg:92,kx:u.facing*390,ky:-160,life:1.8,status:{burn:3000},explode:90});}
  if(e===1){for(let i=-1;i<=1;i++)projectiles.push({kind:'ice',x:u.x+23+u.facing*30,y:u.y+20+i*10,vx:u.facing*(600-Math.abs(i)*60),vy:i*55,w:25,h:8,color:'#78dcff',owner:u,target:t,dmg:38,kx:u.facing*220,ky:-80,life:1.7,status:{slow:2800}});}
  if(e===2){const dx=Math.abs((t.x+t.w/2)-(u.x+23));if(dx<420){t.hit(115,Math.sign(t.x-u.x)*260,-180,u,{stun:650});effects.push({type:'lightning',x1:u.x+23,y1:u.y+15,x2:t.x+23,y2:t.y+15,color:'#fff04d',t:0,life:.28});}else effects.push({type:'lightning',x1:u.x+23,y1:u.y+15,
    x2:u.x+23+u.facing*135,y2:u.y+15,color:'#fff04d',t:0,life:.25});}
  if(e===3){
    // 상대 발밑 지면을 먼저 붉게 예고한 뒤, 그 위치에서 땅 가시가 솟는다.
    const targetX=t.x+t.w/2;
    const groundY=findGroundBelow(t,targetX);
    effects.push({type:'earthWarning',x:targetX,y:groundY,color:'#ff2f2f',t:0,life:.52,r:72});
    setTimeout(()=>{
      if(!running)return;
      effects.push({type:'earthSpike',x:targetX,y:groundY,color:'#a9784d',t:0,life:.48});
      const tx=t.x+t.w/2,foot=t.y+t.h;
      if(Math.abs(tx-targetX)<82&&Math.abs(foot-groundY)<155){
        t.hit(125,Math.sign(tx-u.x||u.facing)*420,-420,u,{defDown:3800});
      }
    },520);
  }
}
function findGroundBelow(target,x){
  const foot=target.y+target.h;
  let best=null;
  for(const p of platforms){
    const[px,py,pw]=p;
    if(x>=px-8&&x<=px+pw+8&&py>=foot-10){
      if(best===null||py<best)best=py;
    }
  }
  // 점프 중이거나 발밑에 발판이 없는 경우에는 현재 발 위치에 예고해
  // 공격이 고정된 허공 좌표에서 생기는 문제를 막는다.
  return best??Math.min(canvas.height-24,foot+8);
}
function flash(color){effects.push({type:'flash',color,t:0,life:.18});}

function startGame(){
  selectScreen.classList.remove('active');selectScreen.hidden=true;gameScreen.hidden=false;gameScreen.classList.add('active');resultPanel.classList.add('hidden');winner=null;
  platforms=maps[selection.map].map(x=>[...x]);projectiles=[];effects=[];fighters=[new Fighter(1,selection.p1,300),new Fighter(2,selection.p2,860)];running=true;last=performance.now();
  document.getElementById('p1Name').textContent=chars[selection.p1].name;document.getElementById('p2Name').textContent=chars[selection.p2].name;
  roundText.classList.remove('hidden');roundText.style.animation='none';void roundText.offsetWidth;roundText.style.animation='fight .8s forwards';setTimeout(()=>roundText.classList.add('hidden'),820);requestAnimationFrame(loop);
}
function endGame(w){if(!running)return;running=false;winner=w;document.getElementById('winnerText').textContent=`${w.player}P WIN!`;document.getElementById('winnerText').style.color=w.c.accent;document.getElementById('winnerSub').textContent=`${w.c.name} 승리`;resultPanel.classList.remove('hidden');}
function loop(now){if(!running){draw(now);updateHud(now);return}const dt=Math.min(.025,(now-last)/1000);last=now;fighters.forEach(f=>f.update(dt,now));updateProjectiles(dt);effects.forEach(e=>e.t+=dt);effects=effects.filter(e=>e.t<e.life);draw(now);updateHud(now);requestAnimationFrame(loop);}

function updateProjectiles(dt){
  for(const p of projectiles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;const t=p.target;
    let hit=false;if(t&&!t.dead){if(p.r)hit=p.x+p.r>t.x&&p.x-p.r<t.x+t.w&&p.y+p.r>t.y&&p.y-p.r<t.y+t.h;else hit=p.x+p.w/2>t.x&&p.x-p.w/2<t.x+t.w&&p.y+p.h/2>t.y&&p.y-p.h/2<t.y+t.h;}
    if(hit){t.hit(p.dmg,p.kx,p.ky,p.owner,p.status||{});effects.push({type:'burst',x:p.x,y:p.y,color:p.color,t:0,life:.2});if(p.explode)radialPoint(p.x,p.y,p.owner,t,p.explode,55,p.status||{});p.life=0;}
  }
  projectiles=projectiles.filter(p=>p.life>0&&p.x>-100&&p.x<1300&&p.y>-250&&p.y<760);
}
function radialPoint(x,y,u,t,r,dmg,status={}){const dx=t.x+t.w/2-x,dy=t.y+t.h/2-y;if(Math.hypot(dx,dy)<r)t.hit(dmg,Math.sign(dx||1)*320,-240,u,status);effects.push({type:'ring',x,y,color:u.id==='mage'?elementColor(u.element):u.c.accent,t:0,life:.25,r});}

function draw(now){drawBackground();drawPlatforms();drawProjectiles();drawEffects('back');fighters.forEach(f=>f.draw(now));drawEffects('front');}
function drawSpellArt(row,frame,x,y,width,height){
  if(!spellArt.complete||!spellArt.naturalWidth)return;
  ctx.drawImage(spellArt,frame*192,row*120,192,120,x,y,width,height);
}

function drawCombatArt(row,frame,x,y,width,height){
  if(!combatArt.complete||!combatArt.naturalWidth)return;
  ctx.drawImage(combatArt,frame*224,row*160,224,160,x-width/2,y-height/2,width,height);
}
function drawProjectiles(){
  for(const p of projectiles){
    ctx.save();
    ctx.translate(p.x,p.y);
    ctx.rotate(Math.atan2(p.vy,p.vx));
    const frame=Math.max(0,Math.floor((2-p.life)*19))%6;
    if(p.kind==='arrow'){
      drawCombatArt(15,0,0,0,p.h>p.w?91:107,78);
    }else if(p.kind==='fireball'){
      drawSpellArt(0,frame,-75,-35,96,70);
    }else if(p.kind==='ice'){
      drawSpellArt(1,frame,-42,-22,66,44);
    }else{
      const scale=p.kind==='orb'?1.15:1;
      drawCombatArt(18+p.element,frame,-5,0,112*scale,80*scale);
    }
    ctx.restore();
  }
}
function drawBackground(){const g=ctx.createLinearGradient(0,0,0,650);if(selection.map===0){g.addColorStop(0,'#baf8fb');g.addColorStop(1,'#48c4cf')}else{g.addColorStop(0,'#9c83c9');g.addColorStop(1,'#46345f')}ctx.fillStyle=g;ctx.fillRect(0,0,1200,650);ctx.globalAlpha=.16;ctx.fillStyle='#fff';for(let i=0;i<25;i++){ctx.beginPath();ctx.arc((i*197)%1200,40+(i*83)%560,2+(i%2),0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;}
function drawPlatforms(){for(const[x,y,w,h]of platforms){ctx.fillStyle='#f3f3ef';roundRect(x,y+8,w,h-8,10);ctx.fill();ctx.fillStyle=selection.map===0?'#268b16':'#604b86';roundRect(x,y,w,h-10,9);ctx.fill();ctx.strokeStyle='#203337';ctx.lineWidth=2;roundRect(x,y,w,h,10);ctx.stroke();}}
function roundRect(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}


const effectSprites={
  diagSlash:[0,138,108],swordCSlash:[1,169,138],thrust:[2,179,85],upslash:[3,153,136],
  multiShot:[16,176,118],bowVolley:[17,143,164],burst:[22,106,93],
  footDust:[14,83,45],teleport:[24,95,89],blessing:[26,141,121],
  elementStorm:[27,260,227]
};

function drawGoddess(e,frame){
  if(!goddessArt.complete||!goddessArt.naturalWidth)return;
  const descent=Math.max(0,1-e.t/.36);
  const ascent=Math.max(0,(e.t-.56)/.49);
  const height=190*descent*descent+270*ascent*ascent;
  const fighter=e.owner;
  ctx.globalAlpha=.66*Math.min(1,e.t/.14,Math.max(0,(e.life-e.t)/.19));
  ctx.drawImage(goddessArt,frame*224,0,224,184,
    fighter.x+fighter.w/2-112,fighter.y-138-height,224,184);
}

function drawEffects(layer='front'){
  for(const e of effects){
    if((e.layer||'front')!==layer)continue;
    const progress=Math.min(1,Math.max(0,e.t/e.life));
    const frame=Math.min(5,Math.floor(progress*6));
    ctx.save();
    ctx.globalAlpha=Math.min(1,(1-progress)*1.55);
    const sprite=effectSprites[e.type];
    if(sprite){
      const [row,width,height]=sprite;
      ctx.translate(e.x,e.y);
      ctx.scale(e.dir||1,1);
      drawCombatArt(row,frame,0,0,width,height);
    }else if(e.type==='flash'){
      ctx.globalAlpha=(1-progress)*.64;
      ctx.fillStyle=e.color;
      ctx.fillRect(0,0,canvas.width,canvas.height);
    }else if(e.type==='axeArc'){
      ctx.translate(e.x,e.y);ctx.scale(e.dir,1);
      drawCombatArt(e.big?5:4,frame,0,0,e.big?207:170,e.big?156:126);
    }else if(e.type==='slam'){
      drawCombatArt(e.big?7:6,frame,e.x,e.y-(e.big?54:47),e.big?219:170,e.big?176:153);
    }else if(e.type==='axeSpinHalf'){
      const front=e.half==='bottom';
      const row=(e.big?10:8)+(front?1:0);
      const phase=(e.t*18)%6;
      const current=Math.floor(phase),mix=phase-current;
      const x=e.owner.x+e.owner.w/2,y=e.owner.y+e.owner.h/2+7;
      ctx.globalAlpha=1-mix;
      drawCombatArt(row,current,x,y,e.r*2.26,124);
      ctx.globalAlpha=mix;
      drawCombatArt(row,(current+1)%6,x,y,e.r*2.26,124);
    }else if(e.type==='dashWind'){
      ctx.translate(e.owner.x+e.owner.w/2-e.dir*progress*30,e.owner.y+20);
      ctx.scale(e.dir,1);
      drawCombatArt(e.big?13:12,frame,-10,0,e.big?189:159,e.big?106:93);
    }else if(e.type==='goddess'){
      drawGoddess(e,frame);
    }else if(e.type==='elementSwitch'){
      drawCombatArt(25,frame,e.x,e.y,98,97);
      drawCombatArt(18+e.element,frame,e.x,e.y-26-progress*22,84,60);
    }else if(e.type==='ring'){
      const radius=e.r||100;
      drawCombatArt(25,frame,e.x,e.y,radius*2.8,radius*2.1);
    }else if(e.type==='lightning'){
      const dx=e.x2-e.x1,dy=e.y2-e.y1;
      ctx.translate(e.x1,e.y1);ctx.rotate(Math.atan2(dy,dx));
      drawSpellArt(2,Math.floor(e.t*32)%6,-4,-27,Math.hypot(dx,dy)+8,54);
    }else if(e.type==='earthWarning'){
      const pulse=.87+.13*Math.sin(progress*Math.PI*7);
      drawCombatArt(23,frame,e.x,e.y-3-38*pulse,(e.r||72)*2.26,160*pulse);
    }else if(e.type==='earthSpike'){
      drawSpellArt(3,frame,e.x-79,e.y-100,158,110);
    }
    ctx.restore();
  }
}

function updateHud(now){if(fighters.length<2)return;const[a,b]=fighters;document.getElementById('p1Hp').style.width=`${100*a.hp/a.maxHp}%`;document.getElementById('p2Hp').style.width=`${100*b.hp/b.maxHp}%`;document.getElementById('p1Ult').style.width=`${a.ult}%`;document.getElementById('p2Ult').style.width=`${b.ult}%`;}

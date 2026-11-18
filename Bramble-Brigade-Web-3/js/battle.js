"use strict";

const battleRules = {
  sapCap:20,
  sapRates:[.92,1.30,1.62,1.91],
  pumpCosts:[5,8,11],
  timeLimit:150
};

class Battle {
  constructor(levelIndex, progress, event=null, mode=null) {
    const level=Campaign.levels[levelIndex];
    this.event=event;
    this.mode=mode;
    this.level=event?{...level,name:event.title,hp:1080,strength:1.41,interval:3.2,
      wave:event.wave.split(" ")}:mode?{...level,name:mode.name,hp:mode.hp,strength:mode.strength,
      interval:mode.interval,wave:mode.wave.split(" "),boss:null}:level;
    this.timeLimit=mode?.time??(event?90:battleRules.timeLimit);
    this.season=progress.season;
    this.progress=progress;
    this.healthMax=Math.round((155+this.level.chapter*22)*(progress.relics>=2?1.12:1));
    this.enemyMax=Math.round(this.level.hp*(1.54+progress.season*.14));
    this.health=this.healthMax;
    this.enemyHealth=this.enemyMax;
    this.sap=(mode?.sap>1?16:6)+(progress.relics>=1?1:0);
    this.pumpLevel=0;
    this.sapSpent=0;
    this.fortCooldown=[2,2];
    this.fortFlash=[0,0];
    this.reserveSent=false;
    this.siegeAt=mode?.siege??((event?13:20)-this.level.chapter-(this.level.boss?3:0));
    this.siegeInFlight=0;
    this.time=0;
    this.nextEnemy=3.2-this.level.chapter*.42;
    this.wave=0;
    this.nextId=0;
    this.units=[];
    this.effects=[];
    this.kills=0;
    this.status="playing";
    this.cooldowns={};
    this.frost=0;
    this.snare=0;
    this.rally=0;
    this.ward=0;
    this.bossPhase=0;
    this.spore=0;
    this.crownShield=0;
    this.bossSummoned=false;
    this.bossDefeated=false;
    this.notice="";
    this.noticeTime=0;
  }
  get sapRate() { return this.sapRateAt(this.pumpLevel); }
  sapRateAt(level) { return battleRules.sapRates[level]*(this.mode?.sap??1); }
  get pumpCost() { return battleRules.pumpCosts[this.pumpLevel]; }
  upgradeSap() {
    if(this.status!=="playing" || this.pumpCost===undefined || this.sap<this.pumpCost) return false;
    this.sap-=this.pumpCost;
    this.pumpLevel++;
    return true;
  }
  spawn(kind,side,boss=null) {
    const source=boss||Campaign.cards[kind];
    const factor=side===1?Campaign.rankPower[this.progress.inventory[kind].rank-1]:
      (boss?1:this.level.strength)*(1+this.season*.115);
    const stats=side===1?Campaign.cardStats(kind,this.progress.inventory[kind].rank,this.progress.relics):null;
    const hp=stats?.hp??Math.round(source.hp*factor);
    const unit={...source,kind,side,id:this.nextId++,x:side===1?14.6:85.4-this.level.chapter*1.6,hp,maxHp:hp,
      hit:stats?.hit??Math.round(source.hit*factor),cooldown:.16,moving:false,boss:!!boss,
      art:boss?.art||source.art||kind};
    this.units.push(unit);
    return unit;
  }
  recruit(kind) {
    const card=Campaign.cards[kind];
    if(this.status!=="playing" || !this.progress.deck.includes(kind) || this.sap<card.cost) return false;
    this.sap-=card.cost;
    this.sapSpent+=card.cost;
    this.spawn(kind,1);
    return true;
  }
  announce(text) {
    this.notice=text;
    this.noticeTime=3;
  }
  abilityReady(key) {
    const anyAllies=this.units.some(unit=>unit.side===1 && unit.hp>0);
    const anyEnemies=this.units.some(unit=>unit.side===-1 && unit.hp>0);
    return this.status==="playing" && this.progress.spells.includes(key) && !this.cooldowns[key] &&
      (key==="ward" || (key==="mercy"?this.health<this.healthMax||this.units.some(unit=>unit.side===1&&unit.hp>0&&unit.hp<unit.maxHp):
        key==="spark"?this.sap<=16:key==="rally"||key==="bloom"?anyAllies:anyEnemies));
  }
  cast(key) {
    if(!this.abilityReady(key)) return false;
    const data=Campaign.abilities[key];
    this.cooldowns[key]=data.cooldown-(this.progress.relics>=3?2:0);
    this.announce(data.name);
    const living=this.units.filter(u=>u.hp>0);
    if(key==="roots") { this.snare=3; }
    if(key==="frost") {
      this.frost=2.2;
      for(const foe of living.filter(u=>u.side===-1)) this.effect(foe.x,foe.x,false,"frost");
    }
    if(key==="spark") { this.sap=Math.min(battleRules.sapCap,this.sap+4); }
    if(key==="volley") {
      const first=living.filter(u=>u.side===-1).sort((a,b)=>a.x-b.x)[0];
      for(const enemy of living.filter(u=>u.side===-1&&u.x<=first.x+24)) {
        this.damage(enemy,32);
        this.effect(enemy.x,enemy.x,true,"volley");
      }
    }
    if(key==="rally") {
      this.rally=5;
      for(const ally of living.filter(u=>u.side===1)) ally.hp=Math.min(ally.maxHp,ally.hp+23);
    }
    if(key==="ward") { this.ward=5; }
    if(key==="mercy"){
      this.health=Math.min(this.healthMax,this.health+24);
      for(const ally of living.filter(unit=>unit.side===1)){
        ally.hp=Math.min(ally.maxHp,ally.hp+12);
        ally.healFlash=.55;
        this.effect(ally.x,ally.x,false,"mend");
      }
    }
    if(key==="gale"){
      for(const foe of living.filter(unit=>unit.side===-1)){
        const before=foe.x;
        foe.x=Math.min(89,foe.x+(foe.boss?4:10));
        this.effect(before,foe.x,true,"gale");
      }
    }
    if(key==="ember"){
      const target=living.filter(unit=>unit.side===-1).sort((a,b)=>a.x-b.x)[0];
      this.damage(target,42);
      this.effect(45,target.x,true,"ember");
    }
    if(key==="bloom"){
      for(const ally of living.filter(unit=>unit.side===1)){
        ally.spellShield=14;
        ally.shieldTime=Math.max(ally.shieldTime||0,5);
        this.effect(ally.x,ally.x,false,"shield");
      }
    }
    return true;
  }
  damage(target,amount) {
    if(target.hp<=0) return;
    let defense=target.side===1 && this.ward>0?.35:
      target.boss && this.crownShield>0?.51:target.kind==="sentinel"?.79:1;
    if(target.brace&&!target.braceUsed){defense*=.45;target.braceUsed=true;target.blockFlash=.42;}
    const dealt=Math.max(1,Math.round(amount*defense));
    const spellAbsorbed=Math.min(dealt,target.spellShield||0);
    const absorbed=Math.min(dealt-spellAbsorbed,target.shield||0);
    target.spellShield=(target.spellShield||0)-spellAbsorbed;
    target.shield=(target.shield||0)-absorbed;
    if(absorbed||spellAbsorbed)target.blockFlash=.42;
    target.hp=Math.max(0,target.hp-dealt+absorbed+spellAbsorbed);
    if(!target.hp && target.side===-1) {
      this.kills++;
      if(target.boss) {
        this.bossDefeated=true;
        this.announce("Boss defeated");
      }
    }
  }
  support(u){
    if(!u.heal&&!u.aegis)return false;
    const nearby=this.units.filter(v=>v!==u&&v.hp>0&&v.side===u.side&&Math.abs(v.x-u.x)<=u.range);
    if(u.heal){
      const wounded=nearby.filter(v=>v.hp<v.maxHp).sort((a,b)=>(a.hp/a.maxHp)-(b.hp/b.maxHp));
      if(!wounded.length)return false;
      const strength=u.side===1?Campaign.rankPower[this.progress.inventory[u.kind].rank-1]:1;
      for(const ally of wounded.slice(0,u.healTargets||1)){
        ally.hp=Math.min(ally.maxHp,ally.hp+Math.round(u.heal*strength));
        ally.healFlash=.55;
        this.effect(u.x,ally.x,true,"mend");
      }
      return true;
    }
    const ally=nearby.find(v=>!v.shield&&v.hp<v.maxHp);
    if(!ally)return false;
    ally.shield=u.aegis;
    ally.blockFlash=.55;
    return true;
  }
  hitUnit(u,target,hit){
    this.damage(target,hit);
    if(u.slow&&target.hp>0)target.slowTime=Math.max(target.slowTime||0,u.slow);
    if(u.root&&target.hp>0)target.rootTime=Math.max(target.rootTime||0,u.root);
    const splash=u.splash||(u.kind==="bomber"?7:0);
    if(splash){
      for(const foe of this.units){
        if(foe!==target&&foe.side!==u.side&&Math.abs(foe.x-target.x)<=splash)this.damage(foe,hit*.48);
      }
      if(u.kind!=="bomber")this.effect(target.x,target.x,false,"blast");
    }
    if(u.chain){
      const linked=this.units.find(v=>v!==target&&v.hp>0&&v.side!==u.side&&Math.abs(v.x-target.x)<=u.chain);
      if(linked){
        this.damage(linked,hit*.55);
        this.effect(target.x,linked.x,true,"arc");
      }
    }
  }
  effect(from,to,ranged,style) { this.effects.push({from,to,ranged,style,ttl:.24}); }
  defendForts(dt) {
    for(let i=0;i<2;i++){
      this.fortFlash[i]=Math.max(0,this.fortFlash[i]-dt);
      this.fortCooldown[i]=Math.max(0,this.fortCooldown[i]-dt);
      if(this.fortCooldown[i]>0) continue;
      const side=i===0?1:-1;
      const x=i===0?14.6:85.4;
      let target;
      let distance=12.5;
      for(const unit of this.units){
        const gap=Math.abs(unit.x-x);
        if(unit.hp>0 && unit.side!==side && gap<distance){target=unit;distance=gap;}
      }
      if(!target) continue;
      this.damage(target,i===0?8:9+this.level.chapter*2);
      this.effect(x,target.x,true,"bolt");
      this.fortCooldown[i]=2.1;
    }
  }
  step(dt) {
    if(this.status!=="playing") return;
    this.time+=dt;
    this.sap=Math.min(battleRules.sapCap,this.sap+dt*this.sapRate);
    for(const key of ["snare","frost","rally","ward","noticeTime","spore","crownShield"]) this[key]=Math.max(0,this[key]-dt);
    for(const key of this.progress.spells) this.cooldowns[key]=Math.max(0,(this.cooldowns[key]||0)-dt);
    const level=this.level;
    if((this.event||this.mode||this.wave<level.wave.length) && this.time>=this.nextEnemy) {
      this.spawn(level.wave[this.wave++%level.wave.length],-1);
      this.nextEnemy=this.time+level.interval*(this.event||this.mode?1:(1.60-level.chapter*.07));
    }
    if(level.boss && !this.bossSummoned && (this.time>=(this.event?9:19-level.chapter*.65) || this.enemyHealth<this.enemyMax*.68)) {
      this.bossSummoned=true;
      this.spawn("boss",-1,level.boss);
      this.announce(level.boss.name+" enters!");
    }
    if(!this.reserveSent && (level.chapter>0 || level.index===1) && this.enemyHealth<this.enemyMax*.69) {
      this.reserveSent=true;
      this.spawn(level.wave[0],-1);
      this.spawn(level.wave[level.wave.length-1],-1);
      this.announce("Thorn fort sends its reserves!");
    }
    this.defendForts(dt);
    if(this.siegeInFlight>0){
      this.siegeInFlight=Math.max(0,this.siegeInFlight-dt);
      if(!this.siegeInFlight){
        const damage=(15+this.level.chapter*7+(level.boss?4:0))*(this.ward>0?.25:1);
        this.health=Math.max(0,this.health-Math.round(damage));
        this.fortFlash[0]=.22;
        if(!this.health){this.status="lost";return;}
      }
    }
    if(this.time>=this.siegeAt && this.enemyHealth>this.enemyMax*.25 && this.frost===0) {
      this.siegeAt=this.time+11-this.level.chapter*.84;
      this.siegeInFlight=.75;
      this.effects.push({from:91.8,to:8.3,ranged:true,style:"siege",ttl:.75});
    }
    const boss=this.units.find(unit=>unit.boss&&unit.hp>0);
    if(boss && this.bossPhase===0 && boss.hp<boss.maxHp*.50) {
      this.bossPhase=1;
      if(level.chapter===0) {
        this.spawn("guard",-1);
        this.spawn("guard",-1);
        this.announce("Brambleback calls two guards!");
      } else if(level.chapter===1) {
        this.spore=5;
        this.announce("Spore cloud slows your attacks!");
      } else if(level.chapter===2) {
        boss.speed*=1.5;
        boss.interval*=.82;
        for(const ally of this.units) if(ally.side===1 && Math.abs(ally.x-boss.x)<12) this.damage(ally,19);
        this.announce("The Cinder Stag charges!");
      } else {
        this.crownShield=4;
        this.spawn("archer",-1);
        this.spawn("archer",-1);
        this.announce("Hollow Crown raises a shield!");
      }
    }
    for(const u of this.units) {
      if(!u.hp) continue;
      if(u.shieldTime>0){
        u.shieldTime=Math.max(0,u.shieldTime-dt);
        if(!u.shieldTime)u.spellShield=0;
      }
      u.frozen=u.side===-1&&this.frost>0;
      for(const timer of ["rootTime","slowTime","blockFlash"])u[timer]=Math.max(0,(u[timer]||0)-dt);
      u.snared=(u.side===-1&&this.snare>0)||u.rootTime>0;
      u.enraged=!!u.fury&&u.hp<=u.maxHp*.5;
      u.rallying=u.side===1&&this.rally>0;
      u.warded=u.side===1&&this.ward>0;
      u.healFlash=Math.max(0,(u.healFlash||0)-dt);
      if(u.frozen){u.moving=false;continue;}
      u.attackAge=Math.max(0,(u.attackAge||0)-dt);
      u.cooldown=Math.max(0,u.cooldown-dt*(u.side===1&&this.spore>0?.60:u.side===1&&this.rally>0?1.55:1));
      if(u.cooldown===0&&this.support(u)){
        u.cooldown=u.interval;
        u.moving=false;
        u.attackAge=.18;
        continue;
      }
      const fury=u.enraged?1.25:1;
      const hit=u.hit*fury;
      const fortX=u.side===1?85.4:14.6;
      let target;
      let distance=Math.abs(fortX-u.x);
      for(const v of this.units) {
        const gap=Math.abs(v.x-u.x);
        if(v.hp && v.side!==u.side && gap<=distance) {
          distance=gap;
          target=v;
        }
      }
      const desired=target?.x??fortX;
      u.moving=distance>u.range+.0001 && !u.snared;
      if(u.moving) {
        u.x+=Math.sign(desired-u.x)*Math.min(distance-u.range,dt*u.speed*.75*fury*(u.slowTime>0?.6:1));
      } else if(distance<=u.range+.0001 && u.cooldown===0) {
        u.cooldown=u.interval;
        if(target) {
          this.hitUnit(u,target,hit);
        } else if(u.side===1) {
          const minHP=level.boss&&!this.bossDefeated?1:0;
          const siege=u.kind==="giant"||u.kind==="lancer"?1.36:1;
          this.enemyHealth=Math.max(minHP,this.enemyHealth-Math.round(hit*siege));
          this.fortFlash[1]=.18;
        } else {
          this.health=Math.max(0,this.health-Math.round(hit*(this.ward>0?.25:1)));
          this.fortFlash[0]=.18;
        }
        if(u.kind==="warden") {
          for(const v of this.units) if(v!==u && v.hp>0 && v.side===u.side && Math.abs(v.x-u.x)<=10) { v.hp=Math.min(v.maxHp,v.hp+5); v.healFlash=.5; }
        }
        u.attackAge=.18;
        this.effect(u.x,desired,u.range>=10,u.kind);
        if(!this.enemyHealth || !this.health) {
          this.status=this.health?"won":"lost";
          break;
        }
      }
    }
    this.units=this.units.filter(u=>u.hp>0);
    for(const effect of this.effects) effect.ttl-=dt;
    this.effects=this.effects.filter(effect=>effect.ttl>0);
    if(this.time>=this.timeLimit && this.status==="playing") {
      const ahead=this.health/this.healthMax>this.enemyHealth/this.enemyMax;
      this.status=!this.event&&ahead&&(!level.boss||this.bossDefeated)?"won":"lost";
      this.announce(this.status==="won"?"Victory on fort health":"Time expired");
    }
  }
}

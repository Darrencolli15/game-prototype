"use strict";

const Campaign = (() => {
  const cards = {
    guard: {role:"Shield",name:"Guard",   text:"Front-line shield", cost:4, hp:77, hit:9, interval:1, range:4.8, speed:6.6, rarity:"Common"},
    archer: {role:"Ranged",name:"Archer",  text:"Back-line damage", cost:4, hp:27, hit:11, interval:.91, range:17, speed:7, rarity:"Common", art:"slinger"},
    giant: {role:"Siege",name:"Giant",   text:"Heavy siege", cost:7, hp:154, hit:23, interval:1.30, range:5.6, speed:5.2, rarity:"Rare"},
    runner: {role:"Fast",name:"Runner",  text:"Quick strikes", cost:3, hp:32, hit:11, interval:.59, range:4.4, speed:11, rarity:"Common"},
    bomber: {role:"Splash",name:"Spore Lobber", text:"Splash damage", cost:6, hp:37, hit:16, interval:1.14, range:14, speed:6.3, rarity:"Rare"},
    warden: {role:"Heal",name:"Briar Warden", text:"Heals nearby allies", cost:5, hp:56, hit:8, interval:1.01, range:10, speed:6.5, rarity:"Rare"},
    lancer: {role:"Charge",name:"Moon Lancer", text:"Bonus fort damage", cost:6, hp:88, hit:22, interval:.98, range:8, speed:8.2, rarity:"Epic"},
    sentinel: {role:"Armor",name:"Oak Sentinel", text:"Armored defender", cost:7, hp:170, hit:19, interval:1.10, range:5.6, speed:5.6, rarity:"Epic"},
    medic: {role:"Heal",name:"Clover Medic",text:"Mends one nearby ally",cost:4,hp:34,hit:4,interval:1.22,range:11,speed:7,rarity:"Common",unlock:1,heal:12},
    sapper: {role:"Splash",name:"Acorn Sapper",text:"Splashes nearby enemies",cost:4,hp:43,hit:10,interval:.93,range:5,speed:8,rarity:"Common",unlock:3,splash:6},
    quill: {role:"Slow",name:"Quill Scout",text:"Slows with quill shots",cost:3,hp:23,hit:7,interval:.92,range:12.5,speed:8,rarity:"Common",unlock:5,slow:1.1},
    squire: {role:"Block",name:"Bark Squire",text:"Blocks part of the first hit",cost:4,hp:61,hit:8,interval:1.01,range:4.9,speed:7.6,rarity:"Common",unlock:7,brace:true},
    mortar: {role:"Blast",name:"Puffcap Mortar",text:"Long-range splash",cost:6,hp:32,hit:19,interval:1.8,range:20,speed:4.8,rarity:"Rare",unlock:5,splash:10},
    dew: {role:"Mend",name:"Dewkeeper",text:"Heals up to two allies",cost:5,hp:53,hit:5,interval:1.35,range:10,speed:6.15,rarity:"Rare",unlock:8,heal:10,healTargets:2},
    trapper: {role:"Root",name:"Bramble Trapper",text:"Pins a target in place",cost:5,hp:40,hit:11,interval:1.36,range:14,speed:5.6,rarity:"Rare",unlock:9,root:.8},
    storm: {role:"Chain",name:"Stormwing",text:"Lightning jumps to a second foe",cost:6,hp:51,hit:17,interval:1.28,range:13,speed:7.1,rarity:"Epic",unlock:10,chain:11},
    flint: {role:"Fury",name:"Flintback",text:"Hits harder below half health",cost:6,hp:126,hit:14,interval:1.08,range:5.2,speed:5.7,rarity:"Epic",unlock:12,fury:true},
    lantern: {role:"Ward",name:"Lantern Hare",text:"Shields a nearby ally",cost:6,hp:47,hit:9,interval:1.38,range:12,speed:7.5,rarity:"Epic",unlock:15,aegis:13}
  };
  const bosses = [
    {name:"Brambleback", hp:225, hit:22, interval:1.28, range:6, speed:3.9, trick:"Calls two guards at half health", art:"boss0"},
    {name:"Sporemother", hp:300, hit:24, interval:1.11, range:12, speed:3.6, trick:"Spores briefly slow allied attacks", art:"boss1"},
    {name:"The Cinder Stag", hp:395, hit:28, interval:1.03, range:9, speed:5.7, trick:"Charges the front line at half health", art:"boss2"},
    {name:"Hollow Crown", hp:397, hit:26, interval:1.21, range:10.0, speed:4.4, trick:"Conjures a shield and calls archers", art:"boss3"}
  ];
  const levelsPerArena=5;
  const zones = [
    {name:"Clover Crossing", tag:"The Old Trail", unlock:"bomber", relic:"Acorn Reservoir", relicText:"+1 starting sap", levels:[
      ["First Patrol",166,.87,3.85,"runner guard archer runner guard"],
      ["Shield Wall",184,.90,3.75,"guard archer guard runner archer guard"],
      ["Burrow Bend",191,.94,3.7,"runner archer guard runner guard archer"],
      ["Briar Gate",207,.98,3.6,"guard runner guard archer giant runner"],
      ["Brambleback’s Den",221,1.01,4.1,"guard archer runner guard archer"]
    ]},
    {name:"Fern Hollow", tag:"Spores & Roots", unlock:"warden", relic:"Iron Bark", relicText:"+12% burrow health", levels:[
      ["Spore Trail",229,1.00,3.85,"runner bomber guard archer bomber runner"],
      ["Tangle Bridge",244,1.02,3.72,"giant archer runner guard bomber archer"],
      ["Mushroom Ring",257,1.05,3.67,"bomber runner warden archer guard bomber guard"],
      ["Root Run",268,1.08,3.55,"guard bomber warden runner giant archer bomber"],
      ["The Bloom Below",283,1.08,3.8,"guard bomber archer guard bomber runner archer"]
    ]},
    {name:"Amber Ridge", tag:"The Cinder Line", unlock:"lancer", relic:"Moon Lantern", relicText:"−2 s ability cooldowns", levels:[
      ["Ashwind Pass",263,1.05,3.48,"runner lancer archer guard giant archer runner"],
      ["Cinder Rampart",283,1.10,3.35,"guard bomber lancer giant archer guard lancer bomber"],
      ["Ember Steps",298,1.15,3.28,"bomber runner giant lancer warden archer guard lancer"],
      ["Saffron Rise",313,1.19,3.15,"lancer giant guard bomber archer lancer giant"],
      ["Stag’s Summit",334,1.14,3.46,"lancer runner giant bomber guard archer lancer guard"]
    ]},
    {name:"Moonroot Keep", tag:"Under the Hollow Moon", unlock:"sentinel", relic:"Hollow Emblem", relicText:"+5% troop damage", levels:[
      ["Silver Watch",347,1.19,3.19,"sentinel archer lancer warden guard bomber archer giant"],
      ["Night March",376,1.25,3.07,"runner lancer sentinel archer warden bomber giant lancer sentinel"],
      ["Moonwell",398,1.28,2.98,"warden sentinel archer bomber lancer giant archer warden"],
      ["Starless Gate",413,1.32,2.93,"guard lancer sentinel bomber warden lancer giant sentinel"],
      ["The Hollow Crown",432,1.24,3.39,"guard lancer archer warden giant archer sentinel lancer bomber"]
    ]}
  ];
  const levels = zones.flatMap((zone,chapter) => zone.levels.map(([name,hp,strength,interval,wave],index) => ({
    name,hp,strength,interval,wave:wave.split(" "),chapter,index,boss:index===levelsPerArena-1?bosses[chapter]:null
  })));
  const abilities = {
    roots:{name:"Bramble Snare",art:"spell-roots",description:"Stops enemy movement for 3 s",cooldown:18,at:0},
    frost:{name:"Frost Bloom",art:"spell-frost",description:"Freezes movement and attacks for 2.2 s",cooldown:26,at:2},
    volley:{name:"Thorn Volley",art:"spell-volley",description:"Deals 32 damage to the front group",cooldown:20,at:5},
    spark:{name:"Sap Spark",art:"spell-spark",description:"Refills 4 sap",cooldown:29,at:8},
    rally:{name:"War Cry",art:"spell-rally",description:"Heals and hastens allies for 5 s",cooldown:24,at:10},
    ward:{name:"Moon Ward",art:"spell-ward",description:"Shields your fort and troops for 5 s",cooldown:25,at:15},
    mercy:{name:"Dew Mend",art:"spell-mercy",description:"Restores 24 HP to your burrow and 12 HP to troops",cooldown:30,at:3},
    gale:{name:"Gust Wing",art:"spell-gale",description:"Pushes nearby foes away from your burrow",cooldown:22,at:6},
    ember:{name:"Ember Seed",art:"spell-ember",description:"Deals 42 damage to the lead foe",cooldown:22,at:11},
    bloom:{name:"Clover Ward",art:"spell-bloom",description:"Gives allies a 14 HP shield for 5 s",cooldown:25,at:17}
  };
  const modes={
    duel:{name:"Woodland Duel",art:"slinger",hint:"1v1 vs CPU",index:1,time:75,hp:122,strength:1.09,interval:4.2,wave:"guard archer runner giant",sap:1,siege:Infinity},
    rush:{name:"Sap Rush",art:"spell-spark",hint:"3× sap",index:2,time:60,hp:150,strength:1.06,interval:1.6,wave:"runner archer guard bomber giant",sap:3,siege:Infinity}
  };
  const rankCost = [2,4,7,11,17];
  const rankPower = [1,1.22,1.40,1.54,1.65,1.74];
  const offers = [
    {id:"com.bramblebrigade.cards.trail",name:"Trail Pack",cards:{guard:4,archer:4,giant:2},acorns:45,price:"$0.99"},
    {id:"com.bramblebrigade.cards.commander",name:"Commander Pack",cards:{bomber:3,warden:3,lancer:3,sentinel:3},acorns:100,price:"$1.99"},
    {id:"com.bramblebrigade.chest.mega",name:"Mega Chest",cards:{guard:3,archer:3,runner:3,giant:3,warden:2,lancer:1,sentinel:1},acorns:55,price:"$2.99",art:"chest-mega"},
    {id:"com.bramblebrigade.gold.pouch",name:"Gold Pouch",cards:{},acorns:30,price:"$0.99",art:"gold"},
    {id:"com.bramblebrigade.gems.pouch",name:"Gem Pouch",cards:{},acorns:0,gems:8,price:"$1.99",art:"gem"},
    {id:"com.bramblebrigade.pass.token",name:"Woodland Pass",cards:{},acorns:0,passTokens:1,price:"$3.99",art:"pass"},
    {id:"com.bramblebrigade.bundle.grove",name:"Grove Supply Bundle",cards:{guard:2,archer:2,medic:2},acorns:60,gems:8,price:"$2.49",rotation:1,art:"chest-mega"},
    {id:"com.bramblebrigade.bundle.harvest",name:"Harvest Bundle",cards:{giant:2,sapper:2,mortar:2},acorns:60,gems:8,price:"$2.49",rotation:2,art:"chest-mega"},
    {id:"com.bramblebrigade.boost.speed",name:"Battle Tempo",cards:{},acorns:0,boost:"speed",benefit:"Optional 2× speed in campaign and side battles",price:"$5.99",art:"clock"},
    {id:"com.bramblebrigade.boost.gold",name:"Gold Rush",cards:{},acorns:0,boost:"gold",benefit:"2× gold earned from campaign battles",price:"$4.99",art:"gold"}
  ];
  const starter = ["guard","archer","giant","runner"];
  const saveKey = "bramble-brigade-campaign-v1";
  const safeInt = (value,fallback=0) => Number.isSafeInteger(value)&&value>=0?value:fallback;
  function load(raw,old) {
    const p = {unlocked:0,acorns:8,seals:0,inventory:{},deck:[...starter],spells:["roots"],layout:2,relics:0,
      medals:{},attempts:{},transactions:[],season:0,xp:0};
    for (const key of starter) p.inventory[key]={rank:1,copies:0};
    if (old && !raw) p.acorns+=Math.min(100,safeInt(old.coins));
    if (!raw) return p;
    const oldLayout=raw.layout!==2;
    const previousUnlocked=Math.min(12,safeInt(raw.unlocked));
    p.unlocked=oldLayout?Math.floor(previousUnlocked/3)*levelsPerArena+previousUnlocked%3:
      Math.min(levels.length,safeInt(raw.unlocked));
    p.relics=Math.max(Math.floor(p.unlocked/levelsPerArena),Math.min(zones.length,safeInt(raw.relics)));
    p.acorns=safeInt(raw.acorns,8);
    p.seals=safeInt(raw.seals,0);
    p.season=Math.min(3,safeInt(raw.season));
    p.xp=safeInt(raw.xp);
    for(const key of Object.keys(cards)) {
      const item=raw.inventory?.[key];
      if(item && safeInt(item.rank)>0) p.inventory[key]={rank:Math.min(6,item.rank),copies:safeInt(item.copies)};
    }
    if(Array.isArray(raw.deck)) {
      const deck=[...new Set(raw.deck)].filter(key=>Object.hasOwn(p.inventory,key));
      p.deck=[...new Set([...deck,...starter])].slice(0,4);
    }
    const savedSpells=Array.isArray(raw.spells)?raw.spells:[raw.ability,"roots"];
    const equipped=[...new Set([...savedSpells,...Object.keys(abilities)])].filter(key=>
      typeof key==="string" && Object.hasOwn(abilities,key) && availableAbility(key,p));
    p.spells=equipped.slice(0,spellSlots(p));
    const campaignSize=oldLayout?12:levels.length;
    for(let i=0;i<campaignSize;i++) {
      const mapped=oldLayout?Math.floor(i/3)*levelsPerArena+(i%3===2?4:i%3):i;
      const stars=safeInt(raw.medals?.[i]);
      if(stars) p.medals[mapped]=Math.min(3,stars);
      const attempts=safeInt(raw.attempts?.[i]);
      if(attempts) p.attempts[mapped]=attempts;
    }
    if(Array.isArray(raw.transactions)) p.transactions=[...new Set(raw.transactions.filter(id=>typeof id==="string"&&/^\d+$/.test(id)))];
    return p;
  }
  function spellSlots(p) { return p.season || p.unlocked>=2?2:1; }
  function availableAbility(key,p) { return abilities[key].at <= (p.season ? levels.length : p.unlocked); }
  function addCards(p,grants) {
    for(const [key,count] of Object.entries(grants)) {
      if(!Object.hasOwn(cards,key) || !safeInt(count)) continue;
      if(p.inventory[key]) p.inventory[key].copies+=count;
      else p.inventory[key]={rank:1,copies:count-1};
    }
  }
  function canMerge(p,key) {
    const item=p.inventory[key];
    return !!item && item.rank<=rankCost.length && item.copies>=rankCost[item.rank-1];
  }
  function merge(p,key) {
    if(!canMerge(p,key)) return false;
    const item=p.inventory[key];
    item.copies-=rankCost[item.rank-1];
    item.rank++;
    return true;
  }
  function cardAvailable(key,p) { return p.season>0||p.unlocked>=(cards[key].unlock||0); }
  function cardStats(key,rank,relics=0) {
    const base=cards[key];
    const factor=rankPower[rank-1];
    return {hp:Math.round(base.hp*factor),hit:Math.round(base.hit*factor*(relics>=4?1.05:1)),
      interval:base.interval,range:base.range,speed:base.speed*.75,cost:base.cost};
  }
  const xpThresholds = [0,20,56,105,175,278,410,575,790,1060,1400,1860];
  while(xpThresholds.length<100) {
    const level=xpThresholds.length;
    xpThresholds.push(xpThresholds[level-1]+460+(level-11)*65);
  }
  function playerLevel(xp) {
    const next=xpThresholds.findIndex(threshold=>threshold>xp);
    return next<0?xpThresholds.length:next;
  }
  function gainXP(p,xp) {
    const previous=playerLevel(p.xp);
    p.xp+=xp;
    const next=playerLevel(p.xp);
    const milestones=Math.floor(next/5)-Math.floor(previous/5);
    return {xp,levelUps:next-previous,milestones};
  }
  function battleReward(p,levelIndex,won,hpRatio,kills) {
    const level=levels[levelIndex];
    if(!won) {
      const prior=p.attempts[levelIndex]||0;
      p.attempts[levelIndex]=prior+1;
      const acorns=prior<2 && kills>0 ? 1 : 0;
      p.acorns+=acorns;
      return {acorns,cards:{},newStage:false,stars:0,...gainXP(p,prior<3&&kills>0?2:0)};
    }
    const first=!p.medals[levelIndex];
    const advances=levelIndex===p.unlocked;
    const grants={};
    const surprises=[];
    const stars=hpRatio>=.85?3:hpRatio>=.5?2:1;
    const acorns=first?6+level.chapter+(level.boss?7:0):stars>p.medals[levelIndex]?1:0;
    const gain=gainXP(p,first?12+level.chapter*2+(level.boss?10:0):stars>(p.medals[levelIndex]||0)?4:1);
    if(advances) {
      p.unlocked++;
      for(const [key,ability] of Object.entries(abilities)) if(!p.season && ability.at===p.unlocked) {
        surprises.push({name:ability.name,art:ability.art,label:"Ability"});
        if(p.spells.length<spellSlots(p)) p.spells.push(key);
      }
    }
    if(first) {
      const recruit={1:"medic",3:"sapper",6:"quill",8:"squire"}[levelIndex];
      if(recruit&&!p.inventory[recruit])grants[recruit]=1;
      const commons=["guard","archer","runner"];
      if(level.index===0 || level.index===2 || level.index===3) grants[commons[(level.index+level.chapter)%commons.length]]=1;
      if(level.boss) {
        grants[zones[level.chapter].unlock]=1;
        if(p.relics<=level.chapter) {
          p.relics=level.chapter+1;
          surprises.push({name:zones[level.chapter].relic,art:"relic"+level.chapter,label:zones[level.chapter].relicText});
        }
      }
    }
    addCards(p,grants);
    p.acorns+=acorns;
    p.medals[levelIndex]=Math.max(stars,p.medals[levelIndex]||0);
    return {acorns,cards:grants,newStage:advances,stars,surprises,...gain};
  }
  return {cards,zones,levels,modes,levelsPerArena,abilities,rankCost,rankPower,offers,saveKey,load,starter,availableAbility,spellSlots,
    addCards,canMerge,merge,cardStats,cardAvailable,battleReward,xpThresholds,playerLevel,gainXP};
})();

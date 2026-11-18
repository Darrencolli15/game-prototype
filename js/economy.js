"use strict";

const Economy = (() => {
  const hour=3600_000;
  const day=24*hour;
  const week=7*day;
  const monday=4*day;
  const freeInterval=3*hour;
  const gemCost=6;
  const tiers=[
    {name:"Scout Cache",time:18,damage:5,gold:3,gems:1,chests:0},
    {name:"Briar Cache",time:35,damage:13,gold:5,gems:1,chests:1},
    {name:"Champion Cache",time:58,damage:27,gold:8,gems:2,chests:1}
  ];
  const events=[
    {title:"Briar Stampede",chapter:0,boss:0,wave:"runner guard giant archer bomber"},
    {title:"Spore Siege",chapter:1,boss:1,wave:"bomber archer guard warden giant"},
    {title:"Ember Hunt",chapter:2,boss:2,wave:"runner lancer giant archer bomber"},
    {title:"Midnight March",chapter:3,boss:3,wave:"guard sentinel archer lancer warden"}
  ];
  const seasonLength=28*day;
  const seasonEpoch=Date.UTC(2026,0,5);
  const legacyPassTiers=[
    {points:12,free:{gold:2},premium:{trail:1}},
    {points:28,free:{trail:1},premium:{gold:4}},
    {points:48,free:{gold:3},premium:{level:1}},
    {points:72,free:{trail:1},premium:{gems:1}},
    {points:100,free:{gems:1},premium:{milestone:1}},
    {points:135,free:{gold:4},premium:{level:1}},
    {points:175,free:{level:1},premium:{gems:2}},
    {points:225,free:{milestone:1},premium:{milestone:1,gold:5}}
  ];
  const passTiers=Array.from({length:35},(_,index)=>{
    const tier=index+1;
    return {points:tier*12,free:tier%5===0?{level:1}:tier%3===0?{trail:1}:{gold:2},
      premium:tier%7===0?{milestone:1}:tier%4===0?{gems:1}:tier%2===0?{gold:3}:{trail:1}};
  });
  const bonusStep=12;
  const lastTier=passTiers.at(-1).points;
  const bonusEarned=points=>Math.max(0,Math.floor((points-lastTier)/bonusStep));
  const nextPassGoal=points=>points<lastTier?(Math.floor(points/12)+1)*12:lastTier+(bonusEarned(points)+1)*bonusStep;
  const claimList=value=>Array.isArray(value)?[...new Set(value.filter(index=>Number.isInteger(index)&&index>=0&&index<passTiers.length))]:[];
  const bonusPrize=()=>({gold:4,cards:{runner:1,guard:1}});
  const offerWeek=now=>Math.floor((now-monday)/week);
  const activeOffers=(now=Date.now())=>Campaign.offers.filter(offer=>!offer.rotation||offer.rotation===rotation(now).slot);
  function rotation(now=Date.now()){
    const id=offerWeek(now);
    return {slot:id%2+1,reset:monday+(id+1)*week};
  }
  const seasonFor=now=>Math.max(0,Math.floor((now-seasonEpoch)/seasonLength));
  const currentWeek=now=>Math.floor((now-monday)/week);
  function integer(value,fallback=0){return Number.isSafeInteger(value)&&value>=0?value:fallback;}
  function restore(p,raw,now=Date.now()){
    const e=raw?.economy??{};
    const eventWeek=integer(e.eventWeek,currentWeek(now));
    const oldPassPoints=integer(e.passPoints);
    const passPoints=e.passVersion>=2?oldPassPoints:Math.floor(oldPassPoints/8)*12+Math.round((oldPassPoints%8)*1.5);
    p.economy={gems:integer(e.gems),levelChests:integer(e.levelChests),milestoneChests:integer(e.milestoneChests),
      passCredits:integer(e.passCredits),passSeason:integer(e.passSeason,seasonFor(now)),passPoints,passVersion:2,
      passPremium:e.passPremium===true,passFreeClaims:claimList(e.passFreeClaims),passPaidClaims:claimList(e.passPaidClaims),
      passBonusClaims:Math.min(bonusEarned(passPoints),integer(e.passBonusClaims)),
      boosts:{speed:e.boosts?.speed===true,gold:e.boosts?.gold===true},matches:integer(e.matches),
      freeAt:integer(e.freeAt,now+freeInterval),stockDay:integer(e.stockDay,Math.floor(now/day)),
      stockBought:Array.isArray(e.stockBought)?[...new Set(e.stockBought.filter(key=>Object.hasOwn(Campaign.cards,key)))]:[],
      eventWeek,eventTiers:Math.min(7,integer(e.eventTiers)),eventDamage:Math.min(100,integer(e.eventDamage)),
      eventTime:Math.min(90,integer(e.eventTime))};
    const migrated=Number.isInteger(e.passFreeClaims);
    if(migrated){
      legacyPassTiers.forEach((tier,index)=>{
        if(p.economy.passPoints<tier.points)return;
        if(!(e.passFreeClaims&(1<<index)))grantPassReward(p,tier.free);
        if(p.economy.passPremium&&!(e.passPaidClaims&(1<<index)))grantPassReward(p,tier.premium);
        p.economy.passFreeClaims.push(index);
        if(p.economy.passPremium)p.economy.passPaidClaims.push(index);
      });
    }
    return refreshPass(p,now)||migrated;
  }
  function stock(p,now=Date.now()){
    const calendarDay=Math.floor(now/day);
    const id=Math.max(calendarDay,p.economy.stockDay);
    const commons=["guard","archer","runner"];
    const specialties=["giant","medic","bomber","mortar","warden","sapper","trapper","lancer","dew","storm","sentinel","quill","flint","squire","lantern"];
    const special=specialties[id%specialties.length];
    const unlock={giant:2,bomber:5,warden:7,lancer:10,sentinel:15};
    return {id,reset:(id+1)*day,items:[
      {key:commons[id%3],price:6,count:1,locked:false},
      {key:commons[(id+1)%3],price:7,count:1,locked:false},
      {key:special,price:Campaign.cards[special].rarity==="Common"?7:12,count:1,locked:!p.season&&p.unlocked<(unlock[special]??Campaign.cards[special].unlock)}
    ].map(item=>({...item,bought:p.economy.stockDay===id&&p.economy.stockBought.includes(item.key)}))};
  }
  function buy(p,key,now=Date.now()){
    const listing=stock(p,now);
    const item=listing.items.find(entry=>entry.key===key);
    if(!item||item.locked||item.bought||p.acorns<item.price)return false;
    if(p.economy.stockDay!==listing.id){p.economy.stockDay=listing.id;p.economy.stockBought=[];}
    p.economy.stockBought.push(key);
    p.acorns-=item.price;
    Campaign.addCards(p,{[key]:item.count});
    return true;
  }
  function odds(p){
    if(p.season || p.unlocked>=18)return {Common:61,Rare:27,Epic:9,Legendary:2.7,Exclusive:.3};
    if(p.unlocked>=10)return {Common:63,Rare:29,Epic:8};
    if(p.unlocked>=5)return {Common:64,Rare:36};
    return {Common:75,Rare:25};
  }
  function grantChest(p,kind,now=Date.now(),random=Math.random){
    const e=p.economy;
    if(kind==="trail" && p.seals>0)p.seals--;
    else if(kind==="level" && e.levelChests>0)e.levelChests--;
    else if(kind==="milestone" && e.milestoneChests>0)e.milestoneChests--;
    else if(kind==="free" && now>=e.freeAt)e.freeAt=now+freeInterval;
    else if(kind==="gem" && e.gems>=gemCost)e.gems-=gemCost;
    else return null;
    const weights=kind==="gem"?odds(p):{Common:100};
    const quantity=kind==="gem"||kind==="milestone"?3:kind==="level"?2:1+Number(kind==="trail"&&random()<.25);
    const newCards=[];
    const cards={};
    for(let i=0;i<quantity;i++){
      let roll=random()*100;
      const rarity=Object.keys(weights).find(key=>{roll-=weights[key];return roll<0;})||"Common";
      const available=Object.keys(Campaign.cards).filter(key=>Campaign.cards[key].rarity===rarity&&Campaign.cardAvailable(key,p));
      const pool=kind==="gem"?available:available.flatMap(key=>Array(Campaign.starter.includes(key)?4:1).fill(key));
      const key=pool[Math.floor(random()*pool.length)];
      if(!p.inventory[key]&&!cards[key])newCards.push(key);
      cards[key]=(cards[key]||0)+1;
    }
    const trailGold=[0,0,0,0,1,1,1,1,1,2,2,2,2,2,3,3,3,4,4,5];
    const gold=kind==="trail"?trailGold[Math.floor(random()*trailGold.length)]:
      kind==="milestone"?3+Math.floor(random()*5):{gem:5,level:2,free:1}[kind];
    const gems=kind==="level"||kind==="milestone"?1:0;
    p.acorns+=gold;
    e.gems+=gems;
    Campaign.addCards(p,cards);
    return {cards,gold,gems,newCards};
  }
  function grantPassReward(p,reward){
    p.acorns+=reward.gold||0;
    if(reward.cards)Campaign.addCards(p,reward.cards);
    p.seals+=reward.trail||0;
    p.economy.gems+=reward.gems||0;
    p.economy.levelChests+=reward.level||0;
    p.economy.milestoneChests+=reward.milestone||0;
  }
  function refreshPass(p,now=Date.now()){
    const e=p.economy;
    const id=seasonFor(now);
    if(id<=e.passSeason)return false;
    passTiers.forEach((tier,index)=>{
      if(e.passPoints<tier.points)return;
      if(!e.passFreeClaims.includes(index))grantPassReward(p,tier.free);
      if(e.passPremium&&!e.passPaidClaims.includes(index))grantPassReward(p,tier.premium);
    });
    const outstanding=bonusEarned(e.passPoints)-e.passBonusClaims;
    if(outstanding>0)grantPassReward(p,{gold:outstanding*4,cards:{runner:outstanding,guard:outstanding}});
    Object.assign(e,{passSeason:id,passPoints:0,passVersion:2,passPremium:false,passFreeClaims:[],passPaidClaims:[],passBonusClaims:0});
    return true;
  }
  function pass(p,now=Date.now()){
    const e=p.economy;
    return {id:e.passSeason,reset:seasonEpoch+(e.passSeason+1)*seasonLength,points:e.passPoints,
      premium:e.passPremium,credits:e.passCredits,freeClaims:e.passFreeClaims,paidClaims:e.passPaidClaims,bonus:bonusEarned(e.passPoints),bonusClaims:e.passBonusClaims,now};
  }
  function unlockPass(p,now=Date.now()){
    refreshPass(p,now);
    const e=p.economy;
    if(e.passPremium||!e.passCredits)return false;
    e.passCredits--;
    e.passPremium=true;
    return true;
  }
  function claimPass(p,index,track,now=Date.now()){
    if(refreshPass(p,now))return null;
    const e=p.economy,tier=passTiers[index];
    const premium=track==="premium";
    if(track!=="free"&&!premium || !tier || e.passPoints<tier.points || premium&&!e.passPremium)return null;
    const claims=premium?"passPaidClaims":"passFreeClaims";
    if(e[claims].includes(index))return null;
    e[claims].push(index);
    grantPassReward(p,tier[track]);
    return tier[track];
  }
  function claimBonus(p,now=Date.now()){
    if(refreshPass(p,now))return null;
    const e=p.economy;
    if(e.passBonusClaims>=bonusEarned(e.passPoints))return null;
    e.passBonusClaims++;
    const reward=bonusPrize();
    grantPassReward(p,reward);
    return reward;
  }
  function complete(p,{newStage=false,boss=false,levelUps=0,milestones=0,kills=0,damage=0,won=false}={},now=Date.now()){
    refreshPass(p,now);
    const e=p.economy;
    const streak=++e.matches%3===0;
    if(streak)p.seals++;
    e.levelChests+=Math.max(0,levelUps-milestones);
    e.milestoneChests+=milestones;
    const passPoints=1+Number(won)+Number(damage>=40);
    e.passPoints+=passPoints;
    const gems=Number(newStage&&boss);
    e.gems+=gems;
    return {trailChest:streak,levelChests:levelUps-milestones,milestones,gems,passPoints};
  }
  function weekly(p,now=Date.now()){
    const id=Math.max(currentWeek(now),p.economy.eventWeek);
    const e=p.economy;
    const active=e.eventWeek===id;
    return {...events[id%events.length],id,reset:monday+(id+1)*week,claimed:active?e.eventTiers:0,
      bestTime:active?e.eventTime:0,bestDamage:active?e.eventDamage:0};
  }
  function eventReward(p,id,seconds,damage,now=Date.now()){
    const event=weekly(p,now);
    if(event.id!==id)return {gold:0,gems:0,chests:0,names:[],expired:true};
    const e=p.economy;
    e.eventWeek=id;
    e.eventTime=Math.max(event.bestTime,Math.floor(seconds));
    e.eventDamage=Math.max(event.bestDamage,Math.floor(damage));
    const rewards={gold:0,gems:0,chests:0,names:[]};
    let claimed=event.claimed;
    tiers.forEach((tier,index)=>{
      const bit=1<<index;
      if(!(claimed&bit) && (seconds>=tier.time || damage>=tier.damage)){
        claimed|=bit;
        rewards.gold+=tier.gold;
        rewards.gems+=tier.gems;
        rewards.chests+=tier.chests;
        rewards.names.push(tier.name);
      }
    });
    e.eventTiers=claimed;
    p.acorns+=rewards.gold;
    e.gems+=rewards.gems;
    p.seals+=rewards.chests;
    return rewards;
  }
  return {gemCost,tiers,passTiers,bonusPrize,bonusStep,lastTier,nextPassGoal,claimBonus,activeOffers,rotation,pass,refreshPass,unlockPass,claimPass,restore,stock,buy,odds,grantChest,complete,weekly,eventReward};
})();

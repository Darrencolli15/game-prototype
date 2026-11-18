"use strict";

const $ = id => document.getElementById(id);
const native = window.webkit?.messageHandlers?.bramble;
const localRead = key => {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
};
const rawSave=window.brambleSavedGame ?? localRead(Campaign.saveKey);
const p=Campaign.load(rawSave,localRead("bramble-brigade-v1"));
const previousPassSettled=Economy.restore(p,rawSave);
const areaSize=Campaign.levelsPerArena;
const currentArena=()=>Math.min(Campaign.zones.length-1,Math.floor(p.unlocked/areaSize));
let zone = currentArena();
let page = "campaign";
let active = null;
let activeIndex = 0;
let paused = false;
let tempo = 1;
let replaceSlot = null;
let replaceSpell = null;
let pendingTroop = null;
let pendingSpell = null;
let shopDay = null;
let offerEnds = null;
let displayedWeek = null;
let preview = null;
let troopFilter = "All";
let revealTicket = 0;
let openedDetail = null;
let prices = {};
let storeBusy = false;
let lastTime = 0;
let nextHud = 0;
let statusTimeout;
let soundOn=true;

try { soundOn=localStorage.getItem("bramble-sound")!=="off"; } catch {}
$("soundToggle").setAttribute("aria-pressed",String(soundOn));

function feedback(kind="tap") {
  if(native && kind!=="tap") native.postMessage({type:"feedback",kind}).catch(()=>{});
  if(soundOn)try {Sound.play(kind);} catch {}
}
function pulse(element,name) {
  element.classList.remove(name);
  requestAnimationFrame(()=>element.classList.add(name));
}
$("soundToggle").addEventListener("click",()=>{
  soundOn=!soundOn;
  $("soundToggle").setAttribute("aria-pressed",String(soundOn));
  try { localStorage.setItem("bramble-sound",soundOn?"on":"off"); } catch {}
  if(soundOn) feedback();
  else Sound.stop();
});

function save() {
  const encoded=JSON.stringify(p);
  try { localStorage.setItem(Campaign.saveKey,encoded); } catch {}
  return native ? native.postMessage({type:"save",data:encoded}) : Promise.resolve(true);
}
function persist() {
  save().catch(()=>notify("Progress could not be saved on this device."));
}
function notify(text) {
  clearTimeout(statusTimeout);
  $("status").textContent=text;
  statusTimeout=setTimeout(()=>{ $("status").textContent=""; },5600);
}
function image(key) { return "./png/"+(Campaign.cards[key]?.art||key)+".png"; }
function number(n) { return n.toLocaleString(); }
function icon(key){return `<img class="ui-icon" src="./icons/${key}.svg" alt="">`;}
const checkoutArt=offer=>offer.art||"chest-mega";
const passOffer=Campaign.offers.find(offer=>offer.passTokens);
function priceFor(offer){return native?prices[offer.id]||"Unavailable":offer.price;}
function canBuy(offer){
  return !!(offer&&native&&prices[offer.id]&&!storeBusy&&
    Economy.activeOffers().includes(offer)&&!p.economy.boosts[offer.boost]);
}
function passBadge(){
  const pass=Economy.pass(p);
  return Economy.passTiers.reduce((sum,tier,i)=>sum+(tier.points<=pass.points?
    Number(!pass.freeClaims.includes(i))+Number(pass.premium&&!pass.paidClaims.includes(i)):0),pass.bonus-pass.bonusClaims);
}
function wallet() {
  const level=Campaign.playerLevel(p.xp);
  const lower=Campaign.xpThresholds[level-1];
  const upper=Campaign.xpThresholds[level];
  const label=$("playerLevel");
  label.textContent="Lv "+level;
  $("xpBar").max=upper?upper-lower:1;
  $("xpBar").value=upper?p.xp-lower:1;
  $("xpText").textContent=upper?(upper-p.xp)+" XP left":"Max level";
  $("xpBar").title=upper?(p.xp-lower)+" / "+(upper-lower)+" XP":"Maximum player level";
  $("walletAcorns").textContent=number(p.acorns);
  $("walletGems").textContent=number(p.economy.gems);
  $("walletAcorns").parentElement.setAttribute("aria-label","Gold shop · "+number(p.acorns)+" gold");
  $("walletGems").parentElement.setAttribute("aria-label","Gem shop · "+number(p.economy.gems)+" gems");
  const chests=p.seals+p.economy.levelChests+p.economy.milestoneChests+Number(Date.now()>=p.economy.freeAt);
  $("chestCount").hidden=!chests;
  $("chestCount").textContent=chests;
  const milestone=level<100&&(level+1)%5===0;
  const nextChest=milestone?"milestone":"level";
  const queued=p.economy.levelChests+p.economy.milestoneChests;
  const xpChest=$("xpChest");
  xpChest.querySelector("img").src="./icons/chest-"+(p.economy.milestoneChests?"milestone":p.economy.levelChests?"level":nextChest)+".svg";
  xpChest.dataset.chestInfo=p.economy.milestoneChests?"milestone":p.economy.levelChests?"level":nextChest;
  xpChest.setAttribute("aria-label",queued?"Open earned level chests":milestone?"Next level milestone chest":"Next level chest");
  xpChest.classList.toggle("ready",queued>0);
  $("xpChestCount").hidden=!queued;
  $("xpChestCount").textContent=queued;
  const passCount=passBadge();
  $("passCount").hidden=!passCount;
  $("passCount").textContent=passCount;
  const pass=Economy.pass(p);
  const next=Economy.nextPassGoal(pass.points);
  $("homePassHint").textContent=passCount?passCount+" ready":pass.points+" / "+next+" pts";
  $("homePassProgress").max=next;
  $("homePassProgress").value=pass.points;
  $("homePass").classList.toggle("claimable",passCount>0);
  const ready=Object.keys(Campaign.cards).filter(key=>Campaign.canMerge(p,key)).length;
  $("mergeCount").hidden=!ready;
  $("mergeCount").textContent=ready;
}
function go(screen) {
  if(screen!==page && active?.status==="playing") pause(true);
  page=screen;
  for(const id of ["campaign","collection","spells","event","shop"]) $(id).hidden=id!==page;
  for(const button of document.querySelectorAll("[data-page]")) {
    if(button.dataset.page===screen) button.setAttribute("aria-current","page");
    else button.removeAttribute("aria-current");
  }
  render();
  window.scrollTo({top:0,behavior:"instant"});
}
function render() {
  wallet();
  const home=page==="campaign"&&!active;
  document.body.dataset.view=home?"home":page==="campaign"?"battle":"section";
  $("subNav").hidden=home||page==="campaign";
  $("pageDots").innerHTML=screens.map((name,i)=>`<button aria-label="Open ${screenNames[i]}" data-page="${name}" class="${name===page?"selected":""}"></button>`).join("");
  if(page==="campaign") {
    $("map").hidden=!!active;
    $("combat").hidden=!active;
    if(!active) renderMap();
    else renderBattle();
  }
  if(page==="collection") renderCollection();
  if(page==="spells") renderAbilities();
  if(page==="event") renderEvent();
  if($("pass").open) renderPass();
  if(page==="shop") renderShop();
}
function renderMap() {
  zone=currentArena();
  const base=zone*areaSize;
  const path=Campaign.levels.slice(base,base+areaSize);
  const reached=path.map((level,offset)=>({level,index:base+offset})).filter(entry=>entry.index<=p.unlocked);
  const next=reached.find(entry=>entry.index===p.unlocked);
  const backdrop=reached.filter(entry=>entry.index<p.unlocked).slice(-2);
  const shadows=backdrop.map((entry,i)=>`<span class="trail-shadow shadow-${i}" aria-hidden="true"><img src="${image(entry.level.wave[0])}" alt=""></span>`).join("");
  const upcoming=next?Campaign.levels[next.index+1]:null;
  const teaser=upcoming?`<span class="trail-teaser" role="img" aria-label="Upcoming ${upcoming.chapter!==zone?"arena":"battle"}, locked">
    <img src="${upcoming.chapter!==zone?"./png/relic"+upcoming.chapter+".png":image(upcoming.wave[0])}" alt=""><b aria-hidden="true">?</b></span>`:"";
  $("levels").innerHTML=next?`<div class="trail-focus">${shadows}${encounter(next,true)}${teaser}</div>`:'<div class="arena-cleared">★ Arena cleared</div>';
  $("arenaList").innerHTML=Campaign.zones.map((arena,i)=>{
    const done=Campaign.levels.filter((_,n)=>Math.floor(n/areaSize)===i&&p.medals[n]).length;
    return `<button class="arena-stop" data-arena="${i}" ${i>zone?"disabled":""}><img src="./png/relic${i}.png" alt=""><span><small>Arena ${i+1}</small><strong>${arena.name}</strong></span><b>${i>zone?"Locked":done+"/5"}</b></button>`;
  }).join("")+'<div class="coming">✧ &nbsp; Coming soon</div>';
  const past=reached.filter(entry=>entry!==next);
  $("pastBattles").hidden=!past.length;
  $("pastBattles").open=false;
  $("historyLevels").innerHTML=past.map(entry=>encounter(entry,false)).join("");
  const matches=p.economy.matches%3;
  $("matchPips").innerHTML=[0,1,2].map(i=>`<i class="${i<matches?"filled":""}"></i>`).join("");
  $("matchChest").classList.toggle("ready",p.seals>0);
  $("matchChestLabel").textContent=p.seals?p.seals+" ready":matches+" / 3";
  $("sideModes").innerHTML=Object.entries(Campaign.modes).map(([key,mode])=>
    `<button type="button" class="side-mode ${key}" data-mode="${key}"><img src="./png/${mode.art}.png" alt=""><span><strong>${mode.name}</strong><small>${mode.hint}</small></span><i aria-hidden="true">›</i></button>`).join("");
  const mastery=$("mastery");
  mastery.hidden=p.unlocked<Campaign.levels.length || zone!==Campaign.zones.length-1 || p.season>=3;
  mastery.innerHTML=mastery.hidden?"":'<button class="primary" type="button" data-mastery>Start mastery '+(p.season+1)+'</button><p class="hint">Replay the campaign against tougher enemies.</p>';
}
function encounter({level,index},next){
  const stars=p.medals[index]||0;
  const ability=Object.values(Campaign.abilities).find(item=>item.at===index+1);
  const icon=level.boss?`./png/boss${zone}.png`:image(level.wave[0]);
  const milestone=level.boss?`./png/relic${zone}.png`:ability?`./png/${ability.art}.png`:"";
  if(next)return `<button type="button" class="encounter ${level.boss?"boss":""}" data-level="${index}" aria-label="${level.name}, start battle">
    <img src="${icon}" alt=""><span><small>${level.boss?"Boss":"Arena "+(zone+1)+" · "+(level.index+1)+"/5"}</small><strong>${level.name}</strong>
      ${milestone?`<span class="encounter-reward"><img src="${milestone}" alt=""> </span>`:''}</span><b>▶ Play</b></button>`;
  return `<button type="button" class="level-row" data-level="${index}"><span class="level-mark">${level.index+1}</span><span><strong>${level.name}</strong></span><span class="level-state">${stars?"★".repeat(stars)+"☆".repeat(3-stars):"Replay"}</span></button>`;
}
function rankText(item) { return item.rank===6?"Max rank":"Rank "+item.rank; }
function renderCollection() {
  $("deck").classList.toggle("swapping",!!pendingTroop);
  $("deck").innerHTML=p.deck.map((key,index)=>{
    const card=Campaign.cards[key];
    return `<button type="button" data-slot="${index}" aria-label="Swap slot ${index+1}, ${card.name}" aria-pressed="${replaceSlot===index}"><i>⇄</i><img src="${image(key)}" alt=""><strong>${card.name}</strong><small>Rank ${p.inventory[key].rank}</small></button>`;
  }).join("");
  $("deckPrompt").textContent=pendingTroop?"Choose slot · "+Campaign.cards[pendingTroop].name+".":
    replaceSlot===null?"⇄ Swap": "Slot "+(replaceSlot+1)+" · Choose troop";
  $("rarityFilters").innerHTML=["All","Common","Rare","Epic"].map(rarity=>`<button type="button" data-rarity-filter="${rarity}" aria-pressed="${troopFilter===rarity}">${rarity}</button>`).join("");
  $("collectionCards").innerHTML=Object.entries(Campaign.cards).filter(([,card])=>troopFilter==="All"||card.rarity===troopFilter).map(([key,card])=>{
    const item=p.inventory[key];
    const need=item?Campaign.rankCost[item.rank-1]:undefined;
    const ready=Campaign.canMerge(p,key);
    const inDeck=p.deck.includes(key);
    const upgrade=item?`<div class="card-buttons">
       ${need===undefined?'<small>Max</small>':ready?`<button type="button" class="merge-signal" data-troop-info="${key}" aria-label="${card.name} ready to merge">↑</button>`:
         `<span class="copy-meter" aria-label="${item.copies} of ${need} copies"><progress value="${item.copies}" max="${need}" aria-hidden="true"></progress><small>${item.copies}/${need}</small></span>`}
       ${inDeck?'<span class="equipped-label">✓ Deck</span>':`<button type="button" class="secondary swap-action ${replaceSlot!==null?"swap-focus":""}" data-equip="${key}">${replaceSlot!==null?"⇄ Use in slot "+(replaceSlot+1):"⇄ Swap in"}</button>`}</div>`:"";
    return `<article class="collection-card ${item?"":"locked"} ${ready?"merge-glow":""}"><button type="button" class="card-head portrait-button" data-troop-info="${key}" aria-label="${card.name} stats and preview"><img src="${image(key)}" alt=""><span><span class="rarity ${card.rarity}">${card.rarity}</span><br><strong>${card.name}</strong><small>${item?rankText(item):"🔒 Locked"} · ${card.cost} sap</small></span><i>ⓘ</i></button>${upgrade}</article>`;
  }).join("");
}
function renderAbilities(){
  $("spellEquipHint").textContent=pendingSpell?"Pick a slot":replaceSpell!==null?"Pick an ability":
    Campaign.spellSlots(p)===1?"1 / 2 slots":"⇄ Swap";
  $("spellDeck").classList.toggle("swapping",!!pendingSpell);
  $("spellDeck").innerHTML=p.spells.map((key,index)=>{
    const ability=Campaign.abilities[key];
    return `<button type="button" data-spell-slot="${index}" aria-pressed="${replaceSpell===index}" aria-label="Swap ability slot ${index+1}, ${ability.name}"><i>⇄</i><img src="./png/${ability.art}.png" alt=""><strong>${ability.name}</strong></button>`;
  }).join("");
  $("abilities").innerHTML=Object.entries(Campaign.abilities).map(([key,ability])=>{
    const available=Campaign.availableAbility(key,p);
    const equipped=p.spells.includes(key);
    const unlock=Campaign.levels[ability.at-1];
    return `<article class="collection-card ${available?"":"locked"}"><button type="button" class="card-head portrait-button" data-spell-info="${key}" aria-label="${ability.name} details and preview"><img src="./png/${ability.art}.png" alt=""><span><strong>${ability.name}</strong><small>${available?ability.cooldown+" s":"Locked"}</small></span><i>ⓘ</i></button>
      ${available&&!equipped?`<button type="button" class="secondary swap-action ${replaceSpell!==null?"swap-focus":""}" data-ability="${key}">⇄ Swap in</button>`:equipped?'<span class="equipped-label">✓ Equipped</span>':`<small class="unlock-label">After ${unlock.boss?"boss":"battle "+(unlock.index+1)} · Arena ${unlock.chapter+1}</small>`}</article>`;
  }).join("");
}
const chestLabels={trail:"Trail Chest",level:"Level-up Chest",free:"Supply Chest",gem:"Gem Chest",milestone:"Milestone Chest"};
function chestReady(kind,now=Date.now()){
  return {trail:p.seals>0,level:p.economy.levelChests>0,milestone:p.economy.milestoneChests>0,free:now>=p.economy.freeAt,gem:p.economy.gems>=Economy.gemCost}[kind];
}
function renderShop() {
  const now=Date.now(),stock=Economy.stock(p,now);
  shopDay=stock.id;
  const chestItems=[
    ["trail",p.seals? p.seals+" ready":"Every 3 battles"],
    ["level",p.economy.levelChests?p.economy.levelChests+" ready":"Each level"],
    ["milestone",p.economy.milestoneChests?p.economy.milestoneChests+" ready":"Every 5 levels"],
    ["free",chestReady("free",now)?"Ready":countdown(p.economy.freeAt-now)],
    ["gem",icon("gem")+" "+Economy.gemCost]
  ];
  $("chests").innerHTML=chestItems.map(([key,caption])=>`<button type="button" class="shop-chest ${key} ${chestReady(key,now)?"ready":""}" data-chest-info="${key}" aria-label="${chestLabels[key]} details"><img class="chest-icon" src="./icons/chest-${key}.svg" alt=""><strong>${chestLabels[key]}</strong><small>${caption}</small></button>`).join("");
  $("trader").innerHTML=stock.items.map(item=>`<article class="offer"><img src="${image(item.key)}" alt=""><div><strong>${Campaign.cards[item.key].name}</strong><small>${item.locked?"Locked":item.bought?"Sold out":"1 in stock"}</small></div><button class="primary" type="button" data-trade="${item.key}" ${item.bought||item.locked||p.acorns<item.price?"disabled":""}>${item.bought?"Sold":icon("gold")+item.price}</button></article>`).join("");
  $("paymentHelp").textContent=native?"":"iPhone shop preview";
  const {reset}=Economy.rotation(now);
  offerEnds=reset;
  const offers=Economy.activeOffers(now);
  const bundle=offers.find(offer=>offer.rotation);
  $("weeklyOffer").innerHTML=`<button type="button" class="weekly-offer" data-offer="${bundle.id}"><img src="./icons/chest-mega.svg" alt=""><span><small>Weekly bundle · <span id="offerClock"></span></small><strong>${bundle.name}</strong><span class="bundle-tokens">${prizeTokens({gold:bundle.acorns,gems:bundle.gems})} <span>6 cards</span></span></span><b>${priceFor(bundle)}</b></button>`;
  $("premium").innerHTML=offers.filter(offer=>!offer.rotation&&!offer.boost).map(offerTile).join("");
  $("boosts").innerHTML=offers.filter(offer=>offer.boost).map(offerTile).join("");
  $("restoreStore").hidden=!native;
  shopClock(now);
}
function offerTile(offer){
  return `<button type="button" class="premium-tile" data-offer="${offer.id}" aria-label="${offer.name} details"><img src="./icons/${checkoutArt(offer)}.svg" alt=""><strong>${offer.name}</strong><small>${p.economy.boosts[offer.boost]?"Owned":priceFor(offer)}</small></button>`;
}
function prizeTokens(prize){
  return [["gold","gold"],["gems","gem"],["trail","chest-trail"],["level","chest-level"],["milestone","chest-milestone"]]
    .filter(([key])=>prize[key]).map(([key,art])=>`<span>${icon(art)}<b>${prize[key]}</b></span>`).join("");
}
function renderPass(now=Date.now()){
  const pass=Economy.pass(p,now);
  $("passTime").textContent=countdown(pass.reset-now)+" left";
  const next=Economy.nextPassGoal(pass.points);
  const done=pass.points>=Economy.lastTier;
  $("passScore").textContent=done?`${pass.points} pts · 35 / 35 tiers`:`${pass.points} / ${next} pts`;
  $("passProgress").max=next;
  $("passProgress").value=pass.points;
  const ready=pass.bonus-pass.bonusClaims;
  $("passBonus").innerHTML=`<button type="button" class="pass-bonus ${ready?"claimable":""}" data-pass-bonus ${ready?"":"disabled"}><img src="./icons/chest-gold.svg" alt=""><span><strong>Bonus Gold Chest</strong><small>${ready?`${ready} ready`:done?`${Economy.bonusStep-(next-pass.points)} / ${Economy.bonusStep} pts`:`Every ${Economy.bonusStep} pts after Tier 35`}</small></span><b>${ready?"Claim ›":"◆"}</b></button>`;
  $("passAction").innerHTML=pass.premium?'<div class="pass-active">✓ Premium active</div>':
    pass.credits?'<button type="button" data-pass-activate class="primary">Activate premium</button>':
      `<button type="button" data-offer="${passOffer.id}" class="primary">${icon("pass")} Premium · ${priceFor(passOffer)}</button>`;
  $("passTrack").innerHTML=Economy.passTiers.map((tier,i)=>{
    const earned=pass.points>=tier.points;
    const track=(key,premium)=>{
      const paid=!premium||pass.premium;
      const claimed=(premium?pass.paidClaims:pass.freeClaims).includes(i);
      const caption=claimed?"Claimed":earned&&paid?"Claim":premium&&!paid?"Premium":"Locked";
      return `<button type="button" class="pass-reward ${premium?"premium":""} ${earned&&paid&&!claimed?"claimable":""}" data-pass-claim="${i}" data-track="${key}" aria-label="Tier ${i+1} ${key} · ${caption}" ${claimed||!earned||!paid?"disabled":""}>${prizeTokens(tier[key])}<small>${caption}</small></button>`;
    };
    return `<div class="pass-tier ${earned?"earned":""}"><span><b>${i+1}</b><small>${tier.points}</small></span>${track("free",false)}${track("premium",true)}</div>`;
  }).join("");
}
function countdown(milliseconds){
  const seconds=Math.max(0,Math.ceil(milliseconds/1000));
  const hours=Math.floor(seconds/3600);
  if(hours>=24)return Math.floor(hours/24)+"d "+hours%24+"h";
  return hours+":"+String(Math.floor(seconds/60)%60).padStart(2,"0")+":"+String(seconds%60).padStart(2,"0");
}
function shopClock(now){
  const stock=Economy.stock(p,now);
  if($("offerClock"))$("offerClock").textContent=countdown(offerEnds-now)+" left";
  $("stockClock").textContent="Restocks in "+countdown(stock.reset-now);
  const free=$("chests").querySelector('[data-chest-info="free"]');
  const ready=chestReady("free",now);
  if(free){
    free.querySelector("small").textContent=ready?"Ready":countdown(p.economy.freeAt-now);
    free.classList.toggle("ready",ready);
  }
}
function renderEvent(now=Date.now()){
  const event=Economy.weekly(p,now);
  displayedWeek=event.id;
  $("eventTitle").textContent=event.title;
  $("eventArt").src="./png/boss"+event.boss+".png";
  $("eventClock").textContent="Resets in "+countdown(event.reset-now);
  $("eventTime").textContent=event.bestTime+"s";
  $("eventDamage").textContent=event.bestDamage+"%";
  $("eventTiers").innerHTML=`<h3>Rewards <small>Meet either goal</small></h3>`+Economy.tiers.map((tier,index)=>{
    const claimed=event.claimed&(1<<index);
    return `<article class="event-tier"><b class="event-rank">${claimed?"✓":index+1}</b><div><strong>${tier.time}s alive <i>or</i> ${tier.damage}% fort damage</strong></div><div class="event-prizes">${prizeTokens({gold:tier.gold,gems:tier.gems,trail:tier.chests})}</div></article>`;
  }).join("");
}
function updateClocks(){
  const now=Date.now();
  const rolled=Economy.refreshPass(p,now);
  if(rolled)persist();
  if($("pass").open){
    if(rolled)renderPass(now);
    else $("passTime").textContent=countdown(Economy.pass(p,now).reset-now)+" left";
  }
  if(page==="shop"){
    if(now>=offerEnds||Economy.stock(p,now).id!==shopDay)renderShop();
    else shopClock(now);
  }
  if(page==="event"){
    const event=Economy.weekly(p,now);
    if(event.id!==displayedWeek)renderEvent(now);
    else $("eventClock").textContent="Resets in "+countdown(event.reset-now);
  }
  wallet();
}
function reward(title,grants,acorns=0,gems=0,{chest=null,newCards=[],credits=0}={}){
  const ticket=++revealTicket;
  const dialog=$("rewardDialog"),artwork=$("rewardArt"),contents=$("rewardCards");
  $("rewardTitle").textContent=title;
  artwork.hidden=!chest;
  artwork.innerHTML=chest?`<img src="./icons/chest-${chest}.svg" alt="">`:"";
  contents.innerHTML=[
    ...Object.entries(grants).map(([key,count])=>`<div class="reward-line ${Campaign.cards[key].rarity}" data-cue="${newCards.includes(key)?"discovery":Campaign.cards[key].rarity.toLowerCase()}"><img src="${image(key)}" alt=""><span>${Campaign.cards[key].name}${newCards.includes(key)?" <em>NEW</em>":""}</span><b>×${count}</b></div>`),
    acorns?`<div class="reward-line">${icon("gold")}<span>Gold</span><b>+${acorns}</b></div>`:"",
    gems?`<div class="reward-line">${icon("gem")}<span>Gems</span><b>+${gems}</b></div>`:"",
    credits?`<div class="reward-line">${icon("pass")}<span>Pass credit</span><b>+${credits}</b></div>`:""
  ].join("");
  const items=[...contents.children];
  const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(!dialog.open)dialog.showModal();
  if(chest) {
    pulse(artwork,"chest-pop");
    setTimeout(()=>{
      if(ticket===revealTicket&&dialog.open)artwork.querySelector("img").src="./icons/chest-open.svg";
    },reduce?0:390);
  }
  feedback(chest?"chest":"reward");
  items.forEach((item,i)=>{
    if(!reduce)item.classList.add("pre-reveal");
    setTimeout(()=>{
      if(ticket!==revealTicket||!dialog.open)return;
      item.classList.remove("pre-reveal");
      pulse(item,"reveal-item");
      if(item.dataset.cue)feedback(item.dataset.cue);
    },reduce?i*140:(chest?540:110)+i*150);
  });
}
function openInfo(title,artName,body,action=""){
  if(page==="campaign"&&active?.status==="playing"&&!paused)pause(true);
  openedDetail=null;
  preview=null;
  $("detailContent").innerHTML=`<div class="detail-title"><div><h2>${title}</h2></div><button type="button" class="small" data-close-detail aria-label="Close details">×</button></div>
    ${artName?`<div class="info-art">${icon(artName)}</div>`:""}${body}${action}`;
  if(!$("detailDialog").open)$("detailDialog").showModal();
}
function showChest(kind){
  if(!chestLabels[kind])return;
  const quantities={trail:"1 Common · 25% chance of 1 extra",level:"2 Common · 1 gem",free:"1 Common",milestone:"3 Common · 1 gem",gem:"3 draws"};
  const values={trail:"0–5 gold",level:"2 gold",free:"1 gold",milestone:"3–7 gold",gem:"5 gold"};
  const odds=kind==="gem"?Economy.odds(p):{Common:100};
  const action=chestReady(kind)?`<button type="button" class="primary modal-primary" data-chest="${kind}">${kind==="gem"?icon("gem")+Economy.gemCost:"Open chest"}</button>`:
    `<p class="info-caption">${{trail:"Finish 3 battles",level:"Earn a player level",milestone:"Reach a level divisible by 5",free:"Ready in "+countdown(p.economy.freeAt-Date.now()),gem:"Requires "+Economy.gemCost+" gems"}[kind]}</p>`;
  openInfo(chestLabels[kind],"chest-"+kind,`<div class="info-tokens"><span>${quantities[kind]}</span><span>${values[kind]}</span></div><div class="odds-line">${Object.entries(odds).map(([name,prob])=>`<b class="rarity ${name}">${name} ${prob}%</b>`).join("")}</div>`,action);
}
function showOffer(id){
  const offer=Campaign.offers.find(item=>item.id===id);
  if(!offer||!Economy.activeOffers().includes(offer))return;
  const owned=p.economy.boosts[offer.boost];
  const listed=Object.entries(offer.cards).map(([key,count])=>`<div class="drop-tile"><img src="${image(key)}" alt=""><strong>${Campaign.cards[key].name}</strong><small>${Campaign.cards[key].rarity} ×${count}</small></div>`).join("");
  openInfo(offer.name,checkoutArt(offer),`<div class="info-tokens">${prizeTokens({gold:offer.acorns,gems:offer.gems})}${offer.passTokens?"<span>1 season credit</span>":""}</div>
    ${listed?`<div class="drop-grid">${listed}</div><p class="info-caption">Guaranteed contents</p>`:offer.passTokens?'<p class="info-caption">Activate for the current 28-day season. Claim earned Premium tiers.</p>':offer.benefit?`<p class="info-caption">${offer.benefit} · Permanent</p>`:""}`,
    `<button type="button" class="primary modal-primary" data-buy="${id}" ${canBuy(offer)?"":"disabled"}>${owned?"Owned":priceFor(offer)}</button>${native?"":'<p class="info-caption">iPhone purchase</p>'}`);
}
function startBattle(index,event=null,mode=null) {
  if(!Campaign.levels[index] || (!event&&!mode&&index>p.unlocked))return;
  activeIndex=index;
  zone=Campaign.levels[index].chapter;
  active=new Battle(index,{...p,deck:[...p.deck],spells:[...p.spells],inventory:JSON.parse(JSON.stringify(p.inventory))},event,mode);
  paused=false;
  tempo=1;
  page="campaign";
  $("battleZone").textContent=event?"Weekly challenge":mode?.hint??Campaign.zones[zone].name;
  $("battleTitle").textContent=active.level.name;
  $("leaveBattle").textContent=event?"‹ Event":"‹ Trail";
  $("allyHp").max=active.healthMax;
  $("enemyHp").max=active.enemyMax;
  $("battleSpells").innerHTML=active.progress.spells.map(key=>{
    const ability=Campaign.abilities[key];
    return `<button type="button" class="spell-button" data-cast="${key}" aria-label="${ability.name}" title="${ability.description}">
      <img src="./png/${ability.art}.png" alt=""><b></b></button>`;
  }).join("");
  $("hand").innerHTML=active.progress.deck.map(key=>{
    const card=Campaign.cards[key];
    return `<button type="button" class="troop ${card.rarity}" data-recruit="${key}" aria-label="Deploy ${card.name}, ${card.cost} sap"><span class="cost">${card.cost}</span><img src="${image(key)}" alt=""><strong>${card.name}</strong><small>${card.role}</small></button>`;
  }).join("");
  go("campaign");
}
function renderBattle() {
  const speed=$("tempo");
  speed.hidden=!p.economy.boosts.speed||!!active.event;
  speed.disabled=active.status!=="playing"||paused;
  speed.textContent=tempo+"×";
  speed.setAttribute("aria-pressed",String(tempo===2));
  speed.setAttribute("aria-label",tempo===2?"Return to normal battle speed":"Double battle speed");
  $("pause").disabled=active.status!=="playing" || paused;
  $("battleOverlay").hidden=active.status==="playing" && !paused;
  if(paused && active.status==="playing") {
    $("battleMessage").textContent="Battle paused";
    $("battleDetail").textContent="";
    $("battleAction").textContent="Resume";
    $("battleLoot").innerHTML="";
    $("battlePeek").hidden=true;
  }
  hud();
  paint();
}
function hud() {
  $("allyHp").value=active.health;
  $("enemyHp").value=active.enemyHealth;
  $("allyNumber").textContent=active.health;
  $("enemyNumber").textContent=active.enemyHealth;
  const seconds=Math.max(0,Math.ceil(active.timeLimit-active.time));
  $("battleTime").textContent=Math.floor(seconds/60)+":"+String(seconds%60).padStart(2,"0");
  const notice=active.noticeTime?active.notice:"";
  if($("notice").textContent!==notice) $("notice").textContent=notice;
  const untilWave=Math.max(1,Math.ceil(active.nextEnemy-active.time));
  const tillSiege=Math.max(0,Math.ceil(active.siegeAt-active.time));
  $("siegeStatus").hidden=!Number.isFinite(active.siegeAt)||active.enemyHealth<=active.enemyMax*.25 && !active.siegeInFlight;
  $("siegeStatus").classList.toggle("warning",tillSiege<=3 || active.siegeInFlight>0);
  $("siegeStatus").textContent="☄ "+(active.siegeInFlight>0?"!":tillSiege+"s");
  $("waveStatus").textContent=active.event||active.mode||active.wave<active.level.wave.length?"Next wave in "+untilWave+"s":"Final push";
  $("sapBar").value=active.sap;
  $("sapValue").textContent=Math.floor(active.sap)+" / "+battleRules.sapCap;
  $("sapRate").textContent=active.sapRate.toFixed(2)+" sap/sec";
  const playing=!paused&&active.status==="playing";
  const maxed=active.pumpCost===undefined;
  $("upgradeSap").disabled=!playing || maxed || active.sap<active.pumpCost;
  $("sapUpgradeDetail").textContent=maxed?"Level 4 · max output":"Lv "+(active.pumpLevel+1)+" → "+(active.pumpLevel+2)+" · "+active.sapRateAt(active.pumpLevel+1).toFixed(2)+"/sec";
  $("sapUpgradeCost").textContent=maxed?"MAX":"♦ "+active.pumpCost;
  for(const button of $("hand").querySelectorAll("button")) button.disabled=!playing||active.sap<Campaign.cards[button.dataset.recruit].cost;
  for(const button of $("battleSpells").querySelectorAll("button")){
    const key=button.dataset.cast;
    const remaining=active.cooldowns[key];
    const available=active.abilityReady(key);
    button.disabled=!playing||!available;
    button.querySelector("b").textContent=remaining?Math.ceil(remaining)+"s":available?"●":"";
  }
}
function paint() {
  if(active) art.paint(zone,active.health,active.enemyHealth,active.units,active.effects,active.time,active.fortFlash);
}
function pause(value) {
  if(active?.status!=="playing") return;
  paused=value;
  lastTime=0;
  renderBattle();
}
function leave() {
  const destination=active?.event?"event":"campaign";
  active=null;
  paused=false;
  zone=currentArena();
  go(destination);
}
function finishBattle() {
  const won=active.status==="won";
  const event=active.event;
  feedback(won||event?"win":"loss");
  let drops;
  let weekly;
  if(event){
    const damage=Math.floor((1-active.enemyHealth/active.enemyMax)*100);
    weekly=Economy.eventReward(p,event.id,active.time,damage);
    drops={acorns:weekly.gold,cards:{},surprises:[]};
    $("battleMessage").textContent="Challenge complete";
    $("battleDetail").textContent=weekly.expired?"A new week has started.":Math.floor(active.time)+"s survived · "+damage+"% damage";
  } else if(active.mode){
    drops={acorns:Number(won),cards:{}};
    p.acorns+=drops.acorns;
    $("battleMessage").textContent=won?"Side trail cleared":"Side trail complete";
    $("battleDetail").textContent=active.kills+" defeated";
  } else {
    drops=Campaign.battleReward(p,activeIndex,won,active.health/active.healthMax,active.kills);
    if(p.economy.boosts.gold){
      p.acorns+=drops.acorns;
      drops.acorns*=2;
    }
    $("battleMessage").textContent=won?(active.level.boss?"Boss defeated":"Trail cleared"):active.time>=active.timeLimit?"Time expired":"Burrow overrun";
    $("battleDetail").textContent=won?"★".repeat(drops.stars)+(drops.levelUps?" · Level "+Campaign.playerLevel(p.xp):""):drops.acorns?"":"Try a different deck.";
  }
  const damage=Math.round((1-active.enemyHealth/active.enemyMax)*100);
  const earned=Economy.complete(p,{...drops,boss:!!active.level.boss&&!event,kills:active.kills,damage,won});
  persist();
  const tokens=[
    drops.acorns?`<span class="loot-pill">${icon("gold")} <b>+${drops.acorns}</b></span>`:"",
    earned.trailChest||weekly?.chests?`<span class="loot-pill" title="Trail Chests">${icon("chest-trail")} <b>+${Number(earned.trailChest)+(weekly?.chests||0)}</b></span>`:"",
    earned.levelChests?`<span class="loot-pill special">${icon("chest-level")} <b>Level-up Chest</b></span>`:"",
    earned.gems||weekly?.gems?`<span class="loot-pill">${icon("gem")} <b>+${earned.gems+(weekly?.gems||0)}</b></span>`:"",
    earned.milestones?`<span class="loot-pill special">${icon("chest-milestone")} <b>Milestone Chest</b></span>`:"",
    drops.xp?`<span class="loot-pill"><b>+${drops.xp} XP</b></span>`:"",
    earned.passPoints?`<span class="loot-pill" title="Pass points">${icon("pass")}<b>+${earned.passPoints}</b></span>`:"",
    ...Object.entries(drops.cards).map(([key,count])=>`<span class="loot-pill" title="${Campaign.cards[key].name}"><img src="${image(key)}" alt="${Campaign.cards[key].name}"><b>×${count}</b></span>`),
    ...(drops.surprises||[]).map(item=>`<span class="loot-pill special"><img src="./png/${item.art}.png" alt=""><span><strong>${item.name}</strong><small>${item.label}</small></span></span>`)
  ];
  $("battleLoot").innerHTML=tokens.join("");
  if(tokens.some(Boolean))pulse($("battleLoot"),"loot-pop");
  const next=drops.newStage?Campaign.levels[p.unlocked]:null;
  $("battlePeek").hidden=!next;
  if(next){
    const artName=next.boss?`./png/boss${next.chapter}.png`:image(next.wave[0]);
    $("battlePeek").innerHTML=`<img src="${artName}" alt=""><span><small>Next up</small><strong>${next.name}</strong></span>`;
  }
  $("battleAction").textContent=event?"Events ›":active.mode||won?"Trail ›":"Retry battle";
  wallet();
  renderBattle();
}

const shortMoves={guard:"Front line",archer:"Ranged",giant:"Siege",runner:"Quick strikes",bomber:"Splash",warden:"Heal allies",
  lancer:"Charge",sentinel:"Armor",roots:"Root · 3 s",frost:"Freeze · 2.2 s",volley:"32 damage",spark:"+4 sap",
  rally:"Heal +23 · 5 s",ward:"Shield · 5 s",mercy:"Heal burrow +24 · Troops +12",gale:"Knockback",ember:"42 damage",bloom:"14 HP shield · 5 s"};
function makePreview(type,key){
  const troop=type==="troop";
  const starter=Campaign.load();
  starter.relics=p.relics;
  if(troop)starter.inventory[key]={rank:p.inventory[key]?.rank||1,copies:0};
  if(!troop)starter.spells=[key];
  const battle=new Battle(0,starter);
  battle.nextEnemy=Infinity;
  battle.siegeAt=Infinity;
  battle.fortCooldown=[Infinity,Infinity];
  battle.sap=key==="spark"?4:6;
  const actor=battle.spawn(troop?key:"guard",1);
  actor.x=key==="giant"?71:key==="archer"||key==="bomber"?35:43;
  if(key==="mercy"){actor.hp=Math.floor(actor.maxHp/2);battle.health-=24;}
  const card=troop?Campaign.cards[key]:null;
  if(card?.fury)actor.hp=Math.floor(actor.maxHp*.46);
  if(card?.heal||card?.aegis||key==="warden"||key==="rally"){
    const ally=battle.spawn("guard",1);
    ally.x=47;ally.hp=Math.floor(ally.maxHp/3);
    if(key==="rally")actor.hp=Math.floor(actor.maxHp/2);
  }
  if(key!=="giant"){
    const foe=battle.spawn(key==="bomber"?"runner":"guard",-1);
    foe.x=key==="runner"||key==="lancer"?67:57;
    if(key==="bomber"||key==="volley"||card?.splash||card?.chain){
      const group=battle.spawn("runner",-1);
      group.x=foe.x+4;
    }
  }
  return {battle,key,renderer:createBattleArt($("previewCanvas")),spell:!troop,autoCast:false};
}
function castPreview(){
  if(!preview?.spell)return;
  if(preview.battle.cast(preview.key)){
    preview.autoCast=true;
    feedback("cast");
  }
}
function drawPreview(dt){
  if(!preview||!$("detailDialog").open)return;
  if(preview.done)return;
  const demo=preview.battle;
  if(preview.spell&&!preview.autoCast&&demo.time>=.75)castPreview();
  if(demo.time<4.9)demo.step(dt);
  preview.renderer.paint(0,demo.health,demo.enemyHealth,demo.units,demo.effects,demo.time,demo.fortFlash);
  const ally=demo.units.find(unit=>unit.side===1);
  const enemy=demo.units.find(unit=>unit.side===-1);
  const readout=preview.key==="spark"?"Sap "+Math.floor(demo.sap):preview.key==="giant"?"Fort "+demo.enemyHealth+" HP":
    (ally?ally.hp+" HP":"0 HP")+"  ·  "+(enemy?enemy.hp+" HP":"0 HP");
  $("previewStats").textContent=readout+(preview.spell&&demo.noticeTime?" · "+shortMoves[preview.key]:"");
  const cast=$("previewCast");
  if(cast)cast.disabled=demo.time>=4.9||!demo.abilityReady(preview.key);
  preview.done=demo.time>=4.9||demo.status!=="playing";
}
function showDetail(type,key,justMerged=false){
  const troop=type==="troop";
  const data=(troop?Campaign.cards:Campaign.abilities)[key];
  if(!data)return;
  openedDetail={type,key};
  const item=p.inventory[key];
  const ready=troop&&Campaign.canMerge(p,key);
  const rank=item?.rank||1;
  const stats=troop?Campaign.cardStats(key,rank,p.relics):null;
  const future=troop&&rank<6?Campaign.cardStats(key,rank+1,p.relics):null;
  const available=troop?!!item:Campaign.availableAbility(key,p);

  const stat=(name,value,next)=>`<div><small>${name}</small><b>${value}${next!==undefined?` <em>→ ${next}</em>`:""}</b></div>`;
  const detailStats=troop?[
    stat("Health",stats.hp,future?.hp),stat("Damage",stats.hit,future?.hit),
    stat("Hit interval",stats.interval+" s"),stat("Range",stats.range),
    stat("Move speed",Number(stats.speed.toFixed(1))),stat("Sap cost",stats.cost)
  ].concat(data.heal?[stat("Heal",Math.round(data.heal*Campaign.rankPower[rank-1]),future?Math.round(data.heal*Campaign.rankPower[rank]):undefined)]:data.aegis?[stat("Shield",data.aegis)]:[]).join(""):stat("Cooldown",data.cooldown-(p.relics>=3?2:0)+" s");
  const mergeCost=Campaign.rankCost[rank-1];
  const footer=troop?item&&mergeCost?`<div class="merge-panel ${ready?"merge-glow":""}"><div><strong>Rank ${rank} → ${rank+1}</strong><small>${item.copies} / ${mergeCost} copies</small></div><progress max="${mergeCost}" value="${Math.min(item.copies,mergeCost)}" aria-label="Copies to next rank"></progress>${ready?`<button type="button" class="merge-action" data-merge="${key}"><span>↑</span> Merge to rank ${rank+1}</button>`:""}</div>`:"":"";
  $("detailContent").innerHTML=`<div class="detail-title"><div><span class="rarity ${data.rarity||""}">${troop?data.rarity:"Ability"}${available?"":" · Locked"}</span><h2>${data.name}</h2><small>${troop?(justMerged?"Rank "+rank+" reached!":(item?rankText(item):"Rank 1 preview")):shortMoves[key]}</small></div><button type="button" class="small" data-close-detail aria-label="Close details">×</button></div>
    <div class="demo battle-demo"><canvas id="previewCanvas" width="1000" height="670" aria-label="Live battle preview"></canvas><b id="previewStats"></b></div>
    <div class="demo-caption"><span>${troop?shortMoves[key]||data.text:"Practice cast"}</span><div>${troop?"":`<button type="button" class="small" id="previewCast" data-preview-cast aria-label="Cast ${data.name}"><img class="ui-icon" src="./png/${data.art}.png" alt=""></button>`}<button type="button" class="small" data-demo aria-label="Replay animation">↻</button></div></div>
    <div class="stat-grid">${detailStats}</div>${footer}`;
  if(!$("detailDialog").open)$("detailDialog").showModal();
  preview=makePreview(type,key);
  if(justMerged)pulse($("detailContent"),"loot-pop");
}
function equipTroop(key,slot){
  if(!p.inventory[key]||p.deck.includes(key)||slot<0||slot>=p.deck.length)return;
  p.deck[slot]=key;
  pendingTroop=replaceSlot=null;
  persist();renderCollection();feedback("deploy");
  notify(Campaign.cards[key].name+" equipped.");
}
function equipSpell(key,slot){
  if(!Campaign.availableAbility(key,p)||p.spells.includes(key)||slot<0||slot>=p.spells.length)return;
  p.spells[slot]=key;
  pendingSpell=replaceSpell=null;
  persist();renderAbilities();feedback("deploy");
  notify(Campaign.abilities[key].name+" equipped.");
}

document.addEventListener("click",event=>{
  const button=event.target.closest("button");
  if(!button || button.disabled) return;
  const d=button.dataset;
  if(d.page) {feedback();go(d.page);}
  if(d.mode){const mode=Campaign.modes[d.mode];feedback();startBattle(mode.index,null,mode);}
  if(d.level!==undefined) {feedback();startBattle(Number(d.level));}
  if(d.recruit && active&&!paused && active.recruit(d.recruit)) {
    feedback("deploy");
    pulse(button,"deployed");
    hud();
  }
  if(d.slot!==undefined) {
    const slot=Number(d.slot);
    if(pendingTroop)equipTroop(pendingTroop,slot);
    else{replaceSlot=replaceSlot===slot?null:slot;renderCollection();}
  }
  if(d.equip) {
    if(replaceSlot!==null)equipTroop(d.equip,replaceSlot);
    else{pendingTroop=pendingTroop===d.equip?null:d.equip;renderCollection();$("deck").scrollIntoView({block:"nearest"});}
  }
  if(d.rarityFilter){troopFilter=d.rarityFilter;renderCollection();}
  if(d.troopInfo)showDetail("troop",d.troopInfo);
  if(d.spellInfo)showDetail("spell",d.spellInfo);
  if(d.closeDetail!==undefined){preview=null;$("detailDialog").close();}
  if(d.previewCast!==undefined)castPreview();
  if(d.chestInfo)showChest(d.chestInfo);
  if(d.offer)showOffer(d.offer);
  if(d.passInfo!==undefined)openInfo("Earn pass points","pass",'<p class="info-caption">+3 for finishing · +1 per knockout · +1 per 20% fort damage · +5 for winning. Up to 24 per battle.</p>');
  if(d.passActivate!==undefined){
    if(Economy.unlockPass(p)){persist();feedback("reward");render();}
  }
  if(d.passClaim!==undefined){
    const prize=Economy.claimPass(p,Number(d.passClaim),d.track);
    persist();render();
    if(prize)openInfo("Tier "+(Number(d.passClaim)+1)+" claimed","pass",`<div class="info-tokens">${prizeTokens(prize)}</div>`);
  }
  if(d.passBonus!==undefined){
    const prize=Economy.claimBonus(p);
    if(prize){persist();render();reward("Bonus Gold Chest",prize.cards,prize.gold,0,{chest:"gold"});}
  }
  if(d.demo!==undefined&&openedDetail)showDetail(openedDetail.type,openedDetail.key);
  if(d.merge && Campaign.merge(p,d.merge)) {
    persist();wallet();renderCollection();feedback("reward");showDetail("troop",d.merge,true);
  }
  if(d.spellSlot!==undefined){
    const slot=Number(d.spellSlot);
    if(pendingSpell)equipSpell(pendingSpell,slot);
    else{replaceSpell=replaceSpell===slot?null:slot;renderAbilities();}
  }
  if(d.ability && Campaign.availableAbility(d.ability,p)) {
    if(replaceSpell!==null)equipSpell(d.ability,replaceSpell);
    else{pendingSpell=pendingSpell===d.ability?null:d.ability;renderAbilities();$("spellDeck").scrollIntoView({block:"nearest"});}
  }
  if(d.cast && !paused && active?.cast(d.cast)) {
    feedback("cast");
    pulse(button,"deployed");
    hud();
  }
  if(d.trade && Economy.buy(p,d.trade)) {
    persist();render();reward("Card purchased",{[d.trade]:1});
  }
  if(d.chest){
    const contents=Economy.grantChest(p,d.chest);
    if(contents){
      $("detailDialog").close();persist();render();
      reward(chestLabels[d.chest],contents.cards,contents.gold,contents.gems,{chest:d.chest,newCards:contents.newCards});
    }
  }
  if(d.buy) purchase(d.buy);
  if(d.mastery!==undefined) {
    p.season++;
    p.unlocked=0;
    p.medals={};
    p.attempts={};
    zone=0;
    persist();render();
  }
});
const screens=["campaign","collection","spells","event","shop"];
const screenNames=["Home","Troops","Abilities","Events","Shop"];
function openTrailSheet(modes){
  $("sheetTitle").textContent=modes?"Modes":"Arenas";
  $("arenaList").hidden=modes;
  $("sideModes").hidden=!modes;
  $("pastBattles").hidden=true;
  $("trailSheet").showModal();
}
$("arenaGate").onclick=()=>openTrailSheet(false);
$("modeGate").onclick=()=>openTrailSheet(true);
$("closeSheet").onclick=()=>$("trailSheet").close();
$("trailSheet").addEventListener("click",event=>{
  const button=event.target.closest("button");
  if(!button)return;
  if(button.dataset.mode||button.dataset.level!==undefined)$("trailSheet").close();
  if(button.dataset.arena===undefined)return;
  const i=Number(button.dataset.arena);
  if(i>currentArena())return;
  const rows=Campaign.levels.map((level,index)=>({level,index})).filter(row=>row.level.chapter===i&&row.index<=p.unlocked);
  $("historyLevels").innerHTML=rows.map(row=>encounter(row,row.index===p.unlocked)).join("");
  $("pastBattles").hidden=false;
  $("pastBattles").open=true;
  $("pastBattles").querySelector("summary").textContent=Campaign.zones[i].name;
  $("pastBattles").scrollIntoView({block:"nearest"});
});
let swipeStart;
document.addEventListener("touchstart",event=>{
  swipeStart=!active&&!document.querySelector("dialog[open]")&&event.touches.length===1?event.touches[0]:null;
},{passive:true});
document.addEventListener("touchend",event=>{
  if(!swipeStart)return;
  const dx=event.changedTouches[0].clientX-swipeStart.clientX,dy=event.changedTouches[0].clientY-swipeStart.clientY;
  swipeStart=null;
  if(Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.6){
    const target=screens[screens.indexOf(page)+(dx<0?1:-1)];
    if(target)go(target);
  }
},{passive:true});
document.addEventListener("touchcancel",()=>{swipeStart=null;});
$("homePass").addEventListener("click",()=>{
  feedback();
  renderPass();
  $("pass").showModal();
  $("pass").scrollTop=0;
});
$("closePass").addEventListener("click",()=>{feedback();$("pass").close();});
$("tempo").addEventListener("click",()=>{tempo=tempo===1?2:1;feedback();renderBattle();});
$("restoreStore").addEventListener("click",async()=>{
  try{
    await native.postMessage({type:"restore"});
    notify("Purchases restored.");
  }catch{notify("Restore unavailable. Try again from the shop.");}
});
$("leaveBattle").addEventListener("click",leave);
$("pause").addEventListener("click",()=>pause(true));
$("battleAction").addEventListener("click",()=>{
  if(((active.event||active.mode) && active.status!=="playing") || active.status==="won") leave();
  else if(active.status==="lost") startBattle(activeIndex);
  else pause(false);
});
$("upgradeSap").addEventListener("click",()=>{
  if(paused || !active?.upgradeSap()) return;
  feedback("pump");
  pulse($("sapBar").parentElement,"surge");
  active.announce("Sap pump upgraded!");
  hud();
});
$("startEvent").addEventListener("click",()=>{
  const event=Economy.weekly(p);
  feedback();
  if(active?.event?.id===event.id && active.status==="playing"){go("campaign");pause(false);}
  else startBattle((event.chapter+1)*areaSize-1,event);
});
$("detailDialog").addEventListener("close",()=>{openedDetail=null;preview=null;});
$("rewardDialog").addEventListener("close",()=>{revealTicket++;});
document.addEventListener("visibilitychange",()=>{if(document.hidden) pause(true);});
document.addEventListener("keydown",event=>{
  if(event.key==="Escape" && page==="campaign" && active?.status==="playing") pause(!paused);
  if(!active || paused || page!=="campaign" || event.repeat) return;
  const slot=["1","2","3","4"].indexOf(event.key);
  if(slot>=0 && active.recruit(active.progress.deck[slot])) {feedback("deploy");hud();}
  const spell=["a","s"].indexOf(event.key);
  if(spell>=0 && active.cast(active.progress.spells[spell])) {feedback("cast");hud();}
  if(event.key==="u" && !$("upgradeSap").disabled) $("upgradeSap").click();
});
async function purchase(id) {
  if(!canBuy(Campaign.offers.find(offer=>offer.id===id)))return;
  storeBusy=true;
  render();
  const buyButton=$("detailContent").querySelector("[data-buy]");
  if(buyButton)buyButton.disabled=true;
  try {
    const result=await native.postMessage({type:"buy",id});
    if(result?.message) notify(result.message);
  } catch {
    notify("The purchase couldn’t be completed. Try again from the shop.");
  } finally {
    storeBusy=false;
    render();
    if(buyButton?.isConnected)buyButton.disabled=false;
  }
}
window.brambleGrant=async (id,transaction)=>{
  const offer=Campaign.offers.find(item=>item.id===id);
  if(!offer || !/^\d+$/.test(transaction)) return false;
  const grant=!p.transactions.includes(transaction);
  const unlock=offer.boost&&!p.economy.boosts[offer.boost];
  if(offer.boost)p.economy.boosts[offer.boost]=true;
  const newCards=Object.keys(offer.cards).filter(key=>!p.inventory[key]);
  if(grant) {
    Campaign.addCards(p,offer.cards);
    p.acorns+=offer.acorns;
    p.economy.gems+=offer.gems||0;
    p.economy.passCredits+=offer.passTokens||0;
    p.transactions.push(transaction);
  }
  try {
    const saved=await save();
    if(saved!==true) return false;
    render();
    if(unlock||grant&&!offer.boost){
      if($("detailDialog").open)$("detailDialog").close();
      if(offer.boost)openInfo(offer.name+" unlocked",checkoutArt(offer),`<p class="info-caption">${offer.benefit}</p>`);
      else reward(offer.name,offer.cards,offer.acorns,offer.gems||0,{chest:Object.keys(offer.cards).length?"mega":null,newCards,credits:offer.passTokens});
    }
    return true;
  } catch { return false; }
};
window.brambleRestoreBoosts=async ids=>{
  for(const offer of Campaign.offers.filter(offer=>offer.boost))p.economy.boosts[offer.boost]=ids.includes(offer.id);
  if(!p.economy.boosts.speed)tempo=1;
  const saved=await save();
  render();
  return saved===true;
};
if(native) {
  native.postMessage({type:"products"}).then(result=>{
    prices=Object.fromEntries(Campaign.offers.filter(o=>typeof result?.[o.id]==="string").map(o=>[o.id,result[o.id]]));
    if(page==="shop"||$("pass").open)render();
    return native.postMessage({type:"ready"});
  }).catch(()=>{ native.postMessage({type:"ready"}).catch(()=>{}); });
}
function frame(now) {
  const dt=lastTime?Math.min(.05,(now-lastTime)/1000):0;
  lastTime=now;
  if(active?.status==="playing"&&!paused&&page==="campaign") {
    for(let step=0;step<tempo;step++)active.step(dt);
    if(active.status!=="playing") finishBattle();
    else {
      if(now>=nextHud) {hud();nextHud=now+70;}
      paint();
    }
  }
  drawPreview(dt);
  requestAnimationFrame(frame);
}
art.onLoad(paint);
if(!rawSave?.economy||rawSave.economy.passSeason===undefined||previousPassSettled)persist();
setInterval(updateClocks,1000);
render();
requestAnimationFrame(frame);

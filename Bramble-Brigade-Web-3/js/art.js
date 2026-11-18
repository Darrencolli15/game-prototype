"use strict";

function createBattleArt(canvas) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  const ground = 472;
  const palettes = [
    ["#729f9b", "#f7e4ac", "#a8b988", "#799a79", "#4a786d", "#7f9d71", "#dfc38c", "#fff1bc"],
    ["#497b9a", "#e2deb7", "#91afa3", "#688a91", "#436874", "#648e80", "#ccbc9c", "#f5ecbe"],
    ["#9d7692", "#f7c887", "#cb977d", "#a97471", "#85586a", "#a9896d", "#e5b783", "#fff0b1"],
    ["#3f517f", "#aeb6c9", "#758bb2", "#586f99", "#394c72", "#607f91", "#c6b599", "#f9ebc6"]
  ];
  let repaint = () => {};
  const sprites = battleSprites;
  for(const sprite of Object.values(sprites))if(!sprite.complete)
    sprite.addEventListener("load",()=>repaint(),{once:true});
  function shape(color, points) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    for (const point of points.slice(1)) ctx.lineTo(...point);
    ctx.closePath();
    ctx.fill();
  }
  function oval(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  function box(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }
  function hills(y, a, b, color) {
    const points = [[0,H]];
    for (let x = 0; x <= W; x += 10) points.push([x,y + a*Math.sin(x*.012+b) + a*.45*Math.cos(x*.023)]);
    points.push([W,H]);
    shape(color, points);
  }
  function tree(x, y, scale, color, pine) {
    ctx.save();
    ctx.translate(x,y);
    ctx.scale(scale,scale);
    box(-5,-70,10,70,color);
    if (pine) {
      shape(color,[[-39,-37],[-25,-71],[-34,-70],[0,-147],[34,-70],[23,-71],[39,-37]]);
    } else {
      oval(-20,-98,32,33,color);
      oval(19,-102,40,42,color);
      oval(-3,-130,30,30,color);
    }
    ctx.restore();
  }
  let cachedStage = -1;
  const scenery = document.createElement("canvas");
  scenery.width = W;
  scenery.height = H;
  function background(stage) {
    if (cachedStage !== stage) {
      const [sky,glow,far,mid,dark,grass,path,light] = palettes[stage];
      const gradient = ctx.createLinearGradient(0,0,0,440);
      gradient.addColorStop(0,sky);
      gradient.addColorStop(1,glow);
      box(0,0,W,H,gradient);
      oval(520,158,120,120,"#fff1a21e");
      oval(520,158,92,92,"#fff1b62a");
      oval(520,158,67,67,light);
      for(let i=0;i<13;i++) {
        const x=(i*181+64)%W,y=75+(i*71%182);
        oval(x,y,31+i%4*16,4+i%3*3,"#fff4d442");
        if(stage===3) oval((i*177+19)%W,40+(i*23%183),2+i%3,2+i%3,"#fef4cf9e");
      }
      hills(339,40,1,far);
      for(let i=0;i<=14;i++) tree(i*78,398+(i*31%39),.59+i%4*.15,mid,stage===1 || stage===3);
      hills(423,28,2,dark);
      for(let i=0;i<9;i++) tree(i*137-26,456+i%3*4,.66+i%4*.12,dark,stage>0);
      hills(452,10,0,grass);

      shape("#463649",[[0,482],[146,470],[517,461],[791,470],[1000,478],[1000,637],[848,666],[160,655],[0,622]]);
      shape("#887369",[[0,479],[146,468],[517,460],[791,468],[1000,477],[1000,609],[848,642],[160,630],[0,600]]);
      shape(path,[[0,475],[146,463],[517,455],[791,463],[1000,474],[1000,571],[848,595],[160,582],[0,568]]);
      shape("#eed7a466",[[0,475],[146,463],[517,455],[791,463],[1000,474],[1000,484],[720,476],[481,468],[145,477],[0,487]]);
      for(let i=0;i<62;i++){
        const x=(i*113.2)%W,y=478+(i*31%154);
        if(y<565){
          oval(x,y,2+(i%4)*3,1+i%3,"#9a77545c");
          if(i%4===0) {
            shape("#fff1bb46",[[x-9,y+1],[x-5,y-4],[x+7,y-3],[x+10,y+1]]);
          }
        } else if(i%2===0){
          shape(dark,[[x,y],[x-8,y-20],[x-2,y-9],[x+6,y-22],[x+8,y-4]]);
          if(i%6===0) oval(x+6,y-20,4,4,light);
        }
        if(i%5===0 && stage===1){
          box(x-2,437,4,13,"#e7dcb1");
          oval(x,439,11,5,"#cb8faf");
          oval(x-2,437,3,2,"#efc2c5");
        }
      }
      for(let i=0;i<8;i++) {
        const x=i*149+38,y=644+(i%3)*6;
        shape(dark,[[x-16,y+13],[x-25,y-3],[x-12,y+2],[x-5,y-16],[x+5,y-2],[x+18,y-13],[x+13,y+12]]);
        oval(x-5,y-16,3.4,3.1,light);
      }
      scenery.getContext("2d").drawImage(canvas,0,0);
      cachedStage=stage;
    } else ctx.drawImage(scenery,0,0);
  }
  function fort(x, ally, hp, flash, time) {
    ctx.save();
    ctx.translate(x,ground);
    ctx.scale(ally ? 1 : -1,1);
    oval(0,42,90,17,"#493b415c");
    const dark=ally?"#394d52":"#523b58";
    const brim=ally?"#5a877a":"#b16862";
    if(hp<=0){
      shape(dark,[[-80,37],[-54,0],[-29,7],[-9,-7],[39,4],[66,37]]);
      ctx.restore();
      return;
    }
    if(ally){
      shape(dark,[[-77,29],[-72,-63],[-46,-99],[-28,-149],[28,-146],[49,-101],[73,-56],[76,31]]);
      shape("#b28369",[[-66,26],[-64,-57],[-39,-93],[-20,-121],[22,-125],[43,-86],[64,-49],[67,26]]);
      shape("#d1a377",[[-60,-49],[-38,-84],[-11,-111],[24,-108],[56,-47],[42,-24],[-58,-22]]);
      shape(brim,[[-79,-51],[-60,-86],[-42,-97],[-26,-143],[0,-154],[24,-148],[48,-98],[62,-86],[82,-53],[54,-55],[21,-87],[-35,-78],[-58,-51]]);
      shape("#89af89",[[-70,-58],[-48,-84],[-32,-93],[-18,-138],[3,-146],[24,-140],[45,-98],[23,-112],[6,-122],[-7,-113],[-18,-87],[-41,-74]]);
      oval(8,-15,30,36,dark);
      box(-22,-12,60,41,dark);
      oval(8,-17,20,25,"#272938");
      box(-12,-17,40,45,"#272938");
      oval(-38,-41,8,10,"#ffdc87");
      oval(46,-38,7,10,"#ffdc87");
    } else {
      shape(dark,[[-74,29],[-67,-85],[-56,-118],[-48,-145],[-28,-120],[-9,-158],[13,-126],[31,-171],[51,-141],[70,-104],[74,29]]);
      shape("#825966",[[-66,26],[-61,-81],[-49,-110],[-30,-102],[-8,-138],[15,-109],[31,-150],[63,-100],[65,28]]);
      shape(brim,[[-77,-81],[-51,-107],[-29,-97],[-7,-120],[14,-94],[36,-116],[71,-93],[72,-72],[40,-67],[24,-78],[-7,-72],[-36,-81],[-67,-63]]);
      shape("#afa17c",[[-50,-22],[-33,-27],[-32,-18],[-47,-13]]);
      shape("#afa17c",[[35,-38],[51,-32],[48,-22],[36,-29]]);
      shape("#332842",[[-21,28],[-19,-22],[4,-56],[26,-23],[31,28]]);
      shape("#e39578",[[-3,-36],[8,-40],[12,-29],[4,-25]]);
    }
    for(let i=0;i<3;i++) shape(dark,[[-56+i*47,22],[-26+i*47,22],[-27+i*47,34],[-57+i*47,34]]);
    if(flash>0) oval(10,-30,63,72,"#ffd99d44");
    box(-8,-183,4,34,dark);
    const wave=Math.sin(time*6)*4;
    shape(ally?"#cde7a0":"#e99586",[[-4,-184],[38,-179+wave],[28,-167+wave],[-4,-165]]);
    ctx.restore();
  }
  function unitSprite(u,time) {
    const size=u.boss?163:u.kind==="giant"||u.kind==="sentinel"?126:u.kind==="guard"?107:95;
    const x=u.x*W/100+(u.id%4-1.5)*6+(u.attackAge?u.side*Math.sin(u.attackAge*17)*9:0);
    const y = ground + 29 + (u.id%3)*8;
    const bob=u.moving?Math.abs(Math.sin(time*15+u.id))*7:u.kind==="boss"?Math.sin(time*5)*3:0;
    const sprite = sprites[u.art] || sprites.thorn;
    oval(x,y-2,size*.23,6,u.side===1?"#3e7b6a8a":"#a65e697a");
    ctx.save();
    ctx.translate(x,y-bob);
    ctx.scale(u.side,1);
    if(sprite.complete && sprite.naturalWidth) {
      if(u.frozen) ctx.filter="drop-shadow(0 0 6px #bff3ff) brightness(1.20)";
      else if(u.side===-1 && !u.boss) ctx.filter="drop-shadow(0 0 3px #b1545e)";
      ctx.drawImage(sprite,-size*.52,-size+12,size,size);
    }
    else oval(0,-28,25,30,u.side===1?"#779e65":"#b95552");
    ctx.restore();
    if (u.hp < u.maxHp || u.boss) {
      box(x-19,y-size-1,38,5,"#463d36");
      box(x-18,y-size,36*u.hp/u.maxHp,3,u.side===1?"#dbef96":"#f59b86");
    }
  }
  function paint(stage, allyHp, enemyHp, units, effects, time, flash=[0,0]) {
    background(stage);
    fort(83,true,allyHp,flash[0],time);
    fort(918,false,enemyHp,flash[1],time);
    for (let lane=0;lane<3;lane++) {
      for (const unit of units) if(unit.id%3===lane) unitSprite(unit,time);
    }
    for(const u of units){
      const x=u.x*10,y=ground+14;
      if(u.snared){
        shape("#b7db7a",[[x-27,y+16],[x-16,y-12],[x-10,y+11],[x+3,y-21],[x+6,y+9],[x+22,y-10],[x+24,y+13]]);
      }
      if(u.rallying)oval(x,y+7,33,10,"#ffd97e70");
      if(u.warded||u.shield||u.spellShield||u.blockFlash>0)oval(x,y-26,39,44,"#b6f5fa64");
      if(u.enraged)oval(x,y+5,36,9,"#eb936a7a");
      if(u.slowTime>0)oval(x,y+5,28,6,"#a6cee16e");
      if(u.healFlash>0){
        box(x-2,y-76,5,17,"#e4ffb0");box(x-8,y-70,17,5,"#e4ffb0");
      }
    }
    for(let i=0;i<7;i++) {
      const x=(i*161+time*(8+i%3))%W,y=414+(i*73%225)+Math.sin(time*1.4+i)*13;
      oval(x,y,2.6,2.6,stage===3?"#d8cfff91":"#fff1a799");
    }
    for(const effect of effects) {
      ctx.globalAlpha=Math.min(1,effect.ttl*6);
      if(effect.style==="frost") {
        const x=effect.to*10,y=ground-25;
        shape("#e7fcff",[[x-16,y+5],[x-7,y-14],[x-2,y+3],[x+7,y-23],[x+16,y+7],[x+3,y+13]]);
      } else if(effect.style==="siege") {
        const t=1-effect.ttl/.75;
        const x=(effect.from+(effect.to-effect.from)*t)*10;
        const y=ground-48-240*Math.sin(t*Math.PI);
        oval(x,y,19,16,"#ecc08c9e");
        oval(x,y,10,9,"#a84b67");
        oval(x-3,y-3,5,4,"#ffe3a0");
      } else if(effect.style==="gale") {
        const x=effect.to*10,y=ground-30,t=1-effect.ttl/.24;
        for(const offset of [-14,0,17])oval(x-35+t*35,y+offset,20+t*16,3,"#e1f3ff");
      } else if(effect.style==="ember") {
        const x=(effect.from+(effect.to-effect.from)*(1-effect.ttl/.24))*10;
        oval(x,ground-33,19,12,"#eb654b");
        oval(x+5,ground-33,8,7,"#ffe48c");
      } else if(effect.style==="mend"&&!effect.ranged) {
        const x=effect.to*10,y=ground-39;
        shape("#ddffac",[[x-5,y-15],[x+5,y-15],[x+5,y-5],[x+15,y-5],[x+15,y+5],[x+5,y+5],[x+5,y+15],[x-5,y+15],[x-5,y+5],[x-15,y+5],[x-15,y-5],[x-5,y-5]]);
      } else if(effect.style==="volley") {
        const x=effect.to*10,y=ground-20-(effect.ttl/.24)*100;
        for(const offset of [-17,0,17])shape("#f3c780",[[x+offset-7,y-28],[x+offset+6,y],[x+offset-2,y-4],[x+offset+1,y-10]]);
      } else if(effect.style==="arc") {
        const x=effect.from*10,to=effect.to*10,y=ground-54,mid=(x+to)/2;
        shape("#ebedff",[[x,y],[mid-10,y-12],[mid-3,y-24],[to,y-7],[mid+1,y-15],[mid+19,y-6]]);
      } else if(effect.style==="blast") {
        const x=effect.to*10,y=ground-13,r=14+46*(1-effect.ttl/.24);
        oval(x,y,r,9,"#e0ad7599");
        for(const offset of [-14,7,18])oval(x+offset,y-9-Math.abs(offset/3),4,4,"#ffe6aa");
      } else if(effect.ranged) {
        const ratio=1-effect.ttl/.24;
        const x=(effect.from+(effect.to-effect.from)*ratio)*10;
        const y=ground-35-31*Math.sin(ratio*Math.PI);
        if(effect.style==="bomber"||effect.style==="mortar")oval(x,y,10,10,"#c18ee1");
        else if(effect.style==="mend")oval(x,y,8,8,"#c6efa4");
        else {
          const dir=Math.sign(effect.to-effect.from)||1;
          shape("#fff5be",[[x-dir*17,y+4],[x-dir*4,y-2],[x+dir*9,y-2],[x+dir*3,y+4]]);
        }
      } else {
        const x=effect.to*10,y=ground-17,large=effect.style==="giant"||effect.style==="boss"?1.55:1;
        shape("#ffeea8",[[x-12*large,y],[x-4,y-6],[x,y-18*large],[x+6,y-5],[x+15*large,y+2],[x+5,y+5],[x,y+16*large],[x-5,y+6]]);
        oval(x+19*large,y-11,3,3,"#fff2c8");
      }
    }
    ctx.globalAlpha=1;
  }
  return {paint, onLoad(callback){ repaint=callback; }};
}

const battleSprites=Object.fromEntries(
  [...new Set([...Object.entries(Campaign.cards).map(([key,card])=>card.art||key),"thorn","boss0","boss1","boss2","boss3"])]
    .map(name=>{const sprite=new Image();sprite.src="./png/"+name+".png";return [name,sprite];})
);
const art=createBattleArt(document.getElementById("scene"));

(() => {
  const canvas = document.getElementById('personaDag');
  if (!canvas) return;

  const nodes = [
    ['Demographic: Core',25],['Demographic: Life Events',24],['Linguistic: Language',53],
    ['Linguistic: Communication',37],['Learning: Academic',34],['Professional: Career',4],
    ['Professional: Industry',51],['Expertise: Domains',144],['Expertise: Skills',64],
    ['Skills: Tools',69],['Skills: Programming',44],['Personality: Character',34],
    ['Personality: Big Five',50],['Values & Motivation',46],['Worldview: Beliefs',67],
    ['Risk & Decision',7],['Behavior: Preferences',34],['Behavior: Habits',30],
    ['Interests: Topics',78],['Interests: Media',81],['Interests: Culture',74],
    ['Interests: Hobbies',50],['Interests: Food',35],['Interests: Sports',40],
    ['Health: Physical',25],['Developer: Professional Context',6],
    ['Developer: AI Workflow Tasks',12],['Developer: Code Maintenance',10]
  ].map((item, id) => ({ id, name:item[0], count:item[1], x:0, y:0, vx:0, vy:0 }));

  const rawLinks = [
    ['Learning: Academic','Expertise: Domains',420],['Learning: Academic','Skills: Tools',207],
    ['Expertise: Domains','Skills: Tools',199],['Learning: Academic','Expertise: Skills',192],
    ['Expertise: Domains','Skills: Programming',132],['Professional: Career','Skills: Tools',129],
    ['Professional: Industry','Skills: Tools',129],['Expertise: Domains','Expertise: Skills',128],
    ['Professional: Career','Expertise: Skills',128],['Professional: Industry','Expertise: Skills',128],
    ['Learning: Academic','Skills: Programming',126],['Expertise: Domains','Professional: Industry',99],
    ['Linguistic: Communication','Behavior: Preferences',91],['Values & Motivation','Interests: Topics',83],
    ['Professional: Career','Skills: Programming',82],['Professional: Industry','Skills: Programming',82],
    ['Demographic: Core','Skills: Tools',69],['Interests: Topics','Interests: Media',68],
    ['Values & Motivation','Worldview: Beliefs',67],['Demographic: Core','Expertise: Skills',65],
    ['Expertise: Domains','Learning: Academic',62],['Personality: Character','Behavior: Habits',62],
    ['Personality: Big Five','Behavior: Habits',62],['Demographic: Core','Interests: Culture',61],
    ['Demographic: Core','Worldview: Beliefs',61],['Learning: Academic','Professional: Industry',51],
    ['Interests: Culture','Interests: Hobbies',50],['Demographic: Life Events','Linguistic: Language',50],
    ['Demographic: Life Events','Health: Physical',47],['Demographic: Life Events','Personality: Character',46],
    ['Personality: Character','Personality: Big Five',45],['Demographic: Life Events','Behavior: Preferences',45],
    ['Demographic: Life Events','Risk & Decision',44],['Expertise: Skills','Skills: Tools',36],
    ['Interests: Topics','Interests: Food',35],['Linguistic: Communication','Demographic: Core',35],
    ['Health: Physical','Interests: Food',35],['Interests: Topics','Interests: Sports',34],
    ['Skills: Programming','Professional: Industry',33],['Interests: Culture','Behavior: Habits',31],
    ['Values & Motivation','Behavior: Preferences',30],['Behavior: Preferences','Behavior: Habits',30],
    ['Risk & Decision','Linguistic: Communication',29],['Personality: Character','Linguistic: Communication',25],
    ['Risk & Decision','Behavior: Preferences',24],['Linguistic: Language','Linguistic: Communication',12],
    ['Skills: Tools','Developer: Professional Context',16],['Developer: Professional Context','Developer: AI Workflow Tasks',12],
    ['Developer: Professional Context','Developer: Code Maintenance',10]
  ];
  const byName = Object.fromEntries(nodes.map(n => [n.name,n]));
  const links = rawLinks.map(([a,b,count]) => ({ source:byName[a], target:byName[b], count })).filter(l => l.source && l.target);

  const palette = {
    Demographic:'#6daedb', Linguistic:'#55c8c5', Learning:'#8d7ed5', Professional:'#6f91d7',
    Expertise:'#4a8fc2', Skills:'#45a9d2', Personality:'#a777d4', Values:'#bf7ac5',
    Worldview:'#b889d6', Risk:'#d09865', Behavior:'#5db398', Interests:'#58a8a4',
    Health:'#72b985', Developer:'#d09255'
  };
  const color = name => palette[name.split(':')[0].split(' ')[0]] || '#7d8997';
  const short = name => name.replace('Developer: ','Dev · ').replace('Demographic: ','Demo · ').replace('Professional: ','Pro · ').replace('Personality: ','Traits · ').replace('Linguistic: ','Language · ').replace('Expertise: ','Expertise · ').replace('Interests: ','Interests · ').replace('Behavior: ','Behavior · ').replace('Skills: ','Skills · ').replace('Learning: ','Learning · ').replace('Health: ','Health · ');

  const ctx = canvas.getContext('2d');
  const shell = canvas.closest('.dag-canvas-wrap');
  const status = document.getElementById('dagStatus');
  const search = document.getElementById('dagSearch');
  const reset = document.getElementById('dagReset');
  const density = document.getElementById('dagDensity');
  const motion = document.getElementById('dagMotion');
  let width=0, height=0, dpr=1, hover=null, selected=null, dragging=null;
  let edgeLimit=Number(density.value), motionOn=true;

  function seed() {
    const layerFor = name => {
      if (/^Developer:/.test(name)) return 4;
      if (/^(Behavior:|Interests:)/.test(name)) return 3;
      if (/^(Expertise:|Skills:)/.test(name)) return 2;
      if (/^(Learning:|Professional:|Linguistic:)/.test(name)) return 1;
      return 0;
    };
    const layers = [[],[],[],[],[]];
    nodes.forEach(n => layers[layerFor(n.name)].push(n));
    layers.forEach((layer, column) => {
      const x = 72 + column * ((width - 144) / 4);
      const gap = (height - 100) / Math.max(1, layer.length - 1);
      layer.forEach((n, row) => {
        n.x = x;
        n.y = layer.length === 1 ? height * .5 : 50 + row * gap;
        n.vx = n.vy = 0;
      });
    });
  }

  function radius(n){ return 7 + Math.sqrt(n.count)*.72; }
  function simulate(){
    nodes.forEach((a,i)=>{
      a.vx+=(width*.5-a.x)*.00025; a.vy+=(height*.5-a.y)*.00025;
      for(let j=i+1;j<nodes.length;j++){
        const b=nodes[j],dx=a.x-b.x,dy=a.y-b.y,d2=dx*dx+dy*dy+1,min=radius(a)+radius(b)+28;
        if(d2<min*min){const d=Math.sqrt(d2),f=(min-d)*.0018;a.vx+=dx/d*f;a.vy+=dy/d*f;b.vx-=dx/d*f;b.vy-=dy/d*f;}
      }
    });
    links.forEach(l=>{const dx=l.target.x-l.source.x,dy=l.target.y-l.source.y,d=Math.sqrt(dx*dx+dy*dy)||1,target=110+Math.min(120,250-l.count*.35),f=(d-target)*.00006;l.source.vx+=dx*f;l.source.vy+=dy*f;l.target.vx-=dx*f;l.target.vy-=dy*f;});
    nodes.forEach(n=>{if(n===dragging)return;n.vx*=.88;n.vy*=.88;n.x=Math.max(38,Math.min(width-38,n.x+n.vx));n.y=Math.max(35,Math.min(height-35,n.y+n.vy));});
  }

  function connected(n,l){return !n || l.source===n || l.target===n;}
  function visibleLinks(){return links.slice(0,edgeLimit);}
  function drawArrow(l,active){
    const dx=l.target.x-l.source.x,dy=l.target.y-l.source.y,d=Math.hypot(dx,dy)||1;
    const tx=l.target.x-dx/d*(radius(l.target)+2),ty=l.target.y-dy/d*(radius(l.target)+2);
    const angle=Math.atan2(dy,dx),size=active?5:3.5;
    ctx.beginPath();ctx.moveTo(tx,ty);ctx.lineTo(tx-Math.cos(angle-.55)*size,ty-Math.sin(angle-.55)*size);ctx.lineTo(tx-Math.cos(angle+.55)*size,ty-Math.sin(angle+.55)*size);ctx.closePath();ctx.fillStyle=active?'rgba(137,201,239,.68)':'rgba(120,145,165,.18)';ctx.fill();
  }
  function draw(time=0){
    ctx.clearRect(0,0,width,height);
    const focus=selected||hover;
    const shown=visibleLinks();
    shown.forEach((l,index)=>{
      const active=connected(focus,l);ctx.beginPath();ctx.moveTo(l.source.x,l.source.y);ctx.lineTo(l.target.x,l.target.y);ctx.strokeStyle=active?'rgba(109,174,219,.52)':'rgba(120,145,165,.11)';ctx.lineWidth=active?Math.min(2.6,.6+l.count/180):.7;ctx.stroke();drawArrow(l,active);
      if(motionOn&&(active||!focus)&&index%2===0){const t=((time*.00007*(1+index%4))+index*.137)%1,x=l.source.x+(l.target.x-l.source.x)*t,y=l.source.y+(l.target.y-l.source.y)*t;ctx.beginPath();ctx.arc(x,y,active?2.4:1.5,0,Math.PI*2);ctx.fillStyle=active?'rgba(158,218,250,.95)':'rgba(86,168,214,.45)';ctx.fill();}
    });
    nodes.forEach(n=>{
      const r=radius(n),active=!focus||n===focus||shown.some(l=>connected(focus,l)&&(l.source===n||l.target===n));
      ctx.globalAlpha=active?1:.16;ctx.beginPath();ctx.arc(n.x,n.y,r+5,0,Math.PI*2);ctx.fillStyle=color(n.name)+'20';ctx.fill();ctx.beginPath();ctx.arc(n.x,n.y,r,0,Math.PI*2);const glow=ctx.createRadialGradient(n.x-r*.3,n.y-r*.35,1,n.x,n.y,r);glow.addColorStop(0,'#d8f0ff');glow.addColorStop(.16,color(n.name));glow.addColorStop(1,color(n.name)+'bb');ctx.fillStyle=glow;ctx.fill();ctx.strokeStyle=n===selected?'#fff':'rgba(255,255,255,.4)';ctx.lineWidth=n===selected?2:1;ctx.stroke();
      ctx.font=`${n===focus?'600':'500'} 11px Inter, sans-serif`;ctx.textAlign='center';ctx.textBaseline='top';ctx.fillStyle=active?'#d8dde3':'#646b74';ctx.fillText(short(n.name),n.x,n.y+r+7);ctx.globalAlpha=1;
    });
    requestAnimationFrame(draw);
  }

  function nearest(e){const rect=canvas.getBoundingClientRect(),x=(e.clientX-rect.left)*width/rect.width,y=(e.clientY-rect.top)*height/rect.height;let best=null,dist=Infinity;nodes.forEach(n=>{const d=Math.hypot(n.x-x,n.y-y);if(d<radius(n)+8&&d<dist){best=n;dist=d;}});return best;}
  function describe(n){if(!n){status.innerHTML=`<b>Explore the graph</b><span>${edgeLimit} strongest category connections shown · hover, select, drag, or search.</span>`;return;}const shown=visibleLinks(),incoming=shown.filter(l=>l.target===n),outgoing=shown.filter(l=>l.source===n),strongest=[...incoming,...outgoing].sort((a,b)=>b.count-a.count)[0],neighbor=strongest?(strongest.source===n?strongest.target:strongest.source):null;status.innerHTML=`<b>${n.name}</b><span>${n.count} attributes · ${incoming.length} incoming · ${outgoing.length} outgoing${neighbor?` · strongest link: ${neighbor.name}`:''}</span>`;}
  canvas.addEventListener('pointermove',e=>{const n=nearest(e);hover=n;canvas.style.cursor=dragging?'grabbing':n?'pointer':'grab';if(dragging){const r=canvas.getBoundingClientRect();dragging.x=(e.clientX-r.left)*width/r.width;dragging.y=(e.clientY-r.top)*height/r.height;}else describe(n||selected);});
  canvas.addEventListener('pointerdown',e=>{const n=nearest(e);if(n){dragging=n;selected=n;canvas.setPointerCapture(e.pointerId);describe(n);}});
  canvas.addEventListener('pointerup',()=>dragging=null);
  canvas.addEventListener('pointerleave',()=>{hover=null;dragging=null;describe(selected);});
  canvas.addEventListener('click',e=>{const n=nearest(e);selected=n||null;describe(selected);});
  search.addEventListener('input',()=>{const q=search.value.trim().toLowerCase();selected=q?nodes.find(n=>n.name.toLowerCase().includes(q)):null;describe(selected);});
  reset.addEventListener('click',()=>{selected=hover=null;search.value='';seed();describe(null);});
  density.addEventListener('input',()=>{edgeLimit=Number(density.value);describe(selected);});
  motion.addEventListener('click',()=>{motionOn=!motionOn;motion.textContent=motionOn?'Flow on':'Flow off';motion.setAttribute('aria-pressed',String(motionOn));});

  function resize(){const rect=shell.getBoundingClientRect();dpr=Math.min(devicePixelRatio||1,1.5);width=Math.max(320,Math.round(rect.width));height=width<600?400:520;canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);canvas.style.height=height+'px';ctx.setTransform(dpr,0,0,dpr,0,0);seed();}
  resize();new ResizeObserver(resize).observe(shell);describe(null);draw();
})();

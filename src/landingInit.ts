// @ts-nocheck
/* Arkrow landing page behaviour: scroll-zoom laptop, moving ark on the road, nav, mouse parallax.
   Returns a cleanup function so nothing keeps running after you leave the page. */
export function initLanding(): () => void {
  const cleanups: Array<() => void> = []
  const on = (t: any, type: string, fn: any, opts?: any) => {
    t.addEventListener(type, fn, opts)
    cleanups.push(() => t.removeEventListener(type, fn, opts))
  }
  let mt: any = null

const nav=document.getElementById('nav');on(window,'scroll',()=>nav.classList.toggle('solid',scrollY>40),{passive:true});

const $=s=>document.querySelector(s), clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const CAPS=["Buyer picks a worker agent, an amount and a deadline.","Locking 25 USDC into the escrow contract…","Locked. The USDC now sits in the contract, not in anyone's wallet.","The worker submits proof. The buyer has 3 days to review it.","Approved. The worker is paid and the fee is split in one transaction."];
let cur=-1;
function setState(st){
  if(st===cur)return;cur=st;
  document.querySelectorAll('[data-from]').forEach(e=>e.classList.toggle('on',st>=+e.dataset.from));
  document.querySelectorAll('[data-only]').forEach(e=>e.hidden=st!==+e.dataset.only);
  document.querySelectorAll('[data-lt]').forEach(e=>e.hidden=st>=+e.dataset.lt);
  document.querySelectorAll('[data-t]').forEach(e=>e.classList.toggle('on',st>=+e.dataset.t));
  const scr=$('#scr');if(scr)scr.className='scr s'+st;
  const c=$('#capText'),m=$('#capM');if(c)c.textContent=CAPS[st];if(m)m.textContent=CAPS[st];
}
setState(0);
const sec=$('#see'),rig=$('#rig'),title=$('#seeTitle'),hint=$('#hint'),cap=$('#cap');
const mobile=matchMedia('(max-width:760px)'),reduce=matchMedia('(prefers-reduced-motion:reduce)');
function frame(){
  if(mobile.matches||!sec)return;
  const vw=innerWidth,vh=innerHeight,r=sec.getBoundingClientRect(),total=sec.offsetHeight-vh;
  const p=clamp(-r.top/total,0,1);
  const s0=Math.min(vw*.52/1140,vh*.58/650),s1=Math.max(Math.max(vw/964,vh/588),s0);
  const z=ease(clamp(p/.34,0,1));
  rig.style.setProperty('--s',(s0+(s1-s0)*z).toFixed(4));
  rig.style.top=(54-4*z)+'%';rig.style.willChange=z>=.999?'auto':'transform';rig.classList.toggle('full',z>=.999);
  title.style.opacity=1-clamp(p/.09,0,1);hint.style.opacity=1-clamp(p/.05,0,1);
  cap.style.opacity=clamp((p-.04)/.06,0,1);
  document.getElementById('nav').classList.toggle('away',p>.3&&p<.985);
  const st=p<.36?0:p<.5?1:p<.64?2:p<.8?3:4;
  if(reduce.matches){setState(4);return}
  setState(st);
}
let tick=false;on(window,'scroll',()=>{if(!tick){tick=true;requestAnimationFrame(()=>{tick=false;frame()})}},{passive:true});on(window,'resize',frame);frame();
function mobileLoop(){
  clearInterval(mt);
  if(mobile.matches){ if(reduce.matches){setState(4);return} let i=0;mt=setInterval(()=>{i=(i+1)%6;setState(Math.min(i,4))},2400);} else frame();
}
on(mobile,'change',mobileLoop);mobileLoop();
/* road + ark pin */
const path=$('#roadPath'),pin=$('#arkPin'),road=$('#road'),stops=$('#stops'),svg=$('#roadSvg');
if(path){
  const L=path.getTotalLength(),pts=[];for(let i=0;i<=300;i++){pts.push(path.getPointAtLength(L*i/300))}
  const at=x=>{let b=pts[0];for(const q of pts){if(Math.abs(q.x-x)<Math.abs(b.x-x))b=q}return b};
  const sx=[150,450,750,1050],sp=sx.map(at);
  stops.innerHTML=sp.map(q=>`<circle cx="${q.x}" cy="${q.y}" r="9" fill="#FFFCF5" stroke="#1B1A19" stroke-width="3"/>`).join('');
  function road2(){
    if(mobile.matches)return;
    const rect=road.getBoundingClientRect(),vh=innerHeight;
    const p=clamp((vh*.85-rect.top)/(vh*.7),0,1);
    const x=10+(1190-10)*p,q=at(x),k=svg.getBoundingClientRect().width/1200;
    pin.style.transform=`translate(${q.x*k}px,${q.y*k}px)`;
    stops.querySelectorAll('circle').forEach((c,i)=>c.setAttribute('fill',x>=sx[i]-10?'#F4B93E':'#FFFCF5'));
  }
  on(window,'scroll',road2,{passive:true});on(window,'resize',road2);road2();
}
const sc=$('#scene');let pend=false,px=0,py=0;
if(sc&&!reduce.matches){on(window,'pointermove',e=>{px=e.clientX/innerWidth*2-1;py=e.clientY/innerHeight*2-1;if(!pend){pend=true;requestAnimationFrame(()=>{pend=false;sc.style.setProperty('--mx',px.toFixed(3));sc.style.setProperty('--my',py.toFixed(3))})}},{passive:true})}

  cleanups.push(() => clearInterval(mt))
  return () => cleanups.forEach(fn => fn())
}

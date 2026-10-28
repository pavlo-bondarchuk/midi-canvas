import Aurora from '../src/visuals/modes/aurora.js';
import Visualizer from '../src/visuals/modes/visualizer.js';
import Fireflies from '../src/visuals/modes/fireflies.js';
import Spots from '../src/visuals/modes/spots.js';
import Lines from '../src/visuals/modes/lines.js';
import Rain from '../src/visuals/modes/rain.js';

const modes = [['aurora','Aurora',Aurora],['visualizer','Visualizer',Visualizer],['fireflies','Fireflies',Fireflies],['spots','Particles',Spots],['lines','Lines',Lines],['rain','Rain',Rain]];
const host = document.querySelector('#comparisons');
const views = modes.map(([id,label,Renderer]) => {
  const article = document.createElement('article');
  article.id = id;
  article.innerHTML = `<h2>${label}</h2><div class="pair"><figure><figcaption>Reference</figcaption><img src="../assets/modes/${id}.png" alt="${label} reference"></figure><figure><figcaption>Live · Original colors</figcaption><canvas width="640" height="640" aria-label="${label} live visualization"></canvas></figure></div>`;
  host.append(article);
  return {Renderer, canvas:article.querySelector('canvas'),ctx:article.querySelector('canvas').getContext('2d',{alpha:false}), caption:article.querySelectorAll('figcaption')[1], renderer:null, cpu:0};
});
let paused=false, playing=false, time=0, last=0, nextNote=0;
const phrase=[36,60,84,43,67,91,48,72,96,31,55,79,40,64,88,52,76,100];
function reset(){time=0;nextNote=0;for(const view of views){view.cpu=0;view.renderer=new view.Renderer();view.renderer.resize(640,640);view.ctx.fillStyle='#02040a';view.ctx.fillRect(0,0,640,640);view.renderer.updateAndDraw(view.ctx,0);}}
document.querySelector('#play').addEventListener('click',()=>{reset();playing=true;paused=false;document.querySelector('#pause').textContent='Pause animation';});
document.querySelector('#reset').addEventListener('click',()=>{reset();playing=false;});
document.querySelector('#pause').addEventListener('click',()=>{paused=!paused;document.querySelector('#pause').textContent=paused?'Resume animation':'Pause animation';});
document.querySelector('#sample').addEventListener('click',async()=>{
  reset();playing=false;paused=true;
  const sampleButton=document.querySelector('#sample');sampleButton.disabled=true;sampleButton.textContent='Rendering reference frame…';
  for(let step=0;step<120;step++){
    time=step/30;
    if(time>=nextNote){const index=Math.floor(nextNote/.18),note=phrase[index%phrase.length],velocity=74+(index*17)%54;for(const view of views){view.renderer.noteOn(note,velocity);view.renderer.noteOff(note);}nextNote+=.18;}
    for(const view of views){const started=performance.now();view.renderer.updateAndDraw(view.ctx,1/30);view.cpu+=performance.now()-started;}
    if(step%8===0)await new Promise(resolve=>requestAnimationFrame(resolve));
  }
  for(const view of views)view.caption.textContent=`Live · Original colors · ${(view.cpu/120).toFixed(1)} ms/frame`;
  paused=true;document.querySelector('#pause').textContent='Resume animation';document.querySelector('#elapsed').textContent='4.0 s';sampleButton.disabled=false;sampleButton.textContent='Reference frame · 4 seconds';
});
function frame(now){requestAnimationFrame(frame);const dt=Math.min(.04,last?(now-last)/1000:1/60);last=now;if(paused)return;time+=dt;if(playing&&time>=nextNote&&time<9){const index=Math.floor(nextNote/.18),note=phrase[index%phrase.length],velocity=74+(index*17)%54;for(const view of views){view.renderer.noteOn(note,velocity);view.renderer.noteOff(note);}nextNote+=.18;}for(const view of views)view.renderer.updateAndDraw(view.ctx,dt);document.querySelector('#elapsed').textContent=`${time.toFixed(1)} s`;}
reset();requestAnimationFrame(frame);

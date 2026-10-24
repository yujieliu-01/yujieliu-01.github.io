import { GameQueueScene } from './queue-model.js';
import { GameEngine } from './game-engine.js';

// Rules own waiting counts and completed batches; GameQueueScene owns movement.
export class GameSession {
  constructor({seed=94715,aspects={cat:459/512,corgi:539/512}}={}) {
    this.seed=seed;this.aspects=aspects;this.reset(false);
  }
  reset(newTraffic=false) {
    if(newTraffic)this.seed=(this.seed+739391)>>>0;
    this.state=GameEngine.create(this.seed);
    this.scene=new GameQueueScene({catCount:2,dogCount:2,aspects:this.aspects});
    this.paused=false;this.elapsed=0;
  }
  get running(){return this.state.started&&!this.state.finished&&!this.paused;}
  start(){GameEngine.start(this.state);}
  choose(mode){GameEngine.select(this.state,mode);}
  setPaused(value){this.paused=Boolean(value);this.scene.setPaused(this.paused);}
  advance(dt,onEvent=()=>{},animationDt=dt) {
    if(this.paused||!Number.isFinite(dt)||dt<=0)return;
    // Preserve event order and cap only the visual clock after a late render.
    let left=dt;
    while(left>1e-8){
      const step=Math.min(left,1/60);
      if(this.running){
        this.elapsed=Math.min(GameEngine.T,this.elapsed+step);
        GameEngine.advance(this.state,this.elapsed,event=>{
          if(event.kind==='arrival')this.scene.add(event.pet.type,1);
          else this.scene.serve(event.departed.cat.length,event.departed.dog.length);
          onEvent(event);
        });
        if(this.state.finished)this.elapsed=this.state.time=GameEngine.T;
      }
      this.scene.update(step*Math.min(1,Math.max(0,animationDt)/dt));left-=step;
    }
  }
  comparisons(){return {MW:GameEngine.simulate(this.seed,'MW'),Lyap:GameEngine.simulate(this.seed,'Lyap')};}
}

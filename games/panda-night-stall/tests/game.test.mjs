import test from 'node:test';
import assert from 'node:assert/strict';
import {GameEngine as E} from '../game-engine.js';
import {GameSession} from '../game-session.js';
import {ZONES} from '../queue-model.js';

test('original arrival sequence, capacities and baseline results remain unchanged',()=>{
  assert.deepEqual(E.arrivals(94715),E.arrivals(94715));assert.notDeepEqual(E.arrivals(94715),E.arrivals(834106));
  assert.equal(E.simulate(94715,'MW').backlog,13);assert.equal(E.simulate(94715,'Lyap').backlog,10);
  assert.deepEqual(Object.values(E.modes).map(m=>m.cap),[[3,0],[2,2],[0,5]]);
});
test('UI selection cannot change the current pot or serve a mid-pot arrival',()=>{
  const s=E.create();s.events=[{id:5,type:'cat',t:1},{id:6,type:'dog',t:2}];E.select(s,'cat');E.start(s);E.select(s,'dog');E.advance(s,2.49);assert.equal(s.served,0);assert.equal(s.current,'cat');E.advance(s,2.5);assert.equal(s.served,2);assert.equal(s.q.cat.length,1);assert.equal(s.q.dog.length,3);assert.equal(s.current,'dog');
});
test('all three policies keep animation queue counts aligned with rules on every frame',()=>{
  for(const choice of ['cat','mix','dog']){
    const game=new GameSession();game.choose(choice);game.start();
    for(let frame=0;frame<3601;frame++){
      game.advance(1/60);game.scene.drainEvents();
      const visual=game.scene.getState(),s=game.state;
      assert.equal(visual.catCount,s.q.cat.length);assert.equal(visual.dogCount,s.q.dog.length);
      assert.equal(visual.auto,false);assert.equal(visual.autoArrivals,false);
      assert.equal(s.served+s.q.cat.length+s.q.dog.length,s.nextArrival+4);
      for(const actor of game.scene.getActors())assert.ok(Number.isFinite(actor.x)&&Number.isFinite(actor.y)&&actor.size>0);
    }
    assert.equal(game.state.time,60);assert.equal(game.state.round,24);assert.equal(game.state.finished,true);
    const sent=game.state.served;
    for(let i=0;i<120;i++){game.advance(1);game.scene.drainEvents();}
    assert.equal(game.scene.getState().servedCount,sent);assert.equal(game.scene.getState().outgoingCount,0);
  }
});
test('pause freezes gameplay and choreography; idle cannot consume time',()=>{
  const game=new GameSession();game.advance(10);assert.equal(game.state.time,0);game.start();game.advance(7.3);game.setPaused(true);
  const before=JSON.stringify(game.state),view=JSON.stringify(game.scene.getActors());game.advance(5);assert.equal(JSON.stringify(game.state),before);assert.equal(JSON.stringify(game.scene.getActors()),view);
  game.setPaused(false);game.advance(.2);assert.ok(Math.abs(game.state.time-7.5)<1e-8);
});
test('a delayed animation frame processes every arrival and batch in order',()=>{
  const a=new GameSession(),b=new GameSession();a.start();b.start();for(let i=0;i<3600;i++)a.advance(1/60);for(let i=0;i<60;i++)b.advance(1);
  assert.deepEqual(a.state.q,b.state.q);assert.equal(a.state.served,b.state.served);assert.deepEqual(a.state.history,b.state.history);
});
test('replay clears outgoing animations, and new night changes the stream',()=>{
  const game=new GameSession(),events=game.state.events;game.start();game.advance(25);game.reset();assert.deepEqual(game.state.events,events);assert.equal(game.scene.getActors().length,4);assert.equal(game.scene.getState().outgoingCount,0);assert.equal(game.state.time,0);game.reset(true);assert.notDeepEqual(game.state.events,events);
});
test('last-pot late arrivals remain waiting and all benchmark runs conserve people',()=>{
  const s=E.create();s.events=[{id:5,type:'cat',t:59.9}];E.start(s);E.advance(s,60);assert.equal(s.served,4);assert.equal(s.q.cat.length,1);
  for(let seed=1;seed<=100;seed++)for(const mode of ['MW','Lyap']){const sim=E.simulate(seed,mode);assert.equal(sim.served+sim.backlog,E.arrivals(seed).length+4);}
});

test('continuous arrivals do not reverse, resize stationary heads or overlap at turns',()=>{
  for(const seed of [94715,1,834106])for(const choice of ['cat','mix','dog']){
    const game=new GameSession({seed});game.choose(choice);game.start();const previous=new Map();
    for(let frame=0;frame<3600;frame++){
      game.advance(1/60);game.scene.drainEvents();
      for(const species of ['cat','corgi']){
        const line=game.scene.lines[species],zone=ZONES[species];
        for(let i=0;i<line.length;i++){
          const actor=line[i],last=previous.get(actor.id);
          if(last){
            assert.ok(actor._trackPos<=last.position+1e-6,'a customer retraced its route');
            assert.ok(Math.hypot(actor.x-last.x,actor.y-last.y)<5,'a customer jumped between frames');
            assert.ok(Math.abs(actor.size-last.size)<2,'perspective scale changed abruptly');
            if(Math.hypot(actor.x-last.x,actor.y-last.y)<.001)assert.ok(Math.abs(actor.size-last.size)<.001,'an idle customer resized');
          }
          previous.set(actor.id,{position:actor._trackPos,x:actor.x,y:actor.y,size:actor.size});
          if(actor._trackPos>=0){
            assert.ok(actor.x-actor.width/2>=zone.x&&actor.x+actor.width/2<=zone.x+zone.w);
            assert.ok(actor.y-actor.size>=zone.y&&actor.y<=zone.y+zone.h);
          }
          for(const ahead of line.slice(0,i)){
            const ox=(actor.width+ahead.width)/2-Math.abs(actor.x-ahead.x);
            const oy=Math.min(actor.y,ahead.y)-Math.max(actor.y-actor.size,ahead.y-ahead.size);
            assert.ok(ox<=.01||oy<=.01,`${species} customers overlapped on a bend`);
          }
        }
      }
    }
  }
});

test('a stalled render keeps the game clock accurate without fast-forwarding feet',()=>{
  const game=new GameSession();game.start();game.advance(3);
  const before=new Map(game.scene.getActors().map(a=>[a.id,{x:a.x,y:a.y}]));
  game.advance(2,()=>{},1/60);
  assert.equal(game.state.round,2);assert.ok(Math.abs(game.state.time-5)<1e-8);
  for(const actor of game.scene.getActors())if(before.has(actor.id)){
    const last=before.get(actor.id);assert.ok(Math.hypot(actor.x-last.x,actor.y-last.y)<6);
  }
});

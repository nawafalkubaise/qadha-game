# Qadha Phase 1+2: Bug Fixes + Anti-Cheat + Core Mechanics

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all critical/high bugs, implement anti-cheat question isolation for online multiplayer, add speed bonus, streak multiplier, and daily double mechanics.

**Architecture:** All changes are in the existing React + Express stack. Bug fixes are surgical edits to `src/Qadha.jsx` and `server/index.mjs`. Anti-cheat adds a `gridQsP2` ref for separate player questions and strips `curQ.a` from broadcasts. New mechanics (speed bonus, streaks, daily doubles) add state variables and UI elements within the existing game loop.

**Tech Stack:** React 19, Express 4, WebSocket (ws), Vite 8

---

### Task 1: Fix answer leak to online guests (CRITICAL)

**Files:**
- Modify: `src/Qadha.jsx:993-1007` (host broadcast effect)
- Modify: `src/Qadha.jsx:1009-1020` (guest receive effect)

The host broadcasts `curQ` including `curQ.a` (correct answer index). Any guest inspecting WebSocket/DevTools sees the answer. Fix: strip `a` from broadcast, keep it host-side only.

- [ ] **Step 1: Strip answer from host broadcast**

In `src/Qadha.jsx`, find the host sync effect (~line 999):
```js
const gameState={...prev,phase:sc,scores,used,active,curPts,curQ:sc==="question"?curQ:null};
```
Replace with:
```js
const safeQ=curQ?{q:curQ.q,o:curQ.o,d:curQ.d,img:curQ.img}:null;
const gameState={...prev,phase:sc,scores,used,active,curPts,curQ:sc==="question"?safeQ:null};
```

- [ ] **Step 2: Store correct answer in a ref for host-side validation**

Add a new ref near line 796:
```js
const curQAnswerRef=useRef(null);
```

In `openQ` (~line 1070), after `setCurQ(shufQ(qs[pi]))`, add:
```js
const shuffled=shufQ(qs[pi]);
curQAnswerRef.current=shuffled.a;
setCurQ(shuffled);
```

- [ ] **Step 3: Update doAns and checkTyped to use ref for answer**

In `doAns` (~line 1036), replace `curQ.a` references with `curQAnswerRef.current`:
```js
const correctIdx=curQAnswerRef.current??curQ.a;
if(idx===correctIdx){...}
```

In `checkTyped` (~line 1077), replace:
```js
const correct=curQ.o[curQ.a];
```
with:
```js
const correctIdx=curQAnswerRef.current??curQ.a;
const correct=curQ.o[correctIdx];
```

- [ ] **Step 4: Send answer reveal to guest after resolution**

In the host broadcast effect, add `answerReveal` to gameState when answered:
```js
const gameState={...prev,phase:sc,scores,used,active,curPts,
  curQ:sc==="question"?safeQ:null,
  answerReveal:answered&&revealed?{correctIdx:curQAnswerRef.current,selA}:null};
```

In the guest receive effect (~line 1018), after setting curQ, handle reveal:
```js
if(gs.answerReveal&&gs.answerReveal.correctIdx!=null){
  const q=curQ||gs.curQ;
  if(q)setCurQ(prev=>({...prev,a:gs.answerReveal.correctIdx}));
  setSelA(gs.answerReveal.selA??null);
  setRevealed(true);setAnswered(true);
}
```

- [ ] **Step 5: Commit**
```bash
git add src/Qadha.jsx
git commit -m "fix(critical): strip correct answer index from online broadcast"
```

---

### Task 2: Fix timer race condition in steal phase (CRITICAL)

**Files:**
- Modify: `src/Qadha.jsx:1024-1033` (timer effect)

- [ ] **Step 1: Guard timer decrement and clear interval in steal callback**

Replace the timer effect (~line 1024-1033):
```js
useEffect(()=>{
  if(sc==="question"&&!answered&&curQ){
    tRef.current=setInterval(()=>{setTimer(p=>{
      if(p<=0)return 0;
      if(p<=1){clearInterval(tRef.current);tRef.current=null;sfx.stop();sfx.wrong();setAnswered(true);if(!bRef.current){bRef.current=true;setTimeout(()=>{clearInterval(tRef.current);tRef.current=null;sfx.steal();setAnswered(false);setSelA(null);setActive(v=>v===1?2:1);setTimer(stealTimerRef.current??45)},2000)}else{setRevealed(true);setTimeout(()=>{bRef.current=false;setRevealed(false);setFirstWrong(null);go("grid")},2500)}return 0}
      if(p===11){sfx.stop()}
      if(p<=6)sfx.tick(true);else if(p<=15)sfx.tick(false);
      return p-1})},1000);
    return()=>{clearInterval(tRef.current);tRef.current=null;sfx.stop()};
  }
},[sc,curQ,answered,go]);
```

- [ ] **Step 2: Add stealTimerRef to store original timer per question**

Near line 796, add:
```js
const stealTimerRef=useRef(45);
```

In `openQ` (~line 1072), before `setTimer(PTS_TIMER[ri]??45)`:
```js
stealTimerRef.current=PTS_TIMER[ri]??45;
```

- [ ] **Step 3: Update doAns steal callback to use stealTimerRef**

In `doAns` (~line 1038), replace `setTimer(45)` with `setTimer(stealTimerRef.current??45)`.
In `checkTyped` (~line 1086), replace `setTimer(45)` with `setTimer(stealTimerRef.current??45)`.

- [ ] **Step 4: Commit**
```bash
git add src/Qadha.jsx
git commit -m "fix(critical): timer race condition in steal phase + use correct tier timer"
```

---

### Task 3: Fix power-ups and 50/50 not reset during steal (CRITICAL)

**Files:**
- Modify: `src/Qadha.jsx:1027,1037-1038,1086` (steal callbacks in timer, doAns, checkTyped)

- [ ] **Step 1: Add resets to all steal transition callbacks**

In the timer effect steal callback (the `setTimeout` inside `if(!bRef.current)`), add before `setAnswered(false)`:
```js
setUsedFifty(false);setUsedExt(false);setHiddenOpts([]);
```

In `doAns` steal callback (same pattern ~line 1038), add the same three resets.

In `checkTyped` steal callback (~line 1086), add the same three resets.

- [ ] **Step 2: Commit**
```bash
git add src/Qadha.jsx
git commit -m "fix(critical): reset power-ups and hidden options during steal transitions"
```

---

### Task 4: Fix session hijacking via display name (HIGH)

**Files:**
- Modify: `server/index.mjs:276-299` (join endpoint)

- [ ] **Step 1: Always create new player on join, add max player limit**

Replace the join handler body (~lines 283-294):
```js
const name = String(req.body?.displayName || "لاعب").trim().slice(0, 32) || "لاعب";
if (room.players.filter(p => !p.isHost).length >= 1) {
  res.status(409).json({ error: "room_full" });
  return;
}
const playerId = randomToken().slice(0, 12);
const playerToken = randomToken();
room.players.push({ id: playerId, name, isHost: false, playerToken });
```

This removes name-based dedup (which leaked tokens) and limits to 2 players total (1 host + 1 guest).

- [ ] **Step 2: Commit**
```bash
git add server/index.mjs
git commit -m "fix(high): prevent session hijacking via display name + limit room to 2 players"
```

---

### Task 5: Fix shufQ when options have duplicates (HIGH)

**Files:**
- Modify: `src/Qadha.jsx:194` (shufQ function)

- [ ] **Step 1: Track correct answer by index, not string match**

Replace line 194:
```js
const shufQ=q=>{
  const ci=q.a;
  const indices=q.o.map((_,i)=>i);
  for(let i=indices.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[indices[i],indices[j]]=[indices[j],indices[i]]}
  const newO=indices.map(i=>q.o[i]);
  const newA=indices.indexOf(ci);
  return{...q,o:newO,a:newA};
};
```

- [ ] **Step 2: Commit**
```bash
git add src/Qadha.jsx
git commit -m "fix(high): shufQ tracks correct answer by index, not string match"
```

---

### Task 6: Fix rev_conflict retry with proper loop (HIGH)

**Files:**
- Modify: `src/Qadha.jsx:959-966,1000-1003` (both rev_conflict handlers)

- [ ] **Step 1: Extract retry helper function**

Add near the top of the Qadha component (after `useEffect` imports area, around line 950):
```js
const putRoomStateRetry=useCallback(async(code,token,gameState,maxRetries=3)=>{
  for(let i=0;i<maxRetries;i++){
    try{
      const data=await getRoom(code);
      await putRoomState(code,token,{clientRev:data.rev,gameState});
      return;
    }catch(e){
      const m=String(e.message||e);
      if((m==="rev_conflict"||m.includes("409"))&&i<maxRetries-1){
        await new Promise(r=>setTimeout(r,100*(i+1)));
        continue;
      }
    }
  }
},[]);
```

- [ ] **Step 2: Replace both inline retry blocks with the helper**

In the cats sync effect (~line 960):
```js
await putRoomStateRetry(code,token,gameState);
```

In the game state sync effect (~line 1000):
```js
await putRoomStateRetry(code,token,gameState);
```

- [ ] **Step 3: Commit**
```bash
git add src/Qadha.jsx
git commit -m "fix(high): proper retry loop for rev_conflict with exponential backoff"
```

---

### Task 7: Fix store.json crash on first run (MEDIUM)

**Files:**
- Modify: `server/index.mjs:26-28` (loadStore function)

- [ ] **Step 1: Wrap in try/catch with default**

Replace `loadStore`:
```js
function loadStore() {
  try {
    const raw = fs.readFileSync(STORE_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return { contentVersion: 1, overlay: {}, fingerprints: {} };
  }
}
```

- [ ] **Step 2: Commit**
```bash
git add server/index.mjs
git commit -m "fix(medium): loadStore returns default on missing/invalid store.json"
```

---

### Task 8: Fix guest navigation to broken state (MEDIUM)

**Files:**
- Modify: `src/Qadha.jsx:1361-1365` (step navigation guard)

- [ ] **Step 1: Block all navigation for online guests**

Find the step nav click handler (~line 1362) and replace the guard:
```js
if(isOnlineGuest){sfx.click();return;}
```

This prevents the guest from clicking ANY step nav button while in an online session.

- [ ] **Step 2: Commit**
```bash
git add src/Qadha.jsx
git commit -m "fix(medium): block all step navigation for online guests"
```

---

### Task 9: Implement separate question pools per player (ANTI-CHEAT)

**Files:**
- Modify: `src/Qadha.jsx` (openQ function, startGame, new refs)

- [ ] **Step 1: Add gridQsP2 ref for second player's questions**

Near the other refs (~line 790):
```js
const gridQsP2Ref=useRef({});
```

- [ ] **Step 2: Modify startGame to generate double questions**

In `startGame` (~line 1112), after `const questions=getQuestions(...)`, generate a second set:
```js
const questionsP2=getQuestions(clean,country.id,r,remoteOverlay);
gridQsP2Ref.current=questionsP2;
```

- [ ] **Step 3: Modify openQ to pick from correct player's pool**

In `openQ`, after determining `catId`, `tier`, and `pack`, add online-aware selection:
```js
const isP2Online=onlineSession&&active===2;
const activePack=isP2Online?(gridQsP2Ref.current[catId]||pack):pack;
```
Use `activePack` instead of `pack` for the `qs` selection.

- [ ] **Step 4: On steal, use the SAME question (already selected curQ)**

No code change needed here - when steal triggers, the existing `curQ` stays set (it's the first player's question). The second player answers the same question. The question from their own pool is NOT used during steal.

- [ ] **Step 5: Commit**
```bash
git add src/Qadha.jsx
git commit -m "feat: separate question pools per player for online anti-cheat"
```

---

### Task 10: Implement speed bonus system

**Files:**
- Modify: `src/Qadha.jsx` (doAns, checkTyped, timer state, UI rendering)

- [ ] **Step 1: Add speed bonus state and calculation**

Near other state declarations (~line 776):
```js
const[speedBonus,setSpeedBonus]=useState(null);
const questionStartRef=useRef(0);
```

In `openQ` (~line 1072), add after `setTimer(PTS_TIMER[ri]??45)`:
```js
questionStartRef.current=Date.now();setSpeedBonus(null);
```

Add helper function near utils:
```js
function calcSpeedBonus(startTime,timerTotal){
  const elapsed=(Date.now()-startTime)/1000;
  const pct=elapsed/timerTotal;
  if(pct<=0.25)return{mult:1.5,label:"بسرعة البرق!"};
  if(pct<=0.5)return{mult:1.25,label:"سريع!"};
  return{mult:1.0,label:null};
}
```

- [ ] **Step 2: Apply speed bonus in doAns**

In `doAns`, when answer is correct (~line 1037), replace score calc:
```js
if(idx===correctIdx){
  const bonus=calcSpeedBonus(questionStartRef.current,stealTimerRef.current??45);
  const pts=Math.round(curPts*bonus.mult);
  setSpeedBonus(bonus);
  sfx.correct();setRevealed(true);
  setScores(p=>{const n=[...p];n[active-1]+=pts;return n});
  ...
}
```

Do the same in `checkTyped` for typed correct answers.

- [ ] **Step 3: Show speed bonus in question UI**

In the question screen render, after the score update animation area, add:
```jsx
{speedBonus&&speedBonus.label&&(
  <div style={{position:"absolute",top:"18%",left:"50%",transform:"translateX(-50)",
    fontSize:"clamp(18px,4vw,28px)",color:th.gold,fontWeight:900,
    animation:"fadeUp 1.5s ease-out forwards",pointerEvents:"none",textAlign:"center"}}>
    {speedBonus.label} ×{speedBonus.mult}
  </div>
)}
```

- [ ] **Step 4: Commit**
```bash
git add src/Qadha.jsx
git commit -m "feat: speed bonus system - faster answers earn more points"
```

---

### Task 11: Implement streak multiplier

**Files:**
- Modify: `src/Qadha.jsx` (state, doAns, checkTyped, grid UI, startGame)

- [ ] **Step 1: Add streak state**

Near other state declarations:
```js
const[streaks,setStreaks]=useState([0,0]);
```

In `startGame` reset (~line 1114), add `setStreaks([0,0])`.

Add helper:
```js
function streakMult(streak){
  if(streak>=6)return{mult:2.0,flames:"🔥🔥🔥"};
  if(streak>=4)return{mult:1.5,flames:"🔥🔥"};
  if(streak>=2)return{mult:1.25,flames:"🔥"};
  return{mult:1.0,flames:""};
}
```

- [ ] **Step 2: Apply streak in doAns and checkTyped**

In `doAns`, on correct answer:
```js
const sm=streakMult(streaks[active-1]);
const bonus=calcSpeedBonus(questionStartRef.current,stealTimerRef.current??45);
const pts=Math.round(curPts*bonus.mult*sm.mult);
setStreaks(p=>{const n=[...p];n[active-1]+=1;return n});
```

On wrong answer (both steal and final wrong):
```js
setStreaks(p=>{const n=[...p];n[active-1]=0;return n});
```

On successful steal (correct after bounce), the stealing player's streak continues:
```js
setStreaks(p=>{const n=[...p];n[active-1]+=1;return n});
```

Same logic in `checkTyped`.

- [ ] **Step 3: Show streak indicator on grid screen**

In the grid screen, near the player turn indicator:
```jsx
{streaks[active-1]>=2&&(
  <span style={{marginInlineStart:8,fontSize:"clamp(14px,3vw,20px)"}}>
    {streakMult(streaks[active-1]).flames} ×{streakMult(streaks[active-1]).mult}
  </span>
)}
```

- [ ] **Step 4: Commit**
```bash
git add src/Qadha.jsx
git commit -m "feat: streak multiplier - consecutive correct answers boost points"
```

---

### Task 12: Implement Daily Double cells

**Files:**
- Modify: `src/Qadha.jsx` (startGame, openQ, grid render, new state)

- [ ] **Step 1: Add daily double state and generation**

Near other state:
```js
const[dailyDoubles,setDailyDoubles]=useState(new Set());
const[ddWager,setDdWager]=useState(null);
```

Add generation function:
```js
function generateDailyDoubles(numCats){
  const midCols=Array.from({length:numCats},(_,i)=>i);
  const hardCols=Array.from({length:numCats},(_,i)=>i);
  const midCol=midCols[Math.floor(Math.random()*midCols.length)];
  let hardCol;
  do{hardCol=hardCols[Math.floor(Math.random()*hardCols.length)]}while(hardCol===midCol&&numCats>1);
  const midRow=2+Math.floor(Math.random()*2); // rows 2-3 (400pt)
  const hardRow=4+Math.floor(Math.random()*2); // rows 4-5 (600pt)
  return new Set([`${midCol}-${midRow}`,`${hardCol}-${hardRow}`]);
}
```

In `startGame` (~line 1114), add:
```js
setDailyDoubles(generateDailyDoubles(8));setDdWager(null);
```

- [ ] **Step 2: Modify openQ to detect daily double**

At the start of `openQ`, after `const k=...`:
```js
if(dailyDoubles.has(k)){
  // Show wager UI instead of immediately opening question
  sfx.coin();
  setDdWager({cellKey:k,ci,ri,maxWager:Math.max(100,scores[active-1])});
  return;
}
```

Add a new function `openDdQuestion` that's called after wager is set:
```js
const openDdQuestion=(wagerAmount)=>{
  if(!ddWager)return;
  const{ci,ri,cellKey}=ddWager;
  setUsed(p=>({...p,[cellKey]:true}));
  // ... same question selection logic as openQ ...
  setCurPts(wagerAmount);
  setDdWager(null);
  // ... rest of openQ logic
};
```

- [ ] **Step 3: Add wager UI overlay**

When `ddWager` is set, render a wager overlay on the grid screen:
```jsx
{ddWager&&(
  <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",display:"flex",
    alignItems:"center",justifyContent:"center",zIndex:999}}>
    <div style={{background:th.card,borderRadius:20,padding:"32px 28px",textAlign:"center",maxWidth:360}}>
      <div style={{fontSize:"clamp(24px,5vw,36px)",marginBottom:16}}>مضاعفة! 🎯</div>
      <div style={{fontSize:"clamp(14px,3vw,18px)",color:th.textDim,marginBottom:20}}>
        اختر مبلغ الرهان
      </div>
      <input type="range" min={100} max={ddWager.maxWager} step={50}
        defaultValue={Math.min(200,ddWager.maxWager)}
        id="dd-wager-slider"
        style={{width:"100%",marginBottom:12}}/>
      <div style={{fontSize:"clamp(20px,4vw,30px)",color:th.gold,marginBottom:20}}
        id="dd-wager-display">200</div>
      <button onClick={()=>{
        const val=parseInt(document.getElementById("dd-wager-slider").value)||200;
        openDdQuestion(val);
      }} style={{padding:"12px 32px",borderRadius:14,background:th.btnBg,color:th.btnText,
        border:"none",fontSize:"clamp(16px,3.5vw,22px)",cursor:"pointer"}}>
        يلا!
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 4: Mark daily double cells on grid with subtle indicator**

In grid cell render, add a subtle sparkle for daily double cells (only visible BEFORE they're opened):
```jsx
{dailyDoubles.has(`${ci}-${ri}`)&&!used[`${ci}-${ri}`]&&(
  <span style={{position:"absolute",top:2,right:2,fontSize:10,opacity:0.5}}>✦</span>
)}
```

- [ ] **Step 5: Handle scoring - correct gains wager, wrong loses wager**

In `doAns`, detect daily double context by checking if `curPts` was set by wager (daily doubles set `curPts` to the wager amount). On wrong answer during daily double, subtract the wager:
```js
// Daily double wrong answer: lose wager points
if(dailyDoubles.has(lastCellKey)){
  setScores(p=>{const n=[...p];n[active-1]=Math.max(0,n[active-1]-curPts);return n});
}
```

No steal on daily double - if wrong, just reveal and return to grid:
```js
if(dailyDoubles.has(lastCellKey)){
  setRevealed(true);
  setTimeout(()=>{bRef.current=false;setRevealed(false);setFirstWrong(null);go("grid")},2500);
  return;
}
```

- [ ] **Step 6: Commit**
```bash
git add src/Qadha.jsx
git commit -m "feat: daily double cells with wagering mechanic"
```

---

### Task 13: Implement Final Round

**Files:**
- Modify: `src/Qadha.jsx` (isDone effect, new state, new screen section)

- [ ] **Step 1: Add final round state**

```js
const[finalRound,setFinalRound]=useState(null);
const[finalWagers,setFinalWagers]=useState([null,null]);
const[finalAnswers,setFinalAnswers]=useState([null,null]);
const[finalPhase,setFinalPhase]=useState("wager"); // "wager"|"answer"|"reveal"
```

- [ ] **Step 2: Modify isDone to trigger final round instead of results**

Replace the isDone effect (~line 1118):
```js
useEffect(()=>{
  if(sc==="grid"&&isDone){
    setTimeout(()=>{
      // Pick a random question from any of the 8 categories
      const randomCat=selCats[Math.floor(Math.random()*selCats.length)];
      const pack=qBank[randomCat.id];
      const qs=pack?.hard||pack?.mid||pack?.easy||[];
      const q=qs.length?shufQ(qs[Math.floor(Math.random()*qs.length)]):{q:"؟",o:["A","B","C","D"],a:0};
      setFinalRound({cat:randomCat,question:q});
      setFinalWagers([null,null]);
      setFinalAnswers([null,null]);
      setFinalPhase("wager");
      go("final");
    },600);
  }
},[sc,isDone,selCats,qBank,go]);
```

- [ ] **Step 3: Add final round screen rendering**

Add a new screen section for `sc==="final"`:
```jsx
{sc==="final"&&finalRound&&(
  <div style={{...W,textAlign:"center"}}>
    <div style={P}>
      <div style={{fontSize:"clamp(28px,6vw,42px)",marginBottom:12}}>الجولة الأخيرة 🏆</div>
      <div style={{fontSize:"clamp(16px,3.5vw,22px)",color:th.textDim,marginBottom:24}}>
        {finalRound.cat.icon} {finalRound.cat.ar}
      </div>
      {finalPhase==="wager"&&(
        // Wager UI for current wagering player
        // P1 wagers first, then P2
        <div>...</div>
      )}
      {finalPhase==="answer"&&(
        // Both players type their answer (hard mode style), 45 seconds
        <div>...</div>
      )}
      {finalPhase==="reveal"&&(
        // Dramatic reveal: P1 answer, then P2 answer, then final scores
        <div>...</div>
      )}
    </div>
  </div>
)}
```

- [ ] **Step 4: Implement wager phase logic**

Each player sets a wager slider (0 to their score). P1 wagers, then P2. After both wager:
```js
setFinalPhase("answer");
```

- [ ] **Step 5: Implement answer phase (typed answer, 45s timer)**

Both players see the question and type their answer. Use existing `isTypedAnswerAccepted` for matching. Timer counts down from 45.

- [ ] **Step 6: Implement reveal phase**

Show P1's answer -> correct/wrong -> score +/- wager. Then P2. Then final scores -> go("results").

- [ ] **Step 7: Commit**
```bash
git add src/Qadha.jsx
git commit -m "feat: final round with wagering after grid completion"
```

---

### Task 14: Implement Sudden Death tiebreaker

**Files:**
- Modify: `src/Qadha.jsx` (results screen, new state)

- [ ] **Step 1: Add sudden death state**

```js
const[suddenDeath,setSuddenDeath]=useState(null);
const[sdAnswered,setSdAnswered]=useState([false,false]);
```

- [ ] **Step 2: Detect tie in results and offer sudden death**

In the results screen, when `scores[0]===scores[1]`:
```jsx
{scores[0]===scores[1]&&!suddenDeath&&(
  <div>
    <div style={{fontSize:"clamp(24px,5vw,36px)",marginBottom:16}}>تعادل! ⚡</div>
    <button onClick={()=>{
      const randomCat=selCats[Math.floor(Math.random()*selCats.length)];
      const pack=qBank[randomCat.id];
      const qs=pack?.hard||pack?.mid||pack?.easy||[];
      const q=qs.length?shufQ(qs[Math.floor(Math.random()*qs.length)]):null;
      if(q)setSuddenDeath({question:q,cat:randomCat,round:1});
    }} style={{...}}>
      جولة حسم! ⚡
    </button>
  </div>
)}
```

- [ ] **Step 3: Render sudden death question**

Both players see the question simultaneously. First correct answer wins. Both tap options (or type in hard mode). After both answer (or timeout), evaluate:
- If one correct, they win
- If both correct, fastest wins (use timestamps)
- If neither correct and round < 3, next question
- If round = 3, declare true tie

- [ ] **Step 4: Commit**
```bash
git add src/Qadha.jsx
git commit -m "feat: sudden death tiebreaker replaces tie screen"
```

---

### Task 15: Implement new power-ups (Switch + Double Chance)

**Files:**
- Modify: `src/Qadha.jsx` (state, openQ, doAns, power-up UI)

- [ ] **Step 1: Add state for new power-ups**

```js
const[usedSwitch,setUsedSwitch]=useState(false);
const[usedDouble,setUsedDouble]=useState(false);
const[doubleChanceActive,setDoubleChanceActive]=useState(false);
```

Reset both in `startGame` and in steal callbacks.

- [ ] **Step 2: Implement Switch power-up**

```js
const useSwitch=useCallback(()=>{
  if(usedSwitch||answered||!curQ)return;
  sfx.click();setUsedSwitch(true);
  // Deduct 100 points
  setScores(p=>{const n=[...p];n[active-1]=Math.max(0,n[active-1]-100);return n});
  // Re-draw from same category/tier (openQ with same ci/ri)
  const ci=lastCellRef.current?.ci;
  const ri=lastCellRef.current?.ri;
  if(ci!=null&&ri!=null){
    // Pick a different question from the same tier
    const catId=selCats[ci].id;
    const tier=rowTierFromRi(ri);
    const pack=qBank[catId];
    const qs=pack?.[tier]||[];
    if(qs.length>1){
      const newQ=shufQ(qs[Math.floor(Math.random()*qs.length)]);
      curQAnswerRef.current=newQ.a;
      setCurQ(newQ);
      setTimer(stealTimerRef.current??45);
      questionStartRef.current=Date.now();
    }
  }
},[usedSwitch,answered,curQ,active,selCats,qBank]);
```

- [ ] **Step 3: Implement Double Chance power-up**

```js
const useDoubleChance=useCallback(()=>{
  if(usedDouble||answered||!curQ||hard)return;
  sfx.click();setUsedDouble(true);setDoubleChanceActive(true);
},[usedDouble,answered,curQ,hard]);
```

In `doAns`, when wrong AND `doubleChanceActive`:
```js
if(doubleChanceActive){
  setDoubleChanceActive(false);
  sfx.wrong();setSelA(idx);
  // Don't trigger steal or end - just let them pick again at half points
  setCurPts(p=>Math.round(p/2));
  setTimeout(()=>{setAnswered(false);setSelA(null)},1000);
  return;
}
```

- [ ] **Step 4: Add power-up buttons to question screen UI**

Add alongside existing 50/50 and +15s buttons:
```jsx
<button onClick={useSwitch} disabled={usedSwitch||answered}
  style={{...powerUpStyle,opacity:usedSwitch?0.3:1}}>
  🔄 تبديل
</button>
<button onClick={useDoubleChance} disabled={usedDouble||answered||hard}
  style={{...powerUpStyle,opacity:usedDouble?0.3:1}}>
  🎯 فرصة ثانية
</button>
```

- [ ] **Step 5: Add lastCellRef for Switch to know current cell**

```js
const lastCellRef=useRef(null);
```
In `openQ`, set `lastCellRef.current={ci,ri}`.

- [ ] **Step 6: Commit**
```bash
git add src/Qadha.jsx
git commit -m "feat: Switch and Double Chance power-ups"
```

---

### Task 16: Implement Category Stars bonus

**Files:**
- Modify: `src/Qadha.jsx` (state, doAns, grid UI)

- [ ] **Step 1: Add category stars tracking**

```js
const[catStars,setCatStars]=useState({});
```

Structure: `{ [catId]: { easy: boolean, mid: boolean, hard: boolean } }`

Reset in `startGame`.

- [ ] **Step 2: Track correct answers per category/tier**

In `doAns` and `checkTyped`, on correct answer, update catStars:
```js
const ci=lastCellRef.current?.ci;
const ri=lastCellRef.current?.ri;
if(ci!=null){
  const catId=selCats[ci].id;
  const tier=rowTierFromRi(ri);
  setCatStars(prev=>{
    const cat={...(prev[catId]||{})};
    cat[tier]=true;
    const updated={...prev,[catId]:cat};
    // Check if all 3 tiers complete -> bonus
    if(cat.easy&&cat.mid&&cat.hard&&!prev[catId]?.bonus){
      cat.bonus=true;
      setScores(p=>{const n=[...p];n[active-1]+=300;return n});
      // Could play a special sound
    }
    return updated;
  });
}
```

- [ ] **Step 3: Show star on completed category columns**

In grid header, for each category:
```jsx
{catStars[selCats[ci]?.id]?.bonus&&(
  <span style={{fontSize:12,position:"absolute",bottom:-2}}>⭐</span>
)}
```

- [ ] **Step 4: Commit**
```bash
git add src/Qadha.jsx
git commit -m "feat: category stars - bonus 300pts for completing all tiers in a category"
```

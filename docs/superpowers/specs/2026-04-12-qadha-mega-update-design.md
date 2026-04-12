# Qadha Mega Update - Design Spec

## Overview

A comprehensive update to Qadha covering: anti-cheat for online multiplayer, new game mechanics for both online and local modes, critical bug fixes, and question bank quality improvements.

---

## 1. Anti-Cheat System (Online Multiplayer)

### 1.1 Separate Question Pools Per Player

Each cell in the 3x8 grid loads **2 different questions** -- one per player.

**Data structure:**
```js
// In game state (host-side only)
gridQs = {
  "0-0": { p1: { q, o, a, d }, p2: { q, o, a, d } },
  "0-1": { p1: { q, o, a, d }, p2: { q, o, a, d } },
  // ... 24 cells total
}
```

**Flow:**
1. Host generates grid, picks 2 unique questions per cell from the bank (using existing `getQuestions` with double the draw)
2. Active player taps a cell -> host sends ONLY that player's question (without `a` field)
3. Inactive player sees: category name + difficulty tier + timer countdown (NOT the question or options)
4. On **steal**: the stealing player receives the SAME question the first player got wrong (the `a` field is still withheld until answer submission)
5. After answer resolution, the correct answer is broadcast to both players for the reveal animation

**Key change to `putRoomState`:**
- `curQ` broadcast must NEVER include `curQ.a` (the correct answer index)
- Host keeps `curQ.a` locally and validates the answer on the host side
- After validation, host broadcasts `{ wasCorrect: true/false, correctIdx: N }` so both clients show the reveal

### 1.2 Answer Index Stripping

**Current bug (CRITICAL):** `curQ.a` is broadcast to all players. Fix:

```js
// Before broadcasting game state, strip the answer
const safeQ = curQ ? { q: curQ.q, o: curQ.o, d: curQ.d, img: curQ.img } : null;
// Send safeQ instead of curQ in putRoomState
```

### 1.3 Speed Bonus (Anti-Google + Engagement)

Faster answers earn more points. This rewards knowledge over searching.

| Answer Time | Multiplier | Label |
|-------------|-----------|-------|
| First 25% of timer | 1.5x | "بسرعة البرق!" (Lightning fast!) |
| First 50% of timer | 1.25x | "سريع!" (Fast!) |
| After 50% | 1.0x | (no bonus) |

Display the bonus as a floating "+150 bonus" animation on score update.

**Timer values remain:** 45s easy, 40s medium, 35s hard (current values).
For future ranked mode: 20s/15s/12s with same multiplier thresholds.

---

## 2. New Game Mechanics (Both Modes)

### 2.1 Streak Multiplier ("سلسلة" - Chain)

Track consecutive correct answers per player.

| Streak | Multiplier | Visual |
|--------|-----------|--------|
| 0-1 correct | x1.0 | No indicator |
| 2-3 correct | x1.25 | Single flame icon |
| 4-5 correct | x1.5 | Double flame |
| 6+ correct | x2.0 | Triple flame + glow |

- Wrong answer or timeout resets streak to 0
- Successful steal CONTINUES the stealer's streak (high drama)
- Failed steal does NOT break the original player's streak (they didn't answer wrong -- they just failed to steal)
- Display streak counter next to player name: "🔥 x4"
- Stacks with speed bonus: a 6-streak + fast answer on a 600pt hard question = 600 * 2.0 * 1.5 = 1800 pts

### 2.2 Daily Double ("مضاعفة" - Double Down)

2 random cells in the grid are secretly marked as Daily Doubles.

**Placement rules:**
- 1 in medium row (400pt tier), 1 in hard row (600pt tier)
- Never in the same category column
- Randomly placed when grid is generated

**Flow:**
1. Player selects a Daily Double cell
2. Special oud sting sound plays + "مضاعفة!" text flashes on screen
3. Player sees a wager slider: minimum 100, maximum = their current score (or 100 if score < 100)
4. Player submits wager, THEN sees the question
5. Correct = earn base points + wager. Wrong = lose wager (but keep base 0, floor at 0 total score)
6. No steal on Daily Double -- only the discovering player answers

### 2.3 Final Round ("الجولة الأخيرة")

After all 24 grid cells are used (or when players choose to end early):

1. A random category is revealed (from the 8 selected, or a 9th surprise category)
2. Each player secretly sets a wager: slider from 0 to their current score
3. Both players see the same question simultaneously
4. Hard-mode style: typed answer, 45 seconds, dialect-aware matching
5. Dramatic reveal: Player 1's answer shown -> correct/wrong -> score update -> Player 2's answer shown -> correct/wrong -> final scores
6. The Final Round can flip the entire match

### 2.4 Sudden Death Tiebreaker

When final scores are tied (replaces the current "تعادل!" screen):

1. "جولة حسم!" (Sudden Death!) announcement with dramatic sound
2. One question appears, both players see it simultaneously
3. First to tap the correct answer wins (real-time race, not turn-based)
4. If both answer wrong or time expires (15 seconds), new question appears
5. Maximum 3 sudden death questions, then true tie declared

### 2.5 Category Stars ("النجوم")

For each category, if a player answers ALL 3 tiers correctly (easy + medium + hard):

- That category's column header lights up gold with a star
- Bonus: +300 points per completed category
- Visual: star icon appears under the category emoji on the grid
- Encourages players to "sweep" categories rather than cherry-pick easy questions

### 2.6 New Power-Ups

Add to existing 50/50 and +15s:

**"تبديل" (Switch):** Replace the current question with a different one from the same category/tier. Costs 100 points from your score. Usable once per match. Useful when you have no idea.

**"فرصة ثانية" (Double Chance):** If your first pick is wrong, get one more attempt at half points. Usable once per match. Does NOT trigger steal if the second attempt is also wrong (steal triggers after both attempts fail).

**Power-up allocation:** Each player gets 1 of each power-up per match (50/50, +15s, Switch, Double Chance = 4 total). Used power-ups are grayed out in the toolbar.

### 2.7 True/False Speed Round ("صح أو خطأ")

Optional bonus round (can be toggled on/off in match settings):

1. Triggers after the grid is complete but BEFORE the Final Round
2. 10 rapid-fire true/false statements, 8 seconds each
3. Both players answer simultaneously (not turn-based)
4. +50 points per correct answer, no penalty for wrong
5. No steal, no power-ups -- pure knowledge speed
6. Statements drawn from a separate `truefalse` bank (new data needed)

---

## 3. Local Mode Adaptations

Local mode = shared screen, same room. Players can see each other's screen. The following adaptations account for this:

### 3.1 No Question Hiding (Screen Sharing Reality)

Since both players see the same screen, anti-cheat question separation does NOT apply. Instead:

- Both players see the same question (current behavior)
- Turn-based play continues as-is
- Steal mechanic works naturally (the stealing player already saw the question)

### 3.2 Hot-Seat Announcement ("الكرسي الساخن")

When turns switch:
- Full-screen overlay: player's name + "دورك!" (Your turn!) for 1.5 seconds
- Different color per player (Player 1 = blue tint, Player 2 = red tint)
- Dramatic sound sting
- This creates a "moment" when passing control, especially in diwaniya settings

### 3.3 Buzzer Mode ("الجرس") - New Local-Only Mode

Alternative to turn-based play for local mode:

1. Both players/teams see the question simultaneously
2. A "BUZZ" button appears for each side of the screen (left = P1, right = P2)
3. First to tap buzzes in -- their side lights up, other side grays out
4. Buzzing player has 10 seconds to pick an answer
5. Correct = earn points. Wrong = opponent gets a free answer (no time pressure)
6. If nobody buzzes within 15 seconds, question is skipped

**Grid modification for Buzzer Mode:**
- Questions are drawn sequentially (not player-selected from grid)
- All 24 questions from the grid are played in order: all easy, then all medium, then all hard
- This keeps the escalating difficulty arc

### 3.4 Group/Party Mode Enhancements

For 3+ people playing in the same room:

**Team Captain System:**
- Each team designates a captain who physically taps the answer
- Other team members discuss and advise verbally
- "تشاور" (Consultation) indicator: 10-second discussion phase before the captain's 15-second answer phase

**Challenge/Penalty Mode ("التحدي"):**
Toggle in match settings. Wrong answer = random challenge from a customizable list:
- "غنِّ بيتين من أغنية" (Sing two lines of a song)
- "قلّد شخصية مشهورة" (Impersonate a celebrity)
- "قول مثل شعبي" (Say a proverb)
- "قف على رجل واحدة ١٠ ثواني" (Stand on one leg for 10 seconds)
- Host can add/remove challenges in settings before match starts
- Display the challenge full-screen with a 30-second timer

**Audience Reactions (Group Mode):**
- People watching (not playing) can tap reaction emojis that float across the screen
- Simple touch zones at the bottom: thumbs up, laughing, shocked, clapping
- Adds atmosphere without interfering with gameplay

---

## 4. Critical Bug Fixes

### 4.1 CRITICAL: Answer Leak to Online Guests
**File:** `src/Qadha.jsx` ~lines 993-1020
**Fix:** Strip `curQ.a` from game state before broadcasting. Host validates answers locally.

### 4.2 CRITICAL: Timer Race Condition in Steal
**File:** `src/Qadha.jsx` ~lines 1024-1033
**Fix:** Clear `tRef.current` immediately in the steal transition callback BEFORE setting state. Guard decrement: `if (p <= 0) return 0;`

### 4.3 CRITICAL: Power-ups/50-50 Not Reset During Steal
**File:** `src/Qadha.jsx` ~lines 1027, 1037-1038
**Fix:** Add `setUsedFifty(false); setUsedExt(false); setHiddenOpts([]);` in both steal transition callbacks.

### 4.4 HIGH: Session Hijacking via Display Name
**File:** `server/index.mjs` ~lines 284-294
**Fix:** Always create new player entries on join. Use reconnection tokens, not display names, for dedup.

### 4.5 HIGH: Steal Timer Hardcoded to 45s
**File:** `src/Qadha.jsx` ~line 1086
**Fix:** Store original timer value for current question in a ref. Use that value instead of hardcoded 45 in steal reset.

### 4.6 HIGH: shufQ Incorrect When Options Have Duplicates
**File:** `src/Qadha.jsx` ~line 194
**Fix:** Track correct answer by original index through shuffle, not by `indexOf` string match.

### 4.7 HIGH: No Player Count Limit on Rooms
**File:** `server/index.mjs` ~lines 276-299
**Fix:** Add `if (room.players.length >= 2) return res.status(409).json({ error: "room_full" });` in join handler.

### 4.8 HIGH: Rev Conflict Retry Can Still Fail
**File:** `src/Qadha.jsx` ~lines 960-966
**Fix:** Implement retry loop with max 3 attempts and exponential backoff (100ms, 200ms, 400ms).

### 4.9 MEDIUM: Store.json Load Crash on First Run
**File:** `server/index.mjs` ~line 27
**Fix:** Wrap in try/catch, return default `{ contentVersion: 1, overlay: {}, fingerprints: {} }`.

### 4.10 MEDIUM: localStorage Overflow for Question Cache
**File:** `src/game/questionCache.js`
**Fix:** On QuotaExceededError, prune oldest entries and retry. Add LRU eviction at 3MB.

### 4.11 MEDIUM: Questions Marked "Seen" on Load, Not Display
**File:** `src/Qadha.jsx` ~lines 750-756
**Fix:** Only add to `seen` set in `openQ` when a question is actually shown to the player.

### 4.12 MEDIUM: Voice Polling Conflicts With WebSocket
**File:** `src/services/voiceMesh.js` ~lines 53-57
**Fix:** Skip HTTP inbox polling when WebSocket transport is connected.

### 4.13 MEDIUM: Guest Can Navigate to Broken State
**File:** `src/Qadha.jsx` ~lines 1361-1365
**Fix:** Block ALL navigation for online guests. Clear `onlineSession` if guest somehow navigates to menu.

### 4.14 LOW: sendChat Callback Never Memoizes
**File:** `src/Qadha.jsx` ~line 1169
**Fix:** Depend on specific stable values from `liveRoom` instead of the whole object.

### 4.15 LOW: Audio Element Refs Not Cleaned Up
**File:** `src/Qadha.jsx` ~lines 1535-1539
**Fix:** Use `useCallback` ref that sets `srcObject = null` on unmount.

---

## 5. Question Bank Improvements

### 5.1 Fix Difficulty Tags (CRITICAL)

**Problem:** 92% of questions (5,890/6,444) have no `d` field.

**Solution:** Write a script that assigns difficulty based on heuristics:
- Questions with short, common-knowledge answers -> d=1 (easy)
- Questions requiring specific knowledge -> d=2 (medium)
- Questions requiring expert/niche knowledge -> d=3 (hard)
- For 8-question template files: assign d=1 to first 3, d=2 to next 3, d=3 to last 2
- Manual review of Kuwait bank (which has the richest content)

### 5.2 Replace Template Filler (CRITICAL)

**Problem:** 222 files across GCC banks are generic country trivia, not category-specific.

**Solution:** Generate real category-specific questions for each country:
- Priority 1: ae, sa (largest audiences)
- Priority 2: qa, bh, om
- Target: minimum 15 real questions per category per country (currently 8 template)
- Use the Anthropic API question generation already built into the game
- Categories to prioritize: history, sports, food, landmarks, celebrities (highest engagement)

### 5.3 Fix Answer Index Distribution

**Problem:** 82% of answers are `a=0`. Five countries are 100% `a=0`.

**Solution:** Write a one-time script to randomize answer positions:
```js
// For each question, shuffle options and update `a` accordingly
const correctText = q.o[q.a];
const shuffled = [...q.o].sort(() => Math.random() - 0.5);
q.a = shuffled.indexOf(correctText);
q.o = shuffled;
```
This makes the source data self-documenting and correct without runtime shuffling.

### 5.4 Replace Joke Distractors

**Problem:** "pizza", "sushi", "underwater city" appear 240+ times as wrong answers.

**Solution:** Script to identify and flag questions where distractors share no semantic relationship with the correct answer. Replace with plausible wrong answers from the same domain. For country-specific questions, use other real answers from that domain.

### 5.5 Improve Short Questions

**Problem:** 257 questions are <=10 characters ("DNA؟", "WHO؟").

**Solution:** Expand these into full sentences:
- "DNA؟" -> "ما الحمض النووي المسؤول عن نقل المعلومات الوراثية؟" (What nucleic acid carries genetic information?)
- "WHO؟" -> "ما المنظمة الدولية المسؤولة عن الصحة العالمية؟" (What international organization is responsible for global health?)

### 5.6 Add New Categories

Priority new categories to add:

| Category ID | Arabic Name | Why |
|-------------|------------|-----|
| `islamic_history` | التاريخ الإسلامي | Huge demand in Gulf audience |
| `arabic_poetry` | الشعر العربي | Core Gulf culture |
| `arabic_grammar` | النحو العربي | Educational, challenging |
| `famous_quotes` | أقوال مشهورة | Engaging, shareable |
| `kdrama` | الدراما الكورية | Very popular in Gulf youth |
| `world_records` | أرقام قياسية | Fun, surprising facts |
| `falconry` | الصيد والصقور | Traditional Gulf heritage |
| `perfumes` | العطور والعود | Culturally significant |
| `quran` | القرآن الكريم | Educational |
| `arab_scientists` | علماء العرب | Inspirational, educational |

Add to `CAT_IDS` and `CAT_GROUP_ROWS` in Qadha.jsx. Create bank files for all 8 countries. Minimum 20 questions per category per country.

### 5.7 Add New Countries (Phase 2)

| Country ID | Name | Priority | Reason |
|-----------|------|----------|--------|
| `eg` | مصر | HIGH | 100M+ population, rich trivia |
| `iq` | العراق | HIGH | 45M+, strong cultural identity |
| `jo` | الأردن | MEDIUM | Levant representation |
| `lb` | لبنان | MEDIUM | Levant representation |
| `ma` | المغرب | MEDIUM | Maghreb representation |
| `ps` | فلسطين | MEDIUM | Cultural significance |
| `dz` | الجزائر | LOW | Maghreb expansion |
| `sd` | السودان | LOW | East Africa representation |

Each new country needs: 72 category files with minimum 15 questions each. Start with top 20 categories for high-priority countries.

### 5.8 Add True/False Question Bank

New bank type for the True/False Speed Round:
- File: `src/data/banks/<country>/truefalse.json`
- Format: `{ "q": "statement text", "a": true/false }`
- Target: 50+ statements per country
- Mix of easy obvious statements and tricky ones

---

## 6. Implementation Phases

### Phase 1: Critical Fixes (Do First)
1. Fix all CRITICAL and HIGH bugs (4.1 - 4.8)
2. Fix answer leak to online guests
3. Fix timer race conditions
4. Fix power-up reset during steal
5. Fix session hijacking

### Phase 2: Anti-Cheat + Core Mechanics
6. Implement separate question pools per player (online)
7. Add speed bonus system
8. Add streak multiplier
9. Add Daily Double cells
10. Strip answer from broadcast

### Phase 3: New Game Features
11. Final Round
12. Sudden Death tiebreaker
13. Category Stars
14. New power-ups (Switch, Double Chance)
15. Hot-Seat announcement (local mode)

### Phase 4: Local Mode Expansion
16. Buzzer Mode
17. Challenge/Penalty Mode
18. Group/Party enhancements
19. Audience reactions

### Phase 5: Question Bank Overhaul
20. Add difficulty tags to all questions
21. Replace template filler in GCC banks
22. Fix answer index distribution
23. Replace joke distractors
24. Expand short questions
25. Add new categories
26. Add True/False bank

### Phase 6: Future (Post-Launch)
27. New countries (Egypt, Iraq, etc.)
28. Tournament bracket mode
29. ELO rating system
30. Achievement/badge system
31. Daily Challenge mode
32. Fibbage/Deception party mode
33. Spectator mode

---

## Technical Notes

- All new features use existing infrastructure (React state, WebSocket, room API)
- No new dependencies required for Phases 1-4
- Question generation for Phase 5 can use the existing Anthropic API integration
- Speed bonus and streak multiplier are purely client-side calculations
- Daily Double and Final Round add new game phases but reuse existing question display/answer components
- Buzzer Mode for local is a new component but reuses the existing question rendering
- True/False round needs a new minimal component (statement + two buttons)

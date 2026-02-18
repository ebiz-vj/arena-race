# Arena Race — Production Validation (Final)

**Document type:** Stability validation before TDD conversion  
**Assumptions:** 3–5 engineers, 90-day MVP, limited QA, early DAU < 1,000  
**Output:** MVP boundary, risks exposed, go/no-go readiness.

---

## 1. MVP Simplification Check

### 1.1 Critical for Phase 1a (Bronze-Only Launch)

| Feature | Why critical |
|---------|----------------|
| **Single board (A)** | Already specified; no variant logic. |
| **Scoring formula (Position, Zone, Overtake, Survival)** | Core game; must be correct and deterministic. |
| **Zone contested-only** | Needed to prevent snowball; simple rule (≥2 players in zone). |
| **Escrow + 8% fee + 38/30/20/12 payout** | Money safety and economics. |
| **2 queues (Bronze-10, Bronze-25)** | Liquidity survival; no Silver until 1k DAU. |
| **Queue timeout 240s + merge prompt at 180s (tier only in 1a)** | Prevents infinite wait; in 1a no Silver→Bronze, only Standard→Casual. |
| **Match log + replay for disputes** | Integrity and dispute resolution. |
| **Entry confirmation + age/jurisdiction + fee disclosure** | Compliance floor. |
| **Basic co-occurrence flag** | Teaming is the main collusion risk in 4-player; must flag. |

### 1.2 Keep for MVP / Simplify / Defer to Phase 2

| System | Verdict | Action |
|--------|---------|--------|
| **Ability draft system** | **Defer** | Phase 1a: fixed ability set (e.g. 3 abilities: Boost, Block, Trap). No draft UI, no snake order, no 90s pre-match. Reduces scope by ~2–3 weeks. Add draft when Gold unlocks (Phase 2). |
| **Multiple boards** | **Defer** | Phase 1a/1b: Board A only. Boards B/C add balance and art; defer until post-PMF. |
| **Advanced bot detection** | **Simplify** | MVP: (1) Input timing threshold (mean <800 ms, std <200 ms over 20 turns → flag). (2) No CAPTCHA in v1 or 3% at most. Defer: auxiliary-actions heuristic, full bot score. |
| **Full risk score system** | **Simplify** | MVP: single composite risk from co-occurrence + win-rate only. Defer: smurf score, full 5-component formula, auto-restrict at 70. Manual review for all flags; no auto-restrict until Phase 2. |
| **Seasonal rotation logic** | **Defer** | MVP: no ability rotation, no mid-season balance patch. One fixed season; "Season 1" is static. Add rotation when seasons are defined (e.g. 12-week calendar). |
| **Diminishing zone multipliers** | **Simplify** | MVP: **contested-only** (zone points only when ≥2 players in zone). **Defer** diminishing (0.9, 0.8, … min 0.5) to Phase 2. Rationale: contested-only already limits snowball; diminishing adds state and testing; can ship without it and add if zone dominance appears in playtests. |
| **Merge handicap (Silver→Bronze)** | **Defer** | Phase 1a has no Silver; handicap only needed in Phase 1b. When 1b ships: keep flat −15 pt deduction. No change. |
| **KYC trigger at 5,000 USDC lifetime** | **Keep** | Required for compliance; low volume at launch so rarely triggers. |
| **Manual payout runbook (24h)** | **Keep** | Essential; small team can do 1–2 manual payouts per week if needed. |
| **Dispute replay from log** | **Keep** | Must have; deterministic close. |

### 1.3 Overengineered for Launch

- **5-component risk score + auto-restrict tiers:** Simplify to flag + manual review only.
- **CAPTCHA 5%:** Defer or reduce to 3%; adds friction and dev/QA.
- **Diminishing zone multiplier:** Defer; contested-only is sufficient for MVP.
- **Ability draft:** Defer; fixed 3 abilities for MVP.
- **Inactivity decay (30 days, −50 ELO):** Low priority for first season; can defer or ship with zero decay in Season 1.

---

## 2. Game Feel Validation

### 2.1 Scoring: Aggression vs Passive

- **Position:** Rewards moving forward (aggression). Passive play loses on position.
- **Zone:** Contested-only rewards **entering** zones where others are (contestation). Passive avoidance of zones yields 0 zone points → **rewards aggression**.
- **Overtake:** Explicitly aggressive (passing others).
- **Survival:** Rewards avoiding Trap and squeeze. **Only component that rewards caution.** At 0.5 per safe token per turn, max 75 vs position 80–120, survival is secondary; optimal play is still "advance + contest + overtake," with survival as modifier.  
**Verdict:** Scoring rewards aggression; survival does not dominate. **Keep as-is.**

### 2.2 Survival and Defensive Meta

- If survival were high weight, "stay safe, don't contest" could dominate. Current weight (realistic 40–60, max 75) keeps survival below position and zone.  
**Verdict:** No change. If playtests show turtling, consider reducing survival to 0.3 per token (max 45) in a balance patch.

### 2.3 Zone Contested Rule — New Player Clarity

- "Zone gives points only when at least 2 players have a token there" is one sentence but non-obvious.  
**Recommendation:** In-client: short tooltip on first zone encounter — "Control zones when others are nearby to score." Optional: highlight zone when contested (e.g. border glow). No rule change.

### 2.4 Diminishing Multiplier — Cognitive Load

- Tracking consecutive turns per zone per player adds hidden state. Players may not know why zone points "dropped."  
**Recommendation:** Already recommended to **defer** diminishing for MVP. If added later, show a simple indicator (e.g. "Zone control: 2nd turn" or "Reduced reward") so it's not a black box.

### 2.5 Five-Minute Match and Tension

- 5 min ≈ 50 turns at 6 s/turn. Tension curve: early (positioning), mid (zone fights, overtakes), late (sprint).  
**Verdict:** 5 min is reasonable. Risk: if turns are slow (e.g. 10 s), match drags. **Recommendation:** Lock turn timer (e.g. 6 s) and enforce; if playtests show fatigue, consider 4 min (≈40 turns) as an optional "quick" mode in Phase 2 only. No change for MVP.

### 2.6 Small Refinements (Fun, No Complexity)

- **In-game score breakdown:** Show Position / Zone / Overtake / Survival in end-screen so players learn what mattered.  
- **Single "biggest moment" highlight:** E.g. "Best overtake" or "Zone capture" — reinforces agency.  
- No new mechanics; UI/feedback only.

---

## 3. Meta Stability Check

### 3.1 Simulated 200-Match High-Skill Meta

**Assumptions:** Skilled players; meta discovery; coordinated group trying to break the game.

- **Position weight (realistic 80–120, max 135):** Still the largest single component (~39% of total). A strategy that maximizes position (Rush) and ignores zone until contested will often lead.  
- **Zone contested-only:** If one player rushes and others contest zones, rusher can still win on position alone if they hold rows. So **Position is slightly dominant** in a vacuum.  
- **Counter:** Control (contest zones, Block/Trap chokes) can deny rusher clean paths; Hunter (overtakes) can close gap if rusher overextends. So meta is not solved by "always Rush," but Rush has a **small edge** in raw numbers.

### 3.2 Zone Diminishing and Stall Meta

- If **diminishing** were in: long control of same zone → declining points. Rational play could be "contest once then leave to reset multiplier" → **stall** (players rotating in/out).  
- **Contested-only (no diminishing):** No reset incentive; contestation is natural. **Deferring diminishing** avoids stall meta. If later data shows one player holding all zones every turn, add diminishing in a patch.

### 3.3 Overtake Cap (8) and Hunter

- Cap 8 → max 32 pts. Hunter needs overtakes to compete; in a skilled lobby, overtake opportunities may be limited (others avoid being passed). Risk: **Hunter underpowered** in high-skill, low-chaos games.  
- **Mitigation:** No RNG. Options: (1) Keep cap at 8; accept Hunter as situational. (2) If data shows Hunter win rate <45% in Gold+, consider cap 10 (40 pts max) in a balance patch. **MVP: keep 8;** monitor.

### 3.4 Most Likely Exploit Strategy and Counter

- **Exploit:** Two accounts queue-sniping to land in same match (same division/tier, similar queue time), then soft team: one blocks/interferes with others, other takes 1st. Co-occurrence detection is designed to catch this (N_together ≥15, avg min(place) ≤2.2).  
- **Counter:** (1) Co-occurrence flag + manual review. (2) No public "queue together" feature in MVP. (3) Matchmaking does not guarantee same region/server; same pair in 15+ of 200 matches is already flag-worthy.  
- **Second exploit:** Rush-only, ignore zones. Maximize position; accept low zone. Counter: Control blocks paths; position alone may not win if 2–3 players contest and overtake. No RNG; design holds.

**Summary:** Position slightly dominant; Hunter possibly weak at high skill; no game-breaking exploit if co-occurrence and review are in place. **Stable for MVP.**

---

## 4. Economic Psychology Stress Test

### 4.1 Median Player After 10 Losses (25 USDC)

- Assume 10 matches, 2.5 wins (1st), 2.5 (2nd), 2.5 (3rd), 2.5 (4th) — median.  
- Payout: 2.5×(34.96+27.60+18.40+11.04) = 2.5×92 = 230. Entry: 250. **Net −20 USDC.**  
- After 10 matches, median player is down 20 USDC. **Perceived as "I lost a bit."** Not catastrophic; but 10 matches with more 3rd/4th (e.g. 1/2/3/4 distribution) = 34.96+55.20+55.20+44.16 = 189.52, entry 250 → **−60.**  
- **Verdict:** Median will feel **slightly punished** after 10 losses if placement skews 3rd/4th. Mitigation: onboarding and messaging ("2nd place gets your entry back"; "focus on improving placement"). No payout change.

### 4.2 Fourth-Place Loss

- 4th at 25 USDC: −13.96 (38/30/20/12). Already softened from −15.80. Losing ~56% of entry in one match is still painful.  
- **Verdict:** Acceptable for competitive structure. Further flattening (e.g. 36/30/20/14) would hurt 2nd (break-even) or platform. **No change.**

### 4.3 Second Place as Motivation

- 2nd = +2.60 at 25 USDC (break-even+). "I got my entry back and a small profit" is a strong motivator. **Keep.**

### 4.4 Top Players Draining Liquidity (35% 1st)

- At 35% 1st, 100 matches → +100 USDC net (see spec). So top players are **modest net positive**, not heavy extractors. Liquidity drain is limited by (1) 8% fee, (2) only 2 of 4 per match positive, (3) realistic 35% 1st.  
- **Verdict:** Sustainable. If a single cohort ever exceeds 40% 1st at scale, consider soft cap (e.g. max N paid matches/day in top tier) in Phase 2. **No change for MVP.**

### 4.5 User Journeys (Simulated)

| Persona | 20 matches (25 USDC) | Outcome | Note |
|---------|----------------------|---------|------|
| **Casual** | 15% 1st, 20% 2nd, 30% 3rd, 35% 4th | Payout ≈ 5×34.96+4×27.60+6×18.40+7×11.04 ≈ 455; entry 500 → **−45** | Feels like "I lost some"; may churn if no social/ progression hook. |
| **Competitive climber** | 28% 1st, 30% 2nd, 25% 3rd, 17% 4th | ≈ 9.8×34.96+6×27.60+5×18.40+3.4×11.04 ≈ 518; entry 500 → **+18** | Break-even/slight positive; motivated to keep climbing. |
| **Skilled grinder** | 35% 1st, 30% 2nd, 22% 3rd, 13% 4th | 100-match net +100 (see spec); 20 matches → **+20** | Modest profit; sustainable. |

**Recommendation:** No payout smoothing. Ensure non-monetary hooks (ELO, divisions, future clans) for casuals who are net negative.

---

## 5. Liquidity Realism Check

### 5.1 Assumptions

- **600 DAU**, **1,200 DAU**; **3 peak hours** per day.  
- Phase 1a: 2 queues (Bronze-10, Bronze-25). Assume 50% of DAU in Bronze-10, 50% in Bronze-25 (worst case split).  
- Active in peak: assume **25%** of DAU in queue over 3 peak hours (conservative).  
- Match duration: ~5 min game + ~1 min queue/matching → ~6 min per match cycle. So one match consumes 4 players for ~6 min.

### 5.2 Expected Queue Times

| DAU | Queue (per tier) | In peak (25%, 3h) | Players in queue (approx) | Matches per 3h | Avg wait (4 needed) |
|-----|-------------------|-------------------|---------------------------|----------------|----------------------|
| 600 | 300 each         | 75 per queue      | 75                        | 75/4 ≈ 18 matches start per 3h; one every 10 min | **2–5 min** typical; spikes to **8–10 min** |
| 1,200 | 600 each       | 150 per queue     | 150                       | 150/4 → match every ~2.5 min | **1–4 min** typical |

- **600 DAU:** Queue time is **acceptable but fragile**. If peak is 2h not 3h, or 20% not 25%, wait can exceed 5 min often.  
- **1,200 DAU:** Queue time **healthy** for 2 queues; when switching to 4 queues (Phase 1b), 300/queue → still workable (~3–6 min).

### 5.3 Frustration Risk

- **600 DAU:** Users may see 4+ min wait frequently. **Merge at 180s** (Standard→Casual) helps; in Phase 1a only tier merge applies. **240s timeout** then offer practice or "try later."  
- **Recommendation:** Show "~X players in queue" or "Low / Medium / High" so users don't assume dead game. At 600 DAU, set expectation: "Peak times: faster matches."

### 5.4 Merge Trigger Timing

- **180s** for Standard→Casual: reasonable; 3 min is already long.  
- **300s** for Silver→Bronze: only in Phase 1b; 5 min is acceptable before offering fill.  
**Keep 180s / 300s.**

### 5.5 Is 240s Timeout Optimal?

- At 240s, user gets a choice (practice or downgrade). Shorter (e.g. 180s) would push practice/downgrade earlier and might fragment more. Longer (e.g. 300s) increases frustration.  
**Verdict:** **240s is optimal** for MVP. No change.

### 5.6 Final Queue Timing Recommendations

| Parameter | Value | Rationale |
|-----------|--------|-----------|
| Merge prompt (tier) | 180 s | Balance between wait and giving matchmaking time. |
| Merge prompt (division) | 300 s | Phase 1b only; 5 min before Silver→Bronze offer. |
| Queue timeout (action required) | 240 s | Offer practice or downgrade. |
| Post-timeout message | 360 s | "Try again at peak" / show peak hours. |

---

## 6. Operational Burden Check

| System | Small team manageable? | Relax for early stage? | Automate later? |
|--------|------------------------|------------------------|-----------------|
| **Anti-collusion** | Yes, if simplified. | Only **flag**; no auto-restrict. Win-rate evaluation only after **≥20** ranked matches; flag if **≥80%** 1st over rolling **50** matches. Co-occurrence: keep 15 matches, avg min(place) ≤2.2. | Phase 2: auto-restrict at risk ≥75; more automation. |
| **Dispute resolution** | Yes. | Keep 72h first response. Replay from log is deterministic; 1 person can handle. | Keep manual; volume low. |
| **Manual payout** | Yes. | 24h escalation; 1–2 incidents/week max at low DAU. | Keep manual; add alerting. |
| **KYC triggers** | Yes. | Keep 5,000 USDC lifetime; 2,000/7-day flag. At <1k DAU almost no one hits. | Integrate KYC provider when volume grows. |
| **Risk scoring** | Simplify. | MVP: **2 inputs only** — co-occurrence flag + win-rate flag. Single "review needed" queue. No numeric risk bands, no auto-restrict. | Phase 2: full 5-component score, bands, auto-restrict. |

**Summary:** Team of 3–5 can run MVP with **flag-only** collusion, **manual review** when possible, **no auto-restrict**. Win-rate flag: min 20 matches, then ≥80% over 50 (reduces false positives and review lag at early DAU).

---

## 7. Compliance Risk Pass

### 7.1 Wording That May Cause Regulatory Discomfort

- **"We do not use any element of chance":** Factually correct; keep. Avoid extending to "This is not gambling" (categorical legal conclusion). Current spec already avoids that.  
- **"Retain entries or winnings pending resolution":** Conservative; keep.  
- **"Seek your own advice if relevant":** Good; keep.  
- **Remaining risk:** Any future copy that implies "guaranteed skill-based in all jurisdictions" — avoid. Keep "determined by game rules" and "seek your own advice."

### 7.2 Operational Behavior That May Look Like Gambling

- **To avoid:** (1) No "bet" or "wager" in UI. (2) No jackpot or bonus multiplier. (3) No marketing of "win money fast" or "earn." (4) No credit or play-now-pay-later. (5) Entry fee + prize pool + placement only.  
- **Current design:** Aligned. Payout by placement only; 8% fee; no RNG.  
- **Caution:** "Tournament" and "entry fee" are correct framing. Avoid "stake" in user-facing text (use "entry" or "entry fee").

### 7.3 No Random Monetary Determinant

- **Confirmed:** Placement is determined solely by in-match score (Position + Zone + Survival + Overtake). All components are deterministic given player actions. Tie-break: score → overtake+zone → overtake count → then **split payout** (no random winner). Splitting is equitable, not random. **No RNG for money.**

### 7.4 No Passive Earning Narrative

- **Confirmed:** No staking, no yield, no "hold to earn." NFT pass = access only. Revenue from fees and primary sales. Copy already states no revenue share, no yield, no guarantee. **Good.**

---

## 8. Final Production Lock Checklist

All items below must be **satisfied** before mainnet launch. Treat as go/no-go.

### 8.1 Smart Contract and Escrow

- [ ] **Escrow audit** completed by qualified firm (scope: deposit, fee deduction, payout by placement, pause, no upgradeable logic for funds).
- [ ] **Testnet deployment** with 100+ test matches (entry, fee, payout 38/30/20/12).
- [ ] **Multisig/timelock** for pause configured and tested.
- [ ] **No upgrade path** for fund-handling logic (or documented and audited if any).

### 8.2 Game and Balance

- [ ] **Internal balance playtests:** ≥50 full matches with 3–4 internal players; no crash, correct placement, score formula verified.
- [ ] **1,000-match internal simulation:** Automated (headless or scripted) with deterministic moves; every match produces placement 1–4; payout sum = 92% of total entry; no stuck state.
- [ ] **Score formula test:** Unit tests for Position, Zone (contested-only), Overtake (cap 8), Survival; tie-break and payout split on tie.

### 8.3 Infrastructure and Ops

- [ ] **Stress test:** Server handles ≥4 concurrent matches (16 clients) without drop or wrong result; match log written for each.
- [ ] **Deterministic turn resolution test:** Simulate 4 players submitting conflicting moves; verify server authoritative resolution produces identical outcome across repeated simulations; verify client cannot compute or alter final score independently; verify resolution order is fixed and documented.
- [ ] **Dispute replay test:** 10 disputed scenarios; ops replays from log; result matches recorded result or corrected payout executed.
- [ ] **Manual payout runbook:** Documented; tested once (e.g. simulated failed contract payout, manual transfer with 38/30/20/12).

### 8.4 Escrow and Migration

- [ ] **Escrow migration test:** If new contract is deployed, test: pause old contract, drain/refund or migrate entries to new contract per design; no double-spend.

### 8.5 Compliance and Access

- [ ] **Geo-block test:** Blocked regions cannot complete entry (or cannot access paid match); list published and enforced.
- [ ] **Age gate:** Entry confirmation and account creation require age (18+ or majority); wording as in spec.
- [ ] **Fee disclosure:** 8% and 38/30/20/12 shown before first paid entry.

### 8.6 Launch Config

- [ ] **Phase 1a locked:** Bronze only; 2 queues (10, 25 USDC); Board A only; fixed ability set (no draft).
- [ ] **Queue logic:** 180s merge prompt (Standard→Casual); 240s timeout with practice/downgrade offer.
- [ ] **Collusion:** Co-occurrence and win-rate (min 20 ranked matches, then ≥80% 1st over rolling 50) flag only; manual review; no auto-restrict in MVP.

---

## 9. MVP Boundary Summary

| In scope for Phase 1a | Out of scope (Phase 2+) |
|-----------------------|--------------------------|
| Board A only | Boards B, C |
| Fixed 3 abilities (Boost, Block, Trap) | Ability draft |
| Zone contested-only (no diminishing) | Zone diminishing multiplier |
| Bronze Retention Cushion (3×4th → 1 free Bronze-10 token; Phase 1a only) | Silver+ retention mechanics |
| Co-occurrence + win-rate flag (min 20 matches, ≥80% over 50); manual review | Full risk score; auto-restrict; smurf/bot score |
| 2 queues; 180s merge; 240s timeout | Silver→Bronze merge (Phase 1b); clan |
| Escrow, 8% fee, 38/30/20/12 | Seasonal rotation; balance patches |
| Match log, dispute replay, manual payout | CAPTCHA (or 3% at most) |
| Entry + age + jurisdiction + fee copy | KYC provider integration (trigger stays) |

---

## 10. Go / No-Go Readiness

### 10.1 Blockers (Must Resolve Before TDD / Launch)

- **None** that invalidate the architecture. All identified issues are addressed by **simplify** or **defer** in §1.

### 10.2 Risks to Accept for MVP

- **Position slightly dominant:** Accept; monitor; balance patch later if Rush >55% win rate.
- **Hunter possibly weak at high skill:** Accept; consider overtake cap 10 in a future patch.
- **600 DAU queue 4–10 min at times:** Accept; Phase 1a + merge + transparency.
- **No auto-restrict for collusion:** Accept; flag + manual review only.

### 10.3 Readiness Signal

**GO for TDD conversion** provided:

1. MVP scope is locked per §1 and §9.  
2. Production checklist (§8) is adopted as gate for mainnet.  
3. Diminishing zone and ability draft are explicitly **deferred** in TDD (not "optional for MVP").  
4. Compliance wording and operational behavior stay as in spec; no "gambling" or "stake" in UI.

**Stable for Technical Design Document.** If major risks appear during TDD (e.g. turn timer implementation, sync issues), re-run only the affected subsection of this validation.

---

**Document control:** Production validation v1.1. Micro-adjustments: Position 0.13; Bronze Retention Cushion; win-rate flag min 20 / 50-match window; deterministic turn resolution checklist; compliance wording per spec. Architecture stable. Ready for TDD conversion.

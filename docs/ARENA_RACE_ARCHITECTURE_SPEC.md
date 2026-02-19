# Arena Race — Architecture Specification (Final)

**Document type:** Precision system design — formulas, thresholds, mechanisms  
**Supersedes:** Ambiguous or incomplete design in Game Plan and Strategic Review  
**Status:** Blueprint for implementation.

---

## 1. Scoring Formula (Fully Specified)

### 1.1 Definitions

- **Match:** 4 players, 5 minutes (300 seconds), 7×7 grid, 3 tokens per player, 5 energy per turn.
- **Turn:** Synchronous; all players submit actions; resolution in fixed order (see tie-break). One turn ≈ 6 seconds real-time → ~50 turns per match (design target).
- **Score:** Running total per player. Only **final score** (at timer expiry or all objectives resolved) determines placement. No per-turn payout; per-turn scoring is for **in-game display and tie-break only**.

### 1.2 Component Formulas (Balanced Weights)

**Design constraint:** No single component may contribute more than 40% of a **realistic** total score (~300–400). All components in comparable influence bands.

**Placement component (at match end)**

Awarded once, at match end, based on **ordinal placement** (1st–4th) by total score. Display-only; payout is by rank.

| Place | Base placement points |
|-------|------------------------|
| 1st   | 100 |
| 2nd   | 60  |
| 3rd   | 40  |
| 4th   | 20  |

**In-match score (for ordering and tie-break)** is the sum of the following. Placement is determined by ordering of this value at T=300s.

**Position component (running)**

- **Per turn:** `Position_per_token = 0.13 × (6 - row_index)` for row 0..6. Sum over player's 3 tokens, then over all turns.
- **Formula:** `Position_points = Σ_turns Σ_my_tokens [ 0.13 × (6 - row(tile)) ]`. Max per turn 3×6×0.13 = 2.34; over 50 turns **max 117**. Realistic (shared board) **~70–105**.

**Control zone scoring** (with anti-snowball; see §1.2.1)

- **Zones:** Three fixed zones per board variant (see §6).
- **Contested-only rule:** A zone awards points in a turn **only if ≥ 2 players** have at least one token in that zone at end of turn. If only one player has tokens there, that zone awards **0** that turn (uncontested = no zone points).
- **Diminishing returns:** For each zone, the same player controlling it for consecutive turns receives a multiplier on zone points: turn 1 = 1.0, turn 2 = 0.9, turn 3 = 0.8, …, minimum **0.5**. Resets if another player controls the zone for a full turn.
- **Base value:** 2 points per zone per turn (when contested and after multiplier). `Zone_points_per_turn = 2 × Σ_zones (controlled × multiplier)`.
- **Realistic max:** With contestation and diminishing, **~80–100** per match. No single component >40% of total.

**Overtake bonus**

- **Definition:** Unchanged (token A passes B in track order, row-major).
- **Formula:** `Overtake_points = 4 × N_overtakes`. **Cap:** 8 overtakes per player per match → **max 32 points**.
- **Realistic:** ~8–24 for Hunter archetype.

**Survival bonus**

- **Definition:** "Danger" = Trap tile or tile with 2+ tokens. Tokens not in danger grant points.
- **Formula:** `Survival_points_per_turn = 0.5 × (tokens not in danger)`. Summed over turns. **Max 75**. Realistic **~40–60**.

### 1.2.1 Zone Anti-Snowball (Deterministic)

- **Activation:** Zone points are awarded **only when the zone is contested** (≥2 players with a token in the zone at end of turn).
- **Diminishing:** Per zone, per player: consecutive turns controlling that zone use multiplier `m = max(0.5, 1 − 0.1×(k−1))` where k = consecutive turns controlling. When another player controls the zone, k resets for the first player.
- **Effect:** Early uncontested control yields nothing; prolonged control yields declining points. No RNG.

### 1.3 Total In-Match Score (Determines Order)

```
Score_player = Position_points + Zone_points + Survival_points + Overtake_bonus
```

Placement (1st–4th) = rank of `Score_player` (descending). **Payout** is by placement rank only, not by raw score.

### 1.4 Tie-Break Resolution

1. **Primary:** Higher total in-match score (as above) → better place.
2. **If tie on total score:** Higher sum of (overtake_points + zone_points) → better place (position is more volatile).
3. **If still tied:** Higher overtake count → better place.
4. **If still tied:** Random tie-break **only** for display order; **payout**: split prize for the two places equally. E.g. 2-way tie for 2nd/3rd → both get (Payout_2nd + Payout_3rd)/2.

### 1.5 Per-Turn Scoring Existence

- **Yes**, for in-match total only: position + zone + survival are computed per turn and summed. Overtake is event-based and added when it occurs. This does **not** affect payout; payout is strictly by final placement (1st–4th).

### 1.6 Maximum and Realistic Score (Single Player, One Match)

| Component | Theoretical max | Realistic range |
|-----------|-----------------|-----------------|
| Position  | 117 (0.13×18×50) | 70–105 |
| Zone      | ~100 (contested + diminishing) | 50–100 |
| Overtake  | 32 (8×4, capped) | 8–24 |
| Survival  | 75                | 40–60 |
| **Total** | **~324**         | **258–370** |

No single component exceeds 40% of realistic total (max 117/324 ≈ 36.1%).

### 1.7 Anti–Snowball

- **No compounding:** Points are additive. No multiplier between components.
- **Overtake cap:** 8 overtakes (32 pts max).
- **Zone:** Contested-only + diminishing returns (see §1.2.1); no runaway from uncontested early control.
- **No underdog bonus:** A bonus for "4th place in final 10 turns" is **removed** — it is exploitable (skilled players can intentionally sit 4th then overtake for extra points). Comeback is achieved only by overtakes and zone contestation within normal scoring.

### 1.8 "Top 40% Break-Even" Across Season

- **Per match:** Exactly 2 of 4 players are at or above break-even (2nd and 1st with the payout curve below). So **per match**, 50% of participants are break-even or better.
- **Across season:** "Top 40% break-even" means: when all **players** in a division are ranked by **net USDC (payouts − entries)** over the season, the 40th percentile player is ≥ 0 (break-even or positive). This is achieved by (1) payout curve that keeps 2nd near break-even per match, and (2) skill distribution such that better players place 1st/2nd more often, so the **player** distribution of net outcome has ~40% at or above zero. No additional formula; it is an **outcome target** to validate with season data and adjust payout % if needed.

---

## 2. Payout Model (Exact)

### 2.1 Parameters

- **Platform fee:** 8% of total entry (taken before distribution). **Rake fixed.**
- **Prize pool:** 92% of total entry.
- **Distribution by placement (recommended):** 1st = **38%**, 2nd = **30%**, 3rd = **20%**, 4th = **12%**. (Slightly flatter than 40/30/20/10 to reduce 4th-place pain while keeping 2nd near break-even; see §2.4–2.6.)

### 2.2 Per-Match Payout (4 players, single entry tier)

Let `E` = entry in USDC per player. Total entry = `4E`. Fee = 8%. Pool = `4E × 0.92 = 3.68E`.

**Recommended split 38/30/20/12:**

| Place | Share | Payout (formula)     |
|-------|--------|----------------------|
| 1st   | 38%    | 0.38 × 3.68E = 1.3984E |
| 2nd   | 30%    | 0.30 × 3.68E = 1.104E  |
| 3rd   | 20%    | 0.20 × 3.68E = 0.736E  |
| 4th   | 12%    | 0.12 × 3.68E = 0.4416E |

**Exact USDC by entry:**

| Place | E = 10 USDC | E = 25 USDC | E = 100 USDC |
|-------|-------------|-------------|--------------|
| 1st   | 13.98       | 34.96       | 139.84       |
| 2nd   | 11.04       | 27.60       | 110.40       |
| 3rd   | 7.36        | 18.40       | 73.60        |
| 4th   | 4.42        | 11.04       | 44.16        |

**Net per match (payout − entry):**

| Place | E = 10 | E = 25 | E = 100 |
|-------|--------|--------|--------|
| 1st   | +3.98  | +9.96  | +39.84  |
| 2nd   | +1.04  | +2.60  | +10.40  |
| 3rd   | −2.64  | −6.60  | −26.40  |
| 4th   | −5.58  | −13.96 | −55.84  |

2nd stays at break-even; 4th loss softened (e.g. −13.96 vs −15.80 at 25 USDC) for retention.

### 2.3 Variance Control

- **No jackpot:** Payouts deterministic by placement; no RNG.
- **Same structure:** Same 38/30/20/12 split for all matches; no featured rake.
- **Stake limit:** Per §9, Phase 1 only 10 and 25 USDC; 100 USDC after DAU threshold.

### 2.4 Realistic 4-Player Placement and Break-Even

In a **symmetric** 4-player game, equal skill ⇒ P(1st) = P(2nd) = P(3rd) = P(4th) = 0.25. A **clearly stronger** player might achieve ~30–40% 1st, not 55%. High-skill realistic band: **30–38% 1st**, 28–32% 2nd, 22–26% 3rd, 12–18% 4th.

**Break-even condition (25 USDC, 38/30/20/12):**  
`EV = 0` ⇒ `13.98p1 + 11.04p2 + 7.36p3 + 4.42p4 = 25` (per 10 USDC equivalent; scale by 2.5 for 25). Using pool 92%:  
`34.96p1 + 27.60p2 + 18.40p3 + 11.04p4 = 25`.

**Minimum placement mix for break-even:** Approximately **28% 1st** with **32% 2nd** (and 22% 3rd, 18% 4th) gives 34.96×0.28 + 27.60×0.32 + 18.40×0.22 + 11.04×0.18 ≈ 9.79 + 8.83 + 4.05 + 1.99 = 24.66 ≈ 25. So **~28–30% 1st** with strong 2nd rate, or **~32% 1st** with 25% 2nd, yields break-even. Achievable for top 40% of players over a season.

### 2.5 Simulation: 100 Matches (25 USDC Entry) — Realistic Distributions

**Placement distributions (4-player realistic):**

| Skill band   | P(1st) | P(2nd) | P(3rd) | P(4th) | Rationale |
|--------------|--------|--------|--------|--------|-----------|
| High (top ~15%) | 0.35 | 0.30 | 0.22 | 0.13 | ~35% 1st is plausible for clear best in match |
| Median        | 0.25 | 0.25 | 0.25 | 0.25 | Equal skill |
| Below median  | 0.18 | 0.22 | 0.28 | 0.32 | Weaker player |

**Payouts per match (25 USDC, 38/30/20/12):** 34.96 / 27.60 / 18.40 / 11.04.

**Expected outcome per 100 matches:**

| Player type | Expected payout (100 matches) | Total entry | Net |
|-------------|------------------------------|-------------|-----|
| High (35/30/22/13) | 100×(12.24 + 8.28 + 4.05 + 1.43) = 2,600 | 2,500 | **+100** |
| Median (25 each)   | 100×23.00 = 2,300 | 2,500 | **−200** |
| Below (18/22/28/32) | 100×(6.29 + 6.07 + 5.15 + 3.53) = 2,104 | 2,500 | **−396** |

**Conclusion:** With **realistic** high-skill distribution (35% 1st), top players are modestly net positive; median is net negative (pays for platform and top); bottom more negative. Sustainable and psychologically acceptable. Break-even requires ~28–30% 1st with strong 2nd rate (see §2.4).

### 2.6 Final Recommended Payout Split

**Keep:** 38 / 30 / 20 / 12 at 8% rake.  
- 2nd remains at break-even (27.60 on 25 entry).  
- 4th loss reduced (11.04 vs 9.20) for retention; platform revenue unchanged (8% of entry).  
- No flattening beyond this without moving 2nd below break-even or raising rake.

---

## 3. Financial Control System

### 3.1 Daily Payout Caps (Platform)

- **Per wallet, per day:** Max **5,000 USDC** total payout (all matches, all tiers). Above that, excess is queued for next calendar day (00:00 UTC).
- **Per match:** No cap (single match payout is bounded by pool size; max single match 4 × 500 = 2,000 USDC entry → 1,472 to 1st at 500 entry; Phase 1 has no 500 tier).

### 3.2 Withdrawal Limits

- **Instant (contract auto-send):** Payout is sent by contract on result finalization; no separate "withdrawal" for winnings. User does not "withdraw" from a balance; they receive prize to wallet automatically.
- **Entry:** User must hold USDC in wallet; approval + transfer to escrow on match start. No in-platform "balance" that is withdrawn later; only escrow in/out.

### 3.3 Anti–Money Laundering (AML) Risk Thresholds

- **Flag for review:** Any single wallet receives **≥ 2,000 USDC** in payouts in a **rolling 7-day** window (all matches).
- **Mandatory KYC before next payout:** Cumulative **lifetime** payouts to a wallet **≥ 5,000 USDC** → require KYC to receive further payouts (payouts held until KYC complete or 90 days then refund to escrow pool per dispute rules).
- **Suspicious:** Same device ID or IP linked to **≥ 3** wallets that each receive payouts → flag; manual review before releasing large payouts.

### 3.4 Escrow Contract Emergency Pause

- **Pause function:** Only callable by a **multisig** (e.g. 2-of-3) or timelock (e.g. 48h delay) to prevent single point of failure.
- **Effect of pause:** (1) New matches cannot **start** (no new entry transfers). (2) Matches already in progress: server completes match; contract accepts result and distributes **only** that match's pool (no global pause of payouts for completed matches).
- **Resume:** Same multisig or timelock. No "confiscate" function; only pause/resume and, if needed, migrate to new contract (see below).

### 3.5 Treasury Buffer Model

- **Platform fee destination:** Fees go to a **treasury wallet** (not back into prize pools). Treasury holds ≥ **2 weeks** of estimated operational burn (runway) before any profit distribution.
- **Reserve for disputes:** **5%** of weekly fee revenue is retained in a "dispute reserve" wallet until season end; used for refunds and contested payouts. Any remainder at season end goes to treasury.

### 3.6 Smart Contract Bug

- **If bug discovered before exploit:** Pause (see above); fix; deploy new contract; migrate liquidity (user entries in escrow) via signed withdrawal flow to new contract; no new entries to old contract.
- **If exploit has occurred:** Pause; assess scope; use dispute reserve and treasury to make affected users whole up to **100% of lost entry** (not profit). Payout order: affected users first, then normal operations. No guarantee of "expected winnings"; only return of entry. Document in post-incident report.

### 3.7 Payout Failure (Contract Revert, Network, etc.)

- **Retry:** Backend retries distribution up to **3 times** (exponential backoff). If still failing, mark match as "payout pending."
- **Manual resolution:** After **24 hours** failed, escalate to ops; manual transfer from escrow to the 4 wallets using same **38/30/20/12** split, from treasury if needed (e.g. gas), then reconcile. Log and alert.

---

## 4. Dispute Resolution Framework

### 4.1 Disputed Match Result

- **Definition:** A player opens a ticket claiming incorrect placement or score within **48 hours** of match end.
- **Process:** (1) System stores match log (final state, per-turn log). (2) Ops replays result from log; if replay matches recorded result, dispute closed. (3) If replay **differs**, result is corrected; payouts are recalculated and **supplementary transfer** (or clawback if needed) is executed. (4) If log is missing or corrupted, apply §4.5 (refund).
- **Deterministic:** Result is **only** what the authoritative server computed from the same rules; no "referee judgment" on gameplay.

### 4.2 Server Crash Mid-Match

- **If < 50% of match time elapsed (e.g. < 2.5 min):** Match is **void**. All entries returned to players (minus 0% fee; full refund). No ELO change.
- **If ≥ 50% elapsed:** Match is **resolved from last known state**. Last full turn's scores are used; placement determined from that state. Payouts distributed accordingly. If last state cannot be recovered, treat as void and full refund.

### 4.3 Player Disconnect

- **Policy:** No pause or rejoin. Disconnected player's tokens are **frozen** (no moves) until match end. Placement is by final score (disconnected player often 4th). No refund for disconnect; it is treated as a loss. Exception: if **server** detects that disconnect was due to **platform outage** (e.g. same-minute disconnect spike), match can be voided and refunded (ops decision using threshold, e.g. >20% of active matches in same minute).

### 4.4 Smart Contract Fails (Revert on Distribute)

- **Handling:** See §3.7. Ops execute manual payout from escrow using same **38/30/20/12** and logged match result. If escrow is insufficient (bug), use dispute reserve then treasury to cover entries first.

### 4.5 Refund Conditions (Exhaustive)

1. **Match voided** (server crash < 50% time, or platform outage): Full refund of entry to all 4 players.
2. **Match voided (≥ 50% time):** No refund; resolve from last state.
3. **Proven collusion/cheat:** Affected match(es) voided; refund to **non-cheating** players only; cheater(s) no refund and subject to penalty (§5).
4. **Contract bug / lost funds:** Refund of **entry** only (from reserve/treasury) after investigation.
5. **Player dispute upheld (wrong result):** Corrected payout; no extra "compensation" beyond correct prize.

### 4.6 Arbitration Policy

- **No third-party arbitration** required for in-scope issues; resolution is per above. For jurisdictions that require it: offer **optional** binding arbitration (user agrees in ToS); arbitrator may only award refund of entry or correct payout, not punitive damages.
- **Appeal:** One appeal per user per case. Same evidence (logs); second review by different ops. Decision final after appeal.

### 4.7 Appeal Structure

- **First response:** Within **72 hours** (business days). Outcome: upheld / rejected / escalated.
- **Appeal:** User has **14 days** to appeal. Appeal reviewed within **5 business days**. Outcome: upheld / rejected. No further appeal for same match.

---

## 5. Anti-Collusion System (Implementation Level)

### 5.1 Co-Occurrence Detection

- **Data:** For each pair of players (A, B), over rolling **last 200 matches** (per player), count `N_together` = number of matches in which both A and B participated.
- **Threshold:** Flag pair if `N_together ≥ 15` **and** in those matches, the **average of min(place_A, place_B) ≤ 2.2** (i.e. together they often place 1st and 2nd).
- **Action:** Pair is assigned a **co-occurrence risk** = min(100, 50 + (20 − avg_placement)*10). If risk ≥ 70, both accounts go to manual review queue; no auto-ban.

### 5.2 ELO Anomaly Triggers

- **Rapid climb:** Over **50 consecutive** ranked matches, if win rate (1st place rate) ≥ **75%** in Bronze or Silver → flag. Threshold 75% (not 90%) to allow for smurfs and new skilled players; review determines smurf vs legitimate.
- **Stable high rank with low games:** Account with **< 100** total matches and ELO already in top 10% of division → flag (possible smurf or transfer).

### 5.3 Suspicious Win-Rate Thresholds

- **Minimum sample:** Win-rate evaluation activates only after **≥ 20** total ranked (paid) matches.
- **Per tier:** Over rolling **50** paid matches in same tier, if 1st-place rate **≥ 80%** → flag for review. (Reduced window from 100 to 50 for earlier signal at low DAU; 80% threshold to limit false positives.) Flag only; no auto-restrict in MVP — manual review determines action.
- **Payout skew:** Wallet in top 1% of payouts (by total USDC received) in division over 30 days, with play count in bottom 50% of that division → flag (possible farming).

### 5.4 Smurf Detection Logic

- **Signals:** (1) New account (< 30 days), (2) ELO gain per match in top 5% historically for that division, (3) Same device fingerprint or IP as another account that has ≥ 100 matches, (4) Same wallet previously used for another account that was banned or restricted.
- **Scoring:** Smurf_score = 0.3×(new_account_bonus) + 0.3×(elo_gain_zscore) + 0.2×(device_match) + 0.2×(wallet_reuse). If Smurf_score ≥ 0.6 → flag; if ≥ 0.8 and device_match = 1 → restrict (cap stakes, require KYC to unlock).

### 5.5 Bot Detection Signals

- **Input timing:** Per turn, time from "turn start" to "submit" in ms. Human-like: mean 2,000–8,000 ms, std > 500 ms. Bot-like: mean < 800 ms and std < 200 ms over 20+ turns → +1 bot signal.
- **No auxiliary actions:** Zero spectate sessions, zero replay views, zero profile edits, zero friend/rival adds over 50+ matches → +1 bot signal.
- **CAPTCHA:** Random 5% of matches require a simple challenge (e.g. "Tap the center tile") before match start. Fail or skip → no payout for that match; repeat fail → flag.

### 5.6 Risk Scoring Formula (Weighted)

For each account, compute:

```
Risk = 0.25 × cooccurrence_score   (0–100 scale)
     + 0.25 × elo_anomaly_score   (0–100)
     + 0.20 × winrate_score        (0–100, from 1st-place rate)
     + 0.15 × smurf_score          (0–100)
     + 0.15 × bot_score            (0–100)
```

Normalize each component to 0–100. **Risk** in [0, 100].

- **0–30:** Normal.
- **30–50:** In review queue (low priority).
- **50–70:** In review queue (high priority); consider stake cap.
- **70–85:** Restrict: max 10 USDC entry, 5 matches/day until review.
- **85–100:** Suspend paid play; manual review; possible ban.

### 5.7 Manual Review Flow

1. **Queue:** All flagged accounts (risk 30+ or any single trigger above threshold) enter queue. Priority by risk score then by payout volume at risk.
2. **Reviewer:** Checks match history, co-occurrence graph, timing data. Decision: clear / restrict / suspend / ban.
3. **Restrict:** Stake cap and match cap applied; user notified with generic message ("Account under review for competitive integrity").
4. **Appeal:** User may appeal once; second reviewer; if upheld, restrict lifted or ban made permanent.

---

## 6. Meta Depth Finalization

### 6.1 Three Core Strategic Archetypes

| Archetype   | Description                    | Primary strength     | Weakness              |
|------------|--------------------------------|----------------------|------------------------|
| **Rush**   | Maximize position early; take center and high-value rows. | Position points, zone when contested | Vulnerable to Block/Trap in chokes; weak if behind. |
| **Control**| Contest zones; use Block/Trap to lock opponents out.      | Zone points (contested + diminishing), denial | Lower raw position; overtake cap limits Hunter so Control stays viable. |
| **Hunter** | Prioritize overtakes; target overtake bonus (cap 8).       | Overtake points      | Weak if no overtake opportunities; depends on others' paths. No rubber-banding. |

Design goal: No single archetype wins >55% when equally skilled; rock-paper-scissors at high level. All three remain viable under the rebalanced scoring (Position, Zone, Overtake each &lt;40% of realistic total).

### 6.2 Ability Draft System (Exact)

- **Pool size:** **6** abilities per season (subset of global list of 8–10). Season calendar defines which 6.
- **Draft timing:** **90 seconds** before match start. Order: random (1–2–3–4). Snake draft: P1 pick, P2, P3, P4, P4, P3, P2, P1. Each player picks **2** abilities (so 8 picks total; each ability can be picked by only one player in that match).
- **Ban:** Optional. Before draft, one **community ban** per season (voted by pass holders): that ability is not in the pool for the season. No per-match ban.
- **In-match:** Each player has exactly the 2 abilities they drafted; energy cost per ability is fixed for the season (see balance).

### 6.3 Ability Rotation Schedule

- **Seasons:** 12 weeks. First 2 weeks = no rotation (baseline). Every **4 weeks**, one ability is **rotated out** and one **rotated in** from the reserve list. Published in season calendar.
- **Energy cost tuning:** Once per season (at mid-season, week 6), one ability may get ±1 energy cost change if pick rate > 55% or win rate (when picked) > 52%. Change is +1 energy for overperforming, −1 for underperforming (min 1, max 4). Announce 1 week in advance.

### 6.4 Board Variant System (3 Boards)

| Board   | Name    | Tiles  | Zones (center + 2) | Notes                          |
|---------|---------|--------|---------------------|--------------------------------|
| **A**   | Standard| 7×7 full | Center (3,3); Corners (1,1),(1,5),(5,1),(5,5) as one zone; Row3+Col3 (excl center) as one zone. | Default; symmetric. |
| **B**   | Lanes   | 7×7 with 3 columns blocked (1,2,3 and 5,6,7; column 4 open). | Center (3,3); Left lane mid; Right lane mid. | Choke points; favors Control. |
| **C**   | Diamond | 7×7 with corners removed (0,0),(0,6),(6,0),(6,6) impassable. | Center (3,3); Top diamond; Bottom diamond. | Favors Rush paths and overtakes. |

- **Unlock:** Bronze/Silver see Board A only. Gold+ see A, B, C. Map is chosen **by server** (round-robin or random among available for that division) so no map veto.

### 6.5 Seasonal Balance Patch Process

- **Input:** Pick rate and win rate (when picked) per ability, per board, over last 4 weeks.
- **Rule:** If ability X has pick rate > 55% **or** win rate > 52%, it is candidate for +1 energy. If pick rate < 25% **and** win rate < 48%, candidate for −1 energy.
- **Output:** At most **one** ability change per mid-season patch. Changelog published; effective next week.

---

## 7. Season Reset Formula

### 7.1 ELO Compression (Season Start)

- **Formula:** `new_rating = floor( (old_rating + season_base) / 2 )`. `season_base` = 1200 for Bronze/Silver, 1400 for Gold, 1600 for Platinum, 1800 for Diamond (division at season end).
- **Effect:** Everyone is pulled toward 1200–1800; no one keeps 2200. Max new rating after reset ≈ (2200+1800)/2 = 2000 (Diamond cap).

### 7.2 Promotion / Demotion Shield

- **After promotion:** For **5 matches** or **7 days** (whichever first), player cannot be demoted. If rating would fall below division threshold, it is clamped at threshold until shield expires.
- **Grace band at demotion boundary:** If rating is within **25 points** of demotion threshold (e.g. Silver→Bronze at 1000), demotion occurs only after **2 consecutive** matches where rating is below threshold at match end. One match above threshold resets the "consecutive" counter.

### 7.3 Placement Match Weighting

- **First 10 matches** of the season count as placement. K-factor for these matches is **1.5×** normal K (e.g. K=24 → 36). So early wins/losses move rating more. After 10 matches, standard K (e.g. 24) applies.

### 7.4 Inactivity Decay

- **Trigger:** No ranked match for **30 consecutive days**.
- **Effect:** Rating reduced by **50 points** (one-time per 30-day period). If decay would push below division minimum (e.g. 800 for Bronze), clamp at 800. No decay during first 14 days of season.
- **Display:** "Inactive" badge; player still appears on leaderboard with decayed rating until they play again.

### 7.5 Avoiding Diamond Stagnation

- **No ceiling cap:** Diamond has no max rating; top players can go 2000+. Leaderboard is uncapped.
- **Compression:** Season reset pulls Diamond players toward 1800, so new season has room to climb again.
- **Placement:** Top 10 Diamond (by rating) at season end get permanent "Season N Diamond Top 10" badge; no financial reward, prestige only.

---

## 8. Compliance Wording Package (Conservative)

*Avoid categorical legal conclusions; describe structure and risk; avoid "forfeiture" and over-assertion.*

### 8.1 Homepage Positioning (Exact Copy)

"Arena Race is a skill-based competitive league. You pay an entry fee to join a match; entry fees fund the prize pool. Match outcomes are determined by player decisions under the published game rules. You should not rely on us for legal or regulatory classification in your jurisdiction; seek your own advice if relevant."

### 8.2 Entry Confirmation Modal (Before First Paid Match)

"By entering this paid match you confirm that:

- You understand that outcomes are determined by the game rules (skill and strategy).
- You are at least 18 years of age, or the age of majority where you are located, whichever is higher.
- You are permitted to use this service under the laws of your jurisdiction and are not in a restricted region.
- You have read and accept the [Rules] and [Terms of Service].
- You accept that [8%] of the total entry will be retained as a platform fee and the remainder distributed as prizes according to placement.

[ ] I confirm the above. [Enter] [Cancel]"

### 8.3 NFT Pass Description (Mint / Secondary)

"The Arena Race League Pass is a seasonal access pass. It grants the holder the right to participate in league matches and access to [division/cosmetics] as described in the current season rules. It does not represent any share of revenue, profit, dividend, or yield. It does not guarantee any financial return. The value of the pass may go up or down. Purchase and use are at your own risk."

### 8.4 Jurisdiction Disclaimer

"The service may not be available in certain jurisdictions. A list of restricted regions is published [link] and may be updated. By using the service you represent that you are not located in, resident of, or subject to the laws of a restricted jurisdiction and that you are permitted to use the service under applicable law. We may use IP and other signals to restrict access. If we determine that you are in a restricted jurisdiction, we may suspend or close your account and retain entries or winnings pending resolution in accordance with our Terms of Service."

### 8.5 Responsible Gaming Section (Policy Page)

"You may set a maximum amount of USDC you can use for entries per day or per week in [Settings]; we will block further entries once the limit is reached. You may self-exclude from paid play for 7, 30, or 90 days. We do not extend credit; all entries are from your own wallet. After [10] paid matches in a single session we may show a reminder of time and activity. If you are concerned about your play or spending, please seek help from [link to responsible gaming resources]."

### 8.6 Age Verification Confirmation

"By creating an account you confirm that you are at least 18 years of age (or the age of majority in your jurisdiction, whichever is higher). We may require verification of your date of birth. Providing false information may result in account closure and retention of entries or winnings in accordance with our Terms of Service."

### 8.7 Fee Disclosure

"Each paid match has a platform fee of [8%] of the total entry (all 4 players). The fee is deducted before prizes are distributed. The remaining [92%] is distributed as follows: 1st place 38%, 2nd place 30%, 3rd place 20%, 4th place 12%. This structure is the same for all entry tiers. The fee may be updated for future seasons with 30 days' notice."

---

## 9. Launch Phase Lock

### 9.1 Phase 1 Configuration (DAU-Gated)

**Phase 1a — DAU &lt; 1,000 (worst-case liquidity):**

| Parameter           | Value |
|---------------------|--------|
| **Divisions open**  | **Bronze only.** Silver locked ("Coming soon"). |
| **Entry tiers**     | 10 USDC, 25 USDC only. |
| **Pool count**      | **2** queues: Bronze-10, Bronze-25. |
| **Format**          | Solo ranked only. |
| **Boards**          | Board A only. |

**Bronze Retention Cushion (Phase 1a only)**

- **Scope:** Applies only in Bronze division; does not apply to Silver or higher.
- **Trigger:** 3 consecutive 4th-place finishes in paid matches (Bronze tier).
- **Reward:** 1 free entry token, usable only for one Bronze 10 USDC match.
- **Token rules:** Non-transferable; non-withdrawable; cannot be converted to USDC; valid for 7 days from grant; maximum 1 active token per account (no stacking).
- **Does not:** Alter payout structure; refund previous losses; or apply in Silver+.
- **Rationale:** Early-stage retention for players on a losing streak. One retry token per trigger has negligible impact on platform economics and is not loss protection or cashback — it is a retry opportunity, not a financial guarantee. Wording must not imply "loss protection" or "cashback."

**Phase 1b — DAU ≥ 1,000 (7-day rolling):**

| Parameter           | Value |
|---------------------|--------|
| **Divisions open**  | Bronze + Silver. Gold, Platinum, Diamond locked. |
| **Entry tiers**     | 10 USDC, 25 USDC only. |
| **Pool count**      | **4** queues: Bronze-10, Bronze-25, Silver-10, Silver-25. |
| **Format**          | Solo ranked only. |
| **Boards**          | Board A only. |

Rationale: At 500 DAU, 4 queues ⇒ ~125 DAU/queue ⇒ very long queues (see §9.5). Starting with 2 queues keeps queue times viable until 1k DAU.

### 9.2 Merge Logic (Exact)

- **Same division, different tier:** If queue wait **≥ 180 seconds** (3 min), prompt Standard (25) players: "Join Casual queue for faster match? Stakes and prizes will be Casual (10 USDC)." If they accept, they enter Casual queue; stakes = Casual only. No mixing of 10 and 25 in the same match.
- **Adjacent division:** If queue wait **≥ 300 seconds** (5 min), allow Silver players to join Bronze queue. **Handicap (flat, no multiplier):** Silver player's **final in-match score** is reduced by a **fixed deduction H = 15 points** before placement is determined. All other players' scores unchanged. Preserves score hierarchy and tie-break logic; no distortion from scaling. ELO: standard K. Only Silver→Bronze fill, never Bronze→Silver.
- **Never merge:** Different stake sizes in one match.

### 9.3 Queue Timeout

- **Max wait before action:** **240 seconds** (4 min). At 4 min, user is shown: (1) "Start practice match (no entry, no ELO)" or (2) "Join lower tier for faster match" (if applicable). No bot backfill in paid matches.
- **After 6 min:** Suggest "Try again at peak time" and show approximate peak hours; no forced action.
- **Worst case (500 DAU, 2 queues):** 250 DAU/queue; assume 20% active in peak 2h ⇒ 50 in queue. Need 4 for match ⇒ ~12 matches per 2h per queue ⇒ one match every ~10 min. **Queue timeout 240s is realistic** for early stage; many users may wait 4+ min and get merge/practice offer. At 1,000 DAU with 4 queues, 250/queue ⇒ ~5 min typical. Mitigation: Phase 1a keeps 2 queues so 500 DAU ⇒ 250/queue, improving to ~5 min when 1k DAU and 4 queues.

### 9.4 Roadmap Trigger Thresholds (DAU-Based)

| Trigger              | Metric | Threshold | Action |
|----------------------|--------|-----------|--------|
| Unlock Gold          | 7-day rolling DAU (paid or free) | ≥ 2,000 | Enable Gold division; add queues Gold-10, Gold-25. |
| Add Pro (100 USDC)   | 7-day rolling DAU in Gold       | ≥ 500   | Enable 100 USDC entry in Gold only. |
| Unlock Platinum      | 7-day rolling DAU               | ≥ 5,000 | Enable Platinum; add Platinum queues. |
| Unlock Diamond       | 7-day rolling DAU               | ≥ 8,000 | Enable Diamond. |
| Clan matchmaking     | 7-day rolling DAU               | ≥ 6,000 | Enable clan vs clan queue (separate from solo). |

DAU = unique accounts with at least one match (paid or practice) in the day. Rolling 7-day = average of last 7 days. Thresholds are checked daily at 00:00 UTC; change takes effect at next season start or, for new queues, within 7 days of threshold first met (to allow ops prep).

### 9.5 Liquidity Survival (Worst-Case Simulation)

| DAU  | Queues | DAU per queue (approx) | Peak 2h active (20%) | Expected queue time (order of magnitude) | Risk |
|------|--------|------------------------|----------------------|------------------------------------------|------|
| 500  | 2      | 250                    | 50                  | 4–10 min (match every ~10 min)           | High; use Phase 1a. |
| 500  | 4      | 125                    | 25                  | 10–20 min                                | **Dead-queue risk.** |
| 1,000 | 2      | 500                    | 100                 | 2–4 min                                  | Acceptable. |
| 1,000 | 4      | 250                    | 50                  | 4–8 min                                  | Acceptable. |
| 2,000 | 4      | 500                    | 100                 | 1–3 min                                  | Healthy. |

**Recommendation:** Phase 1a (Bronze only, 2 queues) until 7-day rolling DAU ≥ 1,000; then Phase 1b (4 queues). Queue timeout 240s is kept; at 4 min user gets merge or practice option. Do **not** start with 4 queues below 1k DAU.

---

## 10. Risk Prioritization Table

| # | Risk | Probability | Impact | Mitigation |
|---|------|-------------|--------|------------|
| 1 | **Regulatory reclassification as gambling** | Medium | High | Maintain strict no-RNG design; publish skill doc; geo-block; get legal memo; never use "bet" or "wager" in user-facing copy. |
| 2 | **Liquidity fragmentation → long queues → churn** | High | High | Phase 1: only 4 pools; merge logic at 3/5 min; DAU gates for new tiers; queue transparency. |
| 3 | **Collusion / win trading in high-stake pools** | Medium | High | Co-occurrence + ELO + win-rate detection; risk score; stake cap and KYC for high tiers; manual review queue. |
| 4 | **Smart contract exploit or bug** | Low | High | Audit; multisig pause; no upgradeable logic for funds; dispute reserve; refund policy for lost entries. |
| 5 | **Player base never reaches 2k DAU** | Medium | High | Focus growth on one vector (e.g. competitive gamer bridge); avoid overbuilding; keep burn low until PMF. |
| 6 | **"Top 40% break-even" not achieved → mass churn** | Medium | High | Monitor net USDC by percentile; if 40th percentile negative for 2 consecutive months, consider adjusting payout curve (e.g. 42/28/18/12) and re-run economics. |
| 7 | **NFT pass deemed security** | Low | Medium | No revenue share, yield, or profit promise; explicit disclaimer on mint and in docs; no token at launch. |
| 8 | **Toxicity / abuse in high tiers** | High | Medium | Progressive chat; reputation; moderation; no open chat in paid until Gold+ and then limited. |
| 9 | **Single dominant strategy → solved meta** | Medium | Medium | Draft system; 3 boards; 3 archetypes; seasonal balance; overtake/zone caps; no rubber-banding. |
| 10 | **Payment / payout failure (RPC, contract revert)** | Medium | Medium | Retry logic; manual payout runbook; dispute reserve; 24h SLA for manual resolution. |

---

## 11. Architecture Consistency & Simplification

### 11.1 Contradictions Resolved

- **Scoring vs payout:** Placement (1st–4th) is by in-match score only; payout uses same rank. No conflict.
- **Merge handicap:** Replaced 0.95 multiplier with **flat −15 points** so tie-break and hierarchy are preserved; no distortion.
- **"Top 40% break-even":** Defined as season-level outcome (40th percentile net ≥ 0); per match still 2/4 break-even with 38/30/20/12. Economic model uses realistic 35% 1st for high-skill; no 55% assumption.

### 11.2 Economic vs Liquidity

- Phase 1a (2 queues) until 1k DAU avoids dead queues; DAU thresholds for Gold/Pro/Platinum/Diamond unchanged. No conflict.
- Payout split 38/30/20/12 is independent of pool count; manual payout and escrow use same split.

### 11.3 Operational Burden (Early-Stage)

- **Keep:** Co-occurrence and win-rate thresholds; risk score; manual review queue.
- **Simplify:** Auto-restrict only at risk ≥ 70 (not 85% win rate alone); first response SLA stays 72h; no "7-day review" requirement — review when capacity allows, but flag immediately. Reduce CAPTCHA to 3% of matches for MVP if needed.
- **Defer:** Full bot behavioral model can use 2 signals (timing + no auxiliary actions) at launch; add more only if farming appears.

### 11.4 MVP Overbuild

- **Remove:** Underdog bonus (exploitable).  
- **Keep:** 3 boards and ability draft in design doc; **Phase 1 ships Board A only** and simple ability set (no draft in Phase 1a if needed for speed — document as "draft in Phase 2" if timeline forces).  
- **Final:** Draft and 3 boards are part of meta depth; Phase 1 can ship with Board A and fixed ability set, then add draft when Gold unlocks.

### 11.5 Keep / Modify / Remove Summary

| Item | Action |
|------|--------|
| Position/Zone/Overtake weights | **Modify** — rebalanced so no component >40% realistic total; zone contested + diminishing. |
| Underdog bonus | **Remove** — exploitable. |
| Merge 0.95 multiplier | **Modify** — flat −15 pt deduction. |
| Payout 40/30/20/10 | **Modify** — 38/30/20/12. |
| 55% win-rate sim | **Modify** — realistic 35/30/22/13 high-skill. |
| "This is not gambling" / "forfeiture" | **Modify** — conservative wording; no categorical legal claim; "retain pending resolution." |
| Zone scoring | **Modify** — contested-only + diminishing. |
| Phase 1 four queues | **Modify** — Phase 1a two queues until 1k DAU; Phase 1b four queues. |
| Queue timeout 240s | **Keep** — realistic for worst case. |

### 11.6 Final Recommended Configuration

- **Payout split:** 38 / 30 / 20 / 12 at 8% rake.  
- **Scoring weights (realistic max share):** Position ~36%, Zone ~31%, Overtake ~10%, Survival ~23%. (Position 117, Zone 100, Overtake 32, Survival 75; total 324.)  
- **Phase 1:** 1a = Bronze only, 2 queues (10 & 25 USDC), until 7-day DAU ≥ 1,000; 1b = Bronze + Silver, 4 queues, same tiers.  
- **Handicap:** Silver→Bronze merge: −15 points to Silver player's score.  
- **Compliance:** Conservative; no legal classification; no "forfeiture"; "retain pending resolution."

---

**Document control:** Version 1.2. Micro-adjustments: Position coefficient 0.15→0.13; Bronze Retention Cushion (Phase 1a); win-rate flag min 20 matches, ≥80% over 50; homepage wording softened. Architecture unchanged. Integrate into technical spec and ops runbooks.

---

**Micro-adjustments applied. Architecture stable. Ready for TDD conversion.**

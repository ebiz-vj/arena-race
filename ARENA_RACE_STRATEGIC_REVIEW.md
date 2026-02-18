# Arena Race — Strategic Stress Test & Architecture Hardening Review

**Document type:** Critical analysis and patch recommendations  
**Scope:** Structural weaknesses, scalability risks, regulatory vulnerabilities, economic blind spots, long-term retention  
**Tone:** Analytical, actionable; no plan summary.

---

## 1. Game Depth & Meta Longevity

### 1.1 Current State Assessment

- **7×7 + 5 energy + 3 tokens:** State space is finite and tractable. With 4 players × 3 tokens, 5 energy/turn, and ~3–4 abilities, a strong solver could enumerate dominant patterns in months, not years.
- **Placement scoring (100/60/40/20):** Creates a clear ordinal incentive; missing are **marginal score mechanics** (e.g. overtakes, zone control) that add decision depth beyond “maximize final position.”
- **Ability list is small:** Boost, Block, Trap (+ higher-league Swap, Shield, Energy steal). No **ability draft/ban**, no **counter-pick** layer—meta can converge to 1–2 optimal loadouts per division.
- **No board variation in core rules:** Single 7×7 layout means one solved “optimal path + ability timing” can dominate. Seasonal “themed boards” are mentioned but not specified as **mechanically different** (obstacles, one-way tiles, control zones with different scoring).

### 1.2 Missing Components

| Gap | Impact | Recommendation |
|-----|--------|----------------|
| **No draft/ban phase** | Solved meta; no counter-strategy | Add pre-match ability draft (each player picks 1–2 from a pool; optional ban). Rotate pool by season. |
| **No explicit control zones** | Score = position only; shallow | Define 2–3 named zones (e.g. center, corners) with different point multipliers or bonus objectives. |
| **No turn-order / initiative system** | First-mover or last-mover advantage can dominate | Document and balance: simultaneous reveal vs. turn order; consider “priority” resource that affects order. |
| **No comeback mechanic** | Snowball; late game can feel decided | Non-RNG comeback: e.g. “underdog bonus” (points for overtaking a higher-placed token in last N turns) to reward late risk-taking. |
| **Overtakes/events not quantified** | “Overtakes, tactical plays” are vague | Publish exact formula: e.g. +X points per overtake, +Y per zone capture, +Z for survival in danger zone. |

### 1.3 Counter-Strategy Framework

- **Ability counter matrix:** Document hard counters (e.g. Block vs Boost in chokepoints). Design so no single ability is always best.
- **Position archetypes:** Define 2–3 playbooks (e.g. “rush center,” “control edges,” “hunt overtakes”) with explicit weaknesses so meta stays rock-paper-scissors.
- **Seasonal rotation rules:** Rotate **which abilities are in the pool** (not remove forever)—e.g. “Season 2: Block banned from draft.” Publish calendar so no securities-style surprise.

### 1.4 Board Variation Model (No RNG)

- **Fixed variant boards:** 3–5 named layouts (e.g. “Cross,” “Diamond,” “Lanes”) with different tile counts, choke points, and zone positions. Same rules; different optimal paths.
- **Unlock by division:** Bronze/Silver see 1–2 boards; Gold+ get full set. Increases skill ceiling without confusing new players.
- **Seasonal board pool:** Each season, 2–3 boards are “ranked”; others in casual only. Prevents single-board solve dominating forever.

### 1.5 Skill Ceiling Expansion (2+ Years)

- **Advanced abilities (Diamond+):** 1–2 high-skill abilities (e.g. “Predict opponent move,” “Temporary zone denial”) that require more APM and game knowledge.
- **Explicit “skill expression” metrics:** Show players: decision speed, overtake count, zone control %. Leaderboards by these create sub-meta goals.
- **Replay analysis / training mode:** Let players replay key turns with alternate choices. Deepens learning and extends “getting better” curve.

### 1.6 Preventing Dominant Optimal Strategy

- **Avoid single dominant strategy:** Design so that “always do X” is punishable (e.g. if everyone rushes center, edge-control wins). Require playtesting with strong players to prove multiple viable strategies.
- **Seasonal balance patches:** Public changelog (ability energy costs, zone weights)—framed as “competitive balance,” not financial governance.
- **Data-driven balance:** Track win rate and pick rate by ability/board; target 45–55% for no single dominant build.

---

## 2. Liquidity & Pool Fragmentation Risk

### 2.1 Fragmentation Dimensions

You have: **5 divisions × 4+ entry tiers (10 / 25 / 100 / 500+ USDC) × clan events × seasonal tournaments.** That implies many distinct queues:

- **By division:** Bronze, Silver, Gold, Platinum, Diamond (5)
- **By stake:** Casual 10, Standard 25, Pro 100, Elite 500+ (4)
- **By format:** Solo ladder, clan, invitational (3+)

Worst case: 5 × 4 × 3 = **60 logical pools.** Even 5 × 4 = 20 is severe for a new game.

### 2.2 Minimum Viable DAU (Order-of-Magnitude)

- **4-player match:** Need 4 in same pool at same time. For &lt;2 min queue at peak:
  - **Per pool:** ~50–100 DAU with same division + same tier (assuming 5–10 min session, 2–3 matches/user).
- **Conservative:** 20 pools → **1,000–2,000 DAU** just to avoid “dead” queues.
- **Healthy (queue &lt;1 min):** ~3,000–5,000 DAU with smart aggregation.

### 2.3 Risks

| Risk | Effect | When it bites |
|------|--------|----------------|
| **Queue delay** | Churn; “game is dead” perception | First 3–6 months if launch is broad |
| **Elite pool starvation** | Diamond/500+ never fires; whales leave | From day 1 if tiers all open |
| **Clan-only events** | Split base; some only play clan, others only solo | Post-launch when clans matter |

### 2.4 Optimal Launch Segmentation (Exact)

**Phase 1 (Day 0–90):**  
- **Divisions:** Bronze + Silver only. Gold/Platinum/Diamond locked or “coming soon.”  
- **Entry tiers:** **Two only:** 10 USDC (Casual), 25 USDC (Standard). No 100 or 500 at launch.  
- **Format:** Solo only. No clan matchmaking.  
- **Rationale:** One queue per division per tier = **4 queues** (Bronze-10, Bronze-25, Silver-10, Silver-25). Merge further if needed (see below).

**Phase 2 (e.g. 2k DAU):**  
- Unlock Gold division; add Pro 100 USDC in one division first (e.g. Gold only).  
- Add clan **leaderboards** (no clan vs clan matchmaking yet).

**Phase 3 (e.g. 5k+ DAU):**  
- Platinum, Diamond; Elite 500+; clan matchmaking.

### 2.5 Pool Merging Logic (Low User Base)

- **Same division, merge tiers:** If queue &gt;3 min, allow “Standard” (25) to optionally join “Casual” (10) queue with **Casual stakes and prizes** (downgrade). Transparent: “Faster match, lower stakes.”
- **Adjacent division merge:** Only if queue &gt;5 min: e.g. Silver can fill into Bronze with **handicap** (e.g. Silver player gets -5% points) so Bronze isn’t crushed. Document as “extended matchmaking.”
- **Never merge:** Different stake sizes (10 vs 500). Same-stake merge only.

### 2.6 Matchmaking Fail-Safe

- **Max queue time:** After T (e.g. 4 min), offer: (1) “Practice match” (no stake, no ELO), or (2) “Join next tier” (with downgrade rules above).
- **Bot backfill:** Do **not** use bots in paid pools (legal/trust). Use bots only in free practice.
- **Queue transparency:** Show “X players in queue” or “Low/Medium/High” so users don’t assume dead game.

### 2.7 Progressive Unlocking (Summary)

- Unlock divisions and stake tiers by **DAU thresholds**, not by calendar.
- Publish thresholds: e.g. “Gold opens at 2,000 DAU; Pro 100 at 1,500 DAU in Gold.”
- Protects liquidity and sets clear growth milestones.

---

## 3. Economic Stress Test

### 3.1 Assumptions (From Plan)

- Platform fee: 8–10%  
- Top 5%: big win; Top 25%: moderate; Top 40%: break-even; Bottom 60%: net loss (softened by “XP + rating”).

### 3.2 Simulation Framework (Simplified)

- **Per match:** 4 players, 1 pool (e.g. 25 USDC). Total entry = 100 USDC; fee 8% = 8 USDC.  
- **Prize pool = 92 USDC.**  
- Distribution: 1st 40%, 2nd 30%, 3rd 20%, 4th 10% → 36.8 / 27.6 / 18.4 / 9.2 USDC.  
- So: 1st +28.8, 2nd +2.6, 3rd -6.6, 4th -15.8 (vs 25 entry).  
- **Break-even band (top 40%)** = 1st and 2nd. 3rd and 4th lose. So “top 40% break-even” **conflicts** with 4-player per-match: only 2/4 = 50% can break even in that match. You need **aggregate over many matches** so that over time, top 40% of **players** (by skill) break even.

### 3.3 Scenarios

**1,000 users**

- Assume 20% play paid daily (200), 2 matches each → 100 matches/day → 400 match entries/day.  
- At 25 USDC avg: 10,000 USDC/day volume; 8% = **800 USDC/day** fee revenue.  
- **Rake sustainability:** Yes for infra; tight for full team + marketing.  
- **Churn risk:** High. Bottom 60% lose most matches; need strong non-monetary retention (clans, rivals, progression).  
- **Whale dependency:** If 10% of revenue from Elite 500+ pools, those need ~20–50 players. At 1k DAU, Elite should be **closed** (no 500+ tier).  
- **Pool imbalance:** With only 2 tiers (10, 25), 1k DAU can sustain; avoid opening more.

**10,000 users**

- 2,000 paid daily, 2 matches → 1,000 matches/day; 250k USDC/day; 8% = **20,000 USDC/day**.  
- Revenue sustainable; can support team, marketing, compliance.  
- **Churn:** Critical. Ensure break-even band is **achievable** for committed players (top 40% by ELO). If perceived as “house always wins,” mid-tier churn spikes.  
- **Whale:** Elite can open; still cap % of revenue from top 1% (e.g. &lt;25%) to avoid shock if they leave.  
- **Pool imbalance:** Can run 3–4 tiers and 3 divisions; monitor queue times.

**100,000 users**

- Scale linearly; fee revenue sufficient.  
- **Rake sustainability:** 8–10% is within range of skill-game platforms; document that it funds operations and prizes, not “house edge.”  
- **Anti-extraction:** Ensure no single cohort (e.g. bots or pros) can extract &gt;X% of pool; use limits (e.g. max matches per day in Elite) or soft caps.

### 3.4 Recommendations

| Item | Recommendation |
|------|----------------|
| **Distribution %** | Fix **per-match** payout so 2nd place is close to break-even (e.g. 2nd gets ~25 USDC on 25 entry). Then “top 40% break-even” means over a season, 40% of **players** are net positive or flat. |
| **Fee tuning** | Start at **8%**; move to 10% only when liquidity is proven (e.g. 10k DAU). Never exceed 10% for “skill” positioning. |
| **Sustainable rake** | Frame as “platform + prize pool funding”; publish fee clearly before each tournament. |
| **Anti-extraction** | (1) Max matches per day in highest tier (e.g. 20); (2) anomaly detection (win rate &gt;70% over 100+ matches); (3) no “unlimited” Elite entry without KYC. |

---

## 4. Regulatory Hardening

### 4.1 Classification Risk Overview

| Interpretation | Risk | Current plan | Gap |
|----------------|------|--------------|-----|
| **Gambling** | License required in many jurisdictions | Skill-dominant, no RNG, tournament | Need explicit “no chance” documentation; avoid any hidden RNG |
| **Prize competition** | Some countries require registration/limits | Tournament framing, clear rules | Define “prize competition” and cite skill exemption where applicable |
| **Financial instrument / security** | NFT or “investment” framing | Pass = access only; no yield | No future “revenue share” or “dividend” language; no token at launch |
| **Securities offering** | If pass sold as investment | Utility only | Marketing must never promise profit from pass |
| **Money transmission** | Handling USDC, payouts | Escrow, auto-distribute | May need MSB or equivalent in some jurisdictions; get legal opinion |

### 4.2 Strengthening Skill Dominance

- **Public design doc:** “Arena Race: Skill-Dominant Design” — list every decision point; state “no hidden randomness; no dice; no shuffle; outcome = f(player decisions only).”  
- **Third-party attestation:** Consider a short “skill assessment” from a gaming/legal expert (e.g. 2–3 page memo) for use in discussions with regulators.  
- **In-client disclaimer:** Before first paid match: “Outcomes are determined solely by player skill and strategy. No element of chance determines match results.”

### 4.3 Tournament Framing

- **Wording:** Use “tournament,” “entry fee,” “prize pool,” “placement,” “leaderboard.” Avoid “bet,” “wager,” “stake” (or use only in internal docs).  
- **Rulebook:** Single source of truth; versioned; accessible before signup. Include: match format, scoring formula, tie-break, anti-cheat, disqualification.  
- **Escrow narrative:** “Entry fees are held in escrow and distributed according to published rules upon completion of the match.”

### 4.4 Compliance Structure

- **Geo-blocking:** Block by IP (and optionally wallet/KYC country) for: (1) jurisdictions where real-money skill games are prohibited, (2) high-risk gambling jurisdictions until legal clarity. Maintain a **published list** of restricted countries.  
- **KYC threshold:** Trigger KYC for: (a) cumulative entry in a season above X USDC (e.g. $1,000), or (b) entry into “Elite” or “Pro” tiers. Do not allow anonymous unlimited high-stakes play.  
- **Age gate:** 18+ (or 21+ in strict jurisdictions); collect DoB at account creation; no “play for free then pay” without age check first.

### 4.5 Responsible Gaming

- **Policy page:** Limit options: max daily spend (cap), self-exclusion (cooling-off period), reality check (“You’ve played X matches this week”).  
- **No credit:** No “play now, pay later”; no lending. USDC only, pre-funded.  
- **Marketing language:** Never use “get rich,” “earn money,” “guaranteed win,” “easy money.” Use “compete,” “prizes,” “skill league,” “prove your strategy.”

### 4.6 Specific Wording Recommendations

- **Homepage:** “Arena Race is a skill-based competitive league. Entry fees fund prize pools. Results are determined by strategy and skill, not chance.”  
- **Before paid entry:** “By entering, you confirm that you understand outcomes are skill-based, you meet age and jurisdiction requirements, and you accept the rules and fee structure.”  
- **NFT pass:** “The League Pass grants access to participate in tournaments. It does not guarantee any profit, revenue share, or yield. Value may go down.”  
- **Restricted regions:** “Service not available in [list]. By using the service you represent you are not in a restricted jurisdiction.”

---

## 5. Anti-Collusion & Competitive Integrity

### 5.1 4-Player Collusion Vectors

- **Soft teaming:** 2 players in same match coordinate (e.g. out-of-game) to target one opponent or let one win.  
- **Win trading:** A and B alternate “wins” in separate matches (harder in 4-player, but possible with multiple accounts).  
- **Bot farming:** Bots in low-tier pools to harvest payouts.  
- **Smurfing:** High-skill players in low divisions to farm wins and payouts.

### 5.2 Detection Systems

| Threat | Detection | Data |
|--------|-----------|------|
| **Teaming** | Same 2 players in many matches together; one consistently benefits (e.g. always 1st/2nd when together) | Match history, co-occurrence matrix, placement correlation |
| **Win trading** | Same wallet(s) in matches with highly asymmetric outcomes; timing patterns | Wallet, IP, session; outcome sequences |
| **Bots** | Move timing (too regular), no spectate/replay views, no social actions | Client telemetry, reaction time distribution |
| **Smurfing** | New account, very high win rate, fast climb; same device/wallet as existing account | ELO curve, device fingerprint, wallet graph |

### 5.3 ELO Anomaly Tracking

- **Rapid climb:** ELO gain per match above threshold (e.g. &gt;90% win over 50 matches in Bronze/Silver) → flag for review.  
- **Stable collusion:** Two players always in same bracket; combined placement sum consistently favorable → flag.  
- **Reversal pattern:** Same two players; in match 1 one wins, in match 2 the other wins, repeatedly → possible win trading.

### 5.4 Collusion Flagging (Algorithm Sketch)

- **Co-occurrence:** For each player pair (A,B), count matches together and average placement (e.g. min(place_A, place_B)). If high co-occurrence and both often top-2, score “teaming risk.”  
- **Payout concentration:** Wallet receiving disproportionate share of payouts in a pool relative to play count → flag.  
- **Temporal:** Matches at odd hours with same small set of wallets → flag.

### 5.5 Anti-Bot Logic

- **Pre-match:** CAPTCHA or lightweight challenge (e.g. “Select the tile that…”).  
- **In-match:** Track input timing; human-like variance.  
- **Post-match:** No payout to accounts that never spectate, never chat, never change settings (heuristic).  
- **Rate limit:** Max N paid matches per day per device/wallet in low tiers until account age/rep threshold.

### 5.6 Behavioral Risk Score

- Single score per account: combine (1) ELO anomaly, (2) co-occurrence risk, (3) bot-like behavior, (4) report count.  
- **Actions:** &lt;30: normal; 30–60: review queue; 60–80: restrict to lower stakes or delay payouts; 80+: suspend and manual review.

### 5.7 Penalty Escalation

- **First offense (teaming/collusion):** Warning; temporary stake cap.  
- **Second:** Ban from paid play for 1 season; forfeit pending payouts.  
- **Third / egregious:** Permanent ban; publish (anonymized) “competitive integrity” report.  
- **Bot/smurf:** Confiscate winnings from affected matches; demote or ban.

---

## 6. Retention & Boredom Risk Model

### 6.1 Plateau and Churn

- **Plateau:** When ELO stabilizes (player is at “true” skill), progression feels flat. Without other goals, engagement drops.  
- **Churn spikes:** (1) After first big loss (emotional); (2) at division boundary (repeated demotion); (3) when queue times grow; (4) after 50–100 matches if no new content.

### 6.2 Soft Reset Mechanics

- **Seasonal ELO compression:** Not full reset. Formula: `new_rating = (old_rating + season_base) / 2` (or similar) so everyone moves toward center but skill still matters.  
- **Placement matches:** First 5–10 matches of season count more; re-anchor rating.  
- **No reset of total wins/titles:** Permanent identity (e.g. “Season 1 Gold”) so progress isn’t erased.

### 6.3 Tier Protection

- **Demotion shield:** After promotion, “protected” for N matches or 1 week: cannot demote. Prevents yo-yo at boundary.  
- **Grace band:** ELO band where you don’t demote immediately (e.g. bottom of Silver has 5-game grace before dropping to Bronze).

### 6.4 Prestige Decay (Optional)

- **Inactivity:** After 30 days no play, show “inactive” and optionally decay ELO slightly (e.g. -50) so ladder doesn’t fill with ghosts. Don’t decay during active season.

### 6.5 Seasonal Ambition Loop

- **Clear goals:** “Reach Gold,” “Top 100 in Silver,” “Clan in top 10,” “Unlock Diamond ability.”  
- **Rewards:** Cosmetic titles, badges, board themes (no monetary promise).  
- **Calendar:** Publish season end; “Championship” event with exclusive skin/title.

### 6.6 Achievement Progression Tree

- **Non-ELO progression:** Achievements (e.g. “Win with 3 overtakes,” “Reach 1st from 4th in one match,” “100 matches in Silver”).  
- **Unlocks:** Cosmetic or “prestige” only.  
- **Long tail:** Some achievements very hard (e.g. “Diamond in 3 seasons”) to extend engagement.

---

## 7. NFT & Tokenomics Future Proofing

### 7.1 Future Token Introduction Risks

- **If token later:** Risk of “investment” narrative; airdrop to pass holders could be seen as security.  
- **Mitigation:** If token ever: (1) no promise of value or utility at sale; (2) use for governance/cosmetics only, not for entry or payouts; (3) legal review before any airdrop or sale.

### 7.2 NFT Liquidity Overestimation

- **Reality:** Most game NFTs are illiquid; resale is thin.  
- **Do not:** Model revenue or sustainability on secondary sales or royalties.  
- **Do:** Price pass as “access for season” with optional resale as bonus; primary revenue = fees + primary sales.

### 7.3 Royalty Dependency Risk

- **Plan lists “NFT resale royalties.”** Secondary markets may not enforce royalties; regulation may limit them.  
- **Recommendation:** Treat royalties as **optional upside**, not baseline. Core revenue: mint price + 8–10% tournament fee + cosmetics.

### 7.4 Revenue Model Independent of NFT Resale

- **Primary:** Tournament fee (8–10%); seasonal pass primary sales; cosmetic NFTs; sponsored events.  
- **Document:** “Revenue model does not depend on secondary market or royalties.”

### 7.5 Long-Term NFT Utility (No Securities)

- **Safe:** Access gating, cosmetic skins, clan badges, voting on non-financial game options (themes, ability rotation).  
- **Avoid:** Revenue share, profit share, yield, dividend, or any “return” tied to platform revenue.

---

## 8. Social & Community Stability

### 8.1 Clan Power Imbalance

- **Risk:** Few clans dominate leaderboards; others feel hopeless.  
- **Mitigation:** (1) Clan size caps (e.g. 20–50); (2) leaderboard by “average ELO” or “clan activity score,” not only total wins; (3) seasonal clan reset or decay so one season’s winner doesn’t lock the next.

### 8.2 Elite Dominance vs Casual

- **Risk:** Leaderboards and spectate focused on Diamond; Bronze/Silver feel irrelevant.  
- **Mitigation:** Division-specific leaderboards and featured matches (e.g. “Silver match of the week”). Celebrate “most improved” and “first promotion” as much as “Diamond champion.”

### 8.3 Toxicity in High-Stake Tiers

- **Risk:** Pro/Elite chat becomes toxic; drives away skilled players.  
- **Mitigation:** Stricter moderation in high tiers; limited phrases only if needed; reputation affects matchmaking (e.g. avoid pairing two low-rep players).

### 8.4 Creator-Led Pool Manipulation

- **Risk:** Creator runs “invite-only” tournament; invites friends who soft-collude.  
- **Mitigation:** Creator tournaments use same anti-collusion rules; creator does not play in own invite pool, or matches are recorded and spot-checked. No “private” paid pools that bypass integrity checks.

### 8.5 Recommendations Summary

- **Clan balancing:** Size cap, scoring by average/activity, seasonal relevance.  
- **Prestige caps:** No single clan or player “locks” permanent #1; seasonal crowns.  
- **Social safety:** Progressive chat, report flow, reputation; no unmoderated open chat in paid.  
- **Governance boundaries:** NFT vote on themes/rotation only; no vote on fee, payouts, or eligibility.

---

## 9. Growth Vector Clarity

### 9.1 Option A: Crypto-Native Web3

| Pros | Cons |
|------|------|
| Already have wallet; understand USDC | Small TAM; many “game then cash out” users |
| Clear fit for NFT pass | High CAC if competing with other Web3 games |
| Community used to tournaments | Regulatory scrutiny on crypto audience |

- **CAC:** High (competitive); retention often weak.  
- **Liquidity:** Can concentrate in few pools (whales).  
- **Regulatory:** Same skill vs gambling; plus crypto-specific scrutiny in some jurisdictions.

### 9.2 Option B: Competitive Gamer Bridge (Web2 → Web3)

| Pros | Cons |
|------|------|
| Large TAM (esports, strategy gamers) | Need fiat on-ramp; wallet friction |
| Skill-first narrative fits | Many dislike “crypto”; need trust |
| Retention potential higher if game is strong | Education cost (wallet, USDC) |

- **CAC:** Medium; pay for performance (Twitch/YouTube, influencers).  
- **Liquidity:** More players, more distributed stakes; healthier matchmaking.  
- **Regulatory:** Broader audience may include stricter jurisdictions; need geo + age gate.

### 9.3 Option C: Creator-Led League Ecosystem

| Pros | Cons |
|------|------|
| Creators bring audience and liquidity | Creator dependency; one creator exit = pool at risk |
| Custom tournaments = engagement | Risk of collusion or bad behavior in private pools |
| Viral potential (Discord, Twitter) | Need tools and support; revenue share complexity |

- **CAC:** Variable; creators may want rev share.  
- **Liquidity:** Fragmented by creator; need aggregation or clear rules.  
- **Regulatory:** Creator marketing must comply (no “get rich” messaging).

### 9.4 Recommendation

- **Primary: B (Competitive gamer bridge).** Largest sustainable TAM; skill narrative and retention align; liquidity and matchmaking improve with more players; regulatory approach (skill, age, geo) works for broad audience.  
- **Secondary: A (Crypto-native)** for launch and early liquidity (target existing Web3 gamers first).  
- **Tertiary: C (Creator-led)** after product is stable; use creators to scale, with clear rules and integrity controls so it doesn’t fragment or create compliance risk.

---

## 10. Execution Priority Map

### Critical (Must Be Built Before Launch)

| Item | Reason |
|------|--------|
| Finalized, published rulebook (scoring, tie-break, no RNG) | Regulatory and trust |
| Escrow contract (audited) + testnet then mainnet | Money safety |
| ELO + 2 divisions (Bronze, Silver) + 2 entry tiers (10, 25 USDC) only | Liquidity protection |
| Basic anti-collusion (co-occurrence + anomaly flags; manual review queue) | Integrity |
| Geo-blocking + age gate + pre-paid disclaimer | Compliance floor |
| Match validation server (authoritative result) | No client-side result manipulation |
| NFT pass (access only; no yield wording) | Compliance and access control |

### Important (Should Be Ready at or Soon After Launch)

| Item | Reason |
|------|--------|
| KYC threshold for high-tier (when opened) | Compliance |
| Clan leaderboards (no clan matchmaking yet) | Retention |
| Rivals + friends (spectate, challenges) | Retention |
| Queue time visibility and merge logic | Retention and liquidity |
| Responsible gaming (limits, self-exclusion) | Compliance and trust |
| Ability draft or rotation design (for meta depth) | Long-term depth |

### Optional (Post–Product-Market Fit)

| Item | Reason |
|------|--------|
| Multiple board variants | Depth; not needed for MVP |
| 2v2, clan vs clan matchmaking | Expands later |
| Advanced abilities (Diamond+) | Depth |
| Token (if ever) | High risk; only with legal clearance |
| Full creator tournament tooling | Scale; not for day 1 |

### Dangerous to Overbuild Early

| Item | Why Dangerous |
|------|----------------|
| All 5 divisions + all entry tiers at launch | Fragments liquidity; dead queues |
| Clan matchmaking from day 1 | Splits base; long queues |
| Complex ability draft/ban in v1 | Delays launch; balance unknown |
| Token or “revenue share” NFT | Regulatory and securities risk |
| Open chat in all tiers | Toxicity and moderation load |
| Marketing that promises “earn” or “win money” | Regulatory and reputational risk |

### Critical for Long-Term Moat

| Item | Why It Matters |
|------|----------------|
| Deep, non-solvable meta (draft, boards, counters) | Retention and esports potential |
| Trust (escrow, integrity, clear rules) | Differentiation vs scammy Web3 games |
| Liquidity and matchmaking health | Retention and word-of-mouth |
| Compliance and responsible gaming | Durability and partnerships |
| Social layer (clans, rivals, identity) | Loyalty beyond single matches |

---

## Document Control

- **Purpose:** Stress test and hardening; not a replacement for the main game plan.  
- **Use:** Patch the main plan with: launch segmentation (2 divisions, 2 tiers), economic clarity (per-match vs aggregate break-even), regulatory wording, anti-collusion systems, retention mechanics, and execution priorities.  
- **Next steps:** (1) Integrate “Critical” and “Important” items into roadmap; (2) Commission legal memo on skill vs gambling and money transmission; (3) Define exact payout curve and merge rules; (4) Implement detection and penalty escalation for integrity.

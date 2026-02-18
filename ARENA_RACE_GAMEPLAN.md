# Arena Race — Game Master Plan (Improved)

**Tagline:** *The Web3 Skill League — Prove your strategy in 5 minutes.*

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Core Positioning](#2-core-positioning)
3. [Game Design](#3-game-design)
4. [Economy & Prizes](#4-economy--prizes)
5. [NFT & Compliance](#5-nft--compliance)
6. [Social & Community](#6-social--community)
7. [Dual-Layer Experience](#7-dual-layer-experience)
8. [Tech & Execution](#8-tech--execution)
9. [Risks & Mitigations](#9-risks--mitigations)
10. [Success Metrics](#10-success-metrics)

---

## 1. Executive Summary

**Arena Race** is a fast-paced, 4-player tactical board game on a 7×7 grid, powered by NFT League Passes and USDC prize pools. It is positioned as a **competitive skill league**, not gambling or speculation.

| Pillar | Summary |
|--------|--------|
| **What it is** | Tournament-based, skill-dominant, 5-minute matches |
| **What it is not** | Gambling, betting, yield farming, dice/RNG luck |
| **Monetization** | NFT passes, 8–10% tournament fee, cosmetics, sponsored events |
| **Differentiator** | Pure decision-based gameplay; regulatory-aware (Dubai/skill framing) |
| **Retention** | ELO divisions, clans, rivals, seasonal resets, dual casual/competitive tone |

**Strategic strengths:** Fun + skill balance, low legal ambiguity, NFT utility compliance, scalable pool segmentation, esports expansion path, moderate dev complexity.

---

## 2. Core Positioning

- **Competitive skill league** — outcomes driven by decisions, not chance  
- **Esports-lite Web3 platform** — spectators, clans, creator tournaments  
- **Tournament-based** — clear rules, transparent escrow, stablecoin only (USDC)  
- **Explicitly not:** gambling, betting, yield farming, or “earn money fast” marketing  

**Positioning statement:** *“Competitive Skill League”* — not casino, not betting.

---

## 3. Game Design

### 3.1 Board & Match

| Element | Spec |
|--------|------|
| Grid | 7×7 tactical board |
| Players per match | 4 |
| Tokens per player | 3 |
| Match duration | 5 minutes (timed) |
| Objective | Maximize score before timer ends |

**Design principle:** No dice, no hidden randomness — pure decision-based play.

### 3.2 Energy System

- **Per turn:** 5 Energy Points  
- **Movement:** 1 energy per tile  
- **Abilities:** 2–3 energy (varies by ability)  
- **Reset:** Energy refills every turn  

**Outcome:** Constant meaningful decisions; no passive or RNG-heavy turns.

### 3.3 Abilities

**Basic (all leagues):**

- Boost — +2 movement  
- Block — freeze tile  
- Trap — temporary penalty tile  

**Higher leagues:**

- Swap positions  
- Defensive shield  
- Energy steal  

Abilities add chaos and counterplay while keeping skill as the dominant factor.

### 3.4 Win Conditions (Timed Score)

Score sources: board position, overtakes, tactical plays, survival bonuses, control zones.

**Final placement points (at timer end):**

| Place | Points |
|-------|--------|
| 1st | 100 |
| 2nd | 60 |
| 3rd | 40 |
| 4th | 20 |

No instant-win or lottery mechanics.

### 3.5 Skill Divisions (ELO)

| Division | Purpose |
|----------|---------|
| Bronze | Entry, casual |
| Silver | Regular |
| Gold | Skilled |
| Platinum | Advanced |
| Diamond | Elite |

- Players compete within tier.  
- Promotion: win streak + minimum rating.  
- Prevents beginners being crushed and pros farming new players.

---

## 4. Economy & Prizes

### 4.1 Entry Pools (by division)

| Pool | Entry | Audience |
|------|-------|----------|
| Casual | 10 USDC | New / entry |
| Standard | 25 USDC | Regular |
| Pro | 100 USDC | Skilled |
| Elite | 500+ USDC | High-tier |

Same rules and mechanics; different stake and prize size. **No pay-to-win.**

### 4.2 Prize Pool Example

- 100 players × 25 USDC = 2,500 USDC  
- Platform fee 8% = 200 USDC  
- **Prize pool = 2,300 USDC**

**Distribution idea:**

- Top 5% — large win  
- Top 25% — moderate win  
- Top 40% — break-even band  
- Others — XP + rating growth  

Goal: Few players feel “zeroed”; encourages replay.

### 4.3 Smart Contract (Escrow)

1. Register via NFT pass  
2. Entry (USDC) sent to contract  
3. Platform fee auto-calculated  
4. Prizes auto-distributed on result  
5. Full on-chain transparency  

No token at launch; no inflationary token economy.

---

## 5. NFT & Compliance

### 5.1 NFT League Pass

- **Role:** Season access pass (required for tournament entry).  
- **Types:** Bronze, Silver, Gold (and higher as needed).  
- **Utility:** Division access, cosmetic identity, prestige, tradable.  

**Explicitly not:** Revenue share, yield, dividend, or profit guarantee (to avoid securities treatment).

### 5.2 Compliance (e.g. Dubai / skill framing)

- Skill-dominant mechanics, no dice/RNG  
- No jackpot-style marketing  
- Tournament framing + clear rulebook  
- Transparent escrow, USDC only  
- Optional KYC for high-tier pools  
- Geo-block high-risk jurisdictions if required  

---

## 6. Social & Community

**Goals:** Identity, rivalry, belonging, prestige, social proof — not “add chat” for its own sake.  
*Money keeps players active; community keeps them loyal.*

### 6.1 Identity

- On-chain identity tied to NFT pass  
- Profile: division badge, win rate, favorite tactic, titles, seasonal history, clan tag  

### 6.2 Clans / Guilds

- Create/join clan (small NFT fee possible)  
- Clan leaderboards, clan vs clan, weekly clan score  
- Shared chat, clan badge NFT  
- Drives belonging and retention  

### 6.3 Friends & Rivals

- **Friends:** Add, spectate live, private challenges, share replays  
- **Rivals:** Mark rival, rival leaderboard, “You defeated your rival” — boosts replay rate  

### 6.4 Spectator Mode

- Live spectating, clan watch parties, featured top-tier matches  
- Real-time spectator chat, match highlights  
- Supports esports-lite positioning  

### 6.5 In-Game Interaction (Controlled)

- Emoji reactions, pre-set tactical phrases, limited chat in higher tiers  
- Reputation score; avoid toxic open chat early  
- Progressive chat unlock by tier  

### 6.6 Seasonal Events

- Opening tournament, mid-season clan war, final championship  
- Themed boards, seasonal trophy NFTs  

### 6.7 Creators

- Custom tournaments, branded leagues, % of pool, invite followers  
- Enables Discord leagues, Twitter/YouTube events  

### 6.8 Anti-Toxicity

- Reputation, cooldowns, reports, filters, progressive chat unlock  

### 6.9 Optional Governance (later)

- NFT holders vote on board themes, ability rotation, seasonal modifiers — game direction only, no financial governance  

---

## 7. Dual-Layer Experience

### 7.1 Layer 1 — Friendly & Casual (Bronze/Silver, low stakes)

- **Tone:** Bright, fun animations, emojis, light music, playful UI  
- **Message:** “Let’s have fun,” small stakes, clan social, encouraging  

### 7.2 Layer 2 — Competitive & Intense (Gold+)

- **Tone:** Minimal UI, focus mode, serious leaderboard  
- **Message:** Pressure, skill respect, prestige, tactical intensity  

### 7.3 Implementation

- **UI:** Casual theme (colorful) vs Pro theme (clean esports); unlock by tier  
- **Chat:** Bronze — emoji/light; Gold+ — tactical-only, limited reactions  
- **Match display:** Casual — more animation; Competitive — minimal animation, clear grid  
- **Audio:** Casual — upbeat; Competitive — tense ambient  

**Rule:** Never mix casual and intense in the same pool (e.g. no Bronze in Diamond pool).

**Result:** One ecosystem — casual on entry, competitive on climb, social at clan level, intense at elite.

---

## 8. Tech & Execution

### 8.1 Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | Next.js |
| Game | Phaser.js (2D) |
| Wallet | WalletConnect |
| Chain | Polygon or Base |
| Backend | Supabase |
| Match validation | Node.js server |
| Contracts | Solidity escrow |

Low infra cost; MVP feasible in 90 days.

### 8.2 90-Day Roadmap (Improved)

| Phase | Window | Focus | Key Deliverables |
|-------|--------|--------|-------------------|
| **1 — Core** | Day 0–30 | Mechanics + infra | Finalized rules; 7×7 board engine; basic matchmaking; wallet connect; energy + basic abilities |
| **2 — Economy** | Day 30–60 | Money + identity | Escrow contract (testnet); NFT pass mint; ELO/ranking; closed beta (invite-only) |
| **3 — Launch** | Day 60–90 | Live + growth | Public launch; Bronze & Silver pools; first marketing push; first creator tournaments |

Expand tiers and pool sizes gradually after launch.

### 8.3 Long-Term Anti-Boredom

- **Seasonal:** New layouts, ability rotation, cosmetic themes; partial rating compression; championship event  
- **Modes (future):** 2v2, clan tournaments, country vs country, invitationals  
- **Depth:** Slightly deeper mechanics in higher leagues  

### 8.4 Monetization

1. NFT League Pass mint  
2. 8–10% tournament fee  
3. Cosmetic NFT skins  
4. Premium board themes  
5. VIP divisions  
6. Sponsored tournaments  
7. NFT resale royalties  

No reliance on token speculation; revenue scales with activity.

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Regulatory (gambling) | Skill-dominant design, no RNG, tournament framing, legal review, geo-blocking |
| Low retention | ELO divisions, clans, rivals, dual-layer UX, seasonal resets |
| Low liquidity in pools | Tiered entry (10–500+ USDC), casual vs pro pools, creator-led events |
| Toxicity / abuse | Reputation, reports, cooldowns, progressive chat, moderation |
| Smart contract bugs | Audit, testnet phase, gradual rollout, fee caps |
| NFT “securities” concern | Pass = access/utility only; no yield or profit promise |

---

## 10. Success Metrics

| Area | Metrics |
|------|--------|
| **Engagement** | DAU/MAU, matches per user per week, session length |
| **Retention** | D1/D7/D30; % returning after first paid match |
| **Economy** | Total USDC in escrow, fee revenue, average entry per match |
| **Social** | Clan creation/join rate, spectate sessions, rival adds |
| **Growth** | New passes minted, referral/concreator-driven signups |
| **Competitive** | ELO distribution health, queue times by tier |

---

## Final Summary

Arena Race is a **Web3 Competitive Skill League**: structured growth, clear monetization, and regulatory awareness. It is not a gambling platform, speculative token project, or simple puzzle app. With the social layer (identity, clans, rivals, dual experience), it aims to be a **competitive social network with a skill-based money layer** — casual on entry, competitive on climb, and intense at the top.

---

*Document: Improved game plan derived from original Arena Race gameplan. Last updated: Feb 2025.*

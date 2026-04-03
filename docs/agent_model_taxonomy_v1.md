# Agent model taxonomy — v1

Design reference for distinct **thinking models** (not just parameter presets). Each type implies different **information diet**, **latency**, **cognitive posture**, and crucially **non-interchangeable decision logic**—not a single linear weighted blend everywhere.

---

## Taxonomy table (v1)

| Type | Short description | Preferred information sources | Delay | Understanding | Rationality | Default risk tendency | Decision style | Confidence style |
|------|-------------------|------------------------------|-------|---------------|-------------|------------------------|----------------|------------------|
| **Trend Follower** | Rides persistent directional moves; exits on clear structure break, not on first counter-tick. | Price/volume aggregates, momentum summaries, trend labels; light news as regime context only. | Low | Medium | Medium | Moderate–high (pyramiding mindset) | **Momentum path rule:** act when smoothed return slope and participation stay aligned for *N* steps; flatten when slope sign flips *and* range expands. | Rises with trend age and signal coherence; decays fast on chop. |
| **Mean Reversion** | Bets extremes snap back to a slow fair-value envelope. | VWAP / moving anchors, range bounds, sentiment spikes as **fade** inputs, not chase. | Medium | Medium | Medium–high | Moderate (sizes down at tails) | **Contrarian band rule:** trigger only when price vs. anchor exceeds a **threshold** *and* velocity is stalling; direction is **inverse** to the surprise. | High near the band edge if exhaustion cues agree; low during one-way squeezes. |
| **News Driven** | Reacts when **new** discrete information hits; ignores slow drift. | Headlines, structured news, firm-specific filings; timestamps and source tier matter more than volume. | Low | Medium | Medium | Medium | **Event-only trigger:** binary gate—no material headline → **no trade** or hold prior bias; on event, map sentiment/category to action via a **small rule table**, not a continuous score. | Spike then **half-life decay** over hours/session; event salience overrides prior. |
| **Macro Conservative** | Top-down hierarchy: regime and policy/risk dominate stock-specific noise. | Macro prints, rates/FX, credit stress, broad risk proxies; company news secondary unless invalidates thesis. | High | High | High | Low–moderate | **Layered rule precedence:** if macro risk-off flag → defensive action first; else if no hard macro veto → allow stock factors. Order is **fixed**, not averaged. | Stable, slow-updating; jumps only on macro **regime** change. |
| **Technical Trader** | Chart structure: levels, breaks, failed breaks; falsifies on invalidation. | OHLC patterns, support/resistance, volume at price; minimal narrative. | Low | Medium | Medium | Moderate | **Threshold / level machine:** long above breakout level *and* hold; short below breakdown; **no** signal in the middle zone (wait). | Binary around the level; muted in “no man’s land.” |
| **Passive Low Attention** | Barely updates; tracks broad exposure with inertia and rare adjustments. | End-of-day summaries, rare alerts; mostly prior allocation. | High | Low | Medium | Low | **Inertia with drift:** default stay/hold small rebalance band; occasional tiny nudge from a **very slow EMA** of returns—no intraday finesse. | Narrow band, rarely extreme; smooths to baseline. |
| **Noise Trader** | Weakly informed; actions dominated by micro-noise and habit. | Social snippets, retail chatter, tick-level flips; **low** trust weighting. | Low | Low | Low | High (overtrading) | **Low-information random drift:** frequent small perturbs around a prior; occasional **mimicry burst** when volume spikes—**not** a score-to-weight mapping. | Volatile, often miscalibrated (high when noisy). |
| **Event Chaser** | Chases **scheduled** or **anticipated** catalyst windows (EPS, FOMC, product). | Calendars, consensus tables, whisper feeds, options-implied event weight. | Medium | Medium | Low–medium | High | **Calendar gate:** positions **open/flip** in a tight window around known events; outside window, decay to flat or minimal exposure—**binary schedule logic**, not continuous blending. | Peaks into the event cone; collapses after resolution or delay. |

---

## v1 notes

- **Decision style** deliberately mixes **threshold machines**, **momentum paths**, **contrarian / inverse** logic, **event-only and calendar gates**, **macro precedence**, **slow EMA / inertia**, and **noise-dominated drift**—not one family of linear aggregators.
- **Understanding** and **rationality** describe typical *posture* for the archetype (training/expertise and adherence to consistent reasoning), not fixed constants in code.
- **Delay** is information-to-action latency (how fast the model *allows* itself to move), not exchange latency.
- Later versions may add hybrid tags (e.g. “News + Technical”) once base types are implemented and measured.

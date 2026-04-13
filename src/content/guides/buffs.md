---
title: Buffs & Multipliers
description: How the review multiplier system works
order: 1
---

*Note: these values are subject to change as we iterate.*

When your submission is reviewed, a reviewer assigns a **multiplier** based on what your API implements. The multiplier directly scales your payout:

> **Payout = hours × 4 × multiplier**

So if you logged 6 hours and your multiplier is 1.25, you'd receive 30 raspberries.

## How the Multiplier Is Built

The multiplier starts at **1.0** and is built in two stages:

1. **Flat bonuses** are added together (capped at 1.5 total)
2. **Multiplier buffs** are applied on top of the capped value

---

## Flat Bonuses

These are additive. Reviewers check your project for each one and add the bonus if it qualifies.

| Buff | Bonus |
|------|-------|
| Authorization (JWT, user tokens, API keys) | +0.15 |
| Persistence (database, file storage) | +0.10 |
| External API integration (non-trivial) | +0.10 |
| Rate limiting / abuse prevention | +0.10 |
| Pagination | +0.05 |
| Proper error handling & input validation | +0.05 |
| Additional endpoints beyond the minimum, up to 4 | +0.03 each |

The sum of all flat bonuses is **capped at 1.5** before multiplier buffs are applied. If your bonuses add up to 1.6, they'll be treated as 1.5.

---

## Multiplier Buffs

These are applied after the flat bonus cap and stack multiplicatively.

| Buff | Multiplier |
|------|------------|
| Cool project | ×1.3 |
| Exceptional code quality / architecture | ×1.2 |

---

## Example

Say your API has:

- Auth (+0.15)
- A database (+0.10)
- Rate limiting (+0.10)
- Solid error handling (+0.05)
- 2 extra endpoints (+0.06)

That's **1.0 + 0.46 = 1.46**. Below the 1.5 cap, so no clipping.

If the reviewer also thinks it's a cool project (×1.3):

**1.46 × 1.3 = 1.898**

With 6 hours logged: **6 × 4 × 1.898 = ~46 raspberries**.

---

Buffs are awarded at reviewer discretion. Please do not ask for specific buffs in your submission notes, but do make sure to highlight any features you implemented that you think are cool and deserve recognition!
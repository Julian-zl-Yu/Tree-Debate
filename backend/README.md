# TreeDebate Forum 

A non-traditional forum that organizes discussions as an opinion tree and ranks content using an entropy-based algorithm to surface meaningful and controversial debates.

## Core Idea

This platform models discussions as a tree of opinions:

- Each **topic** is the root node.
- Each **node** is a user's opinion.
- Every reply must explicitly declare a **stance**:

  - `AGREE`
  - `NEUTRAL`
  - `DISAGREE`

This structure enables more meaningful and structured discussions.

## Ranking Algorithm

Content is ranked using a custom scoring formula:

`final_score = opinion_entropy × engagement_weight × freshness_factor`

### Opinion Entropy

Measures how controversial a discussion is:

`opinion_entropy = - [p_agree ln(p_agree) + p_disagree ln(p_disagree)]`

Maximum when opinions are evenly split
Zero when everyone agrees or disagrees

### Engagement Weight

Captures participation:

`engagement_weight = 1 + ln(W_total + 1)`

Based on total weighted interactions
Uses logarithmic scaling to prevent abuse

### Freshness Factor

Balances new and old content:

`freshness_factor = max(0.3, 1 / (hour_count / 24 + 1))`

## Key Features

- Opinion tree as an N-ary tree structure  
- Stance-enforced replies (`AGREE` / `NEUTRAL` / `DISAGREE`)  
- Entropy-based ranking (not just upvotes)  
- Like system with **diminishing returns** per user  
- Unique reply tracking per user (anti-spam)  
- Abuse prevention: rate limiting, report system  
- Moderation with **weighted reporting** and comment folding  
- User reputation levels affect moderation power

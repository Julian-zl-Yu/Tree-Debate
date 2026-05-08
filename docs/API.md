# MapleBoard API Reference

Base URL: `http://localhost:8080`

Frontend dev proxy sends `/api`, `/swagger-ui`, and `/v3` to the backend from `http://127.0.0.1:5173`.

## Auth

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | Public | Register a user. Body: `{ "username": "...", "password": "..." }` |
| `POST` | `/api/auth/login` | Public | Login. Body: `{ "username": "...", "password": "..." }`. Returns `{ "token": "..." }` |
| `GET` | `/api/users/me` | Bearer token | Current user profile and roles. |

Use the login token as `Authorization: Bearer <token>`.

## Topics

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/topics/feed?sort=HOT&page=0&size=20` | Public | Homepage feed. Supports `sort=HOT|NEW|CONTROVERSIAL`, `category`, and `keyword`. Public response does not expose entropy internals. |
| `GET` | `/api/topics/{id}` | Public | Topic detail header. |
| `POST` | `/api/topics` | Bearer token | Create topic. Body: `{ "category": "...", "title": "...", "content": "..." }` |

## Opinion Tree

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/topics/{topicId}/opinions` | Public | Full N-ary opinion tree. Public response hides score internals. |
| `POST` | `/api/topics/{topicId}/opinions` | Bearer token | Create root opinion or reply. Body: `{ "parentId": null, "stance": "AGREE", "content": "..." }` |
| `PUT` | `/api/topics/{topicId}/opinions/{opinionId}` | Bearer token | Edit own opinion. Body: `{ "stance": "DISAGREE", "content": "..." }` |
| `POST` | `/api/topics/{topicId}/opinions/{opinionId}/likes` | Bearer token | Like an opinion once per user. |
| `POST` | `/api/topics/{topicId}/opinions/{opinionId}/reports` | Bearer token | Report an opinion. Body: `{ "reportType": "SPAM", "reason": "optional" }` |

Valid stances: `AGREE`, `NEUTRAL`, `DISAGREE`.

Valid report types: `SPAM`, `HARASSMENT`, `OFFTOPIC`.

## Admin

All admin endpoints require a token with `ROLE_ADMIN`.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/admin/reported-opinions?page=0&size=20` | Review reported opinions with report scores and entropy/final score internals. Supports `reportType=SPAM|HARASSMENT|OFFTOPIC` and `folded=true|false`. |
| `POST` | `/api/admin/opinions/{id}/fold` | Manually fold an opinion. Folded opinions have `comment_weight = 0` and do not affect entropy/final score. |
| `POST` | `/api/admin/opinions/{id}/unfold` | Manually unfold an opinion and recompute stats. |
| `POST` | `/api/admin/users/{id}/ban` | Disable a user account. |
| `POST` | `/api/admin/users/{id}/unban` | Re-enable a user account. |

## Scoring Rules

`final_score = opinion_entropy * engagement_weight * freshness_factor`

`opinion_entropy = - [p_agree * ln(p_agree) + p_disagree * ln(p_disagree)]`

Folded comments use `comment_weight = 0`.

Auto-fold thresholds:

| Type | Threshold |
| --- | --- |
| `SPAM` | `2.0` |
| `HARASSMENT` | `3.0` |
| `OFFTOPIC` | `5.0` |

# Table styling (three-line)

Goal: a booktabs-ish table (no vertical rules, only a top rule, header rule, and bottom rule).

| Name | Location | Height | Score |
|---|---|--:|--:|
| John | Second St. | 180 | 5 |
| Wally | Third Av. | 160 | 10 |
| Ada | Fourth Blvd. | 170 | 9 |

## Wider content

| Endpoint | Method | Description |
|---|:---:|---|
| /api/render | POST | Renders markdown into a PDF blob. This description is long enough to wrap and should still look clean with minimal rules. |
| /api/status | GET | Returns a small health payload. |

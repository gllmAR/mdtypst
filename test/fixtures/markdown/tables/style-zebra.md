# Table styling (zebra)

Goal: a readable default table style (header emphasis, zebra rows, decent padding).

## Simple

| Key | Description | % |
|-|--------|-|
| ID1 | The description column should be wider and wrap naturally. | 100 |
| ID2 | Short. | 12 |
| ID3 | A long, long, long value that forces wrapping and should still feel pleasant to read in a table cell. | 3 |

## More columns

| Name | Type | Default | Notes |
|-|--|--|-|
| timeout_ms | int | 30000 | Used for navigation + render timeouts. |
| renderer | string | fallback | Can be `fallback`, `cmarker`, or `auto`. |
| tables | string | (unset) | When set to `tablem`, uses the tablem injection pipeline. |

## Numbers / alignment check

| Item | Qty | Unit price | Total |
|:-|--:|--:|--:|
| Apples | 12 | 0.40 | 4.80 |
| Bananas | 3 | 1.20 | 3.60 |
| Kiwis | 2 | 2.50 | 5.00 |

# Width

## The number of - proportional to width

| Key | Description | % |
|-|--------|-|
| ID1  | This column will grow because the number of line in the - line above define are proportionnal to the width  |  100 |


## Mixed proportions (1 / 2 / 6 / 1)

| Key | Short | Description | % |
|-|--|------|-|
| ID1 | ok | This description column should be much wider than its siblings. It also contains enough text to wrap across multiple lines so we can verify that width stays proportional (and wrapping stays sane). | 100 |
| ID2 | ok | Another row to confirm the layout is stable across rows. | 50 |


## Alignment markers still work

| Left | Center | Right |
|:-|:---:|-:|
| a | b | c |
| long long long text | centered | 999 |


## Escaped pipes and code spans

| Key | Description | Notes |
|-|------|-|
| ID1 | Literal pipe: \| should not split the cell | inline `a|b|c` should not split |
| ID2 | Backticks: ``x|y`` should stay in one cell | ok |


## Empty cells

| Key | A | B | C |
|-|--|--|-|
| ID1 | 1 |  | 3 |
| ID2 |  | 2 |  |


## equal

| Key | Description | % |
|-|-|-|
| ID1  | This column will have the same width as it's sibling  |  100 |
| ID23 | same width |  100 |


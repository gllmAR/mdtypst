# Table styling (tablem)

This fixture forces the `cmarker + tablem` pipeline and uses a sidecar that
rebinds `tablem` with a custom renderer.

## Proportional widths (via separator row)

| Key | Description | % |
|-|--------|-|
| ID1 | The Description column should be much wider than Key/% and have comfortable padding. | 100 |
| ID2 | Another row to ensure zebra styling and borders remain consistent. | 12 |

## Many rows

| Name | Status | Notes |
|-|--|------|
| Alpha | ok | baseline |
| Beta | warn | this row contains more text so we can check wrapping inside tablem output |
| Gamma | fail | short |
| Delta | ok | ok |
| Epsilon | ok | ok |
| Zeta | ok | ok |
| Eta | ok | ok |

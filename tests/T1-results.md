# T1 results — picker smoke test

Run at: 2026-05-10T07:07:02.352Z
Pass: 8/9

## Scenarios

- **PASS** — S1 page loads with no console errors
- **PASS** — S2 trigger label = "Silver Maple"\n  - `got="Silver Maple"`
- **PASS** — S3 modal visible after trigger click\n  - `hidden=false`
- **PASS** — S4 14 genus tiles render with leaf+name+count\n  - `count=14 structOk=true badIdx=-1`
- **PASS** — S5 Maple tile click → species view (7 rows)\n  - `viewHidden=false title="Maples" rows=7`
- **PASS** — S6 norway_maple selection wires through\n  - `modalHidden=true hero="24″ Norway Maple" trigger="Norway Maple" h:66→57 c:30→22 fieldsChanged=true`
- **FAIL** — S7 Help-me-ID flow lands on a species\n  - `before="Silver Maple" chose="Eastern White Pine" labelAfter="Silver Maple" selValue="white_pine" selValid=true updated=false`
- **PASS** — S8 Norway Maple flag pill opens modal with token + description\n  - `modalHidden=false token="invasive" descLen=113`
- **PASS** — S9 heart persists across reload\n  - `stillActive=true`

## Console errors collected during run

_None._

## Page errors

_None._

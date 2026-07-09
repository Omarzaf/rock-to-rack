# M9 Simulation Report

Generated: 2026-07-08

## Verification Command

`corepack pnpm simulate`

## Profile Summary

| Profile | Total min | Completed | Catch-up chapters |
|---|---:|---|---|
| fast | 63.2 | yes | none |
| average | 84.0 | yes | none |
| slow | 86.6 | yes | Ch1, Ch2, Ch3, Ch4, Ch5, Ch6 |

## Chapter Summary

| Profile | Chapter | Duration min | Target min | Catch-up | End credits |
|---|---|---:|---:|---|---:|
| fast | Ch1 Mine | 8.4 | 10-12 | no | 75 |
| fast | Ch2 Refine | 9.2 | 11-13 | no | 0 |
| fast | Ch3 Grow and Slice | 10.0 | 12-14 | no | 0 |
| fast | Ch4 Fabricate | 11.5 | 14-16 | no | 0 |
| fast | Ch5 Package | 10.0 | 12-14 | no | 0 |
| fast | Ch6 Rack Up | 14.2 | 17-20 | no | 40 |
| average | Ch1 Mine | 11.3 | 10-12 | no | 75 |
| average | Ch2 Refine | 12.3 | 11-13 | no | 0 |
| average | Ch3 Grow and Slice | 13.3 | 12-14 | no | 0 |
| average | Ch4 Fabricate | 15.3 | 14-16 | no | 0 |
| average | Ch5 Package | 13.3 | 12-14 | no | 0 |
| average | Ch6 Rack Up | 18.8 | 17-20 | no | 40 |
| slow | Ch1 Mine | 11.7 | 10-12 | yes | 110 |
| slow | Ch2 Refine | 12.7 | 11-13 | yes | 153 |
| slow | Ch3 Grow and Slice | 13.7 | 12-14 | yes | 188 |
| slow | Ch4 Fabricate | 15.7 | 14-16 | yes | 223 |
| slow | Ch5 Package | 13.7 | 12-14 | yes | 258 |
| slow | Ch6 Rack Up | 19.2 | 17-20 | yes | 253 |

## Tuning Notes

- Catch-up threshold: 20 percent behind expected progress.
- Catch-up multiplier: 1.25x positive passive gains.
- Fast, average, and slow profiles land inside the M9 target window.
- `ch5.maxBuildChoices` is tuned to 6 so a full-run simulator can supply the chip roster required by all Chapter 6 contracts.

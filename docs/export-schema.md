# Export Schema

Ball In Play Logger exports one flat dataset in both CSV and JSON.

- CSV: a single table
- JSON: metadata plus `columns` and `rows`
- ZIP: one folder containing both the CSV and JSON exports

## Row Types

Each row is one entity:

- `task`
- `bip`
- `ruck`

All row types share the same columns.

## Column Order

1. `activity_id`
2. `activity_name`
3. `entity_type`
4. `task_id`
5. `task_name`
6. `bip_id`
7. `bip_name`
8. `ruck_id`
9. `ruck_count`
10. `start_time_unix_ms`
11. `end_time_unix_ms`
12. `start_time_seconds`
13. `end_time_seconds`
14. `ruck_time_unix_ms`
15. `ruck_start_time_unix_ms`
16. `ruck_end_time_unix_ms`
17. `ruck_time_seconds`
18. `ruck_start_time_seconds`
19. `ruck_end_time_seconds`
20. `duration_seconds`
21. `pre_dead_ball_seconds`
22. `post_dead_ball_seconds`

## Column Meaning

### Shared identity columns

- `activity_id`: unique session/activity identifier
- `activity_name`: exported activity/session label
- `entity_type`: `task`, `bip`, or `ruck`
- `task_id`: task identifier for the row
- `task_name`: task label
- `bip_id`: BIP identifier when applicable, otherwise blank
- `bip_name`: BIP label when applicable, otherwise blank
- `ruck_id`: ruck identifier when applicable, otherwise blank

### Count column

- `ruck_count`
  - on `task` rows: total rucks in that task
  - on `bip` rows: total rucks attached to that BIP
  - on `ruck` rows: blank

### Time columns

- `start_time_unix_ms`
- `end_time_unix_ms`
- `start_time_seconds`
- `end_time_seconds`

Interpretation by row type:

- `task`: task interval
- `bip`: BIP interval
- `ruck`: point event time repeated as start and end

### Ruck window columns

These are only populated on `ruck` rows:

- `ruck_time_unix_ms`
- `ruck_start_time_unix_ms`
- `ruck_end_time_unix_ms`
- `ruck_time_seconds`
- `ruck_start_time_seconds`
- `ruck_end_time_seconds`

Ruck windows are synthetic:

- `ruck_time_*`: the exact click moment
- `ruck_start_time_*`: 1.5 seconds before the click
- `ruck_end_time_*`: 1.5 seconds after the click

For second-based values, the start is clamped to `0.00` if needed.

### Derived analysis columns

- `duration_seconds`
  - task: task duration
  - bip: BIP duration
  - ruck: `0.00`

- `pre_dead_ball_seconds`
  - populated on `bip` rows only
  - first BIP in a task: `bip.start - task.start`
  - later BIPs: `bip.start - previous_bip.end`

- `post_dead_ball_seconds`
  - populated on `bip` rows only
  - non-final BIP: `next_bip.start - bip.end`
  - final BIP: `task.end - bip.end`

## JSON Shape

The JSON export uses:

```json
{
  "activity_id": "…",
  "activity_name": "…",
  "exported_at_unix_ms": 0,
  "exported_at_iso": "…",
  "columns": ["…"],
  "rows": [{ "...": "..." }]
}
```

## Compatibility Notes

- CSV and JSON are intentionally aligned to the same flat schema.
- Editor imports the exported CSV, JSON, or ZIP and rebuilds task/BIP/ruck structure from these rows.
- If this schema changes, update `README.md`, `CONTRIBUTING.md`, and this file together.

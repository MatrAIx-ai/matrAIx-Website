# matrAIx synthetic agents

A scaled-down sample of the **8.3 billion-agent** persona space that powers
matrAIx simulations. Each agent is drawn from the flat dimension schema in
[`dimensions.json`](../../dimensions.json) by assigning **one value per
dimension** — the same space explored on
[matraix.ai/person.html](https://matraix.ai/person.html).

This batch: **830 agents** (8.3B at 1 : 10,000,000), each across **1,162
dimensions**.

## Files

| File | What |
|------|------|
| `agent_0001.json` … `agent_0830.json` | One agent each — a flat `{dimension_id: value}` map plus a small header. |
| `index.json` | Manifest of all agents with their `seed`, `name`, and one-line summary. |
| `generate-personas.js` | The generator. |

## Agent shape

```json
{
  "id": "agent_0001",
  "seed": 1,
  "schemaVersion": "2.0",
  "dimensionCount": 1162,
  "name": "45–54 · Marketing",
  "line": "Manager-level individual in … based in North America. …",
  "dimensions": { "age_bracket": "45–54", "region": "North America", … }
}
```

## Regenerate

Deterministic — agent *N* always uses seed *N*, so re-running reproduces the
exact same files (idempotent). To grow the sample, pass a larger count:

```bash
node agent/personas/generate-personas.js 830     # default
node agent/personas/generate-personas.js 5000     # larger sample
```

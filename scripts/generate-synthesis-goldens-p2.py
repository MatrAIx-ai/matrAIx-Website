#!/usr/bin/env python
"""Phase-2 goldens: run the ORIGINAL PersonaForwardSampler / render.py on a
graph reconstructed from graph-core.v1.json + sampler-pack.v2.json, so Python and
the JS port see identical (precision-rounded) inputs.
Run with /data2/zonglin/MatrAIx/.venv/bin/python (needs numpy)."""
import argparse, hashlib, importlib.util, json, math, platform, sys
from decimal import Decimal, ROUND_HALF_UP, localcontext
from pathlib import Path

sys.dont_write_bytecode = True

WEBSITE_ROOT = Path(__file__).resolve().parents[1]


def load_module(path: Path, name: str):
    if not path.exists():
        sys.exit(f"missing {path}; checkout feature/synthesis-adjust-generate")
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    try:
        spec.loader.exec_module(mod)
    except Exception:
        sys.modules.pop(name, None)
        raise
    return mod


def reconstruct_graph(core: dict, pack: dict) -> dict:
    values = {n["id"]: n["values"] for n in core["nodes"]}

    def decode(code: int, parents: list[str]) -> dict:
        assn, c = {}, code
        for p in parents:
            k = len(values[p])
            assn[p] = values[p][c % k]
            c //= k
        return assn

    return {
        "nodes": [
            {"id": n["id"], "label": n["label"], "category": n["category"],
             "values": n["values"], "prior": n["prior"], "parents": n.get("parents", []),
             **({} if n.get("emit", True) else {"emit": False})}
            for n in core["nodes"]
        ],
        "directed_proposal_edges": [
            {"source": e["source"], "target": e["target"], "edge_weight": e["weight"],
             "cpd": {"type": "pairwise_conditional_matrix",
                     "source_values": values[e["source"]],
                     "target_values": values[e["target"]],
                     "P_target_given_source": e["matrix"]}}
            for e in pack["edges"]
        ],
        "proposal_view": {"topological_order": core["topologicalOrder"]},
        "full_cpts": [
            {"target": c["target"], "parents": c["parents"], "cpt_weight": c["weight"],
             "replace_pairwise_parent_edges": c["replace"],
             "rows": [{"parent_assignment": decode(code, c["parents"]),
                       "distribution": dict(zip(values[c["target"]], dist))}
                      for code, dist in c["rows"]]}
            for c in pack["cpts"]
        ],
        "conditional_masks": pack["masks"],
    }


def verify_raw_artifacts(source: dict, core: dict, pack: dict) -> str:
    """Independent full-row source→artifact gate; do not call JS builder code."""
    def normalize(xs):
        clean = [max(float(x), 0.0) if isinstance(x, (int, float)) and math.isfinite(x) else 0.0
                 for x in xs]
        max_mass = max([0.0, *clean])
        if max_mass == 0:
            return [1.0 / len(clean)] * len(clean)
        scaled = [x / max_mass for x in clean]
        # Python 3.12 sum() is compensated; the immutable builder uses the JS
        # left-to-right Array.reduce contract, so accumulate in the same order.
        total = 0.0
        for x in scaled:
            total += x
        if not math.isfinite(total) or total <= 0:
            raise SystemExit("artifact fidelity failure: non-finite normalized mass")
        return [x / total for x in scaled]

    def align(dist, values, source_values=None):
        if isinstance(dist, dict):
            return normalize([dist.get(v, 0.0) for v in values])
        raw = list(dist or [])
        if source_values is not None:
            by_name = dict(zip(source_values, raw))
            raw = [by_name.get(v, 0.0) for v in values]
        return normalize(raw)

    def sig(values, digits):
        def js_precision(x):
            value = Decimal.from_float(float(x))
            if value.is_zero():
                return 0.0
            quantum = Decimal(1).scaleb(value.adjusted() - digits + 1)
            with localcontext() as context:
                context.prec = max(34, digits + 8)
                rounded = value.quantize(quantum, rounding=ROUND_HALF_UP)
            return float(rounded)
        return [js_precision(x) for x in values]

    def same(actual, expected, label, atol=1e-12):
        if len(actual) != len(expected) or any(abs(a-b) > atol for a, b in zip(actual, expected)):
            raise SystemExit(f"artifact fidelity failure: {label}")

    source_nodes = {n["id"]: n for n in source["nodes"]}
    core_nodes = {n["id"]: n for n in core["nodes"]}
    if ([n["id"] for n in source["nodes"]] != [n["id"] for n in core["nodes"]] or
            source_nodes.keys() != core_nodes.keys()):
        raise SystemExit("artifact fidelity failure: node id set")
    expected_topo = source.get("proposal_view", {}).get("topological_order") or list(source_nodes)
    if core["topologicalOrder"] != expected_topo:
        raise SystemExit("artifact fidelity failure: topological order")
    for nid, raw in source_nodes.items():
        built = core_nodes[nid]
        for field, expected in [
            ("label", raw.get("label", nid)),
            ("category", raw.get("category", "Uncategorized")),
            ("description", raw.get("description", "")),
            ("values", raw.get("values", [])), ("parents", raw.get("parents", [])),
            ("emit", raw.get("emit", True)),
        ]:
            if built[field] != expected:
                raise SystemExit(f"artifact fidelity failure: {nid}.{field}")
        same(built["prior"], sig(align(raw.get("prior", {}), raw.get("values", [])), 9),
             f"{nid}.prior")

    source_edges = {(e["source"], e["target"]): e
                    for e in source.get("directed_proposal_edges", [])}
    pack_edges = {(e["source"], e["target"]): e for e in pack["edges"]}
    core_edges = {(e["source"], e["target"]): e for e in core["edges"]}
    if (len(source_edges) != len(source.get("directed_proposal_edges", [])) or
            source_edges.keys() != pack_edges.keys() or source_edges.keys() != core_edges.keys()):
        raise SystemExit("artifact fidelity failure: pairwise edge key set")
    pairwise_rows = 0
    for (s, t), raw in source_edges.items():
        cpd, built = raw["cpd"], pack_edges[(s, t)]
        core_edge = core_edges[(s, t)]
        if (built["weight"] != float(raw.get("edge_weight", 1)) or
                core_edge["weight"] != float(raw.get("edge_weight", 1)) or
                core_edge["relation"] != raw.get("relation", "")):
            raise SystemExit(f"artifact fidelity failure: edge metadata {s}->{t}")
        if cpd.get("type") != "pairwise_conditional_matrix":
            raise SystemExit(f"unexpected CPD type: {s}->{t}")
        rows = dict(zip(cpd.get("source_values", []), cpd.get("P_target_given_source", [])))
        fallback = align(source_nodes[t].get("prior", {}), source_nodes[t]["values"])
        expected = [sig(align(rows[sv], source_nodes[t]["values"], cpd.get("target_values")), 6)
                    if sv in rows else sig(fallback, 6)
                    for sv in source_nodes[s]["values"]]
        if len(built["matrix"]) != len(expected):
            raise SystemExit(f"row count: {s}->{t}")
        for i, row in enumerate(expected):
            same(built["matrix"][i], row, f"{s}->{t}[{i}]")
        pairwise_rows += len(expected)

    source_cpts = {c["target"]: c for c in source.get("full_cpts", [])}
    pack_cpts = {c["target"]: c for c in pack["cpts"]}
    if len(source_cpts) != len(source.get("full_cpts", [])) or source_cpts.keys() != pack_cpts.keys():
        raise SystemExit("artifact fidelity failure: CPT target set")
    cpt_rows = 0
    for target, raw in source_cpts.items():
        built, parents = pack_cpts[target], raw.get("parents", [])
        if (built["parents"] != parents or
                built["weight"] != float(raw.get("cpt_weight", 1)) or
                built["replace"] != bool(raw.get("replace_pairwise_parent_edges"))):
            raise SystemExit(f"artifact fidelity failure: CPT metadata {target}")
        multipliers, m = [], 1
        for parent in parents:
            multipliers.append(m)
            m *= len(source_nodes[parent]["values"])
        vtoi = {p: {v: i for i, v in enumerate(source_nodes[p]["values"])} for p in parents}
        expected = {}
        for row in raw.get("rows", []):
            try:
                code = sum(vtoi[p][row.get("parent_assignment", {})[p]] * multipliers[i]
                           for i, p in enumerate(parents))
            except KeyError:
                continue
            expected[code] = sig(align(row.get("distribution", {}), source_nodes[target]["values"]), 6)
        actual = dict(built["rows"])
        if len(built["rows"]) != len(expected) or actual.keys() != expected.keys():
            raise SystemExit(f"artifact fidelity failure: CPT codes {target}")
        for code, dist in expected.items():
            same(actual[code], dist, f"CPT {target}[{code}]")
        cpt_rows += len(expected)

    expected_masks = [m for m in source.get("conditional_masks", []) if m.get("target") in source_nodes]
    if pack["masks"] != expected_masks:
        raise SystemExit("artifact fidelity failure: conditional masks")
    if (pairwise_rows, cpt_rows, len(expected_masks)) != (52947, 17645, 524):
        raise SystemExit(f"unexpected structural counts: {(pairwise_rows, cpt_rows, len(expected_masks))}")
    canonical = json.dumps({"core": core, "pack": pack}, sort_keys=True,
                           separators=(",", ":")).encode()
    return hashlib.sha256(canonical).hexdigest()


def node_distribution(np, plan, assignment, *, include_cpts=True,
                      include_edges=True, include_masks=True):
    """Proposal distribution for one node given parent value indices.
    Mirrors one iteration of PersonaForwardSampler.sample_indices."""
    if plan.static_cdf is not None:
        cdf = plan.static_cdf.astype(np.float64)
        probs = np.diff(cdf, prepend=0.0)
        mass = probs.sum()
        if mass <= 0.0:  # zero static CDF follows inverse-CDF index-zero behavior
            out = np.zeros_like(probs)
            out[0] = 1.0
            return out.tolist()
        return (probs / mass).tolist()
    logits = plan.logprior[:, 0].astype(np.float64).copy()
    if include_cpts:
        for parents, multipliers, lut in plan.cpts:
            code = sum(assignment[p] * m for p, m in zip(parents, multipliers))
            logits += lut[:, code].astype(np.float64)
    if include_edges:
        for source, table in plan.edges:
            logits += table[:, assignment[source]].astype(np.float64)
    logits -= logits.max()
    probs = np.exp(logits)
    for conds, value_mult in (plan.masks if include_masks else []):
        if conds is None:
            probs = probs * value_mult[:, 0].astype(np.float64)
            continue
        if all(bool(lut[assignment[p]]) for p, lut in conds):
            probs = probs * value_mult[:, 0].astype(np.float64)
            if probs.sum() <= 0.0:
                probs = np.ones_like(probs)
    mass = probs.sum()
    if mass <= 0.0:  # unconditional zero mask -> Python zero CDF selects index 0
        out = np.zeros_like(probs)
        out[0] = 1.0
        return out.tolist()
    return (probs / mass).tolist()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--matraix-root", type=Path,
                    default=Path("/data2/zonglin/MatrAIx-worktrees/synthesis-4dfa4e066b7"))
    ap.add_argument("--full-dag", type=Path)
    args = ap.parse_args()
    args.full_dag = args.full_dag or args.matraix_root / "persona/synthesis/graph/full_dag.json"
    import numpy as np

    smod = load_module(args.matraix_root / "persona/synthesis/sampler/sampler.py", "psampler")
    rmod = load_module(args.matraix_root / "persona/synthesis/render.py", "prender")

    core = json.loads((WEBSITE_ROOT / "synthesis/data/graph-core.v1.json").read_text())
    pack = json.loads((WEBSITE_ROOT / "synthesis/data/sampler-pack.v2.json").read_text())
    if core.get("datasetId") != pack.get("datasetId"):
        raise SystemExit("core/pack datasetId mismatch")
    graph = reconstruct_graph(core, pack)
    fixtures = WEBSITE_ROOT / "tests/fixtures"

    # deterministic full assignment: node index i -> value index (i*7+3) % k
    assignment = {n["id"]: (i * 7 + 3) % max(len(n["values"]), 1)
                  for i, n in enumerate(core["nodes"])}

    def sampler_for(gamma_scale=1.0, edge_weights=None, node_priors=None, category_scales=None):
        overrides = smod.SamplerOverrides(
            edge_weight_factors={tuple(k.split("->")): v for k, v in (edge_weights or {}).items()},
            node_priors={k: tuple(v) for k, v in (node_priors or {}).items()},
            category_scales=dict(category_scales or {}),
            gamma_scale=gamma_scale)
        return smod.PersonaForwardSampler(
            "reconstructed.json", smod.SamplingConfig(seed=0), graph=graph, overrides=overrides)

    base = sampler_for()
    values = base.values
    base_plans = {p.nid: p for p in base._plan}
    evidence_nodes = [p.nid for p in base._plan if p.cpts or p.edges or p.masks]
    emit_topo = [nid for nid in core["topologicalOrder"]
                 if base.nodes[nid].get("emit", True) is not False]
    active_edges = sorted((source, p.nid) for p in base._plan for source, _ in p.edges)
    cpt_targets = sorted(p.nid for p in base._plan if p.cpts)
    mask_targets = sorted(p.nid for p in base._plan if p.masks)
    replace_targets = sorted(c["target"] for c in pack["cpts"] if c["replace"])
    if not active_edges or not cpt_targets or not mask_targets or not replace_targets:
        raise SystemExit("golden coverage requires active edge, CPT, mask and replace target")

    def dist(sampler, nid, assn=assignment):
        return node_distribution(np, {p.nid: p for p in sampler._plan}[nid], assn)

    def delta(a, b):
        return max(abs(x - y) for x, y in zip(a, b))

    # Direct source→artifact fidelity: this catches a bad builder even if the JS
    # and reconstructed-Python goldens agree with each other.
    source_graph = json.loads(args.full_dag.read_text())
    structure_sha256 = verify_raw_artifacts(source_graph, core, pack)
    source_sampler = smod.PersonaForwardSampler(
        str(args.full_dag), smod.SamplingConfig(seed=0), graph=source_graph)
    source_plans = {p.nid: p for p in source_sampler._plan}
    source_evidence = {p.nid for p in source_sampler._plan if p.cpts or p.edges or p.masks}
    rebuilt_evidence = set(evidence_nodes)
    if source_evidence != rebuilt_evidence:
        missing = sorted(source_evidence - rebuilt_evidence)
        extra = sorted(rebuilt_evidence - source_evidence)
        raise SystemExit(f"evidence target mismatch; missing={missing}, extra={extra}")
    fidelity_assignments = [
        assignment,
        {nid: 0 for nid in assignment},
        {nid: len(values[nid]) - 1 for nid in assignment},
    ]
    max_fidelity_drift = 0.0
    for fidelity_assignment in fidelity_assignments:
        for nid in evidence_nodes:
            if nid not in source_plans:
                raise SystemExit(f"fidelity failure: source plan missing {nid}")
            max_fidelity_drift = max(max_fidelity_drift,
                                     delta(node_distribution(np, source_plans[nid], fidelity_assignment),
                                           dist(base, nid, fidelity_assignment)))
    if max_fidelity_drift > 2e-5:
        raise SystemExit(f"source→artifact distribution drift {max_fidelity_drift} > 2e-5")

    # Select overrides by observed effect, never by pack position. This excludes
    # pairwise edges suppressed by replace_pairwise_parent_edges.
    edge_choice = None
    for source, target in active_edges:
        key = f"{source}->{target}"
        candidate = sampler_for(edge_weights={key: 3.0})
        if delta(dist(base, target), dist(candidate, target)) > 1e-6:
            edge_choice = (source, target, key)
            break
    if edge_choice is None:
        raise SystemExit("no effective edge override found")

    prior_choice = None
    for nid in evidence_nodes:
        uniform = [1.0 / len(values[nid])] * len(values[nid])
        candidate = sampler_for(node_priors={nid: uniform})
        if delta(dist(base, nid), dist(candidate, nid)) > 1e-6:
            prior_choice = (nid, uniform)
            break
    if prior_choice is None:
        raise SystemExit("no effective prior override found")

    pin_choice = None
    for source, target in active_edges:
        for value_index, value_name in enumerate(values[source]):
            if value_index == assignment[source]:
                continue
            pinned_assignment = {**assignment, source: value_index}
            if delta(dist(base, target), dist(base, target, pinned_assignment)) > 1e-6:
                pin_choice = (source, value_name, target)
                break
        if pin_choice:
            break
    if pin_choice is None:
        raise SystemExit("no effective downstream pin found")

    node_category = {n["id"]: n["category"] for n in core["nodes"]}
    category_choice = None
    for category in sorted(set(node_category.values())):
        candidate = sampler_for(category_scales={category: 0.5})
        changed = [nid for nid in evidence_nodes
                   if delta(dist(base, nid), dist(candidate, nid)) > 1e-6]
        if changed:
            category_choice = (category, changed[0])
            break
    if category_choice is None:
        raise SystemExit("no effective category override found")

    gamma_sampler = sampler_for(gamma_scale=2.0)
    gamma_changed = next((nid for nid in evidence_nodes
                          if delta(dist(base, nid), dist(gamma_sampler, nid)) > 1e-6), None)
    if gamma_changed is None:
        raise SystemExit("gamma scenario is a no-op")

    edge_source, edge_target, edge_key = edge_choice
    prior_nid, uniform_prior = prior_choice
    pin_source, pin_value, pin_target = pin_choice
    category, category_target = category_choice

    # Pick structural branches by observed execution, not lexicographic target.
    cpt_case = None
    for cpt in pack["cpts"]:
        target, plan = cpt["target"], base_plans.get(cpt["target"])
        if plan is None or not plan.cpts:
            continue
        for code, _ in cpt["rows"]:
            patch, rest = {}, code
            for parent in cpt["parents"]:
                patch[parent] = rest % len(values[parent])
                rest //= len(values[parent])
            assn = {**assignment, **patch}
            full = dist(base, target, assn)
            without = node_distribution(np, plan, assn, include_cpts=False)
            if delta(full, without) > 1e-6:
                cpt_case = {"kind": "cpt-active", "nodeId": target,
                            "assignmentPatch": patch, "dist": full}
                break
        if cpt_case:
            break
    if cpt_case is None:
        raise SystemExit("no observed active CPT row")

    mask_on_case = mask_off_case = None
    for plan in base._plan:
        for conds, _ in plan.masks:
            if not conds:
                continue
            on_patch, off_patch, can_off = {}, {}, False
            for parent, lut in conds:
                allowed = np.flatnonzero(lut).tolist()
                denied = np.flatnonzero(~lut).tolist()
                if not allowed:
                    break
                on_patch[parent] = allowed[0]
                off_patch[parent] = allowed[0]
                if denied and not can_off:
                    off_patch[parent] = denied[0]
                    can_off = True
            else:
                if not can_off:
                    continue
                on_assn, off_assn = {**assignment, **on_patch}, {**assignment, **off_patch}
                on_full = dist(base, plan.nid, on_assn)
                on_without = node_distribution(np, plan, on_assn, include_masks=False)
                off_full = dist(base, plan.nid, off_assn)
                off_without = node_distribution(np, plan, off_assn, include_masks=False)
                if delta(on_full, on_without) > 1e-6 and delta(off_full, off_without) < 1e-10:
                    mask_on_case = {"kind": "mask-on", "nodeId": plan.nid,
                                    "assignmentPatch": on_patch, "dist": on_full}
                    mask_off_case = {"kind": "mask-off", "nodeId": plan.nid,
                                     "assignmentPatch": off_patch, "dist": off_full}
                    break
        if mask_on_case:
            break
    if mask_on_case is None:
        raise SystemExit("no observed mask on/off branch")

    replace_case = None
    pack_edge_keys = {(e["source"], e["target"]) for e in pack["edges"]}
    for cpt in pack["cpts"]:
        if not cpt["replace"]:
            continue
        for source in cpt["parents"]:
            if (source, cpt["target"]) not in pack_edge_keys:
                continue
            plan = base_plans[cpt["target"]]
            if source in {s for s, _ in plan.edges}:
                continue
            key = f"{source}->{cpt['target']}"
            overridden = sampler_for(edge_weights={key: 3.0})
            default_dist, override_dist = dist(base, cpt["target"]), dist(overridden, cpt["target"])
            if delta(default_dist, override_dist) < 1e-12:
                replace_case = {"kind": "replace-suppressed", "nodeId": cpt["target"],
                                "edgeKey": key, "assignmentPatch": {},
                                "dist": default_dist}
                break
        if replace_case:
            break
    if replace_case is None:
        raise SystemExit("no overlapping replace-suppressed edge found")

    structural_cases = [cpt_case, mask_on_case, mask_off_case, replace_case]
    structural = {edge_target, prior_nid, pin_target,
                  cpt_case["nodeId"], mask_on_case["nodeId"], replace_case["nodeId"]}
    scenarios = [
        {"name": "default", "gammaScale": 1.0, "pins": {}, "overrides": {},
         "effectNodes": []},
        {"name": "gamma2", "gammaScale": 2.0, "pins": {}, "overrides": {},
         "effectNodes": [gamma_changed]},
        {"name": "pins", "gammaScale": 1.0, "pins": {pin_source: pin_value}, "overrides": {},
         "effectNodes": [pin_target]},
        {"name": "edge_boost", "gammaScale": 1.0, "pins": {},
         "overrides": {"edgeWeights": {edge_key: 3.0}}, "effectNodes": [edge_target]},
        {"name": "uniform_prior", "gammaScale": 1.0, "pins": {},
         "overrides": {"nodePriors": {prior_nid: uniform_prior}}, "effectNodes": [prior_nid]},
        {"name": "category_damp", "gammaScale": 1.0, "pins": {},
         "overrides": {"categoryScales": {category: 0.5}}, "effectNodes": [category_target]},
    ]

    common_probes = structural | {gamma_changed, category_target}
    default_probe = {nid: dist(base, nid) for nid in common_probes}
    probes_out = []
    for sc in scenarios:
        ov = sc["overrides"]
        sampler = sampler_for(sc["gammaScale"], ov.get("edgeWeights"),
                              ov.get("nodePriors"), ov.get("categoryScales"))
        sc_assignment = dict(assignment)
        sc_assignment.update({nid: values[nid].index(value) for nid, value in sc["pins"].items()})
        probe_ids = sorted(common_probes | set(sc["effectNodes"]))
        probes = [{"nodeId": nid, "dist": dist(sampler, nid, sc_assignment)} for nid in probe_ids]
        if sc["name"] != "default" and not any(
                delta(default_probe[nid],
                      next(p["dist"] for p in probes if p["nodeId"] == nid)) > 1e-6
                for nid in sc["effectNodes"]):
            raise SystemExit(f"scenario {sc['name']} did not change its effect probe")
        probes_out.append({**sc, "probes": probes})
    metadata = {
        "sourceCommit": "4dfa4e066b706c6a2d33a10fd41b976efd3f524e",
        "datasetId": core["datasetId"], "python": platform.python_version(),
        "numpy": np.__version__, "maxSourceArtifactDrift": max_fidelity_drift,
        "artifactStructureSha256": structure_sha256,
        "dimensionsSha256": hashlib.sha256(
            (WEBSITE_ROOT / "data" / "dimensions.json").read_bytes()
        ).hexdigest(),
    }
    (fixtures / "sampler-probes.golden.json").write_text(
        json.dumps({"metadata": metadata, "assignment": assignment,
                    "structuralCases": structural_cases, "scenarios": probes_out}))

    batch_size, seeds = 200, list(range(1200, 1225))
    marginal_ids = sorted(structural | {gamma_changed, category_target, emit_topo[0], pin_source})
    marg_out = []
    for sc in scenarios:
        ov = sc["overrides"]
        sampler = sampler_for(sc["gammaScale"], ov.get("edgeWeights"),
                              ov.get("nodePriors"), ov.get("categoryScales"))
        pin_idx = {nid: values[nid].index(v) for nid, v in sc["pins"].items()}
        counts = {nid: np.zeros(len(values[nid]), dtype=np.int64) for nid in marginal_ids}
        for seed in seeds:
            idx = sampler.sample_indices(batch_size, pins=pin_idx,
                                         rng=np.random.default_rng(seed))
            for nid in marginal_ids:
                counts[nid] += np.bincount(idx[nid], minlength=len(values[nid]))
        total = batch_size * len(seeds)
        marginals = {nid: {"label": sampler.nodes[nid].get("label", nid),
                           "values": list(values[nid]),
                           "freqs": (counts[nid] / total).tolist()}
                     for nid in marginal_ids}
        marg_out.append({**sc, "marginals": marginals})
    (fixtures / "sampler-marginals.golden.json").write_text(json.dumps({
        "metadata": metadata, "n": batch_size * len(seeds), "batchSize": batch_size,
        "seeds": seeds, "scenarios": marg_out}))

    idx = base.sample_indices(5, rng=np.random.default_rng(7))
    dims = rmod.load_dims(WEBSITE_ROOT / "data" / "dimensions.json")
    renders = []
    for i in range(5):
        row = base.decode_row(idx, i)
        renders.append({"attributes": row, "text": rmod.render(row, dims)})
    (fixtures / "render.golden.json").write_text(json.dumps(renders))
    print("structural probes:", sorted(structural))
    print("max source→artifact drift:", max_fidelity_drift)
    print("scenarios:", [s["name"] for s in scenarios])


if __name__ == "__main__":
    main()

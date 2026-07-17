#!/usr/bin/env python3
"""Generate Phase-1 golden fixtures by running the ORIGINAL (stdlib-only)
PersonaSynthesisService against a graph reconstructed from graph-core.v1.json.
Both Python and JS therefore see byte-identical inputs."""
import argparse, importlib.util, json, sys, tempfile
from pathlib import Path

sys.dont_write_bytecode = True

def load_service(matraix_root: Path):
    path = matraix_root / "application/playground/backend/service/persona_synthesis_service.py"
    if not path.exists():
        sys.exit(f"service not found: {path}\n"
                 "checkout branch feature/synthesis-adjust-generate in the MatrAIx repo")
    spec = importlib.util.spec_from_file_location("psvc", path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    try:
        spec.loader.exec_module(mod)
    except Exception:
        sys.modules.pop(spec.name, None)
        raise
    return mod

def reconstruct_graph(core: dict) -> dict:
    return {
        "nodes": [
            {"id": n["id"], "label": n["label"], "category": n["category"],
             "description": n.get("description", ""), "values": n["values"],
             "prior": n["prior"], "parents": n.get("parents", []),
             **({} if n.get("emit", True) else {"emit": False})}
            for n in core["nodes"]
        ],
        "directed_proposal_edges": [
            {"source": e["source"], "target": e["target"],
             "edge_weight": e["weight"], "relation": e.get("relation", "")}
            for e in core["edges"]
        ],
        "proposal_view": {"topological_order": core["topologicalOrder"]},
    }

def pick_probes(core: dict, overview: dict) -> list[str]:
    """Deterministic, structurally diverse probe nodes."""
    order = core["topologicalOrder"]
    degree = {}
    for e in core["edges"]:
        degree[e["source"]] = degree.get(e["source"], 0) + 1
        degree[e["target"]] = degree.get(e["target"], 0) + 1
    probes = [order[0], order[len(order) // 2], order[-1],
              max(degree, key=lambda k: (degree[k], k))]
    helpers = [n["id"] for n in core["nodes"] if n.get("emit", True) is False]
    if helpers:
        probes.append(helpers[0])
    return sorted(set(probes))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--matraix-root", type=Path,
                    default=Path("/data2/zonglin/MatrAIx-worktrees/synthesis-4dfa4e066b7"))
    ap.add_argument("--full-dag", type=Path)
    ap.add_argument("--core", type=Path, default=Path("synthesis/data/graph-core.v1.json"))
    ap.add_argument("--out", type=Path, default=Path("tests/fixtures"))
    args = ap.parse_args()
    args.full_dag = args.full_dag or args.matraix_root / "persona/synthesis/graph/full_dag.json"

    mod = load_service(args.matraix_root)
    core = json.loads(args.core.read_text())
    graph = reconstruct_graph(core)
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
        json.dump(graph, f)
        graph_path = Path(f.name)
    try:
        svc = mod.PersonaSynthesisService(graph_path)
        source_svc = mod.PersonaSynthesisService(args.full_dag)

        overview = svc.overview()
        if overview != source_svc.overview():
            raise SystemExit("graph-core fidelity failure: reconstructed overview differs from full_dag")

        probes = pick_probes(core, overview)
        subgraphs = [
            {"nodeId": nid, "up": up, "down": down,
             "result": svc.subgraph(nid, up=up, down=down)}
            for nid in probes for (up, down) in [(1, 1), (2, 2)]
        ]
        for case in subgraphs:
            source = source_svc.subgraph(case["nodeId"], up=case["up"], down=case["down"])
            if case["result"] != source:
                raise SystemExit(f"graph-core fidelity failure: subgraph {case['nodeId']}")
        details = [{"nodeId": nid, "result": svc.node_detail(nid)} for nid in probes]
        for case in details:
            if case["result"] != source_svc.node_detail(case["nodeId"]):
                raise SystemExit(f"graph-core fidelity failure: detail {case['nodeId']}")
    finally:
        graph_path.unlink(missing_ok=True)

    (args.out / "overview.golden.json").write_text(json.dumps(overview))
    (args.out / "subgraphs.golden.json").write_text(json.dumps(subgraphs))
    (args.out / "node-details.golden.json").write_text(json.dumps(details))
    print(f"probes: {probes}")

if __name__ == "__main__":
    main()

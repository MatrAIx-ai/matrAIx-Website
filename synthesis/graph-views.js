// Ports of PersonaSynthesisService view methods (persona_synthesis_service.py).
import { roundPy, cmpStr } from "./dist-utils.js";

export const MAX_SUBGRAPH_NODES_PER_DIRECTION = 60;
export const MAX_DETAIL_EDGES = 20;

export const categoryOf = (node) => node.category || "Uncategorized";
export const isAttribute = (node) => node.emit !== false;

export function buildOverview(store) {
  const byCategory = new Map();
  for (const node of store.nodesById.values()) {
    const cat = categoryOf(node);
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push(node);
  }

  const crossEdges = new Map();
  const internalCounts = new Map();
  for (const [nodeId, edges] of store.outEdges) {
    const sourceCat = categoryOf(store.nodesById.get(nodeId));
    for (const edge of edges) {
      const targetCat = categoryOf(store.nodesById.get(edge.target));
      const weight = Number(edge.weight ?? 1);
      if (sourceCat === targetCat) {
        internalCounts.set(sourceCat, (internalCounts.get(sourceCat) ?? 0) + 1);
        continue;
      }
      let byTarget = crossEdges.get(sourceCat);
      if (!byTarget) {
        byTarget = new Map();
        crossEdges.set(sourceCat, byTarget);
      }
      let agg = byTarget.get(targetCat);
      if (!agg) {
        agg = { source: sourceCat, target: targetCat, count: 0, weightSum: 0 };
        byTarget.set(targetCat, agg);
      }
      agg.count += 1;
      agg.weightSum += weight;
    }
  }

  const categories = [];
  for (const [name, catNodes] of byCategory) {
    const topoPositions = catNodes.map((n) => store.topo(n.id));
    const avgTopo = topoPositions.length
      ? topoPositions.reduce((a, b) => a + b, 0) / topoPositions.length : 0;
    const attributes = catNodes
      .filter(isAttribute)
      .sort((a, b) => store.topo(a.id) - store.topo(b.id) || cmpStr(a.id, b.id));
    categories.push({
      name,
      nodeCount: catNodes.length,
      attributeCount: attributes.length,
      helperCount: catNodes.length - attributes.length,
      avgTopo: roundPy(avgTopo, 2),
      internalEdgeCount: internalCounts.get(name) ?? 0,
      attributes: attributes.map((n) => ({
        id: n.id,
        label: n.label ?? n.id,
        valuesCount: (n.values ?? []).length,
        degree: store.inEdges.get(n.id).length + store.outEdges.get(n.id).length,
      })),
    });
  }
  categories.sort((a, b) => a.avgTopo - b.avgTopo || cmpStr(a.name, b.name));

  const attributeTotal = categories.reduce((sum, c) => sum + c.attributeCount, 0);
  const edges = [...crossEdges.values()].flatMap((byTarget) => [...byTarget.values()])
    .map((agg) => ({ ...agg, weightSum: roundPy(agg.weightSum, 4) }))
    .sort((a, b) => b.count - a.count || cmpStr(a.source, b.source) || cmpStr(a.target, b.target));

  return {
    categories,
    edges,
    counts: {
      graphNodes: store.nodesById.size,
      attributes: attributeTotal,
      helpers: store.nodesById.size - attributeTotal,
      directedEdges: store.edgeCount,
      categories: categories.length,
    },
  };
}

export class UnknownNodeError extends Error {
  constructor(nodeId) { super(`unknown node: ${nodeId}`); this.nodeId = nodeId; }
}

// Port of PersonaSynthesisService._walk: BFS hop distances, closest-first, capped.
function walk(store, start, { downstream, maxHops }) {
  const adjacency = downstream ? store.outEdges : store.inEdges;
  const key = downstream ? "target" : "source";
  const distances = new Map();
  const queue = [[start, 0]];
  const seen = new Set([start]);
  for (let qi = 0; qi < queue.length; qi++) {
    const [nodeId, hops] = queue[qi];
    if (hops >= maxHops) continue;
    for (const edge of adjacency.get(nodeId)) {
      const neighbor = edge[key];
      if (seen.has(neighbor)) continue;
      if (distances.size >= MAX_SUBGRAPH_NODES_PER_DIRECTION) {
        return { distances, truncated: true };
      }
      seen.add(neighbor);
      distances.set(neighbor, hops + 1);
      queue.push([neighbor, hops + 1]);
    }
  }
  return { distances, truncated: false };
}

// Port of _topological_layers: Kahn ranks by longest predecessor path,
// centered at zero; ready/successor order = (global topo, id).
function topologicalLayers(store, included, center) {
  const byTopoId = (a, b) => store.topo(a) - store.topo(b) || cmpStr(a, b);
  const successors = new Map();
  const inDegree = new Map();
  for (const id of included) { successors.set(id, new Set()); inDegree.set(id, 0); }
  for (const source of included) {
    for (const edge of store.outEdges.get(source)) {
      const target = edge.target;
      if (!included.has(target) || successors.get(source).has(target)) continue;
      successors.get(source).add(target);
      inDegree.set(target, inDegree.get(target) + 1);
    }
  }
  const ready = [...included].filter((id) => inDegree.get(id) === 0).sort(byTopoId);
  const ranks = new Map([...included].map((id) => [id, 0]));
  let processed = 0;
  while (ready.length) {
    const source = ready.shift();
    processed += 1;
    for (const target of [...successors.get(source)].sort(byTopoId)) {
      ranks.set(target, Math.max(ranks.get(target), ranks.get(source) + 1));
      inDegree.set(target, inDegree.get(target) - 1);
      if (inDegree.get(target) === 0) {
        ready.push(target);
        ready.sort(byTopoId);
      }
    }
  }
  if (processed !== included.size) {
    throw new Error(`induced subgraph around ${center} contains a cycle`);
  }
  const centerRank = ranks.get(center);
  const layers = new Map();
  for (const [id, rank] of ranks) layers.set(id, rank - centerRank);
  return layers;
}

export function subgraph(store, nodeId, { up = 1, down = 1 } = {}) {
  if (!store.nodesById.has(nodeId)) throw new UnknownNodeError(nodeId);
  const upWalk = walk(store, nodeId, { downstream: false, maxHops: up });
  const downWalk = walk(store, nodeId, { downstream: true, maxHops: down });
  const included = new Set([nodeId, ...upWalk.distances.keys(), ...downWalk.distances.keys()]);
  const layerById = topologicalLayers(store, included, nodeId);
  const nodes = [...included]
    .sort((a, b) => layerById.get(a) - layerById.get(b) || store.topo(a) - store.topo(b) || cmpStr(a, b))
    .map((nid) => {
      const node = store.nodesById.get(nid);
      return {
        id: nid,
        label: node.label ?? nid,
        category: categoryOf(node),
        layer: layerById.get(nid),
        valuesCount: (node.values ?? []).length,
        emit: isAttribute(node),
        inDegree: store.inEdges.get(nid).length,
        outDegree: store.outEdges.get(nid).length,
      };
    });
  const edges = [];
  for (const nid of included) {
    for (const edge of store.outEdges.get(nid)) {
      if (included.has(edge.target)) {
        edges.push({
          source: nid,
          target: edge.target,
          weight: roundPy(Number(edge.weight ?? 1), 4),
          relation: edge.relation ?? "",
        });
      }
    }
  }
  edges.sort((a, b) => cmpStr(a.source, b.source) || cmpStr(a.target, b.target));
  return {
    center: nodeId, up, down,
    truncated: upWalk.truncated || downWalk.truncated,
    nodes, edges,
  };
}

export function nodeDetail(store, nodeId) {
  const node = store.nodesById.get(nodeId);
  if (!node) throw new UnknownNodeError(nodeId);
  const edgeView = (edge, otherKey) => {
    const other = store.nodesById.get(edge[otherKey]);
    return {
      id: other.id,
      label: other.label ?? other.id,
      relation: edge.relation ?? "",
      weight: roundPy(Number(edge.weight ?? 1), 4),
    };
  };
  const byWeightDesc = (a, b) => Number(b.weight ?? 1) - Number(a.weight ?? 1);
  const inEdges = [...store.inEdges.get(nodeId)].sort(byWeightDesc);
  const outEdges = [...store.outEdges.get(nodeId)].sort(byWeightDesc);
  return {
    id: nodeId,
    label: node.label ?? nodeId,
    category: categoryOf(node),
    description: node.description ?? "",
    type: isAttribute(node) ? "attribute" : "latent/helper",
    values: [...(node.values ?? [])],
    prior: (node.prior ?? []).map((p) => roundPy(Number(p), 4)),
    parents: [...(node.parents ?? [])],
    inDegree: store.inEdges.get(nodeId).length,
    outDegree: store.outEdges.get(nodeId).length,
    inEdges: inEdges.slice(0, MAX_DETAIL_EDGES).map((e) => edgeView(e, "source")),
    outEdges: outEdges.slice(0, MAX_DETAIL_EDGES).map((e) => edgeView(e, "target")),
  };
}

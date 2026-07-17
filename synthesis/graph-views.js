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

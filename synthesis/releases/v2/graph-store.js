// Port of PersonaSynthesisService._ensure_loaded (index building only).
export function createGraphStore(core) {
  const nodesById = new Map();
  for (const node of core.nodes) nodesById.set(node.id, node);
  const outEdges = new Map(core.nodes.map((n) => [n.id, []]));
  const inEdges = new Map(core.nodes.map((n) => [n.id, []]));
  let edgeCount = 0;
  for (const edge of core.edges) {
    if (nodesById.has(edge.source) && nodesById.has(edge.target)) {
      outEdges.get(edge.source).push(edge);
      inEdges.get(edge.target).push(edge);
      edgeCount += 1;
    }
  }
  const topoIndex = new Map(core.topologicalOrder.map((id, i) => [id, i]));
  const topo = (id) => (topoIndex.has(id) ? topoIndex.get(id) : topoIndex.size);
  return { core, nodesById, outEdges, inEdges, topoIndex, topo, edgeCount };
}

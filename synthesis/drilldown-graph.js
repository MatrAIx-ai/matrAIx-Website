import { subgraph } from "./graph-views.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const NODE_W = 148;
const NODE_H = 34;
const COL_GAP = 90;
const ROW_GAP = 12;
const PAD = 24;
const CLICK_DELAY_MS = 240;

const svgElement = (tag, attrs = {}) => {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  return node;
};

const withText = (node, text) => {
  node.textContent = text;
  return node;
};

const countLabel = (count, singular) => `${count} ${singular}${count === 1 ? "" : "s"}`;

export function createDrilldownRenderer({
  svg,
  emptyEl,
  truncatedEl,
  onSelectNode,
  onCenterNode,
}) {
  const scrollContainer = svg.parentElement;
  let pendingClickTimer = null;
  let pendingScrollFrame = null;
  let centerPosition = null;
  let lastLayoutKey = null;
  let destroyed = false;

  const cancelClick = () => {
    if (pendingClickTimer === null) return;
    clearTimeout(pendingClickTimer);
    pendingClickTimer = null;
  };

  const cancelScroll = () => {
    if (pendingScrollFrame === null) return;
    cancelAnimationFrame(pendingScrollFrame);
    pendingScrollFrame = null;
  };

  const scheduleCenterScroll = () => {
    if (destroyed || !scrollContainer || !centerPosition || pendingScrollFrame !== null) return;
    pendingScrollFrame = requestAnimationFrame(() => {
      pendingScrollFrame = null;
      if (destroyed || !centerPosition) return;
      scrollContainer.scrollTo({
        left: Math.max(0, centerPosition.x + NODE_W / 2 - scrollContainer.clientWidth / 2),
        top: Math.max(0, centerPosition.y + NODE_H / 2 - scrollContainer.clientHeight / 2),
      });
    });
  };

  const resizeObserver = typeof ResizeObserver === "function" && scrollContainer
    ? new ResizeObserver(() => scheduleCenterScroll())
    : null;
  resizeObserver?.observe(scrollContainer);

  const restoreFocus = (focusKey) => {
    if (!focusKey) return;
    const target = [...svg.querySelectorAll("[data-focus-key]")]
      .find((node) => node.dataset.focusKey === focusKey);
    (target ?? document.getElementById("drilldownTitle"))?.focus({ preventScroll: true });
  };

  const clearCanvas = (focusKey) => {
    cancelClick();
    cancelScroll();
    centerPosition = null;
    lastLayoutKey = null;
    svg.replaceChildren();
    for (const name of ["viewBox", "width", "height"]) svg.removeAttribute(name);
    svg.style.width = "";
    svg.style.height = "";
    svg.toggleAttribute("hidden", true);
    svg.hidden = true;
    emptyEl.hidden = false;
    truncatedEl.hidden = true;
    restoreFocus(focusKey);
  };

  function render(state) {
    if (destroyed) return;
    cancelClick();
    const previousFocus = svg.contains(document.activeElement)
      ? document.activeElement?.dataset?.focusKey ?? null
      : null;
    if (!state.store || !state.centerNode) {
      clearCanvas(previousFocus);
      return;
    }

    const view = subgraph(state.store, state.centerNode, { up: state.up, down: state.down });
    const layers = [...new Set(view.nodes.map((node) => node.layer))].sort((a, b) => a - b);
    const colOf = new Map(layers.map((layer, index) => [layer, index]));
    const rowsUsed = new Map();
    const positions = new Map();
    const nodesById = new Map(view.nodes.map((node) => [node.id, node]));

    for (const node of view.nodes) {
      const col = colOf.get(node.layer);
      const row = rowsUsed.get(col) ?? 0;
      rowsUsed.set(col, row + 1);
      positions.set(node.id, {
        x: PAD + col * (NODE_W + COL_GAP),
        y: PAD + row * (NODE_H + ROW_GAP),
      });
    }

    const width = PAD * 2 + layers.length * (NODE_W + COL_GAP) - COL_GAP;
    const height = PAD * 2 + Math.max(...rowsUsed.values()) * (NODE_H + ROW_GAP) - ROW_GAP;
    const physicalWidth = Math.max(width, 300);
    const physicalHeight = Math.max(height, 120);
    svg.setAttribute("viewBox", `0 0 ${physicalWidth} ${physicalHeight}`);
    svg.setAttribute("width", physicalWidth);
    svg.setAttribute("height", physicalHeight);
    svg.style.width = `${physicalWidth}px`;
    svg.style.height = `${physicalHeight}px`;
    svg.toggleAttribute("hidden", false);
    svg.hidden = false;
    emptyEl.hidden = true;
    truncatedEl.textContent = "truncated to 60/direction";
    truncatedEl.setAttribute("role", "status");
    truncatedEl.setAttribute("aria-live", "polite");
    truncatedEl.hidden = !view.truncated;
    svg.replaceChildren();

    svg.append(
      withText(svgElement("title"), `Drill-down around ${nodesById.get(view.center)?.label ?? view.center}`),
      withText(svgElement("desc"),
        "Click a node to select it for detail. Double-click, or press Shift+Enter, to recenter the graph."),
    );

    const defs = svgElement("defs");
    const marker = svgElement("marker", {
      id: "syn-drilldown-arrow",
      viewBox: "0 0 8 8",
      refX: "7",
      refY: "4",
      markerWidth: "7",
      markerHeight: "7",
      orient: "auto",
      markerUnits: "strokeWidth",
    });
    marker.append(svgElement("path", { class: "syn-edge-arrow", d: "M 0 0 L 8 4 L 0 8 Z" }));
    defs.append(marker);
    svg.append(defs);

    const maxWeight = Math.max(...view.edges.map((edge) => edge.weight), 1);
    for (const edge of view.edges) {
      const sourceNode = nodesById.get(edge.source);
      const targetNode = nodesById.get(edge.target);
      if (!sourceNode || !targetNode || sourceNode.layer >= targetNode.layer) {
        throw new Error(`drilldown edge must advance layers: ${edge.source} -> ${edge.target}`);
      }
      const source = positions.get(edge.source);
      const target = positions.get(edge.target);
      const x1 = source.x + NODE_W;
      const y1 = source.y + NODE_H / 2;
      const x2 = target.x;
      const y2 = target.y + NODE_H / 2;
      const dx = Math.max((x2 - x1) / 2, 30);
      const path = svgElement("path", {
        class: "syn-edge",
        d: `M ${x1} ${y1} C ${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`,
        "stroke-width": (0.5 + 2 * (edge.weight / maxWeight)).toFixed(2),
        "marker-end": "url(#syn-drilldown-arrow)",
        "data-source-layer": sourceNode.layer,
        "data-target-layer": targetNode.layer,
      });
      const relation = edge.relation ? ` · ${edge.relation}` : "";
      path.append(withText(svgElement("title"),
        `${sourceNode.label} → ${targetNode.label} · w=${edge.weight}${relation}`));
      svg.append(path);
    }

    for (const node of view.nodes) {
      const { x, y } = positions.get(node.id);
      const isCenter = node.id === view.center;
      const isSelected = node.id === state.selectedNode;
      const classes = [
        "syn-dd-node",
        isCenter ? "center" : "",
        isSelected ? "selected" : "",
        node.emit ? "" : "helper",
      ].filter(Boolean).join(" ");
      const facts = [
        node.label,
        node.category,
        countLabel(node.valuesCount, "value"),
        `in ${node.inDegree}`,
        `out ${node.outDegree}`,
        `layer ${node.layer}`,
        node.emit ? "attribute" : "latent/helper",
        isCenter ? "current center" : "not current center",
        "click or press Enter or Space to select",
        "double-click or press Shift+Enter to recenter",
      ];
      const group = svgElement("g", {
        class: classes,
        transform: `translate(${x} ${y})`,
        role: "button",
        tabindex: "0",
        "aria-label": facts.join("; "),
        "aria-pressed": String(isSelected),
        "data-focus-key": `node:${node.id}`,
      });
      if (isCenter) group.setAttribute("aria-current", "true");

      const mark = svgElement("rect", {
        class: "syn-dd-mark",
        width: NODE_W,
        height: NODE_H,
        rx: "5",
      });
      if (!node.emit) mark.setAttribute("stroke-dasharray", "3 3");
      const hit = svgElement("rect", {
        class: "syn-dd-hit",
        x: "0",
        y: String((NODE_H - 44) / 2),
        width: NODE_W,
        height: "44",
        style: "fill: transparent; stroke: transparent; pointer-events: all",
      });
      const label = withText(svgElement("text", { x: "8", y: "14" }),
        node.label.length > 24 ? `${node.label.slice(0, 23)}…` : node.label);
      const meta = withText(svgElement("text", { x: "8", y: "27", "fill-opacity": "0.64" }),
        `${node.category.length > 18 ? `${node.category.slice(0, 17)}…` : node.category} · L${node.layer}`);
      const fullTitle = [
        node.label,
        `${node.category} · ${countLabel(node.valuesCount, "value")}`,
        `in ${node.inDegree} / out ${node.outDegree} · layer ${node.layer}`,
        node.emit ? "attribute" : "latent/helper",
        isCenter ? "current center" : "not current center",
        "Double-click or Shift+Enter to recenter.",
      ].join("\n");
      group.append(mark, label, meta, hit, withText(svgElement("title"), fullTitle));

      group.addEventListener("click", (event) => {
        cancelClick();
        if (event.detail > 1) return;
        pendingClickTimer = setTimeout(() => {
          pendingClickTimer = null;
          onSelectNode(node.id);
        }, CLICK_DELAY_MS);
      });
      group.addEventListener("dblclick", () => {
        cancelClick();
        onCenterNode(node.id);
      });
      group.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && event.shiftKey) {
          event.preventDefault();
          cancelClick();
          onCenterNode(node.id);
          return;
        }
        if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
          event.preventDefault();
          cancelClick();
          onSelectNode(node.id);
        }
      });
      svg.append(group);
    }

    centerPosition = positions.get(view.center) ?? null;
    const layoutKey = `${view.center}|${view.up}|${view.down}`;
    if (layoutKey !== lastLayoutKey) scheduleCenterScroll();
    lastLayoutKey = layoutKey;
    restoreFocus(previousFocus);
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    resizeObserver?.disconnect();
    cancelClick();
    cancelScroll();
  }

  return { render, destroy };
}

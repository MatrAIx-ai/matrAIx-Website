const SVG_NS = "http://www.w3.org/2000/svg";
const MAX_VISIBLE_EDGES = 80;
const MAX_VISIBLE_LABEL_CHARS = 22;
const MIN_VISIBLE_LABEL_CHARS = 4;
const MIN_HIT_RADIUS = 20;
const ARROW_ID = "syn-overview-arrow";

function svgElement(tag, attributes = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) {
    node.setAttribute(name, value);
  }
  return node;
}

function focusedKey(root) {
  return root.contains(document.activeElement)
    ? document.activeElement?.dataset?.focusKey ?? null
    : null;
}

function restoreFocus(root, key) {
  if (!key) return;
  const target = [...root.querySelectorAll("[data-focus-key]")]
    .find((node) => node.dataset.focusKey === key);
  (target ?? document.getElementById("overviewTitle"))?.focus({ preventScroll: true });
}

function measuredDimension(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.max(1, Math.round(number)) : 1;
}

function layoutCategories(categories, width, height) {
  if (!categories.length) {
    return { positions: new Map(), cellWidth: width, cellHeight: height };
  }
  const columns = Math.min(
    categories.length,
    Math.max(1, Math.ceil(Math.sqrt(categories.length * (width / height)))),
  );
  const rows = Math.max(1, Math.ceil(categories.length / columns));
  const cellWidth = width / columns;
  const cellHeight = height / rows;
  const positions = new Map();

  categories.forEach((category, index) => {
    const row = Math.floor(index / columns);
    const rawColumn = index % columns;
    const column = row % 2 === 0 ? rawColumn : columns - 1 - rawColumn;
    positions.set(category.name, {
      x: cellWidth * (column + 0.5),
      y: cellHeight * (row + 0.5),
    });
  });

  return { positions, cellWidth, cellHeight };
}

function visibleLabel(name, cellWidth) {
  const measuredCap = Math.floor((cellWidth - 12) / 5.5);
  const cap = Math.min(
    MAX_VISIBLE_LABEL_CHARS,
    Math.max(MIN_VISIBLE_LABEL_CHARS, measuredCap),
  );
  return name.length > cap ? name.slice(0, cap - 1) + "…" : name;
}

function categoryRadius(category, maxAttributeCount) {
  return 8 + 14 * Math.sqrt(category.attributeCount / maxAttributeCount);
}

function fact(count, singular) {
  return count + " " + singular + (count === 1 ? "" : "s");
}

function edgeEndpoints(source, target, sourceRadius, targetRadius) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.hypot(dx, dy) || 1;
  const ux = dx / distance;
  const uy = dy / distance;
  return {
    source: {
      x: source.x + ux * (sourceRadius + 2),
      y: source.y + uy * (sourceRadius + 2),
    },
    target: {
      x: target.x - ux * (targetRadius + 4),
      y: target.y - uy * (targetRadius + 4),
    },
  };
}

function appendArrowDefinition(svg) {
  const defs = svgElement("defs");
  const marker = svgElement("marker", {
    id: ARROW_ID,
    viewBox: "0 0 7 7",
    markerWidth: "7",
    markerHeight: "7",
    refX: "6",
    refY: "3.5",
    orient: "auto",
    markerUnits: "userSpaceOnUse",
  });
  marker.append(svgElement("path", {
    class: "syn-edge-arrow",
    d: "M 0 0 L 7 3.5 L 0 7 Z",
  }));
  defs.append(marker);
  svg.append(defs);
}

export function createOverviewRenderer({
  svg,
  listEl,
  onSelectCategory,
  onSelectNode,
}) {
  function renderList(state) {
    const previousFocus = focusedKey(listEl);
    const category = state.overview?.categories
      ?.find((item) => item.name === state.selectedCategory);

    if (!category) {
      const empty = document.createElement("p");
      empty.className = "syn-empty";
      empty.textContent = "Select a category to list its attributes.";
      listEl.replaceChildren(empty);
      restoreFocus(listEl, previousFocus);
      return;
    }

    const heading = document.createElement("h3");
    heading.textContent = category.name + " · " + category.attributeCount;
    listEl.replaceChildren(heading);

    if (!category.attributes.length) {
      const empty = document.createElement("p");
      empty.className = "syn-empty";
      empty.textContent = "This category has no attributes.";
      listEl.append(empty);
      restoreFocus(listEl, previousFocus);
      return;
    }

    for (const attribute of category.attributes) {
      const button = document.createElement("button");
      const selected = state.centerNode === attribute.id;
      button.type = "button";
      button.className = selected ? "active" : "";
      button.dataset.focusKey = "attribute:" + attribute.id;
      button.setAttribute("aria-pressed", String(selected));

      const label = document.createElement("span");
      label.textContent = attribute.label;
      const meta = document.createElement("span");
      meta.textContent = attribute.valuesCount + "v · " + attribute.degree + "°";
      button.append(label, meta);
      button.addEventListener("click", () => onSelectNode(attribute.id));
      listEl.append(button);
    }

    restoreFocus(listEl, previousFocus);
  }

  function renderView(state) {
    const previousFocus = focusedKey(svg);
    const overview = state.overview;
    if (!overview) {
      svg.replaceChildren();
      restoreFocus(svg, previousFocus);
      renderList(state);
      return;
    }

    const rect = svg.getBoundingClientRect();
    const width = measuredDimension(rect.width);
    const height = measuredDimension(rect.height);
    svg.setAttribute("viewBox", "0 0 " + width + " " + height);
    svg.replaceChildren();

    const { categories, edges } = overview;
    const { positions, cellWidth } = layoutCategories(categories, width, height);
    const maxAttributeCount = Math.max(
      ...categories.map((category) => category.attributeCount),
      1,
    );
    const radii = new Map(categories.map((category) => [
      category.name,
      categoryRadius(category, maxAttributeCount),
    ]));

    appendArrowDefinition(svg);
    const maxEdgeCount = Math.max(...edges.map((edge) => edge.count), 1);
    for (const edge of edges.slice(0, MAX_VISIBLE_EDGES)) {
      const sourceCenter = positions.get(edge.source);
      const targetCenter = positions.get(edge.target);
      if (!sourceCenter || !targetCenter) continue;
      const endpoints = edgeEndpoints(
        sourceCenter,
        targetCenter,
        radii.get(edge.source),
        radii.get(edge.target),
      );
      const middleX = (endpoints.source.x + endpoints.target.x) / 2
        + (endpoints.source.y - endpoints.target.y) * 0.15;
      const middleY = (endpoints.source.y + endpoints.target.y) / 2
        + (endpoints.target.x - endpoints.source.x) * 0.15;
      const path = svgElement("path", {
        class: "syn-edge syn-overview-edge",
        d: "M " + endpoints.source.x + " " + endpoints.source.y
          + " Q " + middleX + " " + middleY
          + " " + endpoints.target.x + " " + endpoints.target.y,
        "stroke-width": (0.6 + 2.4 * (edge.count / maxEdgeCount)).toFixed(2),
        "marker-end": "url(#" + ARROW_ID + ")",
      });
      const title = svgElement("title");
      title.textContent = edge.source + " → " + edge.target + " · " + edge.count + " edges";
      path.append(title);
      svg.append(path);
    }

    for (const category of categories) {
      const position = positions.get(category.name);
      const radius = radii.get(category.name);
      const selected = state.selectedCategory === category.name;
      const facts = [
        fact(category.nodeCount, "node"),
        fact(category.attributeCount, "attribute"),
        fact(category.helperCount, "helper"),
        fact(category.internalEdgeCount, "internal edge"),
      ];
      const group = svgElement("g", {
        class: "syn-cat-node" + (selected ? " active" : ""),
        role: "button",
        tabindex: "0",
        "aria-label": category.name + ": " + facts.join(", "),
        "aria-pressed": String(selected),
        "data-focus-key": "category:" + category.name,
      });
      group.append(svgElement("circle", {
        class: "syn-cat-hit",
        cx: position.x,
        cy: position.y,
        r: Math.max(MIN_HIT_RADIUS, radius),
        "aria-hidden": "true",
        style: "fill: transparent; stroke: transparent; pointer-events: all;",
      }));
      group.append(svgElement("circle", {
        class: "syn-cat-mark",
        cx: position.x,
        cy: position.y,
        r: radius,
      }));
      const label = svgElement("text", {
        x: position.x,
        y: position.y + radius + 11,
        "text-anchor": "middle",
      });
      label.textContent = visibleLabel(category.name, cellWidth);
      group.append(label);

      const title = svgElement("title");
      title.textContent = category.name + "\n" + facts.join(" · ");
      group.append(title);
      group.addEventListener("click", () => onSelectCategory(category.name));
      group.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " " && event.key !== "Spacebar") return;
        event.preventDefault();
        onSelectCategory(category.name);
      });
      svg.append(group);
    }

    restoreFocus(svg, previousFocus);
    renderList(state);
  }

  let lastState = null;
  let pendingResizeFrame = null;
  let destroyed = false;
  const observer = new ResizeObserver(() => {
    if (destroyed || !lastState || pendingResizeFrame !== null) return;
    pendingResizeFrame = requestAnimationFrame(() => {
      pendingResizeFrame = null;
      if (!destroyed) renderView(lastState);
    });
  });
  observer.observe(svg.parentElement);

  return {
    render(state) {
      if (destroyed) return;
      lastState = state;
      renderView(state);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      observer.disconnect();
      if (pendingResizeFrame !== null) {
        cancelAnimationFrame(pendingResizeFrame);
        pendingResizeFrame = null;
      }
      lastState = null;
    },
  };
}

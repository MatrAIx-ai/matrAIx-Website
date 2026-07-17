import { nodeDetail } from "./graph-views.js";

const textElement = (tag, text, className = "") => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = text;
  return node;
};

export function createDetailRail({ rootEl, onSelectNode, onCenterNode }) {
  const fallbackFocus = () =>
    document.getElementById("detailTitle")?.focus({ preventScroll: true });

  const restoreFocus = (focusKey) => {
    if (!focusKey) return;
    const target = [...rootEl.querySelectorAll("[data-focus-key]")]
      .find((node) => node.dataset.focusKey === focusKey && !node.disabled);
    if (target) target.focus({ preventScroll: true });
    else fallbackFocus();
  };

  const edgeSection = (heading, direction, edges) => {
    if (!edges.length) return null;
    const section = document.createElement("section");
    section.append(textElement("h3", heading));
    const list = document.createElement("ul");
    list.className = "syn-edge-list";
    edges.forEach((edge, index) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = edge.label;
      button.setAttribute("data-focus-key", `edge:${direction}:${edge.id}:${index}`);
      const relationFact = edge.relation ? `; relation ${edge.relation}` : "";
      button.setAttribute("aria-label",
        `Select ${direction} node ${edge.label}; weight ${edge.weight}${relationFact}`);
      button.addEventListener("click", () => onSelectNode(edge.id));
      const relation = edge.relation ? ` · ${edge.relation}` : "";
      item.append(button, textElement("span", `w=${edge.weight}${relation}`, "syn-edge-meta"));
      list.append(item);
    });
    section.append(list);
    return section;
  };

  function render(state) {
    const previousFocus = rootEl.contains(document.activeElement)
      ? document.activeElement?.dataset?.focusKey ?? null
      : null;
    const nodeId = state.selectedNode;
    if (!nodeId || !state.store) {
      rootEl.replaceChildren(
        textElement("p", "Select a node to inspect priors and edges.", "syn-empty"),
      );
      restoreFocus(previousFocus);
      return;
    }

    const detail = nodeDetail(state.store, nodeId);
    const header = document.createElement("header");
    header.append(
      textElement("h3", detail.label),
      textElement("p",
        `${detail.category} · ${detail.type} · in ${detail.inDegree} / out ${detail.outDegree}`,
        "syn-detail-meta"),
    );
    if (detail.description) {
      header.append(textElement("p", detail.description, "syn-detail-desc"));
    }
    const centerButton = document.createElement("button");
    centerButton.type = "button";
    centerButton.setAttribute("data-focus-key", `center:${detail.id}`);
    centerButton.textContent = state.centerNode === detail.id ? "Centered" : "Center graph here";
    centerButton.disabled = state.centerNode === detail.id;
    centerButton.addEventListener("click", () => onCenterNode(detail.id));
    header.append(centerButton);

    const sections = [header];
    if (detail.values.length) {
      const prior = document.createElement("section");
      prior.append(textElement("h3", `Prior (${detail.values.length} values)`));
      const list = document.createElement("ul");
      list.className = "syn-prior-list";
      detail.values.forEach((value, index) => {
        const probability = detail.prior[index] ?? 0;
        const row = document.createElement("li");
        const track = document.createElement("span");
        track.className = "prior-bar";
        const bar = document.createElement("i");
        bar.style.width = `${Math.round(probability * 100)}%`;
        track.append(bar);
        row.append(
          textElement("span", value, "prior-label"),
          track,
          textElement("span", `${(probability * 100).toFixed(1)}%`, "prior-val"),
        );
        list.append(row);
      });
      prior.append(list);
      sections.push(prior);
    }

    const incoming = edgeSection(
      `Strongest incoming (${Math.min(detail.inDegree, 20)})`, "incoming", detail.inEdges,
    );
    const outgoing = edgeSection(
      `Strongest outgoing (${Math.min(detail.outDegree, 20)})`, "outgoing", detail.outEdges,
    );
    if (incoming) sections.push(incoming);
    if (outgoing) sections.push(outgoing);
    rootEl.replaceChildren(...sections);
    restoreFocus(previousFocus);
  }

  return { render };
}

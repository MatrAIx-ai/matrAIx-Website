// Port of persona/synthesis/sampler/sampler.py::PersonaForwardSampler
// (compile stage) + the service-layer override validation. float64 throughout,
// with explicit finite checks at every scaling/accumulation boundary.
import { normalizeDist } from "./dist-utils.js";

export const EPS = 1e-12;
export const MAX_SAMPLE_N = 200;
export const MAX_SAFE_SEED = Number.MAX_SAFE_INTEGER;

export class SynthesisValidationError extends Error {
  constructor(message, key = null) {
    super(message);
    this.name = "SynthesisValidationError";
    this.key = key;
  }
}

const finiteNonNeg = (value, key, label) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new SynthesisValidationError(`${label} must be >= 0 and finite`, key);
  }
  return value;
};

const record = (value, key) => {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || (
      Object.getPrototypeOf(value) !== Object.prototype
      && Object.getPrototypeOf(value) !== null
    )
  ) {
    throw new SynthesisValidationError(`${key} must be an object`, key);
  }
  return value;
};

const finiteResult = (value, key, label) => {
  if (!Number.isFinite(value)) {
    throw new SynthesisValidationError(`${label} became non-finite`, key);
  }
  return value;
};

const categoryOf = (node) => node.category || "Uncategorized";
const logOf = (probability) => Math.log(Math.max(probability, EPS));
const defaultUndefined = (value, fallback) => (value === undefined ? fallback : value);

function checkedDist(dist, expectedLength, key, label) {
  if (!Array.isArray(dist) || dist.length !== expectedLength) {
    throw new SynthesisValidationError(`${label} has an invalid shape`, key);
  }
  const values = dist.map((value) => finiteNonNeg(value, key, label));
  const mass = values.reduce(
    (sum, value) => finiteResult(sum + value, key, `${label} mass`),
    0,
  );
  if (mass <= 0) {
    throw new SynthesisValidationError(`${label} must have positive mass`, key);
  }
  return normalizeDist(values);
}

export function compileSampler({ core, pack, gammaScale = 1, overrides = {} }) {
  if (
    core?.formatVersion !== 1
    || pack?.formatVersion !== 1
    || typeof core.datasetId !== "string"
    || core.datasetId !== pack.datasetId
  ) {
    throw new SynthesisValidationError("core and pack snapshot mismatch", "datasetId");
  }

  record(overrides, "overrides");
  const allowedSections = new Set(["edgeWeights", "nodePriors", "categoryScales"]);
  for (const section of Object.keys(overrides)) {
    if (!allowedSections.has(section)) {
      throw new SynthesisValidationError(
        `unknown override section: ${section}`,
        `overrides.${section}`,
      );
    }
    record(overrides[section], `overrides.${section}`);
  }
  const gScale = finiteNonNeg(gammaScale, "gammaScale", "gammaScale");

  const nodesById = new Map(core.nodes.map((node) => [node.id, node]));
  const values = new Map(core.nodes.map((node) => [node.id, node.values ?? []]));
  const vtoi = new Map(core.nodes.map((node) => [
    node.id,
    new Map((node.values ?? []).map((value, index) => [value, index])),
  ]));

  // Pairwise and CPT log-ratios are anchored to the original prior.
  const prior0 = new Map();
  const logprior0 = new Map();
  for (const node of core.nodes) {
    const key = `core.nodes.${node.id}.prior`;
    const prior = checkedDist(node.prior, values.get(node.id).length, key, "prior");
    prior0.set(node.id, prior);
    logprior0.set(node.id, prior.map(logOf));
  }

  // Override validation mirrors the service layer.
  const edgeKeys = new Set(pack.edges.map((edge) => `${edge.source}->${edge.target}`));
  const edgeFactors = new Map(Object.entries(overrides.edgeWeights ?? {}).map(
    ([key, factor]) => {
      if (!edgeKeys.has(key)) {
        throw new SynthesisValidationError(
          `unknown edge: ${key}`,
          `overrides.edgeWeights.${key}`,
        );
      }
      return [
        key,
        finiteNonNeg(
          factor,
          `overrides.edgeWeights.${key}`,
          `edge weight factor for ${key}`,
        ),
      ];
    },
  ));

  const knownCategories = new Set(core.nodes.map(categoryOf));
  const categoryScales = new Map(Object.entries(overrides.categoryScales ?? {}).map(
    ([category, scale]) => {
      if (!knownCategories.has(category)) {
        throw new SynthesisValidationError(
          `unknown category: ${category}`,
          `overrides.categoryScales.${category}`,
        );
      }
      return [
        category,
        finiteNonNeg(
          scale,
          `overrides.categoryScales.${category}`,
          `category scale for ${category}`,
        ),
      ];
    },
  ));

  const priorOverrides = new Map(Object.entries(overrides.nodePriors ?? {}).map(
    ([nid, dist]) => {
      const key = `overrides.nodePriors.${nid}`;
      if (!nodesById.has(nid)) {
        throw new SynthesisValidationError(`unknown node: ${nid}`, key);
      }
      const expected = values.get(nid).length;
      if (!Array.isArray(dist) || dist.length !== expected) {
        throw new SynthesisValidationError(
          `prior override for ${nid} must have ${expected} entries`,
          key,
        );
      }
      const weights = dist.map((value) => finiteNonNeg(
        value,
        key,
        `prior weight for ${nid}`,
      ));
      const mass = weights.reduce(
        (sum, value) => finiteResult(sum + value, key, "prior override mass"),
        0,
      );
      if (mass <= 0) {
        throw new SynthesisValidationError(
          `prior override for ${nid} must have positive mass`,
          key,
        );
      }
      return [nid, normalizeDist(weights)];
    },
  ));

  // Pairwise evidence remains anchored to the original prior.
  const inEdges = new Map();
  for (const edge of pack.edges) {
    if (!nodesById.has(edge.source) || !nodesById.has(edge.target)) continue;
    const edgeKey = `${edge.source}->${edge.target}`;
    const targetK = values.get(edge.target).length;
    const sourceK = values.get(edge.source).length;
    if (!Array.isArray(edge.matrix) || edge.matrix.length !== sourceK) {
      throw new SynthesisValidationError(
        `matrix for ${edgeKey} has an invalid shape`,
        `pack.edges.${edgeKey}.matrix`,
      );
    }
    const anchor = logprior0.get(edge.target);
    const logratio = edge.matrix.map((row, rowIndex) => checkedDist(
      row,
      targetK,
      `pack.edges.${edgeKey}.matrix.${rowIndex}`,
      `matrix row for ${edgeKey}`,
    ).map((probability, valueIndex) => logOf(probability) - anchor[valueIndex]));
    if (!inEdges.has(edge.target)) inEdges.set(edge.target, []);
    inEdges.get(edge.target).push({
      source: edge.source,
      weight: finiteNonNeg(
        edge.weight,
        `pack.edges.${edgeKey}.weight`,
        "edge weight",
      ),
      logratio,
    });
  }

  // Full-CPT evidence also remains anchored to the original prior.
  const cptsByTarget = new Map();
  for (const cpt of pack.cpts) {
    if (!nodesById.has(cpt.target)) continue;
    const parents = cpt.parents.filter((parent) => nodesById.has(parent));
    const multipliers = [];
    let codeSpace = 1;
    for (const parent of parents) {
      multipliers.push(codeSpace);
      codeSpace *= values.get(parent).length;
      if (!Number.isSafeInteger(codeSpace)) {
        throw new SynthesisValidationError(
          `CPT code space for ${cpt.target} is unsafe`,
          `pack.cpts.${cpt.target}.parents`,
        );
      }
    }
    const anchor = logprior0.get(cpt.target);
    const lookup = new Map();
    for (const row of cpt.rows) {
      const [code, dist] = row;
      const key = `pack.cpts.${cpt.target}.rows.${code}`;
      if (!Number.isSafeInteger(code) || code < 0 || code >= codeSpace) {
        throw new SynthesisValidationError(
          `invalid CPT code for ${cpt.target}`,
          key,
        );
      }
      lookup.set(code, checkedDist(
        dist,
        values.get(cpt.target).length,
        key,
        `CPT row for ${cpt.target}`,
      ).map((probability, index) => logOf(probability) - anchor[index]));
    }
    if (!cptsByTarget.has(cpt.target)) cptsByTarget.set(cpt.target, []);
    cptsByTarget.get(cpt.target).push({
      parents,
      multipliers,
      weight: finiteNonNeg(
        cpt.weight,
        `pack.cpts.${cpt.target}.weight`,
        "CPT weight",
      ),
      replace: Boolean(cpt.replace),
      lookup,
    });
  }

  // Effective priors are applied only after all evidence ratios are compiled.
  const priorEff = new Map();
  const logprior = new Map();
  for (const nid of nodesById.keys()) {
    const prior = priorOverrides.get(nid) ?? prior0.get(nid);
    priorEff.set(nid, prior);
    logprior.set(nid, prior.map(logOf));
  }

  // Compile conditional masks.
  const masksByTarget = new Map();
  for (const mask of pack.masks) {
    const target = mask.target;
    if (!nodesById.has(target)) continue;
    const condition = record(
      defaultUndefined(mask.condition, {}),
      `pack.masks.${target}.condition`,
    );
    const compiledCondition = [];
    for (const [parent, allowedValues] of Object.entries(condition)) {
      const key = `pack.masks.${target}.condition.${parent}`;
      if (!nodesById.has(parent)) {
        throw new SynthesisValidationError(
          `mask on ${target} has unknown condition parent: ${parent}`,
          key,
        );
      }
      if (!Array.isArray(allowedValues)) {
        throw new SynthesisValidationError("mask allowed values must be an array", key);
      }
      const allowed = new Array(values.get(parent).length).fill(false);
      for (const value of allowedValues) {
        if (typeof value !== "string") {
          throw new SynthesisValidationError("mask allowed values must be strings", key);
        }
        const index = vtoi.get(parent).get(value);
        if (index !== undefined) allowed[index] = true;
      }
      compiledCondition.push({ p: parent, allowed });
    }

    const badMultiplier = finiteNonNeg(
      defaultUndefined(mask.bad_value_multiplier, 0),
      `pack.masks.${target}.bad_value_multiplier`,
      "bad value multiplier",
    );
    const downweights = record(
      defaultUndefined(mask.downweight_values, {}),
      `pack.masks.${target}.downweight_values`,
    );
    const outsideMultiplier = finiteNonNeg(
      defaultUndefined(mask.outside_preferred_multiplier, 1),
      `pack.masks.${target}.outside_preferred_multiplier`,
      "outside multiplier",
    );
    const valueMult = new Array(values.get(target).length).fill(1);

    const badValues = defaultUndefined(mask.bad_values, []);
    if (!Array.isArray(badValues)) {
      throw new SynthesisValidationError(
        "mask bad values must be an array",
        `pack.masks.${target}.bad_values`,
      );
    }
    for (const value of badValues) {
      const index = vtoi.get(target).get(value);
      if (index !== undefined) {
        valueMult[index] = finiteResult(
          valueMult[index] * badMultiplier,
          `pack.masks.${target}`,
          "mask multiplier",
        );
      }
    }

    for (const [value, rawWeight] of Object.entries(downweights)) {
      const weight = finiteNonNeg(
        rawWeight,
        `pack.masks.${target}.downweight_values.${value}`,
        "downweight",
      );
      const index = vtoi.get(target).get(value);
      if (index !== undefined) {
        valueMult[index] = finiteResult(
          valueMult[index] * weight,
          `pack.masks.${target}`,
          "mask multiplier",
        );
      }
    }

    const preferredValues = defaultUndefined(mask.preferred_values, []);
    if (!Array.isArray(preferredValues)) {
      throw new SynthesisValidationError(
        "mask preferred values must be an array",
        `pack.masks.${target}.preferred_values`,
      );
    }
    const preferred = new Set(preferredValues);
    if (mask.penalize_values_outside_preferred_set && preferred.size) {
      values.get(target).forEach((value, index) => {
        if (!preferred.has(value)) {
          valueMult[index] = finiteResult(
            valueMult[index] * outsideMultiplier,
            `pack.masks.${target}`,
            "mask multiplier",
          );
        }
      });
    }

    if (!masksByTarget.has(target)) masksByTarget.set(target, []);
    masksByTarget.get(target).push({
      condition: compiledCondition,
      valueMult,
    });
  }

  // Compute shrinkage using CPT weights and non-replaced raw edge weights.
  const replacedParents = new Map();
  const gammaMap = new Map();
  for (const nid of nodesById.keys()) {
    const weights = [];
    const replaced = new Set();
    for (const cpt of cptsByTarget.get(nid) ?? []) {
      weights.push(cpt.weight);
      if (cpt.replace) {
        for (const parent of cpt.parents) replaced.add(parent);
      }
    }
    for (const edge of inEdges.get(nid) ?? []) {
      if (!replaced.has(edge.source)) weights.push(edge.weight);
    }
    replacedParents.set(nid, replaced);
    const squaredSum = Math.max(weights.reduce((sum, weight) => finiteResult(
      sum + finiteResult(weight * weight, `weights.${nid}`, "squared weight"),
      `weights.${nid}`,
      "weight sum",
    ), 0), EPS);
    gammaMap.set(nid, 1 / Math.max(1, Math.sqrt(squaredSum)));
  }

  // Find all nodes required for emit-only sampling.
  const emitNodes = core.nodes
    .filter((node) => node.emit !== false)
    .map((node) => node.id);
  const parentsByTarget = new Map();
  const addParent = (target, parent) => {
    if (!nodesById.has(target) || !nodesById.has(parent)) return;
    if (!parentsByTarget.has(target)) parentsByTarget.set(target, new Set());
    parentsByTarget.get(target).add(parent);
  };
  for (const edge of core.edges) addParent(edge.target, edge.source);
  for (const cpt of pack.cpts) {
    for (const parent of cpt.parents) addParent(cpt.target, parent);
  }
  for (const mask of pack.masks) {
    for (const parent of Object.keys(mask.condition ?? {})) {
      addParent(mask.target, parent);
    }
  }
  const required = new Set(emitNodes);
  const stack = [...required];
  while (stack.length) {
    const nid = stack.pop();
    for (const parent of parentsByTarget.get(nid) ?? []) {
      if (!required.has(parent)) {
        required.add(parent);
        stack.push(parent);
      }
    }
  }

  // Compile the topologically ordered sampling plan.
  const topoPos = new Map();
  core.topologicalOrder.forEach((nid, index) => {
    if (nodesById.has(nid) && !topoPos.has(nid)) topoPos.set(nid, index);
  });
  const sampledBefore = (parent, position) => (
    required.has(parent) && (topoPos.get(parent) ?? Infinity) < position
  );

  const plan = [];
  for (const [nid, position] of topoPos) {
    if (!required.has(nid)) continue;
    const k = values.get(nid).length;
    const gamma = finiteResult(
      gammaMap.get(nid) * gScale,
      `gamma.${nid}`,
      "gamma",
    );
    const planNode = {
      nid,
      k,
      logprior: logprior.get(nid),
      cpts: [],
      edges: [],
      masks: [],
    };
    const evidenceLower = [...planNode.logprior];
    const evidenceUpper = [...planNode.logprior];
    const addEvidenceBounds = (rows, contributorKey) => {
      const evidenceRows = Array.isArray(rows) ? rows : [...rows];
      for (let valueIndex = 0; valueIndex < k; valueIndex++) {
        // A missing CPT row contributes zero; zero is conservative for edge extrema.
        let lower = 0;
        let upper = 0;
        for (const row of evidenceRows) {
          lower = Math.min(lower, row[valueIndex]);
          upper = Math.max(upper, row[valueIndex]);
        }
        evidenceLower[valueIndex] = finiteResult(
          evidenceLower[valueIndex] + lower,
          `aggregate.${nid}`,
          `aggregate lower bound (${contributorKey})`,
        );
        evidenceUpper[valueIndex] = finiteResult(
          evidenceUpper[valueIndex] + upper,
          `aggregate.${nid}`,
          `aggregate upper bound (${contributorKey})`,
        );
      }
    };

    for (const cpt of cptsByTarget.get(nid) ?? []) {
      if (!cpt.parents.every((parent) => sampledBefore(parent, position))) continue;
      const scale = gamma === 0 || cpt.weight === 0
        ? 0
        : finiteResult(gamma * cpt.weight, `cpts.${nid}`, "CPT scale");
      const lookup = new Map();
      for (const [code, logratio] of cpt.lookup) {
        lookup.set(code, logratio.map((value) => finiteResult(
          scale * value,
          `cpts.${nid}.${code}`,
          "scaled CPT evidence",
        )));
      }
      addEvidenceBounds(lookup.values(), `cpt:${nid}`);
      planNode.cpts.push({
        parents: cpt.parents,
        multipliers: cpt.multipliers,
        lookup,
      });
    }

    const replaced = replacedParents.get(nid);
    for (const edge of inEdges.get(nid) ?? []) {
      if (replaced.has(edge.source) || !sampledBefore(edge.source, position)) continue;
      const key = `${edge.source}->${nid}`;
      const factor = edgeFactors.get(key) ?? 1;
      const categoryScale = categoryScales.get(
        categoryOf(nodesById.get(edge.source)),
      ) ?? 1;
      const scale = gamma === 0
        || edge.weight === 0
        || factor === 0
        || categoryScale === 0
        ? 0
        : (() => {
          // Preserve the upstream arithmetic boundary: override factors compose
          // before gamma/weight scaling, so an overflowing factor product fails.
          const factorProduct = finiteResult(
            factor * categoryScale,
            `edges.${key}`,
            "edge override factor",
          );
          const weightedGamma = finiteResult(
            gamma * edge.weight,
            `edges.${key}`,
            "edge gamma-weight scale",
          );
          return finiteResult(
            weightedGamma * factorProduct,
            `edges.${key}`,
            "edge scale",
          );
        })();
      const table = edge.logratio.map((row) => row.map((value) => finiteResult(
        scale * value,
        `edges.${key}`,
        "scaled edge evidence",
      )));
      addEvidenceBounds(table, `edge:${key}`);
      planNode.edges.push({ source: edge.source, table });
    }

    for (const mask of masksByTarget.get(nid) ?? []) {
      if (mask.condition.some(({ allowed }) => !allowed.includes(true))) continue;
      const missing = mask.condition.filter(
        ({ p: parent }) => !sampledBefore(parent, position),
      );
      if (missing.length) {
        throw new SynthesisValidationError(
          `conditional mask on ${nid} depends on unsampled parents`,
          `pack.masks.${nid}.condition.${missing[0].p}`,
        );
      }
      planNode.masks.push({
        conds: mask.condition.length ? mask.condition : null,
        valueMult: mask.valueMult,
      });
    }
    plan.push(planNode);
  }

  const priorOnlyNodes = core.nodes
    .map((node) => node.id)
    .filter((nid) => required.has(nid) && !topoPos.has(nid));

  function nodeDistribution(nid, assignment) {
    const planNode = plan.find((node) => node.nid === nid);
    if (!planNode) throw new Error(`node not in plan: ${nid}`);
    const get = (parent) => {
      const valueIndex = assignment[parent];
      if (valueIndex === undefined) {
        throw new Error(`assignment missing parent ${parent}`);
      }
      return valueIndex;
    };
    const logits = [...planNode.logprior];

    for (const cpt of planNode.cpts) {
      let code = 0;
      cpt.parents.forEach((parent, index) => {
        code += get(parent) * cpt.multipliers[index];
      });
      const row = cpt.lookup.get(code);
      if (row) {
        for (let valueIndex = 0; valueIndex < planNode.k; valueIndex++) {
          logits[valueIndex] = finiteResult(
            logits[valueIndex] + row[valueIndex],
            `distribution.${nid}`,
            "CPT logit",
          );
        }
      }
    }

    for (const edge of planNode.edges) {
      const row = edge.table[get(edge.source)];
      for (let valueIndex = 0; valueIndex < planNode.k; valueIndex++) {
        logits[valueIndex] = finiteResult(
          logits[valueIndex] + row[valueIndex],
          `distribution.${nid}`,
          "edge logit",
        );
      }
    }

    const max = Math.max(...logits);
    let probabilities = logits.map((value) => finiteResult(
      Math.exp(value - max),
      `distribution.${nid}`,
      "probability",
    ));
    for (const mask of planNode.masks) {
      if (
        mask.conds === null
        || mask.conds.every(({ p: parent, allowed }) => allowed[get(parent)])
      ) {
        probabilities = probabilities.map((value, index) => finiteResult(
          value * mask.valueMult[index],
          `distribution.${nid}`,
          "masked probability",
        ));
        if (mask.conds !== null) {
          const maskedMass = probabilities.reduce(
            (sum, value) => finiteResult(
              sum + value,
              `distribution.${nid}`,
              "masked probability mass",
            ),
            0,
          );
          if (maskedMass <= 0) probabilities = probabilities.map(() => 1);
        }
      }
    }
    const mass = probabilities.reduce(
      (sum, value) => finiteResult(
        sum + value,
        `distribution.${nid}`,
        "probability mass",
      ),
      0,
    );
    // An unconditional all-zero mask produces a zero CDF in Python, selecting index 0.
    return mass <= 0
      ? probabilities.map((_, index) => (index === 0 ? 1 : 0))
      : normalizeDist(probabilities);
  }

  return {
    core,
    nodesById,
    values,
    vtoi,
    priorEff,
    emitNodes,
    plan,
    priorOnlyNodes,
    topoPos,
    nodeDistribution,
  };
}

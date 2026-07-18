const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

class DimensionsSchemaError extends TypeError {
  constructor(key) {
    super("Dimensions schema is invalid.");
    this.name = "DimensionsSchemaError";
    this.code = "schema";
    this.key = key;
  }
}

const fail = (key) => {
  throw new DimensionsSchemaError(key);
};

const isOrdinaryObject = (value) => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const validateSafeJson = (value, key, seen) => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail(key);
    return;
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) fail(key);
    seen.add(value);
    for (const childKey of Object.keys(value)) {
      if (DANGEROUS_KEYS.has(childKey)) fail(`${key}.${childKey}`);
      const childPath = /^(?:0|[1-9][0-9]*)$/.test(childKey)
        ? `${key}[${childKey}]`
        : `${key}.${childKey}`;
      validateSafeJson(value[childKey], childPath, seen);
    }
    return;
  }
  if (!isOrdinaryObject(value) || seen.has(value)) fail(key);
  seen.add(value);
  for (const childKey of Object.keys(value)) {
    if (DANGEROUS_KEYS.has(childKey)) fail(`${key}.${childKey}`);
    validateSafeJson(value[childKey], `${key}.${childKey}`, seen);
  }
};

const requireStringField = (value, key) => {
  if (typeof value !== "string") fail(key);
};

export function validateDimensions(data) {
  if (!isOrdinaryObject(data)) fail("$");
  validateSafeJson(data, "$", new WeakSet());
  if (!Array.isArray(data.dimensions)) fail("dimensions");

  const ids = new Set();
  for (let index = 0; index < data.dimensions.length; index++) {
    const dimension = data.dimensions[index];
    const key = `dimensions[${index}]`;
    if (!isOrdinaryObject(dimension)) fail(key);
    if (typeof dimension.id !== "string" || dimension.id.trim().length === 0
        || ids.has(dimension.id)) {
      fail(`${key}.id`);
    }
    ids.add(dimension.id);

    for (const field of ["label", "category", "description", "phrase"]) {
      if (hasOwn(dimension, field)) requireStringField(dimension[field], `${key}.${field}`);
    }
    if (hasOwn(dimension, "index") && typeof dimension.index !== "number") {
      fail(`${key}.index`);
    }

    if (!Array.isArray(dimension.values) || dimension.values.length === 0) {
      fail(`${key}.values`);
    }
    const values = new Set();
    for (let valueIndex = 0; valueIndex < dimension.values.length; valueIndex++) {
      const value = dimension.values[valueIndex];
      if (typeof value !== "string" || value.trim().length === 0 || values.has(value)) {
        fail(`${key}.values[${valueIndex}]`);
      }
      values.add(value);
    }

    if (hasOwn(dimension, "defaultValue") && dimension.defaultValue !== null) {
      const defaultValue = dimension.defaultValue;
      if (typeof defaultValue === "string") {
        if (!values.has(defaultValue)) fail(`${key}.defaultValue`);
      } else {
        if (!Array.isArray(defaultValue)) fail(`${key}.defaultValue`);
        const defaults = new Set();
        for (let valueIndex = 0; valueIndex < defaultValue.length; valueIndex++) {
          const value = defaultValue[valueIndex];
          if (typeof value !== "string" || defaults.has(value) || !values.has(value)) {
            fail(`${key}.defaultValue[${valueIndex}]`);
          }
          defaults.add(value);
        }
      }
    }
  }
  return data;
}

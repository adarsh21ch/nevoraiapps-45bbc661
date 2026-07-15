import type { Condition, EventPayload } from "./types";

function getPath(obj: unknown, path: string): unknown {
  if (obj == null || typeof obj !== "object") return undefined;
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

function evaluateOne(cond: Condition, payload: EventPayload): boolean {
  const actual = getPath(payload, cond.path);
  const expected = cond.value;
  switch (cond.op) {
    case "eq":
      return actual === expected;
    case "neq":
      return actual !== expected;
    case "gt":
      return typeof actual === "number" && typeof expected === "number" && actual > expected;
    case "gte":
      return typeof actual === "number" && typeof expected === "number" && actual >= expected;
    case "lt":
      return typeof actual === "number" && typeof expected === "number" && actual < expected;
    case "lte":
      return typeof actual === "number" && typeof expected === "number" && actual <= expected;
    case "in":
      return Array.isArray(expected) && expected.includes(actual as never);
    case "not_in":
      return Array.isArray(expected) && !expected.includes(actual as never);
    case "contains":
      if (Array.isArray(actual)) return actual.includes(expected as never);
      if (typeof actual === "string" && typeof expected === "string") return actual.includes(expected);
      return false;
    case "exists":
      return actual !== undefined && actual !== null;
    case "matches":
      if (typeof actual !== "string" || typeof expected !== "string") return false;
      try {
        return new RegExp(expected).test(actual);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

/** All conditions must pass (AND). Empty conditions = always true. */
export function evaluateConditions(
  conditions: Condition[] | null | undefined,
  payload: EventPayload,
): boolean {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every((c) => evaluateOne(c, payload));
}

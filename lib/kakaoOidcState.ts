const MAX_STATE_COUNT = 5;
const STATE_REGEX = /^[A-Za-z0-9_-]{20,200}$/;

const normalizeState = (value: string) => value.trim();

const decodeCookieValue = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const sanitizeStates = (values: string[]) => {
  return values
    .map(normalizeState)
    .filter((state) => STATE_REGEX.test(state))
    .slice(-MAX_STATE_COUNT);
};

export function parseStateCookie(rawValue?: string): string[] {
  if (!rawValue) return [];

  const decoded = decodeCookieValue(rawValue);
  try {
    const parsed = JSON.parse(decoded);
    if (Array.isArray(parsed)) {
      return sanitizeStates(parsed.filter((value): value is string => typeof value === "string"));
    }
  } catch {
    // fallback below
  }

  if (typeof decoded === "string") {
    return sanitizeStates([decoded]);
  }

  return [];
}

export function serializeStateCookie(states: string[]) {
  return encodeURIComponent(JSON.stringify(sanitizeStates(states)));
}

export function appendState(rawValue: string | undefined, nextState: string) {
  const currentStates = parseStateCookie(rawValue);
  return sanitizeStates([...currentStates, nextState]);
}

export function consumeState(rawValue: string | undefined, targetState: string) {
  const currentStates = parseStateCookie(rawValue);
  const index = currentStates.indexOf(targetState);

  if (index < 0) {
    return { matched: false, remainingStates: currentStates };
  }

  const remainingStates = [...currentStates];
  remainingStates.splice(index, 1);

  return { matched: true, remainingStates: sanitizeStates(remainingStates) };
}

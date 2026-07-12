export const parseSuggestionCallback = (
  data: string
):
  | { kind: "dismiss"; suggestionRef: string }
  | { kind: "request"; suggestionRef: string }
  | { kind: "open"; suggestionRef: string }
  | null => {
  const dismissMatch = /^s:d:([A-Za-z0-9_-]{16,43})$/.exec(data);
  if (dismissMatch) {
    return { kind: "dismiss", suggestionRef: dismissMatch[1] };
  }

  const requestMatch = /^s:r:([A-Za-z0-9_-]{16,43})$/.exec(data);
  if (requestMatch) {
    return { kind: "request", suggestionRef: requestMatch[1] };
  }

  const openMatch = /^s:([A-Za-z0-9_-]{16,43})$/.exec(data);
  if (openMatch) {
    return { kind: "open", suggestionRef: openMatch[1] };
  }

  return null;
};

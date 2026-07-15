export const parseRequestCallback = (
  data: string
):
  | { kind: "accept"; requestRef: string }
  | { kind: "decline"; requestRef: string }
  | { kind: "cancel"; requestRef: string }
  | { kind: "open"; requestRef: string }
  | null => {
  const acceptMatch = /^q:a:([A-Za-z0-9_-]{16,43})$/.exec(data);
  if (acceptMatch?.[1]) {
    return { kind: "accept", requestRef: acceptMatch[1] };
  }

  const declineMatch = /^q:d:([A-Za-z0-9_-]{16,43})$/.exec(data);
  if (declineMatch?.[1]) {
    return { kind: "decline", requestRef: declineMatch[1] };
  }

  const cancelMatch = /^q:c:([A-Za-z0-9_-]{16,43})$/.exec(data);
  if (cancelMatch?.[1]) {
    return { kind: "cancel", requestRef: cancelMatch[1] };
  }

  const openMatch = /^q:([A-Za-z0-9_-]{16,43})$/.exec(data);
  if (openMatch?.[1]) {
    return { kind: "open", requestRef: openMatch[1] };
  }

  return null;
};

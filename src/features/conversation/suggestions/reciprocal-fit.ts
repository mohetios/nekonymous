export const fuseReciprocalScore = (
  requesterToCandidate: number,
  candidateToRequester: number
): number => {
  if (requesterToCandidate <= 0 || candidateToRequester <= 0) {
    return 0;
  }

  return (
    (2 * requesterToCandidate * candidateToRequester) /
    (requesterToCandidate + candidateToRequester)
  );
};

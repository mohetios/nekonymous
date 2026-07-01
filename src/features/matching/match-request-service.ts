import type { Environment } from "../../types";
import {
  decryptMatchIntro,
  encryptMatchIntro,
  generateOpaqueId,
} from "../../ticketing/ticketing-service";
import {
  getActiveSlugForUser,
  getUserById,
} from "../../features/identity/identity-service";
import {
  notifyRecipientInbox,
  sendAnonymousMessage,
} from "../../features/messaging/messaging-service";
import { enqueueTelegramOutbox, sendViaOutboxDo } from "../../storage/telegram-outbox-client";
import type { MessagePayload } from "../../types";
import { clearDraft } from "../../storage/user-state-client";
import { incrementPlatformStat } from "../platform/platform-stats-service";
import {
  MATCH_REQUEST_TTL_MS,
  MATCH_PENDING_LIST_LIMIT,
} from "./constants";
import type { MatchRequestRow } from "./match-types";
import {
  canCreateMatchRequest,
  getMatchSuggestion,
  hasPendingMatchBetweenUsers,
  isCandidateEligible,
  markSuggestionAction,
  recordMatchEvent,
} from "./match-service";
import { parseMatchExplanation } from "./match-scoring";
import {
  getMatchQualityLabel,
} from "./match-quality";
import {
  buildIncomingMatchRequestKeyboard,
  formatIncomingMatchRequestMessage,
} from "./keyboards";

export type PendingMatchRequests = {
  incoming: MatchRequestRow[];
  outgoing: MatchRequestRow[];
};

export const getMatchRequest = async (
  requestId: string,
  env: Environment
): Promise<MatchRequestRow | null> =>
  env.DB.prepare("SELECT * FROM match_requests WHERE id = ?")
    .bind(requestId)
    .first<MatchRequestRow>();

export const listPendingMatchRequests = async (
  userId: string,
  env: Environment
): Promise<PendingMatchRequests> => {
  const now = Date.now();
  const rows = await env.DB.prepare(
    `SELECT * FROM match_requests
     WHERE status = 'pending'
       AND (expires_at IS NULL OR expires_at > ?)
       AND (requester_user_id = ? OR candidate_user_id = ?)
     ORDER BY created_at DESC
     LIMIT ?`
  )
    .bind(now, userId, userId, MATCH_PENDING_LIST_LIMIT)
    .all<MatchRequestRow>();

  const incoming: MatchRequestRow[] = [];
  const outgoing: MatchRequestRow[] = [];

  for (const row of rows.results ?? []) {
    if (row.candidate_user_id === userId) {
      incoming.push(row);
    } else if (row.requester_user_id === userId) {
      outgoing.push(row);
    }
  }

  return { incoming, outgoing };
};

export const cancelMatchRequest = async (
  requestId: string,
  requesterUserId: string,
  env: Environment
): Promise<{ ok: boolean; reason?: string; duplicate?: boolean }> => {
  const request = await getMatchRequest(requestId, env);
  if (!request) {
    return { ok: false, reason: "not_found" };
  }

  if (request.requester_user_id !== requesterUserId) {
    return { ok: false, reason: "forbidden" };
  }

  if (request.status === "cancelled") {
    return { ok: true, duplicate: true };
  }

  if (request.status !== "pending") {
    return { ok: false, reason: "already_handled" };
  }

  if (request.expires_at && request.expires_at < Date.now()) {
    await env.DB.prepare(
      `UPDATE match_requests SET status = 'expired', responded_at = ? WHERE id = ?`
    )
      .bind(Date.now(), requestId)
      .run();
    return { ok: false, reason: "expired" };
  }

  const now = Date.now();
  const updateResult = await env.DB.prepare(
    `UPDATE match_requests SET status = 'cancelled', responded_at = ? WHERE id = ? AND status = 'pending'`
  )
    .bind(now, requestId)
    .run();

  if (!updateResult.meta.changes) {
    const current = await getMatchRequest(requestId, env);
    if (current?.status === "cancelled") {
      return { ok: true, duplicate: true };
    }
    return { ok: false, reason: "already_handled" };
  }

  await recordMatchEvent(env, {
    type: "request_cancelled",
    userId: requesterUserId,
    targetUserId: request.candidate_user_id,
    matchRequestId: requestId,
  });

  return { ok: true };
};

const reopenMatchRequest = async (
  env: Environment,
  params: {
    requestId: string;
    introText: string;
    introCiphertext: string;
    candidateUserId: string;
    suggestionId: string;
    requesterUserId: string;
  }
): Promise<void> => {
  const now = Date.now();
  await env.DB.prepare(
    `UPDATE match_requests
     SET status = 'pending',
         intro_ciphertext = ?,
         created_at = ?,
         expires_at = ?,
         responded_at = NULL
     WHERE id = ?`
  )
    .bind(
      params.introCiphertext,
      now,
      now + MATCH_REQUEST_TTL_MS,
      params.requestId
    )
    .run();

  await markSuggestionAction(params.suggestionId, "requested", env);
  await recordMatchEvent(env, {
    type: "request_reopened",
    userId: params.requesterUserId,
    targetUserId: params.candidateUserId,
    matchRequestId: params.requestId,
  });

  await notifyCandidateOfRequest(
    env,
    params.requestId,
    params.introText,
    params.candidateUserId
  );
};

export const createMatchRequest = async (
  params: {
    requesterUserId: string;
    suggestionId: string;
    introText: string;
    env: Environment;
  }
): Promise<{ ok: boolean; requestId?: string; reason?: string }> => {
  const { requesterUserId, suggestionId, introText, env } = params;
  const trimmed = introText.trim();
  if (!trimmed) {
    return { ok: false, reason: "empty_intro" };
  }

  const gate = await canCreateMatchRequest(requesterUserId, env);
  if (!gate.ok) {
    return { ok: false, reason: gate.reason };
  }

  const suggestion = await getMatchSuggestion(
    suggestionId,
    requesterUserId,
    env
  );
  if (!suggestion) {
    return { ok: false, reason: "invalid_suggestion" };
  }

  if (
    !(await isCandidateEligible(
      env,
      requesterUserId,
      suggestion.candidate_user_id
    ))
  ) {
    return { ok: false, reason: "candidate_unavailable" };
  }

  if (
    await hasPendingMatchBetweenUsers(
      env,
      requesterUserId,
      suggestion.candidate_user_id
    )
  ) {
    return { ok: false, reason: "pending_exists" };
  }

  const requester = await getUserById(requesterUserId, env);
  if (!requester || requester.status !== "active") {
    return { ok: false, reason: "requester_inactive" };
  }

  const requestId = generateOpaqueId(12);
  const now = Date.now();
  const idempotencyKey = `req:${requesterUserId}:${suggestionId}`;

  const existing = await env.DB.prepare(
    "SELECT id, status, expires_at FROM match_requests WHERE idempotency_key = ?"
  )
    .bind(idempotencyKey)
    .first<{ id: string; status: MatchRequestRow["status"]; expires_at: number | null }>();

  if (existing) {
    if (existing.status === "accepted") {
      return { ok: false, reason: "already_accepted" };
    }

    const introCiphertext = await encryptMatchIntro(
      existing.id,
      trimmed,
      env.APP_MASTER_KEY
    );

    if (existing.status === "pending") {
      const expired =
        existing.expires_at !== null && existing.expires_at < Date.now();
      if (!expired) {
        await env.DB.prepare(
          `UPDATE match_requests
           SET intro_ciphertext = ?, created_at = ?, expires_at = ?
           WHERE id = ?`
        )
          .bind(
            introCiphertext,
            now,
            now + MATCH_REQUEST_TTL_MS,
            existing.id
          )
          .run();
        await notifyCandidateOfRequest(
          env,
          existing.id,
          trimmed,
          suggestion.candidate_user_id
        );
        await clearDraft(env, requesterUserId);
        return { ok: true, requestId: existing.id };
      }
    }

    if (
      existing.status === "pending" ||
      existing.status === "cancelled" ||
      existing.status === "declined" ||
      existing.status === "expired"
    ) {
      await reopenMatchRequest(env, {
        requestId: existing.id,
        introText: trimmed,
        introCiphertext,
        candidateUserId: suggestion.candidate_user_id,
        suggestionId,
        requesterUserId,
      });
      await clearDraft(env, requesterUserId);
      return { ok: true, requestId: existing.id };
    }
  }

  const introCiphertext = await encryptMatchIntro(
    requestId,
    trimmed,
    env.APP_MASTER_KEY
  );

  try {
    await env.DB.prepare(
      `INSERT INTO match_requests (
        id, requester_user_id, candidate_user_id,
        requester_profile_version, candidate_profile_version,
        score, vector_score, deterministic_score,
        explanation_json, intro_ciphertext,
        status, created_at, expires_at, idempotency_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`
    )
      .bind(
        requestId,
        requesterUserId,
        suggestion.candidate_user_id,
        suggestion.profile_version,
        suggestion.candidate_profile_version,
        suggestion.score,
        suggestion.vector_score,
        suggestion.deterministic_score,
        suggestion.explanation_json,
        introCiphertext,
        now,
        now + MATCH_REQUEST_TTL_MS,
        idempotencyKey
      )
      .run();
  } catch {
    const raced = await env.DB.prepare(
      "SELECT id, status, expires_at FROM match_requests WHERE idempotency_key = ?"
    )
      .bind(idempotencyKey)
      .first<{ id: string; status: MatchRequestRow["status"]; expires_at: number | null }>();
    if (raced) {
      if (raced.status === "accepted") {
        return { ok: false, reason: "already_accepted" };
      }
      const racedIntro = await encryptMatchIntro(
        raced.id,
        trimmed,
        env.APP_MASTER_KEY
      );
      if (raced.status === "pending") {
        const expired =
          raced.expires_at !== null && raced.expires_at < Date.now();
        if (!expired) {
          await notifyCandidateOfRequest(
            env,
            raced.id,
            trimmed,
            suggestion.candidate_user_id
          );
          await clearDraft(env, requesterUserId);
          return { ok: true, requestId: raced.id };
        }
      }
      if (
        raced.status === "pending" ||
        raced.status === "cancelled" ||
        raced.status === "declined" ||
        raced.status === "expired"
      ) {
        await reopenMatchRequest(env, {
          requestId: raced.id,
          introText: trimmed,
          introCiphertext: racedIntro,
          candidateUserId: suggestion.candidate_user_id,
          suggestionId,
          requesterUserId,
        });
        await clearDraft(env, requesterUserId);
        return { ok: true, requestId: raced.id };
      }
    }
    throw new Error("match request insert failed");
  }

  await markSuggestionAction(suggestionId, "requested", env);
  await incrementPlatformStat(env, "match_requests");
  await recordMatchEvent(env, {
    type: "request_created",
    userId: requesterUserId,
    targetUserId: suggestion.candidate_user_id,
    matchRequestId: requestId,
  });

  await notifyCandidateOfRequest(
    env,
    requestId,
    trimmed,
    suggestion.candidate_user_id
  );

  await clearDraft(env, requesterUserId);

  return { ok: true, requestId };
};

const notifyCandidateOfRequest = async (
  env: Environment,
  requestId: string,
  introText: string,
  candidateUserId: string
): Promise<void> => {
  const request = await getMatchRequest(requestId, env);
  if (!request) {
    return;
  }

  const candidate = await getUserById(candidateUserId, env);
  if (!candidate) {
    return;
  }

  const explanation = parseMatchExplanation(request.explanation_json);
  const qualityLabel = getMatchQualityLabel(request.score);

  const text = formatIncomingMatchRequestMessage({
    score: request.score,
    qualityLabel,
    explanation,
    introText,
  });

  const notifyKey = `match_req_notify:${requestId}:${Date.now()}`;
  const job = {
    idempotencyKey: notifyKey,
    chatCiphertext: candidate.telegram_chat_ciphertext,
    chatHash: candidate.telegram_user_hash,
    method: "sendMessage" as const,
    payload: {
      text,
      parse_mode: "HTML" as const,
      reply_markup: buildIncomingMatchRequestKeyboard(requestId),
    },
    priority: "normal" as const,
    createdAt: Date.now(),
  };

  const direct = await sendViaOutboxDo(env, job);
  if (!direct.ok) {
    await enqueueTelegramOutbox(env, job);
  }
};

export const acceptMatchRequest = async (
  requestId: string,
  candidateUserId: string,
  env: Environment
): Promise<{ ok: boolean; reason?: string; duplicate?: boolean }> => {
  const request = await getMatchRequest(requestId, env);
  if (!request) {
    return { ok: false, reason: "not_found" };
  }

  if (request.candidate_user_id !== candidateUserId) {
    return { ok: false, reason: "forbidden" };
  }

  if (request.status === "accepted") {
    return { ok: true, duplicate: true };
  }

  if (request.status !== "pending") {
    return {
      ok: false,
      reason: request.status === "expired" ? "expired" : "already_handled",
    };
  }

  if (request.expires_at && request.expires_at < Date.now()) {
    await env.DB.prepare(
      `UPDATE match_requests SET status = 'expired', responded_at = ? WHERE id = ?`
    )
      .bind(Date.now(), requestId)
      .run();
    return { ok: false, reason: "expired" };
  }

  if (
    !(await isCandidateEligible(
      env,
      request.requester_user_id,
      request.candidate_user_id,
      undefined,
      { forAccept: true }
    ))
  ) {
    return { ok: false, reason: "ineligible" };
  }

  const introText = await decryptMatchIntro(
    requestId,
    request.intro_ciphertext,
    env.APP_MASTER_KEY
  );

  const [requester, candidate] = await Promise.all([
    getUserById(request.requester_user_id, env),
    getUserById(request.candidate_user_id, env),
  ]);

  if (!requester || !candidate) {
    return { ok: false, reason: "user_missing" };
  }

  const linkSlug = await getActiveSlugForUser(candidate.id, env);
  if (!linkSlug) {
    return { ok: false, reason: "no_slug" };
  }

  const payload: MessagePayload = {
    message_type: "text",
    message_text: introText,
    telegramMessageId: 0,
    createdAt: Date.now(),
  };

  const sendResult = await sendAnonymousMessage(env, {
    sender: requester,
    recipient: candidate,
    payload,
    linkSlug,
    isThreadReply: false,
    dedupeKey: `match:${requestId}`,
  });

  if (!sendResult.ok) {
    return { ok: false, reason: "send_failed" };
  }

  const now = Date.now();
  const updateResult = await env.DB.prepare(
    `UPDATE match_requests SET status = 'accepted', responded_at = ? WHERE id = ? AND status = 'pending'`
  )
    .bind(now, requestId)
    .run();

  if (!updateResult.meta.changes) {
    const current = await getMatchRequest(requestId, env);
    if (current?.status === "accepted") {
      return { ok: true, duplicate: true };
    }
    return { ok: false, reason: "already_handled" };
  }

  await recordMatchEvent(env, {
    type: "request_accepted",
    userId: candidateUserId,
    targetUserId: request.requester_user_id,
    matchRequestId: requestId,
  });

  if (sendResult.notify && sendResult.pendingCount) {
    try {
      await notifyRecipientInbox(
        env,
        candidate,
        sendResult.pendingCount,
        sendResult.ticketHash ?? `match:${requestId}`
      );
    } catch {
      // non-fatal
    }
  }

  const { MATCH_ACCEPTED_REQUESTER } = await import("./match-copy");
  await enqueueTelegramOutbox(env, {
    idempotencyKey: `match_accepted:${requestId}`,
    chatCiphertext: requester.telegram_chat_ciphertext,
    chatHash: requester.telegram_user_hash,
    method: "sendMessage",
    payload: {
      text: MATCH_ACCEPTED_REQUESTER,
      parse_mode: "HTML",
    },
    priority: "normal",
    createdAt: now,
  });

  return { ok: true };
};

export const declineMatchRequest = async (
  requestId: string,
  candidateUserId: string,
  env: Environment
): Promise<{ ok: boolean; reason?: string; duplicate?: boolean }> => {
  const request = await getMatchRequest(requestId, env);
  if (!request) {
    return { ok: false, reason: "not_found" };
  }

  if (request.candidate_user_id !== candidateUserId) {
    return { ok: false, reason: "forbidden" };
  }

  if (request.status === "declined") {
    return { ok: true, duplicate: true };
  }

  if (request.status !== "pending") {
    return { ok: false, reason: "already_handled" };
  }

  const now = Date.now();
  await env.DB.prepare(
    `UPDATE match_requests SET status = 'declined', responded_at = ? WHERE id = ? AND status = 'pending'`
  )
    .bind(now, requestId)
    .run();

  await env.DB.prepare(
    `INSERT INTO match_blocks (user_id, blocked_user_id, reason, created_at)
     VALUES (?, ?, 'declined', ?)
     ON CONFLICT(user_id, blocked_user_id) DO UPDATE SET created_at = excluded.created_at`
  )
    .bind(candidateUserId, request.requester_user_id, now)
    .run();

  await recordMatchEvent(env, {
    type: "request_declined",
    userId: candidateUserId,
    targetUserId: request.requester_user_id,
    matchRequestId: requestId,
  });

  const requester = await getUserById(request.requester_user_id, env);
  if (requester) {
    const { MATCH_DECLINED_REQUESTER } = await import("./match-copy");
    await enqueueTelegramOutbox(env, {
      idempotencyKey: `match_declined:${requestId}`,
      chatCiphertext: requester.telegram_chat_ciphertext,
      chatHash: requester.telegram_user_hash,
      method: "sendMessage",
      payload: {
        text: MATCH_DECLINED_REQUESTER,
        parse_mode: "HTML",
      },
      priority: "normal",
      createdAt: now,
    });
  }

  return { ok: true };
};

import type { Environment } from "../types";
import { encryptReportDetails, generateOpaqueId } from "./crypto-service";

export const createReport = async (
  env: Environment,
  input: {
    reporterUserId: string;
    reportedUserId?: string;
    conversationId?: string;
    ticketRef?: string;
    reasonCode: string;
    details?: string;
  }
): Promise<string> => {
  const id = generateOpaqueId(12);
  const now = Date.now();
  const detailsCiphertext = input.details
    ? await encryptReportDetails(input.details, env.APP_MASTER_KEY)
    : null;

  await env.DB.prepare(
    `INSERT INTO reports (
      id, reporter_user_id, reported_user_id, conversation_id, ticket_ref,
      reason_code, details_ciphertext, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?)`
  )
    .bind(
      id,
      input.reporterUserId,
      input.reportedUserId ?? null,
      input.conversationId ?? null,
      input.ticketRef ?? null,
      input.reasonCode,
      detailsCiphertext,
      now
    )
    .run();

  if (input.conversationId) {
    await env.DB.prepare(
      "UPDATE conversations SET report_count = report_count + 1, updated_at = ? WHERE id = ?"
    )
      .bind(now, input.conversationId)
      .run();
  }

  return id;
};

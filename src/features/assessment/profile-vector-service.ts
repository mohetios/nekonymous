import type { Environment } from "../../types";
import { generateOpaqueId } from "../../crypto/crypto-service";
import {
  PROFILE_EMBEDDING_DIMENSION,
  PROFILE_EMBEDDING_MODEL,
} from "./constants";
import { buildProfileEmbeddingText } from "./profile-summary";
import type { AssessmentResultSummary, AssessmentScores } from "./scoring";
import { updateProfileVectorStatus } from "./assessment-profile-service";

export type ProfileVectorMetadata = {
  userId: string;
  locale: "fa" | "en";
  discoverable: boolean;
  safetyTier: "normal" | "limited";
  profileVersion: string;
  intentPrimary: string;
  profileBucket: number;
};

export const buildProfileVectorId = (
  userId: string,
  version: string
): string => `profile:${userId}:${version}`;

const extractEmbedding = (response: unknown): number[] => {
  const data = response as { data?: number[][] | number[] };
  if (Array.isArray(data.data)) {
    const first = data.data[0];
    if (Array.isArray(first)) {
      return first;
    }
    if (typeof first === "number") {
      return data.data as number[];
    }
  }
  throw new Error("Unexpected embedding response shape");
};

export const indexCompletedProfile = async (params: {
  userId: string;
  version: string;
  locale: "fa" | "en";
  scores: AssessmentScores;
  resultSummary: AssessmentResultSummary;
  profileSummaryText: string;
  discoverable: boolean;
  safetyTier: "normal" | "limited";
  primaryIntent: string;
  profileBucket: number;
  env: Environment;
}): Promise<{ vectorId: string; model: string; dimension?: number }> => {
  const {
    userId,
    version,
    locale,
    scores,
    resultSummary,
    profileSummaryText,
    discoverable,
    safetyTier,
    primaryIntent,
    profileBucket,
    env,
  } = params;

  const vectorId = buildProfileVectorId(userId, version);
  const eventId = generateOpaqueId(12);
  const now = Date.now();
  const text =
    profileSummaryText ||
    buildProfileEmbeddingText(scores, resultSummary, locale);

  await env.DB.prepare(
    `INSERT INTO profile_vector_index_events (
      id, user_id, vector_id, profile_version, status, model, created_at
    ) VALUES (?, ?, ?, ?, 'started', ?, ?)`
  )
    .bind(eventId, userId, vectorId, version, PROFILE_EMBEDDING_MODEL, now)
    .run();

  try {
    const embeddingResponse = await env.AI.run(PROFILE_EMBEDDING_MODEL, {
      text: [text],
    });

    const values = extractEmbedding(embeddingResponse);
    const dimension = values.length;

    if (dimension !== PROFILE_EMBEDDING_DIMENSION) {
      throw new Error(
        `Embedding dimension mismatch: expected ${PROFILE_EMBEDDING_DIMENSION}, got ${dimension}`
      );
    }

    const metadata: ProfileVectorMetadata = {
      userId,
      locale,
      discoverable,
      safetyTier,
      profileVersion: version,
      intentPrimary: primaryIntent,
      profileBucket,
    };

    await env.PROFILE_VECTORS.upsert([
      {
        id: vectorId,
        values,
        metadata: {
          userId: metadata.userId,
          locale: metadata.locale,
          discoverable: metadata.discoverable,
          safetyTier: metadata.safetyTier,
          profileVersion: metadata.profileVersion,
          intentPrimary: metadata.intentPrimary,
          profileBucket: metadata.profileBucket,
        },
      },
    ]);

    await updateProfileVectorStatus(
      userId,
      vectorId,
      "indexed",
      text,
      env
    );

    await env.DB.prepare(
      `UPDATE profile_vector_index_events
       SET status = 'completed', dimension = ?, completed_at = ?
       WHERE id = ?`
    )
      .bind(dimension, Date.now(), eventId)
      .run();

    return { vectorId, model: PROFILE_EMBEDDING_MODEL, dimension };
  } catch (error) {
    const message =
      error instanceof Error ? error.message.slice(0, 200) : "indexing failed";

    await updateProfileVectorStatus(userId, vectorId, "failed", text, env);

    await env.DB.prepare(
      `UPDATE profile_vector_index_events
       SET status = 'failed', error_message = ?, completed_at = ?
       WHERE id = ?`
    )
      .bind(message, Date.now(), eventId)
      .run();

    throw error;
  }
};

/** Non-fatal wrapper: logs failure via D1 event row, does not throw to caller. */
export const indexCompletedProfileSafe = async (
  params: Parameters<typeof indexCompletedProfile>[0]
): Promise<void> => {
  try {
    await indexCompletedProfile(params);
  } catch {
    // Vector indexing failure is non-fatal; status recorded in D1.
  }
};

export const updateVectorDiscoverability = async (
  userId: string,
  enabled: boolean,
  env: Environment
): Promise<void> => {
  const row = await env.DB.prepare(
    "SELECT * FROM test_profiles WHERE user_id = ?"
  )
    .bind(userId)
    .first<{
      vector_id: string | null;
      vector_status: string;
      version: string;
      locale?: string;
      safety_tier: string;
      primary_intent: string;
      profile_bucket: number;
    }>();

  if (!row?.vector_id || row.vector_status !== "indexed") {
    return;
  }

  const stored = await env.PROFILE_VECTORS.getByIds([row.vector_id]);
  const vector = stored[0];
  if (!vector?.values?.length) {
    return;
  }

  const user = await env.DB.prepare("SELECT locale FROM users WHERE id = ?")
    .bind(userId)
    .first<{ locale: string }>();

  const locale = user?.locale === "en" ? "en" : "fa";

  await env.PROFILE_VECTORS.upsert([
    {
      id: row.vector_id,
      values: vector.values,
      metadata: {
        userId,
        locale,
        discoverable: enabled,
        safetyTier: row.safety_tier,
        profileVersion: row.version,
        intentPrimary: row.primary_intent,
        profileBucket: row.profile_bucket,
      },
    },
  ]);
};

import { DurableObject } from "cloudflare:workers";
import type { Environment } from "../../types";
import type {
  IndexJobRecord,
  IndexJobStatus,
  ProfileVaultRecord,
  ProfileVaultRecordStatus,
  StoreIndexJobInput,
  StoreProfileInput,
  StoreVectorRouteInput,
  VectorRouteRecord,
} from "./profile-vault.types";

type ProfileRow = {
  profile_hash: string;
  owner_proof_tag: string;
  profile_enc: string;
  route_enc: string;
  revision: number;
  status: string;
  created_at: number;
  updated_at: number;
};

type IndexJobRow = {
  job_hash: string;
  route_enc: string;
  revision: number;
  status: string;
  vectors_enc: string | null;
  created_at: number;
  expires_at: number;
};

type VectorRouteRow = {
  vector_hash: string;
  vector_route_enc: string;
  role: string;
  revision: number;
  status: string;
  created_at: number;
  updated_at: number;
};

const isSafeHash = (value: string): boolean =>
  /^[A-Za-z0-9_-]{32,86}$/.test(value);

const rowToProfile = (row: ProfileRow): ProfileVaultRecord => ({
  profileHash: row.profile_hash,
  ownerProofTag: row.owner_proof_tag,
  profileEnc: row.profile_enc,
  routeEnc: row.route_enc,
  revision: row.revision,
  status: row.status as ProfileVaultRecord["status"],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const rowToIndexJob = (row: IndexJobRow): IndexJobRecord => ({
  jobHash: row.job_hash,
  routeEnc: row.route_enc,
  revision: row.revision,
  status: row.status as IndexJobRecord["status"],
  vectorsEnc: row.vectors_enc ?? null,
  createdAt: row.created_at,
  expiresAt: row.expires_at,
});

const rowToVectorRoute = (row: VectorRouteRow): VectorRouteRecord => ({
  vectorHash: row.vector_hash,
  vectorRouteEnc: row.vector_route_enc,
  role: row.role as VectorRouteRecord["role"],
  revision: row.revision,
  status: row.status as VectorRouteRecord["status"],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export class ProfileVaultShardDurableObject extends DurableObject<Environment> {
  constructor(ctx: DurableObjectState, env: Environment) {
    super(ctx, env);
    void ctx.blockConcurrencyWhile(() => {
      this.ensureSchema();
      return Promise.resolve();
    });
  }

  private ensureSchema(): void {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS _sql_schema_migrations (
        id INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS profiles (
        profile_hash TEXT PRIMARY KEY,
        owner_proof_tag TEXT NOT NULL,
        profile_enc TEXT NOT NULL,
        route_enc TEXT NOT NULL,
        revision INTEGER NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_profiles_status_updated
        ON profiles(status, updated_at);

      CREATE TABLE IF NOT EXISTS vector_routes (
        vector_hash TEXT PRIMARY KEY,
        vector_route_enc TEXT NOT NULL,
        role TEXT NOT NULL,
        revision INTEGER NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_vector_routes_revision
        ON vector_routes(revision, status);

      CREATE TABLE IF NOT EXISTS index_jobs (
        job_hash TEXT PRIMARY KEY,
        route_enc TEXT NOT NULL,
        revision INTEGER NOT NULL,
        status TEXT NOT NULL,
        vectors_enc TEXT,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_index_jobs_status_expires
        ON index_jobs(status, expires_at);

      INSERT OR IGNORE INTO _sql_schema_migrations (id) VALUES (1);
    `);

    const hasVectorsEnc = this.ctx.storage.sql
      .exec<{ name: string }>("PRAGMA table_info(index_jobs)")
      .toArray()
      .some((column) => column.name === "vectors_enc");
    if (!hasVectorsEnc) {
      this.ctx.storage.sql.exec("ALTER TABLE index_jobs ADD COLUMN vectors_enc TEXT");
    }
  }

  storeProfile(body: StoreProfileInput): void {
    if (
      !body.profileHash ||
      !isSafeHash(body.profileHash) ||
      !body.ownerProofTag ||
      !body.profileEnc ||
      !body.routeEnc ||
      !Number.isInteger(body.revision) ||
      body.revision < 1 ||
      !body.status
    ) {
      throw new Error("Invalid profile payload");
    }

    const now = Date.now();
    this.ctx.storage.sql.exec(
      `INSERT INTO profiles (
        profile_hash, owner_proof_tag, profile_enc, route_enc,
        revision, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(profile_hash) DO UPDATE SET
        owner_proof_tag = excluded.owner_proof_tag,
        profile_enc = excluded.profile_enc,
        route_enc = excluded.route_enc,
        revision = excluded.revision,
        status = excluded.status,
        updated_at = excluded.updated_at`,
      body.profileHash,
      body.ownerProofTag,
      body.profileEnc,
      body.routeEnc,
      body.revision,
      body.status,
      now,
      now
    );
  }

  getProfile(profileHash: string): ProfileVaultRecord | null {
    if (!isSafeHash(profileHash)) {
      return null;
    }

    const row = this.ctx.storage.sql
      .exec<ProfileRow>("SELECT * FROM profiles WHERE profile_hash = ? LIMIT 1", profileHash)
      .toArray()[0];

    return row ? rowToProfile(row) : null;
  }

  setProfileStatus(
    profileHash: string,
    status: ProfileVaultRecordStatus,
    expectedRevision?: number
  ): void {
    if (!isSafeHash(profileHash) || !status) {
      return;
    }

    const now = Date.now();
    if (Number.isInteger(expectedRevision)) {
      this.ctx.storage.sql.exec(
        `UPDATE profiles SET status = ?, updated_at = ?
         WHERE profile_hash = ? AND revision = ?`,
        status,
        now,
        profileHash,
        expectedRevision
      );
    } else {
      this.ctx.storage.sql.exec(
        "UPDATE profiles SET status = ?, updated_at = ? WHERE profile_hash = ?",
        status,
        now,
        profileHash
      );
    }
  }

  updateProfileRoute(
    profileHash: string,
    routeEnc: string
  ): void {
    if (!isSafeHash(profileHash) || !routeEnc) {
      return;
    }

    const now = Date.now();
    this.ctx.storage.sql.exec(
      "UPDATE profiles SET route_enc = ?, updated_at = ? WHERE profile_hash = ?",
      routeEnc,
      now,
      profileHash
    );
  }

  storeVectorRoute(body: StoreVectorRouteInput): void {
    if (
      !body.vectorHash ||
      !isSafeHash(body.vectorHash) ||
      !body.vectorRouteEnc ||
      !body.role ||
      !Number.isInteger(body.revision) ||
      body.revision < 1 ||
      !body.status
    ) {
      throw new Error("Invalid vector route payload");
    }

    const now = Date.now();
    this.ctx.storage.sql.exec(
      `INSERT INTO vector_routes (
        vector_hash, vector_route_enc, role, revision, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(vector_hash) DO UPDATE SET
        vector_route_enc = excluded.vector_route_enc,
        role = excluded.role,
        revision = excluded.revision,
        status = excluded.status,
        updated_at = excluded.updated_at`,
      body.vectorHash,
      body.vectorRouteEnc,
      body.role,
      body.revision,
      body.status,
      now,
      now
    );
  }

  getVectorRoute(vectorHash: string): VectorRouteRecord | null {
    if (!isSafeHash(vectorHash)) {
      return null;
    }

    const row = this.ctx.storage.sql
      .exec<VectorRouteRow>(
        "SELECT * FROM vector_routes WHERE vector_hash = ? LIMIT 1",
        vectorHash
      )
      .toArray()[0];

    return row ? rowToVectorRoute(row) : null;
  }

  storeIndexJob(body: StoreIndexJobInput): void {
    if (
      !body.jobHash ||
      !isSafeHash(body.jobHash) ||
      !body.routeEnc ||
      !Number.isInteger(body.revision) ||
      body.revision < 1 ||
      !body.status ||
      !Number.isInteger(body.expiresAt)
    ) {
      throw new Error("Invalid index job payload");
    }

    const now = Date.now();
    this.ctx.storage.sql.exec(
      `INSERT INTO index_jobs (
        job_hash, route_enc, revision, status, created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(job_hash) DO UPDATE SET
        route_enc = excluded.route_enc,
        revision = excluded.revision,
        status = excluded.status,
        expires_at = excluded.expires_at`,
      body.jobHash,
      body.routeEnc,
      body.revision,
      body.status,
      now,
      body.expiresAt
    );
  }

  getIndexJob(jobHash: string): IndexJobRecord | null {
    if (!isSafeHash(jobHash)) {
      return null;
    }

    const row = this.ctx.storage.sql
      .exec<IndexJobRow>("SELECT * FROM index_jobs WHERE job_hash = ? LIMIT 1", jobHash)
      .toArray()[0];

    return row ? rowToIndexJob(row) : null;
  }

  setIndexJobStatus(
    jobHash: string,
    status: IndexJobStatus,
    vectorsEnc?: string | null
  ): void {
    if (!isSafeHash(jobHash) || !status) {
      return;
    }

    if (typeof vectorsEnc === "string" && vectorsEnc.length > 0) {
      this.ctx.storage.sql.exec(
        "UPDATE index_jobs SET status = ?, vectors_enc = ? WHERE job_hash = ?",
        status,
        vectorsEnc,
        jobHash
      );
    } else {
      this.ctx.storage.sql.exec(
        "UPDATE index_jobs SET status = ? WHERE job_hash = ?",
        status,
        jobHash
      );
    }
  }
}

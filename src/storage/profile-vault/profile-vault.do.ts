import { DurableObject } from "cloudflare:workers";
import type { Environment } from "../../types";
import type {
  IndexJobRecord,
  ProfileVaultRecord,
  ProfileVaultShardPing,
  VectorRouteRecord,
} from "./profile-vault.types";

export type { ProfileVaultShardPing } from "./profile-vault.types";

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

  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (request.method === "POST" && pathname === "/profiles") {
      return this.storeProfile(request);
    }

    if (pathname.startsWith("/profiles/")) {
      const rest = pathname.slice("/profiles/".length);
      if (rest.endsWith("/status")) {
        const profileHash = decodeURIComponent(rest.slice(0, -"/status".length));
        if (!isSafeHash(profileHash)) {
          return new Response("Invalid profile hash", { status: 400 });
        }
        if (request.method === "POST") {
          return this.setProfileStatus(profileHash, request);
        }
      } else if (rest.endsWith("/route")) {
        const profileHash = decodeURIComponent(rest.slice(0, -"/route".length));
        if (!isSafeHash(profileHash)) {
          return new Response("Invalid profile hash", { status: 400 });
        }
        if (request.method === "POST") {
          return this.updateProfileRoute(profileHash, request);
        }
      } else {
        const profileHash = decodeURIComponent(rest);
        if (!isSafeHash(profileHash)) {
          return new Response("Invalid profile hash", { status: 400 });
        }
        if (request.method === "GET") {
          return this.getProfile(profileHash);
        }
      }
    }

    if (request.method === "POST" && pathname === "/vector-routes") {
      return this.storeVectorRoute(request);
    }

    if (pathname.startsWith("/vector-routes/")) {
      const vectorHash = decodeURIComponent(pathname.slice("/vector-routes/".length));
      if (!isSafeHash(vectorHash)) {
        return new Response("Invalid vector hash", { status: 400 });
      }
      if (request.method === "GET") {
        return this.getVectorRoute(vectorHash);
      }
    }

    if (request.method === "POST" && pathname === "/index-jobs") {
      return this.storeIndexJob(request);
    }

    if (pathname.startsWith("/index-jobs/")) {
      const rest = pathname.slice("/index-jobs/".length);
      if (rest.endsWith("/status")) {
        const jobHash = decodeURIComponent(rest.slice(0, -"/status".length));
        if (!isSafeHash(jobHash)) {
          return new Response("Invalid index job hash", { status: 400 });
        }
        if (request.method === "POST") {
          return this.setIndexJobStatus(jobHash, request);
        }
      } else {
        const jobHash = decodeURIComponent(rest);
        if (!isSafeHash(jobHash)) {
          return new Response("Invalid index job hash", { status: 400 });
        }
        if (request.method === "GET") {
          return this.getIndexJob(jobHash);
        }
      }
    }

    return new Response("Not Found", { status: 404 });
  }

  private async storeProfile(request: Request): Promise<Response> {
    const body = await request.json<{
      profileHash: string;
      ownerProofTag: string;
      profileEnc: string;
      routeEnc: string;
      revision: number;
      status: string;
    }>();

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
      return new Response("Invalid profile payload", { status: 400 });
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

    return Response.json({ ok: true });
  }

  private getProfile(profileHash: string): Response {
    const row = this.ctx.storage.sql
      .exec<ProfileRow>("SELECT * FROM profiles WHERE profile_hash = ? LIMIT 1", profileHash)
      .toArray()[0];

    return Response.json({ record: row ? rowToProfile(row) : null });
  }

  private async setProfileStatus(
    profileHash: string,
    request: Request
  ): Promise<Response> {
    const body = await request.json<{
      status: string;
      expectedRevision?: number;
    }>();

    if (!body.status) {
      return new Response("Invalid status payload", { status: 400 });
    }

    const now = Date.now();
    if (Number.isInteger(body.expectedRevision)) {
      this.ctx.storage.sql.exec(
        `UPDATE profiles SET status = ?, updated_at = ?
         WHERE profile_hash = ? AND revision = ?`,
        body.status,
        now,
        profileHash,
        body.expectedRevision
      );
    } else {
      this.ctx.storage.sql.exec(
        "UPDATE profiles SET status = ?, updated_at = ? WHERE profile_hash = ?",
        body.status,
        now,
        profileHash
      );
    }

    return Response.json({ ok: true });
  }

  private async updateProfileRoute(
    profileHash: string,
    request: Request
  ): Promise<Response> {
    const body = await request.json<{ routeEnc?: string }>();
    if (!body.routeEnc) {
      return new Response("Invalid profile route payload", { status: 400 });
    }

    const now = Date.now();
    this.ctx.storage.sql.exec(
      "UPDATE profiles SET route_enc = ?, updated_at = ? WHERE profile_hash = ?",
      body.routeEnc,
      now,
      profileHash
    );

    return Response.json({ ok: true });
  }

  private async storeVectorRoute(request: Request): Promise<Response> {
    const body = await request.json<{
      vectorHash: string;
      vectorRouteEnc: string;
      role: string;
      revision: number;
      status: string;
    }>();

    if (
      !body.vectorHash ||
      !isSafeHash(body.vectorHash) ||
      !body.vectorRouteEnc ||
      !body.role ||
      !Number.isInteger(body.revision) ||
      body.revision < 1 ||
      !body.status
    ) {
      return new Response("Invalid vector route payload", { status: 400 });
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

    return Response.json({ ok: true });
  }

  private getVectorRoute(vectorHash: string): Response {
    const row = this.ctx.storage.sql
      .exec<VectorRouteRow>(
        "SELECT * FROM vector_routes WHERE vector_hash = ? LIMIT 1",
        vectorHash
      )
      .toArray()[0];

    return Response.json({ record: row ? rowToVectorRoute(row) : null });
  }

  private async storeIndexJob(request: Request): Promise<Response> {
    const body = await request.json<{
      jobHash: string;
      routeEnc: string;
      revision: number;
      status: string;
      expiresAt: number;
    }>();

    if (
      !body.jobHash ||
      !isSafeHash(body.jobHash) ||
      !body.routeEnc ||
      !Number.isInteger(body.revision) ||
      body.revision < 1 ||
      !body.status ||
      !Number.isInteger(body.expiresAt)
    ) {
      return new Response("Invalid index job payload", { status: 400 });
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

    return Response.json({ ok: true });
  }

  private getIndexJob(jobHash: string): Response {
    const row = this.ctx.storage.sql
      .exec<IndexJobRow>("SELECT * FROM index_jobs WHERE job_hash = ? LIMIT 1", jobHash)
      .toArray()[0];

    return Response.json({ record: row ? rowToIndexJob(row) : null });
  }

  private async setIndexJobStatus(
    jobHash: string,
    request: Request
  ): Promise<Response> {
    const body = await request.json<{
      status: string;
      vectorsEnc?: string | null;
    }>();

    if (!body.status) {
      return new Response("Invalid index job status payload", { status: 400 });
    }

    if (typeof body.vectorsEnc === "string" && body.vectorsEnc.length > 0) {
      this.ctx.storage.sql.exec(
        "UPDATE index_jobs SET status = ?, vectors_enc = ? WHERE job_hash = ?",
        body.status,
        body.vectorsEnc,
        jobHash
      );
    } else {
      this.ctx.storage.sql.exec(
        "UPDATE index_jobs SET status = ? WHERE job_hash = ?",
        body.status,
        jobHash
      );
    }

    return Response.json({ ok: true });
  }

  ping(): ProfileVaultShardPing {
    const profiles =
      this.ctx.storage.sql
        .exec<{ n: number }>("SELECT COUNT(*) AS n FROM profiles")
        .one().n ?? 0;
    const vectorRoutes =
      this.ctx.storage.sql
        .exec<{ n: number }>("SELECT COUNT(*) AS n FROM vector_routes")
        .one().n ?? 0;
    const indexJobs =
      this.ctx.storage.sql
        .exec<{ n: number }>("SELECT COUNT(*) AS n FROM index_jobs")
        .one().n ?? 0;

    return {
      ok: true,
      plane: "profile",
      profiles,
      vectorRoutes,
      indexJobs,
    };
  }
}

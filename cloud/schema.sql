BEGIN;

-- Authentication tables are installed separately. Reserved beta identities and
-- password accounts share the same immutable user/workspace IDs.
CREATE TABLE IF NOT EXISTS fieldwork_workspaces (
  id text PRIMARY KEY,
  owner_user_id text NOT NULL UNIQUE,
  owner_email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fieldwork_record_state (
  workspace_id text PRIMARY KEY REFERENCES fieldwork_workspaces(id),
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  entries jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(entries) = 'array'),
  supervisors jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(supervisors) = 'array'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fieldwork_record_history (
  workspace_id text NOT NULL REFERENCES fieldwork_workspaces(id),
  revision bigint NOT NULL CHECK (revision > 0),
  entries jsonb NOT NULL CHECK (jsonb_typeof(entries) = 'array'),
  supervisors jsonb NOT NULL CHECK (jsonb_typeof(supervisors) = 'array'),
  actor_user_id text NOT NULL,
  mutation_id text NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
  request_hash text NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  source jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, revision),
  UNIQUE (workspace_id, mutation_id)
);

CREATE TABLE IF NOT EXISTS fieldwork_migration_receipts (
  workspace_id text NOT NULL,
  origin text NOT NULL,
  snapshot_hash text NOT NULL CHECK (snapshot_hash ~ '^[a-f0-9]{64}$'),
  revision bigint NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, origin, snapshot_hash),
  FOREIGN KEY (workspace_id, revision) REFERENCES fieldwork_record_history(workspace_id, revision)
);

-- Staged transport bytes may expire; committed ledger history never expires here.
CREATE TABLE IF NOT EXISTS fieldwork_record_uploads (
  workspace_id text NOT NULL REFERENCES fieldwork_workspaces(id),
  upload_id text NOT NULL,
  expected_revision bigint NOT NULL CHECK (expected_revision >= 0),
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  byte_length integer NOT NULL CHECK (byte_length BETWEEN 1 AND 26214400),
  chunk_count integer NOT NULL CHECK (chunk_count BETWEEN 1 AND 37),
  mutation_id text NOT NULL,
  source jsonb,
  completed_revision bigint,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, upload_id),
  UNIQUE (workspace_id, mutation_id)
);

CREATE INDEX IF NOT EXISTS fieldwork_record_uploads_expiry ON fieldwork_record_uploads(expires_at);

CREATE TABLE IF NOT EXISTS fieldwork_record_upload_chunks (
  workspace_id text NOT NULL,
  upload_id text NOT NULL,
  chunk_index integer NOT NULL CHECK (chunk_index BETWEEN 0 AND 36),
  bytes bytea NOT NULL CHECK (octet_length(bytes) BETWEEN 1 AND 716800),
  hash text NOT NULL CHECK (hash ~ '^[a-f0-9]{64}$'),
  PRIMARY KEY (workspace_id, upload_id, chunk_index),
  FOREIGN KEY (workspace_id, upload_id) REFERENCES fieldwork_record_uploads(workspace_id, upload_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS fieldwork_documents (
  workspace_id text NOT NULL REFERENCES fieldwork_workspaces(id),
  document_id text NOT NULL,
  hash text NOT NULL CHECK (hash ~ '^[a-f0-9]{64}$'),
  size integer NOT NULL CHECK (size BETWEEN 0 AND 26214400),
  metadata jsonb NOT NULL CHECK (jsonb_typeof(metadata) = 'object'),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, document_id)
);

CREATE TABLE IF NOT EXISTS fieldwork_document_chunks (
  workspace_id text NOT NULL,
  document_id text NOT NULL,
  chunk_index integer NOT NULL CHECK (chunk_index >= 0),
  bytes bytea NOT NULL CHECK (octet_length(bytes) <= 1048576),
  hash text NOT NULL CHECK (hash ~ '^[a-f0-9]{64}$'),
  PRIMARY KEY (workspace_id, document_id, chunk_index),
  FOREIGN KEY (workspace_id, document_id) REFERENCES fieldwork_documents(workspace_id, document_id)
);

CREATE TABLE IF NOT EXISTS fieldwork_archive_batches (
  workspace_id text NOT NULL REFERENCES fieldwork_workspaces(id),
  batch_id text NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  content_hash text NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
  byte_length integer NOT NULL CHECK (byte_length BETWEEN 0 AND 26214400),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, batch_id)
);

CREATE TABLE IF NOT EXISTS fieldwork_archive_batch_history (
  workspace_id text NOT NULL,
  batch_id text NOT NULL,
  version bigint NOT NULL CHECK (version > 0),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  content_hash text NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
  byte_length integer NOT NULL CHECK (byte_length BETWEEN 0 AND 26214400),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, batch_id, version),
  FOREIGN KEY (workspace_id, batch_id) REFERENCES fieldwork_archive_batches(workspace_id, batch_id)
);

CREATE TABLE IF NOT EXISTS fieldwork_archive_uploads (
  workspace_id text NOT NULL REFERENCES fieldwork_workspaces(id),
  upload_id text NOT NULL,
  batch_id text NOT NULL,
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  byte_length integer NOT NULL CHECK (byte_length BETWEEN 1 AND 26214400),
  expected_version bigint,
  completed_version bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, upload_id)
);

CREATE TABLE IF NOT EXISTS fieldwork_archive_upload_chunks (
  workspace_id text NOT NULL,
  upload_id text NOT NULL,
  chunk_index integer NOT NULL CHECK (chunk_index >= 0),
  bytes bytea NOT NULL CHECK (octet_length(bytes) <= 1048576),
  hash text NOT NULL CHECK (hash ~ '^[a-f0-9]{64}$'),
  PRIMARY KEY (workspace_id, upload_id, chunk_index),
  FOREIGN KEY (workspace_id, upload_id) REFERENCES fieldwork_archive_uploads(workspace_id, upload_id) ON DELETE CASCADE
);

-- Application bugs cannot rewrite audit history or already uploaded source bytes.
CREATE OR REPLACE FUNCTION fieldwork_reject_audit_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Fieldwork audit history is immutable' USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS fieldwork_record_history_immutable ON fieldwork_record_history;
CREATE TRIGGER fieldwork_record_history_immutable BEFORE UPDATE OR DELETE ON fieldwork_record_history
FOR EACH ROW EXECUTE FUNCTION fieldwork_reject_audit_mutation();

DROP TRIGGER IF EXISTS fieldwork_migration_receipts_immutable ON fieldwork_migration_receipts;
CREATE TRIGGER fieldwork_migration_receipts_immutable BEFORE UPDATE OR DELETE ON fieldwork_migration_receipts
FOR EACH ROW EXECUTE FUNCTION fieldwork_reject_audit_mutation();

DROP TRIGGER IF EXISTS fieldwork_archive_batch_history_immutable ON fieldwork_archive_batch_history;
CREATE TRIGGER fieldwork_archive_batch_history_immutable BEFORE UPDATE OR DELETE ON fieldwork_archive_batch_history
FOR EACH ROW EXECUTE FUNCTION fieldwork_reject_audit_mutation();

DROP TRIGGER IF EXISTS fieldwork_document_chunks_immutable ON fieldwork_document_chunks;
CREATE TRIGGER fieldwork_document_chunks_immutable BEFORE UPDATE OR DELETE ON fieldwork_document_chunks
FOR EACH ROW EXECUTE FUNCTION fieldwork_reject_audit_mutation();

CREATE OR REPLACE FUNCTION fieldwork_protect_document() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Original source documents cannot be deleted here' USING ERRCODE = '55000';
  END IF;
  IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
     OR NEW.document_id IS DISTINCT FROM OLD.document_id
     OR NEW.hash IS DISTINCT FROM OLD.hash
     OR NEW.size IS DISTINCT FROM OLD.size
     OR NEW.metadata IS DISTINCT FROM OLD.metadata
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR (OLD.verified_at IS NOT NULL AND NEW.verified_at IS DISTINCT FROM OLD.verified_at) THEN
    RAISE EXCEPTION 'Original source document metadata is immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fieldwork_document_immutable ON fieldwork_documents;
CREATE TRIGGER fieldwork_document_immutable BEFORE UPDATE OR DELETE ON fieldwork_documents
FOR EACH ROW EXECUTE FUNCTION fieldwork_protect_document();

COMMIT;

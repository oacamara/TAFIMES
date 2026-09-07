-- ============================================================
-- TAFIMES – Messagerie interne (Phase 1 / MVP)
-- Migration 002
--
-- A executer APRES 001_initial_schema.sql.
-- Idempotent : peut etre rejoue sans erreur.
-- ============================================================


-- ============================================================
-- 1. AJUSTEMENTS DES TABLES EXISTANTES
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;


-- ============================================================
-- 2. FONCTIONS D'AIDE (SECURITY DEFINER)
--
-- Elles contournent la RLS de la table qu'elles interrogent, ce qui
-- evite la recursion infinie quand une policy sur une table doit lire
-- cette meme table (ou une table dont la policy la reference en retour).
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    JOIN roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_conversation_member(_conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_members
    WHERE conversation_id = _conversation_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_conversation_owner(_conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_members
    WHERE conversation_id = _conversation_id
      AND user_id = auth.uid()
      AND role = 'owner'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_message(_message_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM messages m
    JOIN conversation_members cm ON cm.conversation_id = m.conversation_id
    WHERE m.id = _message_id AND cm.user_id = auth.uid()
  );
$$;


-- ============================================================
-- 3. CORRECTIF : recursion infinie sur profiles
--
-- L'ancienne policy "profiles_select" faisait un SELECT sur profiles
-- a l'interieur de sa propre expression -> erreur 42P17
-- "infinite recursion detected in policy for relation profiles".
-- On passe par is_app_admin() (SECURITY DEFINER).
-- ============================================================

DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT
  USING (id = auth.uid() OR public.is_app_admin());


-- ============================================================
-- 4. ANNUAIRE
--
-- Vue en SECURITY DEFINER (security_invoker = false) : tout utilisateur
-- authentifie lit le nom / l'avatar / le role de tous les autres, mais
-- JAMAIS leur email — la table profiles reste fermee.
-- C'est la seule facon d'avoir un filtrage a la colonne, la RLS ne
-- filtrant qu'a la ligne.
-- ============================================================

CREATE OR REPLACE VIEW public.user_directory
WITH (security_invoker = false) AS
SELECT
  p.id,
  p.name,
  p.avatar_url,
  COALESCE(r.name, 'operator') AS role_name
FROM profiles p
LEFT JOIN roles r ON r.id = p.role_id;

REVOKE ALL ON public.user_directory FROM anon;
GRANT SELECT ON public.user_directory TO authenticated;


-- ============================================================
-- 5. CONVERSATIONS (canaux + messages directs)
--
-- Une seule table pour les deux : un DM est une conversation privee
-- sans nom, a exactement deux membres. Cela evite de dupliquer messages,
-- RLS, pagination, non-lus et abonnements temps reel.
-- dm_key = 'uuid_le_plus_petit:uuid_le_plus_grand' -> unicite du DM par paire.
-- ============================================================

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('channel','dm')),
  name TEXT,
  slug TEXT UNIQUE,
  description TEXT,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('public','private')),
  dm_key TEXT UNIQUE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT conversations_shape CHECK (
    (type = 'channel' AND name IS NOT NULL AND slug IS NOT NULL AND dm_key IS NULL)
    OR
    (type = 'dm' AND name IS NULL AND slug IS NULL AND dm_key IS NOT NULL AND visibility = 'private')
  )
);

CREATE INDEX IF NOT EXISTS conversations_last_message_idx
  ON conversations (last_message_at DESC);

DROP TRIGGER IF EXISTS conversations_updated_at ON conversations;
CREATE TRIGGER conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- 6. MEMBRES D'UNE CONVERSATION
--
-- last_read_at porte le calcul des non-lus (pas de table de lecture
-- par message : inutile a 15 utilisateurs).
-- ============================================================

CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member')),
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  muted BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS conversation_members_user_idx
  ON conversation_members (user_id);


-- ============================================================
-- 7. MESSAGES
--
-- seq (identity) = curseur de pagination stable et monotone :
--   WHERE conversation_id = $1 AND seq < $curseur ORDER BY seq DESC LIMIT 50
-- Bien plus fiable qu'un curseur sur created_at (collisions a la ms).
-- ============================================================

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seq BIGINT GENERATED ALWAYS AS IDENTITY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL DEFAULT '',
  has_attachments BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ,
  search_vector TSVECTOR GENERATED ALWAYS AS (to_tsvector('french', COALESCE(body,''))) STORED,
  CONSTRAINT messages_not_empty CHECK (length(body) > 0 OR has_attachments)
);

CREATE UNIQUE INDEX IF NOT EXISTS messages_seq_key
  ON messages (seq);
CREATE INDEX IF NOT EXISTS messages_conversation_seq_idx
  ON messages (conversation_id, seq DESC);
CREATE INDEX IF NOT EXISTS messages_search_idx
  ON messages USING GIN (search_vector);

-- Remonte la conversation en tete de sidebar sans requete supplementaire.
CREATE OR REPLACE FUNCTION public.touch_conversation_on_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE conversations
     SET last_message_at = NEW.created_at
   WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_touch_conversation ON messages;
CREATE TRIGGER messages_touch_conversation
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_conversation_on_message();


-- ============================================================
-- 8. PIECES JOINTES
--
-- On stocke le CHEMIN dans le bucket, pas une URL : le bucket est prive,
-- les URLs sont signees a la demande et expirent.
-- ============================================================

CREATE TABLE IF NOT EXISTS message_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 5242880),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS message_attachments_message_idx
  ON message_attachments (message_id);


-- ============================================================
-- 9. ABONNEMENTS WEB PUSH
-- ============================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_success_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
  ON push_subscriptions (user_id);


-- ============================================================
-- 10. RPC
--
-- La creation d'une conversation passe obligatoirement par une RPC :
-- cela garantit l'invariant "toute conversation a au moins un membre
-- owner", impossible a tenir avec un simple INSERT sous RLS
-- (on ne peut pas s'ajouter a une conversation dont on n'est pas
-- encore membre).
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_channel(
  _name        TEXT,
  _description TEXT DEFAULT NULL,
  _visibility  TEXT DEFAULT 'public'
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _me   UUID := auth.uid();
  _id   UUID;
  _base TEXT;
  _slug TEXT;
  _n    INT := 1;
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;
  IF _visibility NOT IN ('public','private') THEN
    RAISE EXCEPTION 'Visibilite invalide: %', _visibility;
  END IF;

  _name := btrim(_name);
  IF length(_name) = 0 OR length(_name) > 80 THEN
    RAISE EXCEPTION 'Le nom du canal doit faire entre 1 et 80 caracteres';
  END IF;

  _base := btrim(regexp_replace(lower(_name), '[^a-z0-9]+', '-', 'g'), '-');
  IF _base = '' THEN
    _base := 'canal';
  END IF;
  _slug := _base;

  WHILE EXISTS (SELECT 1 FROM conversations WHERE slug = _slug) LOOP
    _n := _n + 1;
    _slug := _base || '-' || _n;
    IF _n > 200 THEN
      RAISE EXCEPTION 'Impossible de generer un slug unique pour %', _name;
    END IF;
  END LOOP;

  INSERT INTO conversations (type, name, slug, description, visibility, created_by)
  VALUES ('channel', _name, _slug, NULLIF(btrim(COALESCE(_description,'')),''), _visibility, _me)
  RETURNING id INTO _id;

  INSERT INTO conversation_members (conversation_id, user_id, role)
  VALUES (_id, _me, 'owner');

  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_dm(_other_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _me  UUID := auth.uid();
  _key TEXT;
  _id  UUID;
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;
  IF _other_user_id IS NULL OR _other_user_id = _me THEN
    RAISE EXCEPTION 'Destinataire invalide';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = _other_user_id) THEN
    RAISE EXCEPTION 'Utilisateur inconnu';
  END IF;

  _key := LEAST(_me::text, _other_user_id::text) || ':' ||
          GREATEST(_me::text, _other_user_id::text);

  SELECT id INTO _id FROM conversations WHERE dm_key = _key;

  IF _id IS NULL THEN
    BEGIN
      INSERT INTO conversations (type, visibility, dm_key, created_by)
      VALUES ('dm', 'private', _key, _me)
      RETURNING id INTO _id;
    EXCEPTION WHEN unique_violation THEN
      -- Creation concurrente du meme DM par les deux interlocuteurs.
      SELECT id INTO _id FROM conversations WHERE dm_key = _key;
    END;
  END IF;

  -- Idempotent : re-ajoute un membre qui aurait quitte la conversation.
  INSERT INTO conversation_members (conversation_id, user_id, role)
  VALUES (_id, _me, 'member'), (_id, _other_user_id, 'member')
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  RETURN _id;
END;
$$;

-- Un seul aller-retour pour tous les badges de la sidebar.
CREATE OR REPLACE FUNCTION public.get_unread_counts()
RETURNS TABLE (conversation_id UUID, unread_count BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT cm.conversation_id, COUNT(m.id)
  FROM conversation_members cm
  LEFT JOIN messages m
         ON m.conversation_id = cm.conversation_id
        AND m.created_at > cm.last_read_at
        AND m.sender_id <> cm.user_id
  WHERE cm.user_id = auth.uid()
  GROUP BY cm.conversation_id;
$$;

-- Autorisation des topics Realtime (presence + indicateur de frappe).
CREATE OR REPLACE FUNCTION public.can_use_realtime_topic(_topic TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE _cid UUID;
BEGIN
  IF _topic IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Presence globale "qui est en ligne" : tout utilisateur authentifie.
  IF _topic = 'presence:workspace' THEN
    RETURN auth.uid() IS NOT NULL;
  END IF;

  -- Frappe / presence par conversation : reserve aux membres.
  IF _topic LIKE 'conv:%' THEN
    BEGIN
      _cid := substring(_topic FROM 6)::UUID;
    EXCEPTION WHEN others THEN
      RETURN FALSE;
    END;
    RETURN public.is_conversation_member(_cid);
  END IF;

  RETURN FALSE;
END;
$$;

-- Autorisation d'acces a un objet du bucket message-attachments.
-- Le chemin est '<conversation_id>/<uuid>.<ext>'.
CREATE OR REPLACE FUNCTION public.can_access_attachment_path(_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE _cid UUID;
BEGIN
  BEGIN
    _cid := ((storage.foldername(_name))[1])::UUID;
  EXCEPTION WHEN others THEN
    RETURN FALSE;
  END;
  RETURN public.is_conversation_member(_cid);
END;
$$;


-- ============================================================
-- 11. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE conversations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages             ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_attachments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions   ENABLE ROW LEVEL SECURITY;

-- ---------- conversations ----------
-- Les canaux publics sont visibles de tous (pour pouvoir les rejoindre) ;
-- les canaux prives et les DM ne sont visibles que de leurs membres.
-- Pas de policy INSERT : la creation passe par create_channel/get_or_create_dm.
DROP POLICY IF EXISTS "conversations_select" ON conversations;
CREATE POLICY "conversations_select" ON conversations FOR SELECT TO authenticated
  USING (
    (type = 'channel' AND visibility = 'public')
    OR public.is_conversation_member(id)
    OR public.is_app_admin()
  );

DROP POLICY IF EXISTS "conversations_update" ON conversations;
CREATE POLICY "conversations_update" ON conversations FOR UPDATE TO authenticated
  USING (public.is_conversation_owner(id) OR public.is_app_admin())
  WITH CHECK (public.is_conversation_owner(id) OR public.is_app_admin());

-- Seules la description, la visibilite et l'archivage sont modifiables.
REVOKE UPDATE ON conversations FROM authenticated;
GRANT  UPDATE (name, description, visibility, archived_at) ON conversations TO authenticated;
REVOKE INSERT, DELETE ON conversations FROM authenticated;

-- ---------- conversation_members ----------
DROP POLICY IF EXISTS "conversation_members_select" ON conversation_members;
CREATE POLICY "conversation_members_select" ON conversation_members FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id) OR public.is_app_admin());

-- Rejoindre soi-meme un canal public actif.
DROP POLICY IF EXISTS "conversation_members_join_public" ON conversation_members;
CREATE POLICY "conversation_members_join_public" ON conversation_members FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'member'
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
        AND c.type = 'channel'
        AND c.visibility = 'public'
        AND c.archived_at IS NULL
    )
  );

-- Un owner de canal (ou un admin) invite qui il veut.
DROP POLICY IF EXISTS "conversation_members_invite" ON conversation_members;
CREATE POLICY "conversation_members_invite" ON conversation_members FOR INSERT TO authenticated
  WITH CHECK (public.is_conversation_owner(conversation_id) OR public.is_app_admin());

DROP POLICY IF EXISTS "conversation_members_update_self" ON conversation_members;
CREATE POLICY "conversation_members_update_self" ON conversation_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Quitter une conversation, ou en etre retire par un owner / admin.
DROP POLICY IF EXISTS "conversation_members_delete" ON conversation_members;
CREATE POLICY "conversation_members_delete" ON conversation_members FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_conversation_owner(conversation_id)
    OR public.is_app_admin()
  );

-- La RLS filtre les lignes, pas les colonnes : sans ce grant restreint,
-- un membre pourrait se promouvoir owner via UPDATE sur sa propre ligne.
REVOKE UPDATE ON conversation_members FROM authenticated;
GRANT  UPDATE (last_read_at, muted) ON conversation_members TO authenticated;

-- ---------- messages ----------
DROP POLICY IF EXISTS "messages_select" ON messages;
CREATE POLICY "messages_select" ON messages FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id));

DROP POLICY IF EXISTS "messages_insert" ON messages;
CREATE POLICY "messages_insert" ON messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_conversation_member(conversation_id)
    AND EXISTS (SELECT 1 FROM conversations c WHERE c.id = conversation_id AND c.archived_at IS NULL)
  );

-- Prete pour la Phase 2 (edition de ses propres messages) : aucune UI en Phase 1.
DROP POLICY IF EXISTS "messages_update_own" ON messages;
CREATE POLICY "messages_update_own" ON messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

REVOKE UPDATE, DELETE ON messages FROM authenticated;
GRANT  UPDATE (body, edited_at) ON messages TO authenticated;

-- ---------- message_attachments ----------
DROP POLICY IF EXISTS "message_attachments_select" ON message_attachments;
CREATE POLICY "message_attachments_select" ON message_attachments FOR SELECT TO authenticated
  USING (public.can_access_message(message_id));

DROP POLICY IF EXISTS "message_attachments_insert" ON message_attachments;
CREATE POLICY "message_attachments_insert" ON message_attachments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM messages m WHERE m.id = message_id AND m.sender_id = auth.uid())
  );

REVOKE UPDATE, DELETE ON message_attachments FROM authenticated;

-- ---------- push_subscriptions ----------
DROP POLICY IF EXISTS "push_subscriptions_own" ON push_subscriptions;
CREATE POLICY "push_subscriptions_own" ON push_subscriptions FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ============================================================
-- 12. DROITS D'EXECUTION DES RPC
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.is_app_admin()                      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_conversation_member(UUID)        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_conversation_owner(UUID)         FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_message(UUID)            FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_channel(TEXT, TEXT, TEXT)    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_or_create_dm(UUID)              FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_unread_counts()                 FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_use_realtime_topic(TEXT)        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_attachment_path(TEXT)    FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_app_admin()                       TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversation_member(UUID)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversation_owner(UUID)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_message(UUID)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_channel(TEXT, TEXT, TEXT)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_dm(UUID)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unread_counts()                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_use_realtime_topic(TEXT)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_attachment_path(TEXT)     TO authenticated;


-- ============================================================
-- 13. STORAGE — bucket prive
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message-attachments', 'message-attachments', FALSE, 5242880,
  ARRAY[
    'image/png','image/jpeg','image/gif','image/webp',
    'application/pdf','text/plain','text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
ON CONFLICT (id) DO UPDATE
  SET public = FALSE,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "attachments_read" ON storage.objects;
CREATE POLICY "attachments_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'message-attachments' AND public.can_access_attachment_path(name));

DROP POLICY IF EXISTS "attachments_write" ON storage.objects;
CREATE POLICY "attachments_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'message-attachments' AND public.can_access_attachment_path(name));

DROP POLICY IF EXISTS "attachments_delete_own" ON storage.objects;
CREATE POLICY "attachments_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'message-attachments' AND owner_id = auth.uid()::text);


-- ============================================================
-- 14. REALTIME
--
-- postgres_changes sur messages : la RLS de messages s'applique a
-- l'abonnement, un non-membre ne recoit rien.
-- ============================================================

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;
$$;

-- Canaux Realtime prives (broadcast "en train d'ecrire" + presence).
-- Sans ces policies, n'importe quel utilisateur pourrait ecouter le
-- topic d'un canal prive dont il n'est pas membre.
DROP POLICY IF EXISTS "realtime_topic_read" ON realtime.messages;
CREATE POLICY "realtime_topic_read" ON realtime.messages FOR SELECT TO authenticated
  USING (public.can_use_realtime_topic(realtime.topic()));

DROP POLICY IF EXISTS "realtime_topic_write" ON realtime.messages;
CREATE POLICY "realtime_topic_write" ON realtime.messages FOR INSERT TO authenticated
  WITH CHECK (public.can_use_realtime_topic(realtime.topic()));

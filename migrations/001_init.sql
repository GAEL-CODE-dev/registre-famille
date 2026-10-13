-- Schéma initial : une seule famille, donc une table membres et une table admins

CREATE TABLE IF NOT EXISTS membres (
  id                 SERIAL PRIMARY KEY,
  nom                VARCHAR(80)  NOT NULL,
  prenom             VARCHAR(80)  NOT NULL,
  sexe               CHAR(1)      NOT NULL CHECK (sexe IN ('M', 'F')),
  date_naissance     DATE         NOT NULL,
  telephone          VARCHAR(25),
  email              VARCHAR(120),
  quartier           VARCHAR(120),
  lien_famille       VARCHAR(20)  CHECK (lien_famille IN (
                       'pere','mere','conjoint','enfant','frere_soeur',
                       'oncle_tante','cousin','grand_parent','autre')),
  statut_matrimonial VARCHAR(20)  CHECK (statut_matrimonial IN (
                       'celibataire','marie','veuf','divorce')),
  profession         VARCHAR(120),
  parent_id          INTEGER REFERENCES membres(id) ON DELETE SET NULL,
  statut             VARCHAR(10)  NOT NULL DEFAULT 'actif'
                       CHECK (statut IN ('actif','inactif')),
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Anti-doublon : même nom + prénom + date de naissance
CREATE UNIQUE INDEX IF NOT EXISTS membres_doublon_idx
  ON membres (LOWER(nom), LOWER(prenom), date_naissance);

CREATE INDEX IF NOT EXISTS membres_nom_idx
  ON membres (LOWER(nom), LOWER(prenom));

CREATE TABLE IF NOT EXISTS admins (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(50) NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
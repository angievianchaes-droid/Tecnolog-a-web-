-- Esquema PostgreSQL · Bienestar Universitario Unitrópico
-- Nombres en español y en singular. Todas las tablas llevan creado_en y actualizado_en.

CREATE TABLE IF NOT EXISTS usuario (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre             varchar(120) NOT NULL,
  correo             varchar(160) NOT NULL UNIQUE,
  contrasena_hash    varchar(100) NOT NULL,
  rol                varchar(20)  NOT NULL DEFAULT 'estudiante'
                       CHECK (rol IN ('estudiante','bienestar','admin')),
  programa_academico varchar(120),
  codigo_estudiantil varchar(20),
  creado_en          timestamptz NOT NULL DEFAULT now(),
  actualizado_en     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categoria (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre         varchar(60) NOT NULL UNIQUE,
  descripcion    varchar(300),
  color          varchar(7) NOT NULL DEFAULT '#2e7d32' CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  creado_en      timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lugar (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre         varchar(100) NOT NULL UNIQUE,
  direccion      varchar(200),
  capacidad      integer CHECK (capacidad > 0),
  latitud        numeric(9,6) CHECK (latitud BETWEEN -90 AND 90),
  longitud       numeric(9,6) CHECK (longitud BETWEEN -180 AND 180),
  creado_en      timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evento (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo         varchar(150) NOT NULL,
  descripcion    text NOT NULL,
  fecha_inicio   timestamptz NOT NULL,
  fecha_fin      timestamptz NOT NULL,
  cupo_maximo    integer CHECK (cupo_maximo > 0),          -- NULL = sin límite
  estado         varchar(15) NOT NULL DEFAULT 'borrador'
                   CHECK (estado IN ('borrador','publicado','cancelado','finalizado')),
  imagen_url     varchar(300),
  categoria_id   uuid NOT NULL REFERENCES categoria(id) ON DELETE RESTRICT,
  lugar_id       uuid NOT NULL REFERENCES lugar(id)     ON DELETE RESTRICT,
  creado_por     uuid REFERENCES usuario(id) ON DELETE SET NULL,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT evento_fechas_validas CHECK (fecha_fin > fecha_inicio)
);

CREATE TABLE IF NOT EXISTS inscripcion (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id                uuid NOT NULL REFERENCES evento(id)  ON DELETE CASCADE,
  usuario_id               uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  estado                   varchar(15) NOT NULL DEFAULT 'confirmada'
                             CHECK (estado IN ('confirmada','cancelada','en_espera')),
  asistio                  boolean NOT NULL DEFAULT false,
  asistencia_registrada_en timestamptz,
  creado_en                timestamptz NOT NULL DEFAULT now(),
  actualizado_en           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evento_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS suscripcion_push (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id     uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  endpoint       text NOT NULL UNIQUE,
  clave_p256dh   text NOT NULL,
  clave_auth     text NOT NULL,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

-- Índices (columnas por las que se filtra u ordena)
CREATE INDEX IF NOT EXISTS idx_evento_fecha_inicio      ON evento (fecha_inicio);
CREATE INDEX IF NOT EXISTS idx_evento_estado_fecha      ON evento (estado, fecha_inicio);
CREATE INDEX IF NOT EXISTS idx_evento_categoria         ON evento (categoria_id);
CREATE INDEX IF NOT EXISTS idx_evento_lugar             ON evento (lugar_id);
CREATE INDEX IF NOT EXISTS idx_inscripcion_usuario      ON inscripcion (usuario_id);
CREATE INDEX IF NOT EXISTS idx_inscripcion_evento_estado ON inscripcion (evento_id, estado);
CREATE INDEX IF NOT EXISTS idx_push_usuario             ON suscripcion_push (usuario_id);

-- Mantiene actualizado_en al día en cada UPDATE
CREATE OR REPLACE FUNCTION set_actualizado_en() RETURNS trigger AS $$
BEGIN NEW.actualizado_en = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['usuario','categoria','lugar','evento','inscripcion','suscripcion_push'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_actualizado ON %1$s', t);
    EXECUTE format('CREATE TRIGGER trg_%1$s_actualizado BEFORE UPDATE ON %1$s
                    FOR EACH ROW EXECUTE FUNCTION set_actualizado_en()', t);
  END LOOP;
END $$;

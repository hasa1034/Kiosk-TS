-- Copyright (C) 2022 - present Juergen Zimmermann, Hochschule Karlsruhe
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.
--
-- This program is distributed in the hope that it will be useful,
-- but WITHOUT ANY WARRANTY; without even the implied warranty of
-- MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
-- GNU General Public License for more details.
--
-- You should have received a copy of the GNU General Public License
-- along with this program.  If not, see <https://www.gnu.org/licenses/>.

-- TEXT statt varchar(n):
-- "There is no performance difference among these three types, apart from a few extra CPU cycles
-- to check the length when storing into a length-constrained column"
-- ggf. CHECK(char_length(nachname) <= 255)

-- https://www.postgresql.org/docs/current/manage-ag-tablespaces.html
SET default_tablespace = kioskspace;

-- https://www.postgresql.org/docs/current/sql-createtable.html
-- https://www.postgresql.org/docs/current/datatype.html
-- https://www.postgresql.org/docs/current/sql-createtype.html
-- https://www.postgresql.org/docs/current/datatype-enum.html
CREATE TYPE geschlecht AS ENUM ('MAENNLICH', 'WEIBLICH', 'DIVERS');

CREATE TABLE IF NOT EXISTS kiosk (
    id            INTEGER GENERATED ALWAYS AS IDENTITY(START WITH 1000) PRIMARY KEY,
    version       INTEGER NOT NULL DEFAULT 0,
    name          TEXT NOT NULL,
                  -- impliziter Index als B-Baum durch UNIQUE
                  -- https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-UNIQUE-CONSTRAINTS
    email         TEXT NOT NULL UNIQUE,
                  -- https://www.postgresql.org/docs/current/datatype-boolean.html
    ist_geoeffnet BOOLEAN NOT NULL DEFAULT TRUE,
    homepage      TEXT,
    username      TEXT NOT NULL,
                  -- https://www.postgresql.org/docs/current/datatype-datetime.html
    erzeugt       TIMESTAMP NOT NULL,
    aktualisiert  TIMESTAMP NOT NULL
);

-- default: btree
CREATE INDEX IF NOT EXISTS kiosk_name_idx ON kiosk(name);

CREATE TABLE IF NOT EXISTS betreiber (
    id          INTEGER GENERATED ALWAYS AS IDENTITY(START WITH 1000) PRIMARY KEY,
    vorname     TEXT NOT NULL,
    nachname    TEXT NOT NULL,
    geschlecht  geschlecht,
    kiosk_id    INTEGER NOT NULL REFERENCES kiosk ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS betreiber_kiosk_id_idx ON betreiber(kiosk_id);
CREATE INDEX IF NOT EXISTS betreiber_vorname_idx ON betreiber(vorname);
CREATE INDEX IF NOT EXISTS betreiber_nachname_idx ON betreiber(nachname);

CREATE TABLE IF NOT EXISTS produkt (
    id          INTEGER GENERATED ALWAYS AS IDENTITY(START WITH 1000) PRIMARY KEY,
    name        TEXT NOT NULL,
                -- https://www.postgresql.org/docs/current/datatype-numeric.html#DATATYPE-NUMERIC-DECIMAL
                -- https://www.postgresql.org/docs/current/datatype-money.html
                -- 10 Stellen, davon 2 Nachkommastellen
    preis      NUMERIC(10,2) NOT NULL,
    waehrung    TEXT NOT NULL CHECK (waehrung ~ '[A-Z]{3}'),
    kiosk_id    INTEGER NOT NULL REFERENCES kiosk ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS produkt_kiosk_id_idx ON produkt(kiosk_id);
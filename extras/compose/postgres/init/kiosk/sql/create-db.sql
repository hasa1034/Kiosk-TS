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

-- Aufruf:   psql --dbname=postgres --username=postgres --file=/init/kiosk/sql/create-db.sql

-- https://www.postgresql.org/docs/current/sql-createuser.html
-- https://www.postgresql.org/docs/current/sql-createrole.html
CREATE USER kiosk PASSWORD 'p';

-- https://www.postgresql.org/docs/current/sql-createdatabase.html
CREATE DATABASE kiosk;

-- https://www.postgresql.org/docs/current/role-attributes.html
-- https://www.postgresql.org/docs/current/ddl-priv.html
-- https://www.postgresql.org/docs/current/sql-grant.html
GRANT ALL ON DATABASE kiosk TO kiosk;

-- https://www.postgresql.org/docs/current/sql-createtablespace.html
CREATE TABLESPACE kioskspace OWNER kiosk LOCATION '/tablespace/kiosk';
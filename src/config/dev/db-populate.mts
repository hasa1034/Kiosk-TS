// Copyright (C) 2021 - present Juergen Zimmermann, Hochschule Karlsruhe
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.

/**
 * Das Modul enthält die Funktionalität, um die Test-DB neu zu laden.
 * @packageDocumentation
 */

/* eslint-disable @stylistic/quotes */

import { PrismaPg } from '@prisma/adapter-pg';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { URL } from 'node:url';
import { PrismaClient } from '../../generated/prisma/client.ts';
import { getLogger } from '../../logger/logger.mts';
import { config } from '../app.mts';
import { adapter } from '../prisma-client.mts';
import { resourcesURL } from '../resources.mts';

/**
 * Die Test-DB wird im Development-Modus neu geladen, nachdem die Module
 * initialisiert sind, was durch `OnApplicationBootstrap` realisiert wird.
 */
export class DbPopulateService {
    readonly #dbPopulate = config.db?.populate === true;

    readonly #dbURL = new URL('postgresql/', resourcesURL);

    readonly #prisma: PrismaClient;

    readonly #prismaAdmin: PrismaClient;

    readonly #logger = getLogger(DbPopulateService.name);

    /**
     * Initialisierung durch DI mit `DataSource` für SQL-Queries.
     */
    constructor() {
        // PrismaClient fuer DB "kiosk" (siehe Umgebungsvariable DATABASE_URL in ".env")
        // d.h. mit PostgreSQL-User "kiosk" und Schema "kiosk"
        // aber OHNE Logging der Queries
        this.#prisma = new PrismaClient({ adapter, errorFormat: 'pretty' });

        const adapterAdmin = new PrismaPg({
            connectionString: process.env['DATABASE_URL_ADMIN'],
        });
        this.#prismaAdmin = new PrismaClient({
            adapter: adapterAdmin,
            errorFormat: 'pretty',
        });
    }

    async populate() {
        if (!this.#dbPopulate) {
            return;
        }

        // Bei TypedSQL ist nur 1 SQL-Anweisung pro Datei moeglich
        // https://www.prisma.io/typedsql
        const dropScript = new URL('drop-table.sql', this.#dbURL);
        this.#logger.debug('dropScript = %s', dropScript); // eslint-disable-line sonarjs/no-duplicate-string
        // https://nodejs.org/api/fs.html#fspromisesreadfilepath-options
        const dropStatements = await readFile(dropScript, 'utf8'); // eslint-disable-line security/detect-non-literal-fs-filename,n/no-sync

        const createScript = new URL('create-table.sql', this.#dbURL); // eslint-disable-line sonarjs/no-duplicate-string
        this.#logger.debug('createScript = %s', createScript); // eslint-disable-line sonarjs/no-duplicate-string
        const createStatements = await readFile(createScript, 'utf8'); // eslint-disable-line security/detect-non-literal-fs-filename,n/no-sync

        const copyScript = new URL('copy-csv.sql', this.#dbURL); // eslint-disable-line sonarjs/no-duplicate-string
        this.#logger.debug('copyScript = %s', copyScript); // eslint-disable-line sonarjs/no-duplicate-string
        const copyStatements = await readFile(copyScript, 'utf8'); // eslint-disable-line security/detect-non-literal-fs-filename,n/no-sync

        await this.#prisma.$connect();
        await this.#prisma.$transaction(async (tx) => {
            await tx.$executeRawUnsafe(dropStatements);
            await tx.$executeRawUnsafe(createStatements);
        });
        await this.#prisma.$disconnect();

        // COPY zum Laden von CSV-Dateien erfordert Administrationsrechte
        // https://www.postgresql.org/docs/current/sql-copy.html
        await this.#prismaAdmin.$connect();
        await this.#prismaAdmin.$transaction(async (tx) => {
            await tx.$executeRawUnsafe(copyStatements);
        });
        await this.#prismaAdmin.$disconnect();
    }
}
/* eslint-enable @stylistic/quotes */

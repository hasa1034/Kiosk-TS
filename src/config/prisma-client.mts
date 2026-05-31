// Copyright (C) 2025 - present Juergen Zimmermann, Hochschule Karlsruhe
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
// along with this program. If not, see <http://www.gnu.org/licenses/>.

import { PrismaPg } from '@prisma/adapter-pg';
import { prismaQueryInsights } from '@prisma/sqlcommenter-query-insights';
import process from 'node:process';
import { styleText } from 'node:util';
import { PrismaClient } from '../generated/prisma/client.ts';
import { getLogger } from '../logger/logger.mts';

/**
 * Das Modul besteht aus dem Objekt {@linkcode prismaClient} als DB-Client
 * mit _Prisma_.
 * @packageDocumentation
 */

const logger = getLogger('prisma-client', 'file');

// PrismaClient passend zur Umgebungsvariable DATABASE_URL in ".env"
// d.h. mit PostgreSQL-User "kiosk" und Schema "kiosk" (ANGEPASST)
export const adapter = new PrismaPg({
    connectionString: process.env['DATABASE_URL'],
});

let tmpClient: PrismaClient;

if (logger.isLevelEnabled('debug')) {
    const debugClient = new PrismaClient({
        adapter,
        errorFormat: 'pretty',
        log: [
            {
                // siehe unten: debugClient.$on('query', ...);
                emit: 'event',
                level: 'query',
            },
            'info',
            'warn',
            'error',
        ],
        // Kommentar zu Log-Ausgabe generieren:
        // /*prismaQuery='Kiosk.findMany%3A... mit base64-Codierung (ANGEPASST)
        // https://www.prisma.io/docs/orm/reference/prisma-client-reference#comments
        // @ts-ignore
        comments: [prismaQueryInsights()],
    });

    debugClient.$on('query', (e) => {
        // console.log(), weil der Pino-Logger asynchron ist
        const message = styleText(['black', 'bgWhite'], 'Query:');
        console.log(`${message} ${e.query}`);
    });

    tmpClient = debugClient;
} else {
    const prodClient = new PrismaClient({ adapter });
    tmpClient = prodClient;
}

/**
 * PrismaClient passend zur Umgebungsvariable DATABASE_URL in ".env".
 * @author [Jürgen Zimmermann](mailto:Juergen.Zimmermann@h-ka.de)
 */
export const prismaClient = tmpClient;

/**
 * Prisma-Client mit der DB verbinden.
 * @author [Jürgen Zimmermann](mailto:Juergen.Zimmermann@h-ka.de)
 */
export const connectDB = async () => {
    await prismaClient.$connect();
    logger.info('Verbindung mit der DB ist hergestellt.');
};

/**
 * DB-Verbindung für den Prisma-Client trennen.
 * @author [Jürgen Zimmermann](mailto:Juergen.Zimmermann@h-ka.de)
 */
export const disconnectDB = async () => {
    await prismaClient.$disconnect();
    logger.info('Verbindung mit der DB ist getrennt.');
};

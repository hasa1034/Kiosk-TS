// Copyright (C) 2026 - present Juergen Zimmermann, Hochschule Karlsruhe
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
 * Das Modul besteht aus der Klasse {@linkcode WhereBuilder}.
 * @packageDocumentation
 */

import { type Geschlecht, Prisma } from '../../generated/prisma/client.ts';
import { type KioskWhereInput } from '../../generated/prisma/models/Kiosk.ts';
import { type Suchparameter } from './suchparameter.mts';
import { getLogger } from '../../logger/logger.mts';

/** Typdefinitionen für die Suche mit der Kiosk-ID. */
export type BuildIdParams = {
    /** ID des gesuchten Kiosks. */
    readonly id: number;
};

const logger = getLogger('buildWhere', 'func');

/**
 * WHERE-Klausel für die flexible Suche nach Kiosken bauen.
 * @param suchparameter JSON-Objekt mit Suchparameter. Bei "name" wird mit
 * einem Teilstring gesucht, bei "email" mit Gleichheit.
 * @returns KioskWhereInput
 */
// "rest properties" ab ES 2018 https://github.com/tc39/proposal-object-rest-spread
// oxlint-disable-next-line max-lines-per-function
export const buildWhere = ({ ...restProps }: Suchparameter) => {
    logger.debug('build: restProps=%o', restProps);

    // Beispiel: { name: 'a', istGeoeffnet: true, geschlecht: 'MAENNLICH' }
    // wird zu:
    // WHERE name ILIKE %a% AND ist_geoeffnet = true AND betreiber.geschlecht = 'MAENNLICH'
    const where: KioskWhereInput = {};

    // Properties vom Typ string, enum, boolean
    Object.entries(restProps).forEach(([key, value]) => {
        switch (key) {
            case 'name':
                where.name = {
                    contains: value as string,
                    mode: Prisma.QueryMode.insensitive,
                };
                break;
            case 'email':
                where.email = { equals: value as string };
                break;
            case 'istGeoeffnet':
                // boolean
                where.istGeoeffnet = {
                    equals: (value as string).toLowerCase() === 'true',
                };
                break;
            case 'homepage':
                where.homepage = { equals: value as string };
                break;
            case 'username':
                where.username = {
                    contains: value as string,
                    mode: Prisma.QueryMode.insensitive,
                };
                break;
            case 'geschlecht':
                // enum auf Betreiber
                where.betreiber = {
                    some: {
                        geschlecht: { equals: value as Geschlecht },
                    },
                };
                break;
            default:
                break;
        }
    });

    logger.debug('build: where=%o', where);
    return where;
};

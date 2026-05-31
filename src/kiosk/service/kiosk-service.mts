// oxlint-disable max-lines
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
 * Das Modul besteht aus der Klasse {@linkcode KioskService}.
 * @packageDocumentation
 */

import { type Prisma } from '../../generated/prisma/client.ts';
import { type Suchparameter, suchparameterNamen } from './suchparameter.mts';
import { type KioskInclude } from '../../generated/prisma/models/Kiosk.ts';
import { NotFoundError } from './errors.mts';
import { type Pageable } from './pageable.mts';
import { type Slice } from './slice.mts';
import { buildWhere } from './where-builder.mts';
import { getLogger } from '../../logger/logger.mts';
import { prismaClient } from '../../config/prisma-client.mts';

// Typdefinition für `findById`
type FindByIdParams = {
    // ID des gesuchten Kiosks
    readonly id: number;
};

export type KioskMitBetreiber = Prisma.KioskGetPayload<{
    include: { betreiber: true };
}>;

// "preis" ist vom Prisma-internen Typ "Decimal"
export type KioskMitBetreiberDTO = KioskMitBetreiber;

export type KioskMitBetreiberUndProdukt = Prisma.KioskGetPayload<{
    include: {
        betreiber: true;
        produkt: true;
    };
}>;

// "preis" ist vom Prisma-internen Typ "Decimal"
export type KioskMitBetreiberUndProduktDTO = Omit<
    KioskMitBetreiberUndProdukt,
    'produkt'
> & {
    produkt: (Omit<KioskMitBetreiberUndProdukt['produkt'][number], 'preis'> & {
        preis: number;
    })[];
};

/**
 * Die Klasse `KioskService` implementiert das Lesen für Kioske und greift
 * mit _Prisma_ auf eine relationale DB zu.
 */
export class KioskService {
    static readonly ID_PATTERN = /^[1-9]\d{0,10}$/u;

    readonly #includeBetreiber: KioskInclude = { betreiber: true };
    readonly #includeBetreiberUndProdukt: KioskInclude = {
        betreiber: true,
        produkt: true,
    };

    readonly #logger = getLogger(KioskService.name);

    // Rueckgabetyp Promise bei asynchronen Funktionen
    //    ab ES2015
    //    vergleiche Task<> bei C#
    // Status eines Promise:
    //    Pending: das Resultat ist noch nicht vorhanden, weil die asynchrone
    //             Operation noch nicht abgeschlossen ist
    //    Fulfilled: die asynchrone Operation ist abgeschlossen und
    //               das Promise-Objekt hat einen Wert
    //    Rejected: die asynchrone Operation ist fehlgeschlagen and das
    //              Promise-Objekt wird nicht den Status "fulfilled" erreichen.
    //              Im Promise-Objekt ist dann die Fehlerursache enthalten.

    /**
     * Einen Kiosk asynchron anhand seiner ID suchen
     * @param id ID des gesuchten Kiosks
     * @returns Der gefundene Kiosk in einem Promise aus ES2015.
     * @throws NotFoundError falls kein Kiosk mit der ID existiert
     */
    // https://2ality.com/2015/01/es6-destructuring.html#simulating-named-parameters-in-javascript
    async findById({
        id,
    }: FindByIdParams): Promise<Readonly<KioskMitBetreiberUndProduktDTO>> {
        this.#logger.debug('findById: id=%d', id);

        // Das Resultat ist null, falls kein Datensatz gefunden
        // Lesen: Keine Transaktion erforderlich
        // "include":
        // - referenzierte Daten werden mitgeladen
        // - keine Konfiguration fuer Eager- oder Lazy-Fetching
        // - keine Proxy-Objekte durch evtl. Lazy-Fetching
        // - keine DTO-Klassen mit weggelassenen nicht geladenen Properties
        const kiosk: KioskMitBetreiberUndProdukt | null =
            await prismaClient.kiosk.findUnique({
                where: { id },
                include: this.#includeBetreiberUndProdukt,
            });
        if (kiosk === null) {
            this.#logger.debug('Es gibt keinen Kiosk mit der ID %d', id);
            throw new NotFoundError(`Es gibt keinen Kiosk mit der ID ${id}.`);
        }

        // Rest Properties
        const { produkt, ...kioskRest } = kiosk;
        const kioskDTO: KioskMitBetreiberUndProduktDTO = {
            // Spread Properties
            ...kioskRest,
            produkt: produkt.map((p) => ({
                ...p,
                preis: p.preis.toNumber(),
            })),
        };

        this.#logger.debug('findById: kioskDTO=%o', kioskDTO);
        return kioskDTO;
    }

    /**
     * Kioske asynchron suchen.
     * @param suchparameter JSON-Objekt mit Suchparameter.
     * @param pageable Maximale Anzahl an Datensätzen und Seitennummer.
     * @returns Ein JSON-Array mit den gefundenen Kiosken.
     * @throws NotFoundError falls keine Kioske gefunden wurden.
     */
    async find(
        suchparameter: Suchparameter | null,
        pageable: Pageable,
    ): Promise<Readonly<Slice<Readonly<KioskMitBetreiberDTO>>>> {
        this.#logger.debug(
            'find: suchparameter=%s, pageable=%o',
            JSON.stringify(suchparameter),
            pageable,
        );

        // Keine Suchparameter?
        if (suchparameter === null) {
            return await this.#findAll(pageable);
        }
        const keys = Object.keys(suchparameter);
        if (keys.length === 0) {
            return await this.#findAll(pageable);
        }

        // Falsche Namen fuer Suchparameter?
        if (!this.#checkKeys(keys) || !this.#checkEnums(suchparameter)) {
            this.#logger.debug('Ungueltige Suchparameter');
            throw new NotFoundError('Ungueltige Suchparameter');
        }

        // Das Resultat ist eine leere Liste, falls nichts gefunden
        // Lesen: Keine Transaktion erforderlich
        const where = buildWhere(suchparameter);
        const { number, size } = pageable;
        const kioske: KioskMitBetreiber[] = await prismaClient.kiosk.findMany({
            where,
            skip: number * size,
            take: size,
            include: this.#includeBetreiber,
        });
        if (kioske.length === 0) {
            this.#logger.debug('find: Keine Kioske gefunden');
            throw new NotFoundError(
                `Keine Kioske gefunden: ${JSON.stringify(suchparameter)}, Seite ${pageable.number}}`,
            );
        }
        const totalElements = await this.count(where);
        return this.#createSlice(kioske, totalElements);
    }

    /**
     * Anzahl der gefundenen Kioske zurückliefern.
     * @param WHERE-Klausel der eigentlichen Suche.
     * @returns Anzahl der gefundenen Kioske.
     */
    async count(where?: Prisma.KioskWhereInput) {
        this.#logger.debug('count: where=%o', where ?? 'undefined');
        const { count } = prismaClient.kiosk;
        const anzahl =
            typeof where === 'undefined'
                ? await count()
                : await count({ where });
        this.#logger.debug('count: %d', anzahl);
        return anzahl;
    }

    async #findAll(
        pageable: Pageable,
    ): Promise<Readonly<Slice<KioskMitBetreiberDTO>>> {
        const { number, size } = pageable;
        const kioske: KioskMitBetreiber[] = await prismaClient.kiosk.findMany({
            skip: number * size,
            take: size,
            include: this.#includeBetreiber,
        });
        if (kioske.length === 0) {
            this.#logger.debug('#findAll: Keine Kioske gefunden');
            throw new NotFoundError(`Ungueltige Seite "${number}"`);
        }
        const totalElements = await this.count();
        return this.#createSlice(kioske, totalElements);
    }

    #createSlice(
        kioske: KioskMitBetreiber[],
        totalElements: number,
    ): Readonly<Slice<KioskMitBetreiberDTO>> {
        const kioskSlice: Slice<KioskMitBetreiberDTO> = {
            content: kioske,
            totalElements,
        };
        this.#logger.debug('createSlice: kioskSlice=%o', kioskSlice);
        return kioskSlice;
    }

    #checkKeys(keys: string[]) {
        this.#logger.debug('#checkKeys: keys=%o', keys);
        // Ist jeder Suchparameter auch eine Property von Kiosk?
        let validKeys = true;
        keys.forEach((key) => {
            if (
                !suchparameterNamen.includes(key) &&
                key !== 'javascript' &&
                key !== 'typescript' &&
                key !== 'java' &&
                key !== 'python'
            ) {
                this.#logger.debug(
                    '#checkKeys: ungueltiger Suchparameter "%s"',
                    key,
                );
                validKeys = false;
            }
        });

        return validKeys;
    }

    #checkEnums(suchparameter: Suchparameter) {
        const { geschlecht } = suchparameter;
        this.#logger.debug(
            '#checkEnums: Suchparameter "geschlecht=%s"',
            geschlecht,
        );
        return (
            typeof geschlecht === 'undefined' ||
            geschlecht === 'MAENNLICH' ||
            geschlecht === 'WEIBLICH' ||
            geschlecht === 'DIVERS'
        );
    }
}

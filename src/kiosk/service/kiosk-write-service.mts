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
 * Das Modul besteht aus der Klasse {@linkcode KioskWriteService} für die
 * Schreiboperationen im Anwendungskern.
 * @packageDocumentation
 */

import { type Prisma } from '../../generated/prisma/client.ts';
import {
    EmailExistsError,
    NotFoundError,
    VersionInvalidError,
    VersionOutdatedError,
} from './errors.mts';
import { KioskService } from './kiosk-service.mts';
import { getLogger } from '../../logger/logger.mts';
import { prismaClient } from '../../config/prisma-client.mts';
import { sendmail } from '../../mail/sendmail.mts';

export type KioskCreate = Prisma.KioskCreateInput;
type KioskCreated = Prisma.KioskGetPayload<{
    include: {
        betreiber: true;
        produkt: true;
    };
}>;

export type KioskUpdate = Prisma.KioskUpdateInput;
/** Typdefinitionen zum Aktualisieren eines Kiosks mit `update`. */
export type UpdateParams = {
    /** ID des zu aktualisierenden Kiosks. */
    readonly id: number | undefined;
    /** Kiosk-Objekt mit den aktualisierten Werten. */
    readonly kiosk: KioskUpdate;
    /** Versionsnummer für die zu aktualisierenden Werte. */
    readonly version: string;
};
type KioskUpdated = Prisma.KioskGetPayload<{}>;

/**
 * Die Klasse `KioskWriteService` implementiert den Anwendungskern für das
 * Schreiben von Kiosken und greift mit _Prisma_ auf die DB zu.
 */
export class KioskWriteService {
    private static readonly VERSION_PATTERN = /^"\d{1,3}"/u;

    readonly #readService: KioskService;

    readonly #logger = getLogger(KioskWriteService.name);

    constructor(readService: KioskService) {
        this.#readService = readService;
    }

    /**
     * Ein neuer Kiosk soll angelegt werden.
     * @param kiosk Das neu abzulegende Kiosk
     * @returns Die ID des neu angelegten Kiosks
     * @throws EmailExistsError falls die Email bereits existiert
     */
    async create(kiosk: KioskCreate) {
        this.#logger.debug('create: kiosk=%o', kiosk);
        await this.#validateCreate(kiosk);

        // Neuer Datensatz mit generierter ID
        let kioskDb: KioskCreated | undefined;
        await prismaClient.$transaction(async (tx) => {
            kioskDb = await tx.kiosk.create({
                data: kiosk,
                include: { betreiber: true, produkt: true },
            });
        });
        await KioskWriteService.#sendmail({
            id: kioskDb?.id ?? 'N/A',
            name: kioskDb?.name ?? 'N/A',
        });

        this.#logger.debug('create: kioskDb.id=%s', kioskDb?.id);
        return kioskDb?.id ?? Number.NaN;
    }

    /**
     * Ein vorhandener Kiosk soll aktualisiert werden. "Destructured" Argument
     * mit id (ID des zu aktualisierenden Kiosks), kiosk (zu aktualisierender Kiosk)
     * und version (Versionsnummer für optimistische Synchronisation).
     * @returns Die neue Versionsnummer gemäß optimistischer Synchronisation
     * @throws NotFoundException falls kein Kiosk zur ID vorhanden ist
     * @throws VersionInvalidException falls die Versionsnummer ungültig ist
     * @throws VersionOutdatedException falls die Versionsnummer veraltet ist
     */
    // https://2ality.com/2015/01/es6-destructuring.html#simulating-named-parameters-in-javascript
    async update({ id, kiosk, version }: UpdateParams) {
        this.#logger.debug(
            'update: id=%s, kiosk=%o, version=%s',
            id,
            kiosk,
            version,
        );
        if (typeof id === 'undefined') {
            this.#logger.debug('update: Keine gueltige ID');
            throw new NotFoundError(`Es gibt keinen Kiosk mit der ID ${id}.`);
        }

        await this.#validateUpdate(id, version);

        kiosk.version = { increment: 1 };
        let kioskUpdated: KioskUpdated | undefined;
        await prismaClient.$transaction(async (tx) => {
            kioskUpdated = await tx.kiosk.update({
                data: kiosk,
                where: { id },
            });
        });
        this.#logger.debug(
            'update: kioskUpdated=%s',
            JSON.stringify(kioskUpdated),
        );

        return kioskUpdated?.version ?? Number.NaN;
    }

    /**
     * Ein Kiosk wird asynchron anhand seiner ID gelöscht.
     *
     * @param id ID des zu löschenden Kiosks
     * @returns true, falls der Kiosk vorhanden war und gelöscht wurde. Sonst false.
     */
    async delete(id: number) {
        this.#logger.debug('delete: id=%d', id);

        const kiosk = await prismaClient.kiosk.findUnique({
            where: { id },
        });
        if (kiosk === null) {
            this.#logger.debug('delete: not found');
            return false;
        }

        await prismaClient.$transaction(async (tx) => {
            await tx.kiosk.delete({ where: { id } });
        });

        this.#logger.debug('delete');
        return true;
    }

    async #validateCreate({
        email,
    }: Prisma.KioskCreateInput): Promise<undefined> {
        this.#logger.debug('#validateCreate: email=%s', email);
        if (typeof email === 'undefined') {
            this.#logger.debug('#validateCreate: ok');
            return;
        }

        const anzahl = await prismaClient.kiosk.count({ where: { email } });
        if (anzahl > 0) {
            this.#logger.debug('#validateCreate: email existiert: %s', email);
            throw new EmailExistsError(email);
        }
        this.#logger.debug('#validateCreate: ok');
    }

    static async #sendmail({ id, name }: { id: number | 'N/A'; name: string }) {
        const subject = `Neuer Kiosk ${id}`;
        const body = `Der Kiosk mit dem Namen <strong>${name}</strong> ist angelegt`;
        await sendmail({ subject, body });
    }

    async #validateUpdate(id: number, versionStr: string) {
        this.#logger.debug(
            '#validateUpdate: id=%d, versionStr=%s',
            id,
            versionStr,
        );
        if (!KioskWriteService.VERSION_PATTERN.test(versionStr)) {
            throw new VersionInvalidError(versionStr);
        }

        const version = Number.parseInt(versionStr.slice(1, -1), 10);
        const kioskDb = await this.#readService.findById({ id });

        if (version < kioskDb.version) {
            this.#logger.debug('#validateUpdate: versionDb=%d', version);
            throw new VersionOutdatedError(version);
        }
    }
}

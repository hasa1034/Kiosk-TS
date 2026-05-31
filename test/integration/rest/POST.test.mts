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

import { beforeAll, describe, expect, test } from 'vitest';
import { type KioskNeuType } from '../../../src/kiosk/router/kiosk-validation.mts';
import { ProblemDetails } from '../../../src/problem-details.mts';
import {
    APPLICATION_JSON,
    AUTHORIZATION,
    BEARER,
    CONTENT_TYPE,
    LOCATION,
    POST,
    restURL,
} from '../constants.mts';
import { getToken } from '../token.mts';

// ID-Pattern für fortlaufende Integer-IDs aus der DB
const ID_PATTERN = /^\d+$/u;

// -----------------------------------------------------------------------------
// T e s t d a t e n
// -----------------------------------------------------------------------------
const neuerKiosk: KioskNeuType = {
    name: 'Campus Kiosk Karlsruhe',
    email: `kiosk-success-${Date.now()}@h-ka.de`, // Einzigartig pro Testlauf
    istGeoeffnet: true,
    homepage: 'https://kiosk.h-ka.de',
    username: 'admin',
    betreiber: [
        {
            vorname: 'Max',
            nachname: 'Mustermann',
            geschlecht: 'MAENNLICH',
        },
    ],
    produkt: [
        {
            name: 'Kaffee',
            preis: 2.50,
            waehrung: 'EUR',
        },
    ],
};

const neuerKioskInvalid: Record<string, unknown> = {
    name: '?!',              // Zu kurz / Ungültige Zeichen laut Schema
    email: 'falsche-email',   // Kein valides E-Mail-Format
    istGeoeffnet: 'ja',       // Sollte boolean sein
    homepage: 'keine-url',    // Keine valide URL
    username: '',             // Darf nicht leer sein
};

const neuerKioskEmailExistiert: KioskNeuType = {
    name: 'Kiosk Duplikat',
    email: 'frank@acme.cn', // Eine E-Mail, die bereits durch deine Testdaten existiert
    istGeoeffnet: true,
    homepage: 'https://duplikat.de',
    username: 'admin',
    betreiber: [],
    produkt: [],
};

// -----------------------------------------------------------------------------
// T e s t s
// -----------------------------------------------------------------------------
describe('POST /rest', () => {
    let token: string;

    beforeAll(async () => {
        token = await getToken('admin', 'p');
    });

    test('Neuer Kiosk', async () => {
        // given
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(AUTHORIZATION, `${BEARER} ${token}`);

        // when
        const response = await fetch(restURL, {
            method: POST,
            body: JSON.stringify(neuerKiosk),
            headers,
        });

        // then
        const { status } = response;

        expect(status).toBe(201);

        const responseHeaders = response.headers;
        const location = responseHeaders.get(LOCATION);

        expect(location).toBeDefined();

        // ID nach dem letzten "/" extrahieren
        const indexLastSlash = location?.lastIndexOf('/') ?? -1;

        expect(indexLastSlash).not.toBe(-1);

        const idStr = location?.slice(indexLastSlash + 1);

        expect(idStr).toBeDefined();
        expect(ID_PATTERN.test(idStr ?? '')).toBe(true);
    });

    test('Neuer Kiosk mit ungueltigen Daten', async () => {
        // given
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(AUTHORIZATION, `${BEARER} ${token}`);

        const expectedPaths = [
            'name',
            'email',
            'istGeoeffnet',
            'homepage',
            'username',
        ];

        // when
        const response = await fetch(restURL, {
            method: POST,
            body: JSON.stringify(neuerKioskInvalid),
            headers,
        });

        // then
        const { status } = response;

        expect(status).toBe(422);

        const body = (await response.json()) as ProblemDetails;
        const { detail } = body;

        expect(detail).toBeDefined();
        expect(detail).toHaveLength(expectedPaths.length);

        const paths = detail.map((d: any) => d.path[0]);

        expect(paths).toStrictEqual(expect.arrayContaining(expectedPaths));
    });

    test('Neuer Kiosk, aber die E-Mail existiert bereits', async () => {
        // given
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(AUTHORIZATION, `${BEARER} ${token}`);

        // when
        const response = await fetch(restURL, {
            method: POST,
            body: JSON.stringify(neuerKioskEmailExistiert),
            headers,
        });

        // then
        const { status } = response;

        expect(status).toBe(422);

        const body = (await response.json()) as ProblemDetails;

        // Validierung, dass die Fehlermeldung auf das Unique-Constraint der E-Mail hinweist
        expect(body.detail).toStrictEqual(expect.stringContaining('email'));
    });

    test.concurrent('Neuer Kiosk, aber ohne Token', async () => {
        // when
        const { status } = await fetch(restURL, {
            method: POST,
            body: JSON.stringify(neuerKiosk),
        });

        // then
        expect(status).toBe(401);
    });

    test.concurrent('Neuer Kiosk, aber mit falschem Token', async () => {
        // given
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(AUTHORIZATION, `${BEARER} FALSCHER_TOKEN`);

        // when
        const { status } = await fetch(restURL, {
            method: POST,
            body: JSON.stringify(neuerKiosk),
            headers,
        });

        // then
        expect(status).toBe(401);
    });

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    test.concurrent.todo('Abgelaufener Token', () => {});
});

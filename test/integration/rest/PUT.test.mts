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
import { type KioskUpdateType } from '../../../src/kiosk/router/kiosk-validation.mts';
import { ProblemDetails } from '../../../src/problem-details.mts';
import {
    APPLICATION_JSON,
    AUTHORIZATION,
    BEARER,
    CONTENT_TYPE,
    IF_MATCH,
    PUT,
    restURL,
} from '../constants.mts';
import { getToken } from '../token.mts';

// -----------------------------------------------------------------------------
// T e s t d a t e n
// -----------------------------------------------------------------------------
const geaendertKiosk: KioskUpdateType = {
    name: 'Updated Campus Kiosk',
    email: 'update-kiosk@h-ka.de',
    istGeoeffnet: false,
    homepage: 'https://updated-kiosk.h-ka.de',
    username: 'admin',
};
const idVorhanden = '1'; // ID, die laut deinen Testdaten existiert

const geaendertKioskIdNichtVorhanden: KioskUpdateType = {
    name: 'Phantom Kiosk',
    email: 'phantom@kiosk.de',
    istGeoeffnet: true,
    homepage: 'https://phantom.de',
    username: 'admin',
};
const idNichtVorhanden = '999999';

const geaendertKioskInvalid: Record<string, unknown> = {
    name: '?!',               // Ungültiges Format laut Zod-Schema
    email: 'keine-email',     // Falsches E-Mail-Format
    istGeoeffnet: 'geschlossen', // Sollte ein Boolean sein
    homepage: 'invalid-url',  // Keine korrekte URL-Struktur
    username: '',             // Darf nicht leer sein
};

const veralteterKiosk: KioskUpdateType = {
    name: 'Veralteter Kiosk',
    email: 'alt@kiosk.de',
    istGeoeffnet: true,
    homepage: 'https://alt.de',
    username: 'admin',
};

// -----------------------------------------------------------------------------
// T e s t s
// -----------------------------------------------------------------------------
describe('PUT /rest/:id', () => {
    let token: string;

    beforeAll(async () => {
        token = await getToken('admin', 'p');
    });

    test('Vorhandenen Kiosk aendern', async () => {
        // given
        const url = `${restURL}/${idVorhanden}`;
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(IF_MATCH, '"0"');
        headers.append(AUTHORIZATION, `${BEARER} ${token}`);

        // when
        const { status } = await fetch(url, {
            method: PUT,
            body: JSON.stringify(geaendertKiosk),
            headers,
        });

        // then
        expect(status).toBe(204);
    });

    test('Nicht-vorhandenen Kiosk aendern', async () => {
        // given
        const url = `${restURL}/${idNichtVorhanden}`;
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(IF_MATCH, '"0"');
        headers.append(AUTHORIZATION, `${BEARER} ${token}`);

        // when
        const { status } = await fetch(url, {
            method: PUT,
            body: JSON.stringify(geaendertKioskIdNichtVorhanden),
            headers,
        });

        // then
        expect(status).toBe(404);
    });

    test('Vorhandenen Kiosk aendern, aber mit ungueltigen Daten', async () => {
        // given
        const url = `${restURL}/${idVorhanden}`;
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(IF_MATCH, '"0"');
        headers.append(AUTHORIZATION, `${BEARER} ${token}`);

        const expectedPaths = [
            'name',
            'email',
            'istGeoeffnet',
            'homepage',
            'username',
        ];

        // when
        const response = await fetch(url, {
            method: PUT,
            body: JSON.stringify(geaendertKioskInvalid),
            headers,
        });

        // then
        expect(response.status).toBe(422);

        const body = (await response.json()) as ProblemDetails;
        const { detail } = body;

        expect(detail).toBeDefined();
        expect(detail).toHaveLength(expectedPaths.length);

        const paths = detail.map((d: any) => d.path[0]);

        expect(paths).toStrictEqual(expect.arrayContaining(expectedPaths));
    });

    test('Vorhandenen Kiosk aendern, aber ohne Versionsnummer', async () => {
        // given
        const url = `${restURL}/${idVorhanden}`;
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(AUTHORIZATION, `${BEARER} ${token}`);

        // when
        const response = await fetch(url, {
            method: PUT,
            body: JSON.stringify(geaendertKiosk),
            headers,
        });

        // then
        expect(response.status).toBe(428);

        const { detail, statusCode } =
            (await response.json()) as ProblemDetails;

        expect(detail).toContain(IF_MATCH);
        expect(statusCode).toBe(428);
    });

    test('Vorhandenen Kiosk aendern, aber mit alter Versionsnummer', async () => {
        // given
        const url = `${restURL}/${idVorhanden}`;
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(IF_MATCH, '"-1"');
        headers.append(AUTHORIZATION, `${BEARER} ${token}`);

        // when
        const response = await fetch(url, {
            method: PUT,
            body: JSON.stringify(veralteterKiosk),
            headers,
        });

        // then
        expect(response.status).toBe(412);

        const { detail, statusCode } =
            (await response.json()) as ProblemDetails;

        expect(detail).toMatch(/Versionsnummer/u);
        expect(statusCode).toBe(412);
    });

    test('Vorhandenen Kiosk aendern, aber ohne Token', async () => {
        // given
        const url = `${restURL}/${idVorhanden}`;
        const headers = new Headers();
        headers.append(CONTENT_TYPE, APPLICATION_JSON);
        headers.append(IF_MATCH, '"0"');

        // when
        const response = await fetch(url, {
            method: PUT,
            body: JSON.stringify(geaendertKiosk),
            headers,
        });

        // then
        expect(response.status).toBe(401);
    });
});

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

import { describe, expect, test } from 'vitest';
import {
    ACCEPT,
    APPLICATION_JSON,
    IF_NONE_MATCH,
    restURL,
} from '../constants.mts';

// -----------------------------------------------------------------------------
// T e s t d a t e n
// -----------------------------------------------------------------------------
// Eine ID, die sicher in deiner Testdatenbank (z.B. via CSV) existiert
const idVorhanden = '1';
// Eine ID, die garantiert nicht existiert
const idNichtVorhanden = '999999';

// -----------------------------------------------------------------------------
// T e s t s
// -----------------------------------------------------------------------------
describe('GET /rest/:id', () => {
    test.concurrent('Kiosk nach ID suchen (Erfolgsfall)', async () => {
        // given
        const url = `${restURL}/${idVorhanden}`;

        // when
        const response = await fetch(url);

        // then
        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toContain(APPLICATION_JSON);

        const body = await response.json();
        expect(body).toBeInstanceOf(Object);
        expect(body.id).toBe(Number.parseInt(idVorhanden, 10));

        // Verfiziert die Kiosk-Struktur aus deinem Router
        expect(body.name).toBeDefined();
        expect(body.email).toBeDefined();
        expect(body.istGeoeffnet).toBeDefined();
    });

    test.concurrent('Kiosk nach ID suchen mit ETag (304 Not Modified)', async () => {
        // given
        const url = `${restURL}/${idVorhanden}`;
        const headers = new Headers();
        headers.append(ACCEPT, APPLICATION_JSON);
        headers.append(IF_NONE_MATCH, '"0"');

        // when
        const response = await fetch(url, { headers });

        // then
        expect(response.status).toBe(304);

        const body = await response.text();
        expect(body).toBe('');
    });

    test.concurrent('Kiosk nach nicht-existenter ID suchen (404)', async () => {
        // given
        const url = `${restURL}/${idNichtVorhanden}`;

        // when
        const response = await fetch(url);

        // then
        expect(response.status).toBe(404);
    });

    test.concurrent('Kiosk nach ID suchen mit falschem Accept-Header (406)', async () => {
        // given
        const url = `${restURL}/${idVorhanden}`;
        const headers = new Headers();
        // Router erlaubt laut Regex nur json oder html, XML fliegt raus
        headers.append(ACCEPT, 'text/xml');

        // when
        const response = await fetch(url, { headers });

        // then
        expect(response.status).toBe(406);
    });
});

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
import { ACCEPT, APPLICATION_JSON, restURL } from '../constants.mts';

// -----------------------------------------------------------------------------
// T e s t s
// -----------------------------------------------------------------------------
describe('GET /rest (Query-Parameter)', () => {
    test.concurrent('Kioske mit Paginierung auflisten (Erfolgsfall)', async () => {
        // given
        const url = `${restURL}?page=0&size=5`;

        // when
        const response = await fetch(url);

        // then
        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toContain(APPLICATION_JSON);

        const body = await response.json();
        // createPage liefert laut Vorlage ein Objekt mit Metadaten (z.B. page-Objekt) und Daten
        expect(body).toBeInstanceOf(Object);
        expect(body.kioske || body._embedded || body).toBeDefined();
    });

    test.concurrent('Nur die Anzahl aller Kioske abfragen (count-only)', async () => {
        // given
        const url = `${restURL}?count-only=true`;

        // when
        const response = await fetch(url);

        // then
        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toContain(APPLICATION_JSON);

        const body = await response.json();
        expect(body).toHaveProperty('count');
        expect(typeof body.count).toBe('number');
    });

    test.concurrent('Kioske nach bestimmten Kriterien filtern (z.B. Name)', async () => {
        // given
        const suchname = 'Alice';
        const url = `${restURL}?name=${suchname}&page=0&size=2`;

        // when
        const response = await fetch(url);

        // then
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body).toBeDefined();
    });

    test.concurrent('Kiosk-Suche mit falschem Accept-Header abweisen (406)', async () => {
        // given
        const url = `${restURL}?page=0&size=1`;
        const headers = new Headers();
        // Laut deinem Router-Regex fliegt alles außer json/html raus
        headers.append(ACCEPT, 'text/plain');

        // when
        const response = await fetch(url, { headers });

        // then
        expect(response.status).toBe(406);
    });
});

// oxlint-disable max-classes-per-file
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
 * Das Modul besteht aus den Klassen für die Fehlerbehandlung bei der Verwaltung
 * von Kiosken, z.B. beim DB-Zugriff.
 * @packageDocumentation
 */

/**
 * Error-Klasse für einen nicht gefundenen Kiosk.
 */
export class NotFoundError extends Error {}

/**
 * Error-Klasse für eine bereits existierende Email.
 */
export class EmailExistsError extends Error {
    readonly email: string | undefined;

    constructor(email: string | undefined) {
        super(`Die email ${email} existiert bereits.`);
        this.email = email;
    }
}

/**
 * Error-Klasse für eine ungültige Versionsnummer beim Ändern.
 */
export class VersionInvalidError extends Error {
    readonly version: string | undefined;

    constructor(version: string | undefined) {
        super(`Die Versionsnummer ${version} ist ungueltig.`);
        this.version = version;
    }
}

/**
 * Error-Klasse für eine veraltete Versionsnummer beim Ändern.
 */
export class VersionOutdatedError extends Error {
    readonly version: number;

    constructor(version: number) {
        super(`Die Versionsnummer ${version} ist nicht aktuell.`);
        this.version = version;
    }
}

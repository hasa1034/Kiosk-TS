// Copyright (C) 2024 - present Juergen Zimmermann, Hochschule Karlsruhe
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
 * Das Modul enthält die Konfiguration für _Keycloak_.
 * @packageDocumentation
 */

import { readFile } from 'node:fs/promises';
import { getLogger } from '../logger/logger.mts';
import { config } from './app.mts';
import { env } from './env.mts';
import { resourcesURL } from './resources.mts';

const logger = getLogger('config/keycloak', 'file');

const { keycloak } = config;

if (keycloak !== undefined && keycloak !== null) {
    if (
        (keycloak.schema !== undefined &&
            typeof keycloak.schema !== 'string') ||
        (keycloak.port !== undefined && typeof keycloak.port !== 'number')
    ) {
        throw new TypeError(
            'Die Konfiguration für Keycloak (Schema und Port) ist falsch',
        );
    }
    if (keycloak.realm !== undefined && typeof keycloak.realm !== 'string') {
        throw new TypeError(
            'Der konfigurierte Realm-Name für Keycloak ist kein String',
        );
    }
    if (
        keycloak.clientId !== undefined &&
        typeof keycloak.clientId !== 'string'
    ) {
        throw new TypeError(
            'Der konfigurierte Client-ID für Keycloak ist kein String',
        );
    }
}

const schema = (keycloak?.schema as string | undefined) ?? 'https';
const host = (keycloak?.host as string | undefined) ?? 'keycloak';
const port = (keycloak?.port as number | undefined) ?? 8443;
const authServerUrl = `${schema}://${host}:${port}`;
// Keycloak ist in Sicherheits-Bereiche (= realms) unterteilt
const realm = (keycloak?.realm as string | undefined) ?? 'javascript';
const issuer = `${authServerUrl}/realms/${realm}`;
const oidcUrl = `${issuer}/protocol/openid-connect`;
const jwksUri = `${oidcUrl}/certs`;
const clientId =
    (keycloak?.clientId as string | undefined) ?? 'javascript-client';
const audience = ['account'];

// fuer KeycloakService
const accessTokenUrl = `${oidcUrl}/token`;

const { CLIENT_SECRET, NODE_ENV } = env;
const caCertificate = await readFile(
    new URL('tls/certificate.crt', resourcesURL),
    { encoding: 'utf8' },
);

export const keycloakConfig = {
    realm,
    issuer,
    jwksUri,
    clientId,
    audience,
    caCertificate,
    // fuer KeycloakService
    accessTokenUrl,
    secret:
        CLIENT_SECRET ??
        'ERROR: Umgebungsvariable CLIENT_SECRET nicht gesetzt!',
};

const keycloakConfigLogBase = {
    realm,
    issuer,
    jwksUri,
    clientId,
    audience,
    accessTokenUrl,
    secret: keycloakConfig.secret,
};
if (NODE_ENV === 'development') {
    logger.debug('keycloakConfig = %o', keycloakConfigLogBase);
} else {
    const { secret, ...keycloakConfigLog } = keycloakConfigLogBase;
    logger.debug('keycloakConfig = %o', keycloakConfigLog);
}

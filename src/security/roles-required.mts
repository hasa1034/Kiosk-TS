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

import { type Context, type HonoRequest, type Next } from 'hono';
import {
    ForbiddenError,
    InternalServerError,
    UnauthorizedError,
} from './errors.mts';
import { createRemoteJWKSet, customFetch, jwtVerify } from 'jose';
import { JOSEError } from 'jose/errors';
import { getLogger } from '../logger/logger.mts';
import { keycloakConfig } from '../config/keycloak.mts';

const logger = getLogger('roles-required', 'file');

type Rolle = 'admin' | 'user';
type FetchInitWithTls = RequestInit & {
    readonly tls: {
        readonly ca: string;
    };
};

const { issuer, jwksUri, clientId, audience, caCertificate } = keycloakConfig;
const jwks = createRemoteJWKSet(new URL(jwksUri), {
    [customFetch]: async (url, options) => {
        const requestInit: FetchInitWithTls = {
            ...options,
            tls: {
                ca: caCertificate,
            },
        };
        return await fetch(url, requestInit);
    },
});

// Token aus dem Request Header extrahieren
const getToken = (req: HonoRequest) => {
    const auth = req.header('Authorization');
    if (!auth?.startsWith('Bearer ')) {
        throw new UnauthorizedError('Authorization fehlt im Header');
    }
    const token = auth.slice(7); // oxlint-disable-line no-magic-numbers
    logger.debug('getToken: token=%s', token);
    return token;
};

// Base64 in JSON decodieren und verifizieren
const verifyToken = async (token: string) => {
    try {
        // https://github.com/panva/jose/blob/main/docs/jwt/verify/functions/jwtVerify.md
        // iat, exp und nbf werden implizit verifiziert
        return await jwtVerify(token, jwks, {
            // siehe Properties innerhalb der Payload des Tokens
            issuer,
            audience,
        });
    } catch (err) {
        logger.debug('verifyToken: verifyResult err=%o', err as object);
        if (err instanceof JOSEError) {
            // abgeleitet: JWTClaimValidationFailed, JWTExpired, ...
            throw new UnauthorizedError('Token nicht (mehr) gueltig');
        }
        throw new InternalServerError();
    }
};

// Rollen aus der Payload des verifizierten JWTs extrahieren
// {
//   "exp": ...,
//   "iat": ...,
//   ...
//   "resource_access": {
//     "javascript-client": {
//       "roles": ["admin"]
//     }
const getRollen = (payload: any) => {
    const roles = payload?.resource_access?.[clientId]?.roles;
    if (!Array.isArray(roles)) {
        throw new ForbiddenError('Keine Rolle im Token enthalten');
    }
    logger.debug('getRollen: roles=%o', roles);
    return roles;
};

/**
 * Middleware: mindestens eine der geforderten Rollen muss im Token enthalten sein.
 * Prüft den JWT hinsichtlich Audience, Expiration und Rollen.
 * @param roles Rollen als einzelne String-Argumente
 */
export const rolesRequired =
    (...roles: Rolle[]) =>
    // @ts-ignore
    async (c: Context, next: Next) => {
        const { req } = c;

        // Token aus dem Request Header extrahieren
        const token = getToken(req);

        // Base64 in JSON decodieren und verifizieren
        const verifyResult = await verifyToken(token);
        if (verifyResult instanceof Response) {
            return verifyResult;
        }

        // Payload aus dem verifizierten JWT extrahieren
        const { payload } = verifyResult;
        logger.debug('rolesRequired: payload=%o', payload);

        // Rollen aus der Payload bei resource_access.CLIENT_ID.roles extrahieren
        const rollenResult = getRollen(payload);

        // Ist eine der erforderlichen Rollen in der Payload vorhanden?
        const rolleVorhanden = roles.some((role) =>
            rollenResult.includes(role),
        );
        if (!rolleVorhanden) {
            throw new ForbiddenError('Erforderliche Rolle nicht vorhanden');
        }

        // Payload fuer evtl. spaetere Verarbeitung im Request puffern
        (req as any).tokenPayload = payload;

        await next();
    };

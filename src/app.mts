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

import { Hono, type Context, type Next } from 'hono';
import { compress } from 'hono/compress';
import { cors } from 'hono/cors';
import { showRoutes } from 'hono/dev';
import { createMiddleware } from 'hono/factory';
import { secureHeaders } from 'hono/secure-headers';
import { type ZodError } from 'zod';
import { router as healthRouter } from './admin/health-router.mts';
// import { graphqlApp } from './kiosk/graphql/graphql-app.mts'; // ANGEPASST
import { router } from './kiosk/router/kiosk-router.mts'; // ANGEPASST
import { router as kioskWriteRouter } from './kiosk/router/kiosk-write-router.mts'; // ANGEPASST
import {
    EmailExistsError, // ANGEPASST (Statt IsbnExistsError)
    NotFoundError,
    VersionInvalidError,
    VersionOutdatedError,
} from './kiosk/service/errors.mts'; // ANGEPASST
import { corsOptions } from './config/cors.mts';
import { router as devRouter } from './config/dev/dev-router.mts';
import { env } from './config/env.mts';
import { paths } from './config/paths.mts';
import { getLogger } from './logger/logger.mts';
import { requestLogger } from './logger/request-logger.mts';
import { responseTime } from './logger/response-time.mts';
import { trackMetrics } from './monitoring/prometheus-metrics.mts';
import { router as prometheusRouter } from './monitoring/prometheus-router.mts';
import {
    createProblemDetails,
    forbidden,
    preconditionFailed,
    unauthorized,
    unprocessableContent,
} from './problem-details.mts';
import { router as authRouter } from './security/auth-router.mts';
import { ForbiddenError, UnauthorizedError } from './security/errors.mts';

/**
 * Web-Applikation mit Hono.
 * @author [Jürgen Zimmermann](mailto:Juergen.Zimmermann@h-ka.de)
 */
export const app = new Hono();

const logger = getLogger('app', 'file');

// -----------------------------------------------------------------------------
// M i d d l e w a r e
// -----------------------------------------------------------------------------

// Globale Middleware muss vor den Routen registriert werden
// https://hono.dev/docs/guides/middleware#execution-order

// Zusaetzliche Security-Header
const securityHeaders = createMiddleware(async (c: Context, next: Next) => {
    c.header('X-Content-Type-Options', 'nosniff');
    // siehe CORS
    c.header('X-Frame-Options', 'SAMEORIGIN');
    await next();
});

// https://hono.dev/docs/middleware/builtin/secure-headers
// https://hono.dev/docs/middleware/builtin/cors
// https://hono.dev/docs/middleware/builtin/compress
app.use(secureHeaders(), cors(corsOptions), securityHeaders, compress());

app.use(trackMetrics);

if (logger.isLevelEnabled('debug')) {
    app.use(responseTime, requestLogger);
}

// -----------------------------------------------------------------------------
// R o u t e n
// -----------------------------------------------------------------------------
app.route(paths.rest, router);
app.route(paths.rest, kioskWriteRouter); // ANGEPASST
app.route(paths.health, healthRouter);
app.route(paths.auth, authRouter);
// Yoga baut eine Hono-App mit Basispfad "/graphql"
// app.route('/', graphqlApp);
app.route('/prometheus', prometheusRouter);

const { NODE_ENV } = env;
if (NODE_ENV === 'development' || NODE_ENV === 'test') {
    app.route(paths.dev, devRouter);
}

if (logger.isLevelEnabled('debug')) {
    showRoutes(app, {
        verbose: true,
    });
}

// -----------------------------------------------------------------------------
// E r r o r   H a n d l e r
// -----------------------------------------------------------------------------
// https://hono.dev/docs/api/exception#handling-httpexceptions
app.onError((error, c) => {
    if (error instanceof NotFoundError) {
        // https://hono.dev/docs/api/context#notfound
        return c.notFound() as Response;
    }

    if (error.name === 'ZodError') {
        return createProblemDetails(
            c,
            unprocessableContent,
            (error as ZodError).issues,
        );
    }

    if (error instanceof EmailExistsError) {
        // ANGEPASST
        return createProblemDetails(c, unprocessableContent, error.message);
    }

    if (
        error instanceof VersionInvalidError ||
        error instanceof VersionOutdatedError
    ) {
        return createProblemDetails(c, preconditionFailed, error.message);
    }

    if (error instanceof UnauthorizedError) {
        return createProblemDetails(c, unauthorized, error.message);
    }

    if (error instanceof ForbiddenError) {
        return createProblemDetails(c, forbidden, error.message);
    }

    logger.error('Interner Fehler: %o', error);
    console.log(error.stack);
    return c.body('Interner Fehler', 500); // eslint-disable-line @typescript-eslint/no-magic-numbers
});

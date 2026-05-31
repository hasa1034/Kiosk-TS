import process from 'node:process';
import { styleText } from 'node:util';
import { PrismaPg } from '@prisma/adapter-pg';
import { prismaQueryInsights } from '@prisma/sqlcommenter-query-insights';
// Hier war der Fehler: Nur ein Import und die Endung muss .ts sein!
import {
    PrismaClient,
    type Produkt,
    type Prisma,
} from './generated/prisma/client.ts';

// --- Logging & Info ---
let message = styleText(['black', 'bgWhite'], 'Node version');
console.log(`${message}=${process.version}`);
message = styleText(['black', 'bgWhite'], 'DATABASE_URL');
console.log(`${message}=${process.env['DATABASE_URL']}`);
console.log();

// --- Adapter & Client Setup ---
const adapter = new PrismaPg({
    connectionString: process.env['DATABASE_URL'],
});

const log: (Prisma.LogLevel | Prisma.LogDefinition)[] = [
    { emit: 'event', level: 'query' },
    'info',
    'warn',
    'error',
];

const prisma = new PrismaClient({
    adapter,
    errorFormat: 'pretty',
    log,
    comments: [prismaQueryInsights()],
});

// Query-Logging im Terminal (grün für die SQL-Abfrage)
prisma.$on('query', (e) => {
    console.log(styleText('green', `Query: ${e.query}`));
    console.log(styleText('cyan', `Duration: ${e.duration} ms`));
});

// --- Eigener Payload-Typ ---
export type ProduktMitKiosk = Prisma.ProduktGetPayload<{
    include: { kiosk: true };
}>;

// --- Datenbank-Operationen ---
try {
    await prisma.$connect();

    // 1. Ein einzelnes Produkt finden
    const produkt: Produkt | null = await prisma.produkt.findUnique({
        where: { id: 1 },
    });
    message = styleText(['black', 'bgWhite'], 'Einzel-Produkt');
    console.log(`${message} = %j`, produkt);
    console.log();

    // 2. Suche: Alle Produkte, deren Name "Cola" enthält
    const produkteSuche: ProduktMitKiosk[] = await prisma.produkt.findMany({
        where: {
            name: {
                contains: 'Zigaretten',
                mode: 'insensitive',
            },
        },
        include: {
            kiosk: true,
        },
    });
    message = styleText(['black', 'bgWhite'], 'Produkte mit Kiosk-Details');
    console.log(`${message} = %j`, produkteSuche);
    console.log();

    // 3. Daten-Transformation
    const produktNamen = produkteSuche.map((p) => p.name);
    // Beachte: Wir nutzen hier 'kiosk', weil das Model so im Schema heißt
    const kioskNamen = produkteSuche.map((p) => p.kiosk.name);

    console.log(styleText(['black', 'bgWhite'], 'Produktnamen'), produktNamen);
    console.log(styleText(['black', 'bgWhite'], 'Verkauft in'), kioskNamen);
    console.log();
} catch (err) {
    console.error(styleText('red', 'Datenbankfehler:'), err);
} finally {
    await prisma.$disconnect();
}

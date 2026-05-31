import { PrismaPg } from '@prisma/adapter-pg';
import process from 'node:process';
import { styleText } from 'node:util';
import { PrismaClient, type Prisma } from './generated/prisma/client.ts';
let message = styleText(
    'yellow',
    `process.env['DATABASE_URL']=${process.env['DATABASE_URL']}`,
);
console.log(message);
console.log();

// Wir nutzen hier den ADMIN Account (falls in .env vorhanden) für Schreibrechte
const adapter = new PrismaPg({
    connectionString: process.env['DATABASE_URL_ADMIN'],
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
});

prisma.$on('query', (e) => {
    console.log(styleText('green', `Query: ${e.query}`));
    console.log(styleText('cyan', `Duration: ${e.duration} ms`));
});

// --- Daten für einen neuen Kiosk (Create Input) ---
const neuerKiosk: Prisma.KioskCreateInput = {
    name: 'Kiosk an der Hochschule',
    email: `hka-kiosk-${Date.now()}@example.com`,
    username: 'hka_admin',
    istGeoeffnet: true,
    erzeugt: new Date(),
    aktualisiert: new Date(),
    // Verschachteltes Create: Betreiber und Produkt direkt mit anlegen (1:N Beziehungen)
    betreiber: {
        create: [
            {
                vorname: 'Max',
                nachname: 'Mustermann',
                geschlecht: 'MAENNLICH',
            },
        ],
    },
    produkt: {
        create: [
            {
                name: 'Kaffee',
                preis: 2.5,
                waehrung: 'EUR',
            },
        ],
    },
};

// --- Daten für ein Update (Update Input) ---
const geaendertesProdukt: Prisma.ProduktUpdateInput = {
    preis: 2.8, // Preiserhöhung
    waehrung: 'EUR',
};

try {
    await prisma.$connect();

    await prisma.$transaction(async (tx) => {
        // 1. Kiosk erstellen
        const kioskDb = await tx.kiosk.create({
            data: neuerKiosk,
            include: { betreiber: true, produkt: true },
        });
        message = styleText(['black', 'bgWhite'], 'Neuer Kiosk ID:');
        console.log(`${message} ${kioskDb.id}`);

        // 2. Produkt aktualisieren
        const produktUpdated = await tx.produkt.update({
            data: geaendertesProdukt,
            where: { id: 1 },
        });
        // eslint-disable-next-line require-atomic-updates
        message = styleText(['black', 'bgWhite'], 'Produkt aktualisiert:');
        console.log(
            `${message} ID ${produktUpdated.id}, Neuer Preis: ${produktUpdated.preis.toString()}`,
        );

        // 3. Löschen (Beispiel: Kiosk mit ID 99 löschen)
        // await tx.kiosk.delete({ where: { id: 99 } });
    });
} finally {
    await prisma.$disconnect();
}

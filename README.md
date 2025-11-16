
# Hydra-Classic (Node.js) - Ready for Railway + External Lavalink

Questo progetto è un bot Discord musicale minimale, compatibile con **BotGhost** (accetta comandi inviati da bot) e pronto per il deploy su Railway.

## Funzionalità
- Prefisso: `!`
- Comandi: `!join`, `!play <url|search>`, `!skip`, `!stop`, `!leave`, `!volume <0-100>`
- Usa **erela.js** per connettersi a Lavalink
- Progettato per usare un **Lavalink esterno** (non incluso)

## Variabili d'ambiente (Railway)
Imposta queste variabili nella sezione Environment della tua app Railway:
```
TOKEN=TUO_TOKEN_DISCORD
PREFIX=!
LAVALINK_HOST=lavalink.reiyu.space
LAVALINK_PORT=2333
LAVALINK_PASSWORD=yusie
```

## Deploy su Railway (passi rapidi)
1. Crea un repository GitHub e carica questi file (o scarica lo zip e usa Upload).
2. Su Railway: New Project → Deploy from GitHub → collega il repo → Deploy.
3. Imposta le Environment Variables (TOKEN, PREFIX, LAVALINK_*).
4. Avvia il progetto. Dovrebbe essere online in pochi secondi.

## Note
- Questo progetto è intenzionalmente minimale per facilità di deploy e compatibilità.
- Se vuoi, posso aggiungere Dockerfile, script per Lavalink locale, dashboard, o comandi interattivi.


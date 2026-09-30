# Prisma + Capacitor

Capacitor queda preparado como una capa futura para empaquetar la PWA de Prisma en Android y iOS.

## Configuración actual

- App ID: `com.juno.prisma`
- Nombre nativo: `Prisma`
- Directorio web: `dist/public`
- Build móvil: `pnpm run build:web`
- Sin plataformas `android/` o `ios/` creadas todavía.
- Sin plugins nativos añadidos todavía.

## Flujo previsto

```bash
pnpm install
pnpm run cap:sync
npx cap add android
npx cap add ios
npx cap sync
pnpm run cap:open:android
pnpm run cap:open:ios
```

La app sigue siendo local-first: Dexie y el almacenamiento local continúan siendo la fuente de datos. Capacitor no añade backend, sincronización cloud ni transmisión de datos financieros.

## Nota de plataforma

La creación y compilación de Android/iOS requiere los toolchains nativos correspondientes. Esta fase solo registra la configuración compartida y mantiene intacto el flujo web.

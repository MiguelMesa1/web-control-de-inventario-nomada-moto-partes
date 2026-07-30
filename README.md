# Web Control de Inventario Nomada Moto Partes

Aplicación web para administrar el inventario de **Nomada Moto Partes**. Centraliza el catálogo de productos, movimientos, importaciones de archivos, alertas de reposición y análisis operativo.

## Funcionalidades

- Panel de control con indicadores de inventario.
- Consulta, filtros y gestión del catálogo de productos.
- Importación de inventario y registro de importaciones fallidas.
- Historial de movimientos y documentos adjuntos por producto.
- Alertas de reposición y lista de seguimiento por línea.
- Analítica, configuración de líneas y administración de usuarios.
- Autenticación y persistencia de datos con [InsForge](https://insforge.dev).

## Tecnologías

- Next.js 16, React 19 y TypeScript.
- Tailwind CSS y componentes Radix UI.
- InsForge para autenticación, base de datos, almacenamiento y funciones.
- Vitest para pruebas unitarias y Playwright para pruebas de extremo a extremo.

## Requisitos

- Node.js 22.x
- pnpm 10+
- Un proyecto de InsForge configurado

## Primeros pasos

1. Instala las dependencias:

   ```bash
   pnpm install
   ```

2. Crea tu archivo de variables de entorno a partir del ejemplo:

   ```bash
   cp .env.example .env.local
   ```

   En Windows PowerShell:

   ```powershell
   Copy-Item .env.example .env.local
   ```

3. Completa `.env.local` con las credenciales de tu proyecto InsForge:

   ```env
   NEXT_PUBLIC_INSFORGE_URL=https://tu-proyecto.us-east.insforge.app
   NEXT_PUBLIC_INSFORGE_ANON_KEY=
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   INSFORGE_API_KEY=
   ```

4. Aplica las migraciones de la carpeta `migrations/` en el proyecto de InsForge.

5. Inicia el servidor de desarrollo:

   ```bash
   pnpm dev
   ```

Abre [http://localhost:3000](http://localhost:3000) en el navegador.

## Comandos

| Comando | Descripción |
| --- | --- |
| `pnpm dev` | Inicia el entorno de desarrollo. |
| `pnpm build` | Genera la compilación de producción. |
| `pnpm start` | Inicia la aplicación compilada. |
| `pnpm lint` | Ejecuta ESLint. |
| `pnpm test` | Ejecuta las pruebas unitarias. |
| `pnpm test:e2e` | Ejecuta las pruebas de Playwright. |

## Seguridad

No subas `.env.local`, `.insforge/`, dependencias, compilados ni reportes de pruebas. El archivo `.gitignore` del proyecto ya los excluye. Usa `.env.example` únicamente como plantilla y nunca pongas claves reales allí.

## Estructura principal

```text
src/app/          Rutas, pantallas y API de Next.js
src/components/   Componentes visuales y proveedores de estado
src/lib/          Cliente InsForge y lógica de inventario
migrations/       Esquema y políticas de la base de datos
insforge/         Funciones de InsForge
tests/            Pruebas de extremo a extremo
```

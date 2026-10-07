# MagicBeauty.Store

Premium e-commerce platform for Magic Beauty Cosmetics.

## Purpose

MagicBeauty.Store is a real-world e-commerce project built as both a business solution and a professional portfolio project.

## Tech Stack

### Backend
- .NET 10 Web API
- Clean Architecture
- Entity Framework Core
- SQL Server
- Code First + Migrations

### Frontend
- Angular 21
- Standalone components
- PrimeNG free components
- Custom premium beauty styling

## Architecture

```text
MagicBeauty.Store/
├── backend/
│   ├── MagicBeauty.Store.slnx
│   └── src/
│       ├── MagicBeauty.Store.Api/
│       ├── MagicBeauty.Store.Application/
│       ├── MagicBeauty.Store.Contracts/
│       ├── MagicBeauty.Store.Domain/
│       └── MagicBeauty.Store.Infrastructure/
├── frontend/
└── docs/

## Configuración por ambiente

La API usa appsettings.Development.json en desarrollo y appsettings.Production.json en producción. Los archivos reales y appsettings.json están excluidos de Git; únicamente se publican las plantillas .example.json sin conexiones ni credenciales.

Desde backend/src/MagicBeauty.Store.Api, copia la plantilla del ambiente:

    Copy-Item appsettings.Development.example.json appsettings.Development.json
    Copy-Item appsettings.Production.example.json appsettings.Production.json

Completa DefaultConnection, AllowedHosts y Cors:AllowedOrigins en tus archivos locales. No sobrescribas un archivo real ya configurado al copiar plantillas.

En desarrollo puede utilizarse SQL Server LocalDB con autenticación integrada. La configuración local existente se conserva en el archivo Development y no se publica.

En producción, configura tu conexión a Azure SQL MagicProcess mediante el archivo ignorado o la variable de entorno ConnectionStrings__DefaultConnection del hosting. Define ASPNETCORE_ENVIRONMENT=Production; para desarrollo, ASPNETCORE_ENVIRONMENT=Development. Los perfiles launchSettings existentes ya seleccionan Development.

Las plantillas tienen la conexión vacía deliberadamente: deben completarse antes de ejecutar. No introduzcas credenciales en las plantillas ni en el frontend. Los archivos reales ignorados deben suministrarse también al desplegar o configurarse mediante variables de entorno.

La conexión local publicada anteriormente permanece en commits históricos; esta actualización la elimina de las versiones actuales sin reescribir el historial.

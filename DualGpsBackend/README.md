# DualGpsBackend

## Project structure

Java code is grouped by feature under `com.dualgpsbackend`:

```text
com.dualgpsbackend
├── DualGpsBackendApplication
├── file
│   ├── api            # File HTTP endpoints and API response types
│   ├── application    # File use cases, commands, results, and exceptions
│   ├── domain         # File entities and business types
│   ├── persistence    # File database repositories
│   └── storage        # File storage interface and local implementation
├── user
│   ├── api            # Registration and login HTTP endpoints
│   ├── application    # User use cases, DTOs, mapping, and exceptions
│   ├── domain         # User entity and roles
│   └── persistence    # User database repositories
├── security
│   └── config         # Security configuration and password encoder
│                      # JWT generation and authentication live in security
└── shared
    ├── api            # Global HTTP exception handling
    └── config         # Shared web configuration, including CORS
```

Add new features as sibling packages of `file` and `user`, keeping their
controllers, services, DTOs, entities, and repositories together in the same
layer layout. API classes handle HTTP concerns; application classes coordinate
use cases; domain classes hold business data; persistence and storage classes
handle external resources. Keep application code independent of API classes.
Use `shared` for cross-feature infrastructure, and mirror production packages
under `src/test/java`.

The application entry point stays in the root package so Spring can discover
all feature components, entities, and repositories. This organization keeps the
existing HTTP endpoints and database mappings unchanged.

## Run with Docker

Start the Spring Boot backend and PostgreSQL database:

```shell
docker compose up --build
```

The backend is available at `http://localhost:8080`. PostgreSQL is available on
`localhost:5432`. Database data is kept in the `postgres-data` Docker volume.

The default local database values are:

- database: `dual_gps`
- username: `dual_gps`
- password: `dual_gps`

Stop the containers with `docker compose down`. To also delete the persisted database
data, run `docker compose down --volumes`.

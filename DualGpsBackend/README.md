# DualGpsBackend

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

You can override the credentials and published ports through environment variables.
For example, in PowerShell:

```powershell
$env:POSTGRES_PASSWORD = "choose-a-password"
$env:BACKEND_PORT = "8081"
docker compose up --build
```

Stop the containers with `docker compose down`. To also delete the persisted database
data, run `docker compose down --volumes`.

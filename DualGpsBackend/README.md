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

## Logging

Application logs go to the console at `INFO` level by default. Upload completion,
user registration, login, and role changes are logged with generated IDs.
Storage and database request failures include stack traces; expected validation
and bearer authentication rejections use `DEBUG`.

For local debugging, set `APP_LOG_LEVEL=DEBUG` in the IntelliJ run configuration
or in PowerShell before starting the backend:

```powershell
$env:APP_LOG_LEVEL = "DEBUG"
./mvnw.cmd spring-boot:run
```

For Docker, set `LOGGING_LEVEL_COM_DUALGPSBACKEND=DEBUG` in the backend service's
environment. View its console output with `docker compose logs -f backend`.
Avoid logging passwords, tokens, authorization headers, request bodies, or file
contents. Local file logging can optionally be enabled with
`logging.file.name=./data/logs/dual-gps.log`; use a writable, persistent directory
when running in a container.

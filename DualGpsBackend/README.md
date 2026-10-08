# Dual GPS backend

The REST API for [Dual GPS](../README.md), built with Java 25 and Spring Boot 4.1.1. It manages user registration, JWT authentication, and files owned by authenticated users. PostgreSQL stores accounts and file metadata; a local storage implementation stores file content.

The mobile app connects directly to the NTRIP caster. This backend does not relay GNSS corrections.

## Features

- Validated registration and login, BCrypt password hashing, and stateless JWT authentication.
- Spring Data JPA persistence with PostgreSQL.
- Multipart file uploads with a 10 MiB application limit and a required file purpose.
- Owner-restricted downloads with streamed content and sanitized attachment filenames.
- A file storage interface with a local filesystem implementation and restricted storage keys.
- Cleanup of partial uploads and compensation when metadata persistence fails.
- Centralized validation and infrastructure error responses.
- Controller, service, and filesystem tests for successful requests and failure cases.

## Run locally

The entire backend—both the Spring Boot API and PostgreSQL database—can run in Docker using the included Dockerfile and Compose configuration. This option requires Docker with Compose, without a local Java or Maven installation.

### Run both components in Docker

The repository includes a multi-stage Dockerfile and a Compose backend service, with PostgreSQL health checks and startup ordering. The backend image runs as the `spring` user.

**Current container limitation:** the image does not prepare a writable default upload directory under `/app`. Since local storage creates its root during startup, the default backend container can fail with a filesystem permission error. From this directory, build the API image and run both components with a temporary writable storage root:

```shell
docker compose build backend
docker compose up -d database
docker compose run --rm --service-ports -e FILE_STORAGE_ROOT=/tmp/dualgps-uploads backend
```

Both Spring Boot and PostgreSQL run in containers. The API is exposed on `http://localhost:8080`, and PostgreSQL on `localhost:5432`. PostgreSQL data persists in the `postgres-data` volume. The temporary upload directory has no persistent volume; its content is lost when the API container is removed. For persistent container file storage, configure a volume and a directory writable by the `spring` user.

Stop the foreground API with Ctrl+C, then stop Compose services with `docker compose down`. This preserves the database volume.

### Run Spring Boot locally with PostgreSQL in Docker

Alternatively, install JDK 25 and run Spring Boot on your computer. Maven is provided through the wrapper.

From this directory, start PostgreSQL:

```shell
docker compose up -d database
```

Then start the backend on Windows:

```powershell
.\mvnw.cmd spring-boot:run
```

On macOS/Linux:

```shell
./mvnw spring-boot:run
```

The API is available at `http://localhost:8080`; PostgreSQL is exposed on `localhost:5432`. There is no public landing page or health endpoint configured. Use the authentication endpoints below to try the API.

Local database defaults are database `dual_gps`, username `dual_gps`, and password `dual_gps`. PostgreSQL data persists in the `postgres-data` Docker volume. Uploaded content is stored in `./data/uploads`, relative to the backend process's working directory.

## Configuration

The application reads these environment variables:

| Variable            | Default                                     | Purpose                   |
| ------------------- | ------------------------------------------- | ------------------------- |
| `DATABASE_URL`      | `jdbc:postgresql://localhost:5432/dual_gps` | JDBC connection URL       |
| `DATABASE_USERNAME` | `dual_gps`                                  | Database user             |
| `DATABASE_PASSWORD` | `dual_gps`                                  | Database password         |
| `JPA_DDL_AUTO`      | `update`                                    | Hibernate schema handling |
| `FILE_STORAGE_ROOT` | `./data/uploads`                            | Local content directory   |
| `SERVER_PORT`       | `8080`                                      | HTTP port                 |
| `APP_LOG_LEVEL`     | `INFO`                                      | Application log level     |

Compose separately accepts `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_PORT`, and `BACKEND_PORT`. It maps the database credentials into the backend service. Other application overrides need to be passed explicitly to that service or to the local JVM process.

Multipart limits are configured as 10 MB per file and 11 MB per request. The application service additionally requires nonempty files of at most 10 MiB.

## API

All routes except `/api/auth/**` and `/error` require a valid JWT in `Authorization: Bearer <token>`.

| Method | Endpoint                   | Request                               | Success response              |
| ------ | -------------------------- | ------------------------------------- | ----------------------------- |
| `POST` | `/api/auth/register`       | JSON: `username`, `email`, `password` | `200`, registered user        |
| `POST` | `/api/auth/login`          | JSON: `email`, `password`             | `200`, `{ "token": "..." }`   |
| `POST` | `/api/files`               | Multipart: `file`, `purpose`          | `201`, uploaded file metadata |
| `GET`  | `/api/files/{id}/download` | File UUID in the path                 | `200`, attachment stream      |

File purposes are `USER_AVATAR`, `GPS_IMPORT`, and `DOCUMENT`. These classify stored files; the API does not parse imported GNSS data. Upload metadata contains `id`, `originalFilename`, `contentType`, `size`, `purpose`, and `createdAt`. Uploads return a `Location` header, but a standalone metadata GET endpoint is not implemented.

### Example requests

These examples use PowerShell. On macOS/Linux, use `curl` in place of `curl.exe` for the multipart and download commands.

```powershell
$baseUrl = "http://localhost:8080"
$account = @{
    username = "demo"
    email = "demo@example.com"
    password = "local-demo-password"
}
Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/register" -ContentType "application/json" -Body ($account | ConvertTo-Json)

$credentials = @{ email = $account.email; password = $account.password }
$session = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/auth/login" -ContentType "application/json" -Body ($credentials | ConvertTo-Json)
$token = $session.token
```

Upload a local file, replacing `sample.txt` with an existing path:

```powershell
curl.exe -X POST "$baseUrl/api/files" -H "Authorization: Bearer $token" -F "file=@sample.txt;type=text/plain" -F "purpose=DOCUMENT"
```

Use the `id` from the upload response to download it:

```powershell
$fileId = "<id-from-upload-response>"
curl.exe "$baseUrl/api/files/$fileId/download" -H "Authorization: Bearer $token" --output downloaded.txt
```

Missing files and files belonging to another user both return `404` with `File not found`. Duplicate registration returns `409`; invalid login credentials return `401`; validation errors return `400`.

## Architecture

Java code is organized by feature under `com.dualgpsbackend`:

```text
com.dualgpsbackend
|-- DualGpsBackendApplication
|-- file
|   |-- api           HTTP endpoints and response types
|   |-- application   Upload/download use cases, commands, and results
|   |-- domain        File entity and purpose enum
|   |-- persistence   JPA repository
|   `-- storage       Storage interface and local implementation
|-- user
|   |-- api           Registration and login endpoints
|   |-- application   User services, DTOs, and MapStruct mapping
|   |-- domain        User entity and roles
|   `-- persistence   JPA repository
|-- security          JWT utilities, filter, and security configuration
`-- shared            Exception handling and web configuration
```

API classes handle HTTP concerns; application services coordinate use cases; repositories and storage classes handle external resources. New features can follow the same layout, with corresponding packages under `src/test/java`.

## Tests

With PostgreSQL running and JDK 25 configured:

```powershell
.\mvnw.cmd test
```

On macOS/Linux, use `./mvnw test`. The application context test uses the configured PostgreSQL database. To run only the file controller, service, and filesystem tests:

```powershell
.\mvnw.cmd "-Dtest=FileControllerTest,FileDownloadControllerTest,FileServiceTest,FileDownloadServiceTest,LocalFileStorageTest" test
```

Those tests use mocked application dependencies or temporary storage directories. They cover authentication failures, invalid inputs, owner-restricted access, safe download headers, stream closure, storage key validation, byte preservation, and cleanup after failures. The Dockerfile packages with tests skipped; run the tests separately.

## Current scope

JWTs expire after one hour. The signing key is generated in memory at startup, so a backend restart invalidates existing tokens. New accounts receive the `OPERATOR` role. Registration currently returns the user entity, including its encoded password field; a dedicated response DTO is still needed. The frontend's registered-user type also contains legacy fields that do not match the backend's current user model.

The current setup uses local credentials, Hibernate schema updates, and local file storage for development. File listing, metadata retrieval, deletion endpoints, and a mobile file management screen are not yet implemented.

FROM eclipse-temurin:25-jdk-alpine AS builder

WORKDIR /workspace

COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -B -ntp dependency:go-offline

COPY src src
RUN ./mvnw -B -ntp package -DskipTests \
    && cp "$(find target -maxdepth 1 -type f -name '*.jar' | head -n 1)" target/application.jar

FROM eclipse-temurin:25-jre-alpine

RUN addgroup -S spring && adduser -S spring -G spring
USER spring:spring
WORKDIR /app

COPY --from=builder /workspace/target/application.jar application.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "application.jar"]

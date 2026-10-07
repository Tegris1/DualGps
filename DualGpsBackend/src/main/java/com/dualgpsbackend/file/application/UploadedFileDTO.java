package com.dualgpsbackend.file.application;

import com.dualgpsbackend.file.domain.FilePurpose;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

public record UploadedFileDTO(
        UUID id,
        String originalFilename,
        String contentType,
        long size,
        FilePurpose purpose,
        Instant createdAt
) {
}

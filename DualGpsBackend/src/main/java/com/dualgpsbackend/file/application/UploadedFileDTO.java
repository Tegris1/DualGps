package com.dualgpsbackend.file.application;

import com.dualgpsbackend.file.domain.FileAsset;
import com.dualgpsbackend.file.domain.FilePurpose;

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
    static UploadedFileDTO from(FileAsset asset) {
        return new UploadedFileDTO(
                asset.getId(),
                asset.getOriginalFilename(),
                asset.getContentType(),
                asset.getSize(),
                asset.getPurpose(),
                asset.getCreatedAt()
        );
    }
}

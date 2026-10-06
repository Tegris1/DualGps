package com.dualgpsbackend.file.application;

import com.dualgpsbackend.file.domain.FilePurpose;

import java.io.InputStream;

public record UploadFileCommand(
        String ownerEmail,
        String originalFilename,
        String contentType,
        long size,
        FilePurpose purpose,
        InputStream content
) {
}
package com.dualgpsbackend.file.application;

import java.io.IOException;
import java.io.InputStream;

public record FileDownloadDTO(
        String originalFilename,
        long size,
        ContentSource content
) {

    @FunctionalInterface
    public interface ContentSource{
        InputStream openStream() throws IOException;
    }
}

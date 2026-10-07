package com.dualgpsbackend.file.storage;

import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cglib.core.Local;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;

@Slf4j
@Component
public class LocalFileStorage implements FileStorage{

    private final Path root;

    public LocalFileStorage(@Value("${storage.local.root}") String directory) throws IOException{
        root = Path.of(directory).toAbsolutePath().normalize();
        Files.createDirectories(root);
        log.info("Local file storage initialized: directory={}", root);
    }

    @Override
    public void upload(String storageKey, InputStream content) throws IOException{
        Path target = resolve(storageKey);
        long bytesWritten;

        try(OutputStream output = Files.newOutputStream(
                target,
                StandardOpenOption.CREATE_NEW,
                StandardOpenOption.WRITE
        )){
            try{
                bytesWritten = content.transferTo(output);
            }catch (IOException exception){
                log.debug("Local write failed; removing partial upload: storageKey={}", storageKey);
                try {
                    output.close();
                    Files.deleteIfExists(target);
                }catch (IOException cleanupException){
                    exception.addSuppressed(cleanupException);
                    log.warn("Partial upload cleanup failed; file may remain: storageKey={}", storageKey);
                }
                throw exception;
            }
        }
        log.debug("Local file written: storageKey={}, bytes={}", storageKey, bytesWritten);
    }

    @Override
    public InputStream download(String storageKey) throws IOException{
        InputStream content = Files.newInputStream(resolve(storageKey));
        log.debug("Local file opened for download: storageKey={}", storageKey);
        return content;
    }

    @Override
    public void delete(String storageKey) throws IOException {
        boolean deleted = Files.deleteIfExists(resolve(storageKey));
        log.debug("Local file deletion completed: storageKey={}, deleted={}", storageKey, deleted);
    }

    private Path resolve(String storageKey){
        if(storageKey == null || !storageKey.matches("[a-zA-Z0-9_-]+")){
            throw new IllegalArgumentException("Invalid storage key");
        }

        return root.resolve(storageKey);
    }
}

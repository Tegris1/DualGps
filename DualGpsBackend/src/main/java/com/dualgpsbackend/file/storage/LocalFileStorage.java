package com.dualgpsbackend.file.storage;

import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cglib.core.Local;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;

@Component
public class LocalFileStorage implements FileStorage{

    private final Path root;

    public LocalFileStorage(@Value("${storage.local.root}") String directory) throws IOException{
        root = Path.of(directory).toAbsolutePath().normalize();
        Files.createDirectories(root);
    }

    @Override
    public void upload(String storageKey, InputStream content) throws IOException{
        Path target = resolve(storageKey);

        try(OutputStream output = Files.newOutputStream(
                target,
                StandardOpenOption.CREATE_NEW,
                StandardOpenOption.WRITE
        )){
            try{
                content.transferTo(output);
            }catch (IOException exception){
                try {
                    output.close();
                    Files.deleteIfExists(target);
                }catch (IOException cleanupException){
                    exception.addSuppressed(cleanupException);
                }
                throw exception;
            }
        }
    }

    @Override
    public InputStream download(String storageKey) throws IOException{
        return Files.newInputStream(resolve(storageKey));
    }

    @Override
    public void delete(String storageKey) throws IOException {
        Files.deleteIfExists(resolve(storageKey));
    }

    private Path resolve(String storageKey){
        if(storageKey == null || !storageKey.matches("[a-zA-Z0-9_-]+")){
            throw new IllegalArgumentException("Invalid storage key");
        }

        return root.resolve(storageKey);
    }
}

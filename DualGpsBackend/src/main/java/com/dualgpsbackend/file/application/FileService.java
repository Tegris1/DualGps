package com.dualgpsbackend.file.application;

import com.dualgpsbackend.file.api.FileResponse;
import com.dualgpsbackend.file.domain.FileAsset;
import com.dualgpsbackend.file.persistence.FileAssetRepository;
import com.dualgpsbackend.file.storage.FileStorage;
import com.dualgpsbackend.model.User;
import com.dualgpsbackend.reositories.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class FileService {

    private static final long MAX_FILE_SIZE = 10L * 1024 * 1024;

    private final FileStorage fileStorage;
    private final FileAssetRepository fileAssetRepository;
    private final UserRepository userRepository;

    public UploadedFile upload (UploadFileCommand command) throws IOException{
        validate(command);

        User owner = userRepository.findByEmail(command.ownerEmail()).orElseThrow(
                ()-> new UsernameNotFoundException("User not found")
        );

        String storageKey = UUID.randomUUID().toString();

        FileAsset  asset = new FileAsset();
        asset.setStorageKey(storageKey);
        asset.setOriginalFilename(command.originalFilename());
        asset.setContentType(command.contentType());
        asset.setSize(command.size());
        asset.setPurpose(command.purpose());
        asset.setOwner(owner);

        fileStorage.upload(storageKey, command.content());

        FileAsset saved;

        try {
            saved = fileAssetRepository.saveAndFlush(asset);
        } catch (RuntimeException exception) {
            deleteAfterFailure(storageKey, exception);
            throw exception;
        }

        return new UploadedFile(
                saved.getId(),
                saved.getOriginalFilename(),
                saved.getContentType(),
                saved.getSize(),
                saved.getPurpose(),
                saved.getCreatedAt()
        );
    }

    private void validate(UploadFileCommand command){
        if(command == null){
            throw new IllegalArgumentException("Upload data required");
        }
        if(command.ownerEmail() == null || command.ownerEmail().isBlank()){
            throw new IllegalArgumentException("Owner email is required");
        }

        if(command.content() == null || command.purpose() == null){
            throw new IllegalArgumentException("File cannot be empty");
        }

        if(command.originalFilename() == null || command.originalFilename().isBlank()){
            throw new IllegalArgumentException("Filename is required");
        }
        if (command.contentType() == null
                || command.contentType().isBlank()) {
            throw new IllegalArgumentException("Content type is required");
        }

        if (command.size() <= 0 || command.size() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException(
                    "File must be nonempty and no larger than 10 MiB"
            );
        }
    }

    private void deleteAfterFailure(
            String storageKey,
            RuntimeException originalException
    ) {
        try {
            fileStorage.delete(storageKey);
        } catch (IOException cleanupException) {
            originalException.addSuppressed(cleanupException);
        }
    }

}

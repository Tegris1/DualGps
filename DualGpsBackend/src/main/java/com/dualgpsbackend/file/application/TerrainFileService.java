package com.dualgpsbackend.file.application;

import com.dualgpsbackend.file.domain.FileAsset;
import com.dualgpsbackend.file.domain.FilePurpose;
import com.dualgpsbackend.file.persistence.FileAssetRepository;
import com.dualgpsbackend.file.storage.FileStorage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.io.IOException;
import java.io.PushbackInputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class TerrainFileService {
    private static final int GLB_HEADER_SIZE = 20;
    private static final int GLB_MAGIC = 0x46546c67;
    private static final int JSON_CHUNK = 0x4e4f534a;

    private final FileService fileService;
    private final FileAssetRepository repository;
    private final FileStorage storage;

    public List<UploadedFileDTO> list(String ownerEmail) {
        return repository.findAllByOwner_EmailAndTerrainTrueOrderByCreatedAtDesc(ownerEmail)
                .stream().map(UploadedFileDTO::from).toList();
    }

    public UploadedFileDTO add(UploadFileCommandDTO command) throws IOException {
        return fileService.uploadTerrain(validateTerrain(command));
    }

    @Transactional(rollbackFor = IOException.class)
    public UploadedFileDTO replace(UUID id, UploadFileCommandDTO command) throws IOException {
        UploadFileCommandDTO terrain = validateTerrain(command);
        FileAsset asset = ownedTerrain(id, terrain.ownerEmail());
        String newKey = UUID.randomUUID().toString();
        storage.upload(newKey, terrain.content());
        cleanUpOnCompletion(asset.getStorageKey(), newKey);
        asset.setStorageKey(newKey);
        asset.setOriginalFilename(terrain.originalFilename());
        asset.setContentType(terrain.contentType());
        asset.setSize(terrain.size());
        return UploadedFileDTO.from(asset);
    }

    @Transactional
    public void delete(UUID id, String ownerEmail) {
        FileAsset asset = ownedTerrain(id, ownerEmail);
        repository.delete(asset);
        cleanUpOnCompletion(asset.getStorageKey(), null);
    }

    private FileAsset ownedTerrain(UUID id, String ownerEmail) {
        return repository.findByIdAndOwner_EmailAndTerrainTrue(id, ownerEmail)
                .orElseThrow(FileAssetNotFoundException::new);
    }

    private UploadFileCommandDTO validateTerrain(UploadFileCommandDTO command) throws IOException {
        FileService.validate(command);
        String filename = command.originalFilename();
        if (filename.length() > 255 || !filename.toLowerCase(Locale.ROOT).endsWith(".glb")) {
            throw new IllegalArgumentException("Choose a .glb terrain file with a filename up to 255 characters");
        }

        PushbackInputStream content = new PushbackInputStream(command.content(), GLB_HEADER_SIZE);
        byte[] header = content.readNBytes(GLB_HEADER_SIZE);
        if (header.length != GLB_HEADER_SIZE) {
            throw invalidModel();
        }
        ByteBuffer glb = ByteBuffer.wrap(header).order(ByteOrder.LITTLE_ENDIAN);
        if (glb.getInt() != GLB_MAGIC || glb.getInt() != 2
                || Integer.toUnsignedLong(glb.getInt()) != command.size()) {
            throw invalidModel();
        }
        long jsonSize = Integer.toUnsignedLong(glb.getInt());
        if (jsonSize == 0 || jsonSize % 4 != 0 || GLB_HEADER_SIZE + jsonSize > command.size()
                || glb.getInt() != JSON_CHUNK) {
            throw invalidModel();
        }
        content.unread(header);
        return new UploadFileCommandDTO(command.ownerEmail(), filename, "model/gltf-binary", command.size(),
                FilePurpose.DOCUMENT, content);
    }

    private IllegalArgumentException invalidModel() {
        return new IllegalArgumentException("The file is not a glTF 2.0 binary model");
    }

    private void cleanUpOnCompletion(String previousKey, String newKey) {
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                String unusedKey = switch (status) {
                    case STATUS_COMMITTED -> previousKey;
                    case STATUS_ROLLED_BACK -> newKey;
                    default -> null;
                };
                if (unusedKey != null) {
                    try {
                        storage.delete(unusedKey);
                    } catch (IOException exception) {
                        log.warn("Could not remove unused terrain content: storageKey={}", unusedKey, exception);
                    }
                }
            }
        });
    }
}

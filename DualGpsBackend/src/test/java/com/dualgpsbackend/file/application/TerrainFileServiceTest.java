package com.dualgpsbackend.file.application;

import com.dualgpsbackend.file.domain.FileAsset;
import com.dualgpsbackend.file.domain.FilePurpose;
import com.dualgpsbackend.file.persistence.FileAssetRepository;
import com.dualgpsbackend.file.storage.LocalFileStorage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.io.ByteArrayInputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class TerrainFileServiceTest {
    private static final String OWNER = "architect@example.com";
    private static final String OLD_KEY = "old-model";
    private static final UUID ID = UUID.randomUUID();
    private static final byte[] GLB = ByteBuffer.allocate(24).order(ByteOrder.LITTLE_ENDIAN)
            .putInt(0x46546c67).putInt(2).putInt(24).putInt(4).putInt(0x4e4f534a)
            .put(new byte[] {'{', '}', ' ', ' '}).array();

    @TempDir private Path directory;
    private final FileService generalFiles = mock(FileService.class);
    private final FileAssetRepository repository = mock(FileAssetRepository.class);
    private TerrainFileService terrainFiles;
    private FileAsset asset;

    @BeforeEach
    void setUp() throws Exception {
        terrainFiles = new TerrainFileService(generalFiles, repository, new LocalFileStorage(directory.toString()));
        Files.write(directory.resolve(OLD_KEY), new byte[] {5});
        asset = new FileAsset();
        asset.setId(ID);
        asset.setStorageKey(OLD_KEY);
        asset.setOriginalFilename("old.glb");
        asset.setCreatedAt(Instant.now());
    }

    @Test
    void validatesTheModelAndPassesAllTheBytesToSharedStorage() throws Exception {
        when(generalFiles.uploadTerrain(any())).thenAnswer(invocation -> {
            UploadFileCommandDTO command = invocation.getArgument(0);
            assertThat(command.content().readAllBytes()).isEqualTo(GLB);
            return new UploadedFileDTO(ID, command.originalFilename(), command.contentType(), command.size(),
                    command.purpose(), Instant.now());
        });

        assertThat(terrainFiles.add(command(OWNER, GLB)).originalFilename()).isEqualTo("new.glb");
        assertThatThrownBy(() -> terrainFiles.add(command(OWNER, new byte[24])))
                .isInstanceOf(IllegalArgumentException.class);
        verify(generalFiles).uploadTerrain(any());
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void replacementKeepsTheOriginalUntilCommitAndCleansUpTheUnusedFile(boolean commit) throws Exception {
        when(repository.findByIdAndOwner_EmailAndTerrainTrue(ID, OWNER)).thenReturn(Optional.of(asset));
        TransactionSynchronizationManager.initSynchronization();
        try {
            UploadedFileDTO replacement = terrainFiles.replace(ID, command(OWNER, GLB));
            Path newFile = directory.resolve(asset.getStorageKey());
            assertThat(replacement.id()).isEqualTo(ID);
            assertThat(newFile).hasBinaryContent(GLB);
            assertThat(directory.resolve(OLD_KEY)).exists();

            finish(commit);

            assertThat(commit ? directory.resolve(OLD_KEY) : newFile).doesNotExist();
            assertThat(commit ? newFile : directory.resolve(OLD_KEY)).exists();
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    void deletesOnlyAnOwnedTerrainAndRemovesTheBytesAfterCommit() {
        assertThatThrownBy(() -> terrainFiles.delete(ID, "other@example.com"))
                .isInstanceOf(FileAssetNotFoundException.class);
        assertThat(directory.resolve(OLD_KEY)).exists();
        when(repository.findByIdAndOwner_EmailAndTerrainTrue(ID, OWNER)).thenReturn(Optional.of(asset));
        TransactionSynchronizationManager.initSynchronization();
        try {
            terrainFiles.delete(ID, OWNER);
            verify(repository).delete(asset);
            assertThat(directory.resolve(OLD_KEY)).exists();
            finish(true);
            assertThat(directory.resolve(OLD_KEY)).doesNotExist();
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
        verifyNoInteractions(generalFiles);
    }

    private UploadFileCommandDTO command(String owner, byte[] bytes) {
        return new UploadFileCommandDTO(owner, "new.glb", "model/gltf-binary", bytes.length,
                FilePurpose.DOCUMENT, new ByteArrayInputStream(bytes));
    }

    private void finish(boolean commit) {
        int status = commit ? TransactionSynchronization.STATUS_COMMITTED : TransactionSynchronization.STATUS_ROLLED_BACK;
        TransactionSynchronizationManager.getSynchronizations().forEach(action -> action.afterCompletion(status));
    }
}

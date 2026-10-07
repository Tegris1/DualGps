package com.dualgpsbackend.file.application;

import com.dualgpsbackend.file.domain.FileAsset;
import com.dualgpsbackend.file.domain.FilePurpose;
import com.dualgpsbackend.file.persistence.FileAssetRepository;
import com.dualgpsbackend.file.storage.FileStorage;
import com.dualgpsbackend.model.User;
import com.dualgpsbackend.reositories.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FileServiceTest {

    private static final String OWNER_EMAIL = "owner@example.com";
    private static final byte[] CONTENT = "GPS sample".getBytes(StandardCharsets.UTF_8);
    private static final long MAX_FILE_SIZE = 10L * 1024 * 1024;

    @Mock
    private FileStorage fileStorage;

    @Mock
    private FileAssetRepository fileAssetRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private FileService fileService;

    private User owner;

    @BeforeEach
    void setUp() {
        owner = new User();
        owner.setId(42L);
        owner.setEmail(OWNER_EMAIL);
    }

    @Test
    void uploadsBeforeSavingMetadataAndReturnsPersistedResult() throws IOException {
        UploadFileCommand command = validCommand();
        UUID fileId = stubSuccessfulPersistence();
        Instant beforeUpload = Instant.now();

        UploadedFile result = fileService.upload(command);

        ArgumentCaptor<FileAsset> assetCaptor = ArgumentCaptor.forClass(FileAsset.class);
        verify(fileAssetRepository).saveAndFlush(assetCaptor.capture());
        FileAsset asset = assetCaptor.getValue();
        assertThat(asset.getOwner()).isSameAs(owner);
        assertThat(asset.getOriginalFilename()).isEqualTo(command.originalFilename());
        assertThat(asset.getContentType()).isEqualTo(command.contentType());
        assertThat(asset.getSize()).isEqualTo(CONTENT.length);
        assertThat(asset.getPurpose()).isEqualTo(FilePurpose.GPS_IMPORT);
        assertThat(asset.getCreatedAt()).isBetween(beforeUpload, Instant.now());
        assertThat(asset.getStorageKey()).isEqualTo(UUID.fromString(asset.getStorageKey()).toString());
        assertThat(asset.getStorageKey()).isNotEqualTo(command.originalFilename());

        InOrder operations = inOrder(fileStorage, fileAssetRepository);
        operations.verify(fileStorage).upload(asset.getStorageKey(), command.content());
        operations.verify(fileAssetRepository).saveAndFlush(asset);
        verify(fileStorage, never()).delete(anyString());

        assertThat(result).isEqualTo(new UploadedFile(
                fileId, command.originalFilename(), command.contentType(), CONTENT.length,
                command.purpose(), asset.getCreatedAt()
        ));
    }

    @ParameterizedTest
    @ValueSource(longs = {1, MAX_FILE_SIZE})
    void acceptsFileSizeBoundaries(long size) throws IOException {
        stubSuccessfulPersistence();
        UploadFileCommand command = command(OWNER_EMAIL, "sample.txt", "text/plain", size,
                FilePurpose.DOCUMENT, new ByteArrayInputStream(new byte[(int) size]));

        UploadedFile result = fileService.upload(command);

        assertThat(result.size()).isEqualTo(size);
    }

    @ParameterizedTest(name = "Rejects {0}")
    @MethodSource("invalidCommands")
    void rejectsInvalidInputBeforeAccessingStorageOrDatabase(String description, UploadFileCommand command) {
        assertThatThrownBy(() -> fileService.upload(command))
                .isInstanceOf(IllegalArgumentException.class);

        verifyNoInteractions(userRepository, fileStorage, fileAssetRepository);
    }

    @Test
    void rejectsUnknownOwnerBeforeWritingFile() {
        when(userRepository.findByEmail(OWNER_EMAIL)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> fileService.upload(validCommand()))
                .isInstanceOf(UsernameNotFoundException.class);

        verifyNoInteractions(fileStorage, fileAssetRepository);
    }

    @Test
    void storageFailureDoesNotSaveMetadataOrDeleteAnExistingObject() throws IOException {
        when(userRepository.findByEmail(OWNER_EMAIL)).thenReturn(Optional.of(owner));
        IOException failure = new IOException("Storage unavailable");
        doThrow(failure).when(fileStorage).upload(anyString(), any(InputStream.class));

        assertThatThrownBy(() -> fileService.upload(validCommand())).isSameAs(failure);

        verifyNoInteractions(fileAssetRepository);
        verify(fileStorage, never()).delete(anyString());
    }

    @Test
    void metadataFailureDeletesTheUploadedObjectAndPreservesTheException() throws IOException {
        when(userRepository.findByEmail(OWNER_EMAIL)).thenReturn(Optional.of(owner));
        DataIntegrityViolationException failure = new DataIntegrityViolationException("Metadata rejected");
        when(fileAssetRepository.saveAndFlush(any(FileAsset.class))).thenThrow(failure);
        UploadFileCommand command = validCommand();

        assertThatThrownBy(() -> fileService.upload(command)).isSameAs(failure);

        ArgumentCaptor<String> keyCaptor = ArgumentCaptor.forClass(String.class);
        InOrder operations = inOrder(fileStorage, fileAssetRepository);
        operations.verify(fileStorage).upload(keyCaptor.capture(), any(InputStream.class));
        operations.verify(fileAssetRepository).saveAndFlush(any(FileAsset.class));
        operations.verify(fileStorage).delete(keyCaptor.getValue());
        assertThat(failure.getSuppressed()).isEmpty();
    }

    @Test
    void cleanupFailureIsSuppressedOnTheOriginalPersistenceException() throws IOException {
        when(userRepository.findByEmail(OWNER_EMAIL)).thenReturn(Optional.of(owner));
        DataIntegrityViolationException failure = new DataIntegrityViolationException("Metadata rejected");
        IOException cleanupFailure = new IOException("Deletion failed");
        when(fileAssetRepository.saveAndFlush(any(FileAsset.class))).thenThrow(failure);
        doThrow(cleanupFailure).when(fileStorage).delete(anyString());

        assertThatThrownBy(() -> fileService.upload(validCommand())).isSameAs(failure);

        assertThat(failure.getSuppressed()).containsExactly(cleanupFailure);
    }

    private UUID stubSuccessfulPersistence() {
        UUID fileId = UUID.randomUUID();
        when(userRepository.findByEmail(OWNER_EMAIL)).thenReturn(Optional.of(owner));
        when(fileAssetRepository.saveAndFlush(any(FileAsset.class))).thenAnswer(invocation -> {
            FileAsset asset = invocation.getArgument(0);
            asset.setId(fileId);
            return asset;
        });
        return fileId;
    }

    private static UploadFileCommand validCommand() {
        return command(OWNER_EMAIL, "sample.txt", "text/plain", CONTENT.length,
                FilePurpose.GPS_IMPORT, new ByteArrayInputStream(CONTENT));
    }

    private static UploadFileCommand command(String email, String filename, String contentType,
                                             long size, FilePurpose purpose, InputStream content) {
        return new UploadFileCommand(email, filename, contentType, size, purpose, content);
    }

    private static Stream<Arguments> invalidCommands() {
        return Stream.of(
                Arguments.of("null command", null),
                Arguments.of("null owner", command(null, "file", "text/plain", 1, FilePurpose.DOCUMENT,
                        new ByteArrayInputStream(CONTENT))),
                Arguments.of("blank owner", command(" ", "file", "text/plain", 1, FilePurpose.DOCUMENT,
                        new ByteArrayInputStream(CONTENT))),
                Arguments.of("missing content", command(OWNER_EMAIL, "file", "text/plain", 1,
                        FilePurpose.DOCUMENT, null)),
                Arguments.of("missing purpose", command(OWNER_EMAIL, "file", "text/plain", 1, null,
                        new ByteArrayInputStream(CONTENT))),
                Arguments.of("null filename", command(OWNER_EMAIL, null, "text/plain", 1,
                        FilePurpose.DOCUMENT, new ByteArrayInputStream(CONTENT))),
                Arguments.of("blank filename", command(OWNER_EMAIL, " ", "text/plain", 1,
                        FilePurpose.DOCUMENT, new ByteArrayInputStream(CONTENT))),
                Arguments.of("null content type", command(OWNER_EMAIL, "file", null, 1,
                        FilePurpose.DOCUMENT, new ByteArrayInputStream(CONTENT))),
                Arguments.of("blank content type", command(OWNER_EMAIL, "file", " ", 1,
                        FilePurpose.DOCUMENT, new ByteArrayInputStream(CONTENT))),
                Arguments.of("empty file", command(OWNER_EMAIL, "file", "text/plain", 0,
                        FilePurpose.DOCUMENT, new ByteArrayInputStream(CONTENT))),
                Arguments.of("negative size", command(OWNER_EMAIL, "file", "text/plain", -1,
                        FilePurpose.DOCUMENT, new ByteArrayInputStream(CONTENT))),
                Arguments.of("oversized file", command(OWNER_EMAIL, "file", "text/plain", MAX_FILE_SIZE + 1,
                        FilePurpose.DOCUMENT, new ByteArrayInputStream(CONTENT)))
        );
    }
}

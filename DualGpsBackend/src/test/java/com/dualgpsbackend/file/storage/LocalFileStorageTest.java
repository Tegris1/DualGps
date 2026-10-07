package com.dualgpsbackend.file.storage;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EmptySource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.FileAlreadyExistsException;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.util.UUID;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LocalFileStorageTest {

    private static final byte[] CONTENT = "GPS sample".getBytes(StandardCharsets.UTF_8);

    @TempDir
    private Path directory;

    private Path root;
    private LocalFileStorage storage;

    @BeforeEach
    void setUp() throws IOException {
        root = directory.resolve("uploads");
        storage = new LocalFileStorage(root.toString());
    }

    @Test
    void createsMissingStorageDirectories() throws IOException {
        Path nestedRoot = directory.resolve("nested/uploads");

        new LocalFileStorage(nestedRoot.toString());

        assertThat(nestedRoot).isDirectory();
    }

    @Test
    void uploadedBytesCanBeDownloadedUnchanged() throws IOException {
        String key = UUID.randomUUID().toString();

        try (InputStream content = new ByteArrayInputStream(CONTENT)) {
            storage.upload(key, content);
        }

        assertThat(Files.readAllBytes(root.resolve(key))).isEqualTo(CONTENT);
        try (InputStream downloaded = storage.download(key)) {
            assertThat(downloaded.readAllBytes()).isEqualTo(CONTENT);
        }
    }

    @Test
    void uploadingAnExistingKeyDoesNotOverwriteOrDeleteItsContents() throws IOException {
        String key = UUID.randomUUID().toString();
        try (InputStream content = new ByteArrayInputStream(CONTENT)) {
            storage.upload(key, content);
        }

        try (InputStream replacement = new ByteArrayInputStream(new byte[]{1, 2, 3})) {
            assertThatThrownBy(() -> storage.upload(key, replacement))
                    .isInstanceOf(FileAlreadyExistsException.class);
        }

        assertThat(Files.readAllBytes(root.resolve(key))).isEqualTo(CONTENT);
    }

    @Test
    void failedTransferRemovesThePartialFileAndPreservesTheException() throws IOException {
        String key = UUID.randomUUID().toString();
        IOException failure = new IOException("Input stream failed");
        try (InputStream content = new InputStream() {
            @Override
            public int read() throws IOException {
                throw failure;
            }

            @Override
            public long transferTo(OutputStream output) throws IOException {
                output.write(CONTENT, 0, 2);
                throw failure;
            }
        }) {
            assertThatThrownBy(() -> storage.upload(key, content)).isSameAs(failure);
        }

        assertThat(root.resolve(key)).doesNotExist();
    }

    @Test
    void deletionIsIdempotentAndDeletedFilesCannotBeDownloaded() throws IOException {
        String key = UUID.randomUUID().toString();
        try (InputStream content = new ByteArrayInputStream(CONTENT)) {
            storage.upload(key, content);
        }

        storage.delete(key);

        assertThat(root.resolve(key)).doesNotExist();
        assertThatCode(() -> storage.delete(key)).doesNotThrowAnyException();
        assertThatThrownBy(() -> storage.download(key)).isInstanceOf(NoSuchFileException.class);
    }

    @ParameterizedTest
    @NullSource
    @EmptySource
    @ValueSource(strings = {"..", "../outside", "..\\outside", "nested/file", "nested\\file",
            "/outside", "C:\\outside", "file.txt", "bad key"})
    void invalidKeysAreRejectedForEveryOperationWithoutTouchingOtherFiles(String key) throws IOException {
        Path outside = directory.resolve("outside");
        Files.write(outside, CONTENT);

        try (InputStream content = new ByteArrayInputStream(CONTENT)) {
            assertThatThrownBy(() -> storage.upload(key, content))
                    .isInstanceOf(IllegalArgumentException.class);
        }
        assertThatThrownBy(() -> storage.download(key)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> storage.delete(key)).isInstanceOf(IllegalArgumentException.class);

        assertThat(Files.readAllBytes(outside)).isEqualTo(CONTENT);
        try (Stream<Path> files = Files.list(root)) {
            assertThat(files).isEmpty();
        }
    }
}

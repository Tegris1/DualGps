package com.dualgpsbackend.file.application;

import com.dualgpsbackend.file.domain.FileAsset;
import com.dualgpsbackend.file.persistence.FileAssetRepository;
import com.dualgpsbackend.file.storage.FileStorage;
import com.dualgpsbackend.user.persistence.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FileDownloadServiceTest {

    private static final String OWNER_EMAIL = "owner@example.com";
    private static final byte[] CONTENT = "GPS sample".getBytes(StandardCharsets.UTF_8);

    @Mock
    private FileStorage fileStorage;

    @Mock
    private FileAssetRepository fileAssetRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private FileService fileService;

    @Test
    void authorizedDownloadReturnsMetadataAndOpensStorageOnlyWhenRequested() throws IOException {
        FileAsset asset = asset();
        when(fileAssetRepository.findByIdAndOwner_Email(asset.getId(), OWNER_EMAIL))
                .thenReturn(Optional.of(asset));

        FileDownloadDTO result = fileService.download(asset.getId(), OWNER_EMAIL);

        assertThat(result.originalFilename()).isEqualTo(asset.getOriginalFilename());
        assertThat(result.size()).isEqualTo(CONTENT.length);
        verifyNoInteractions(fileStorage, userRepository);
        when(fileStorage.download(asset.getStorageKey())).thenReturn(new ByteArrayInputStream(CONTENT));

        try (InputStream content = result.content().openStream()) {
            assertThat(content.readAllBytes()).isEqualTo(CONTENT);
        }

        verify(fileAssetRepository).findByIdAndOwner_Email(asset.getId(), OWNER_EMAIL);
        verify(fileStorage).download(asset.getStorageKey());
        verifyNoMoreInteractions(fileStorage, fileAssetRepository);
    }

    @ParameterizedTest
    @ValueSource(strings = {OWNER_EMAIL, "other@example.com"})
    void missingOrInaccessibleFileDoesNotOpenStorage(String authenticatedEmail) {
        UUID fileId = UUID.randomUUID();
        when(fileAssetRepository.findByIdAndOwner_Email(fileId, authenticatedEmail))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> fileService.download(fileId, authenticatedEmail))
                .isInstanceOf(FileAssetNotFoundException.class)
                .hasMessage("File not found");

        verify(fileAssetRepository).findByIdAndOwner_Email(fileId, authenticatedEmail);
        verifyNoInteractions(fileStorage, userRepository);
        verifyNoMoreInteractions(fileAssetRepository);
    }

    @Test
    void storageFailureIsDeferredUntilTheContentStreamIsOpened() throws IOException {
        FileAsset asset = asset();
        when(fileAssetRepository.findByIdAndOwner_Email(asset.getId(), OWNER_EMAIL))
                .thenReturn(Optional.of(asset));

        FileDownloadDTO result = fileService.download(asset.getId(), OWNER_EMAIL);

        verifyNoInteractions(fileStorage);
        IOException failure = new IOException("Stored file missing");
        when(fileStorage.download(asset.getStorageKey())).thenThrow(failure);
        assertThatThrownBy(() -> result.content().openStream()).isSameAs(failure);
        verify(fileStorage).download(asset.getStorageKey());
        verifyNoMoreInteractions(fileStorage);
    }

    private FileAsset asset() {
        FileAsset asset = new FileAsset();
        asset.setId(UUID.randomUUID());
        asset.setStorageKey(UUID.randomUUID().toString());
        asset.setOriginalFilename("sample.txt");
        asset.setSize(CONTENT.length);
        return asset;
    }
}

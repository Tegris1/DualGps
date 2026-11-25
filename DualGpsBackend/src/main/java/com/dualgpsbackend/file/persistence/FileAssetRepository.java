package com.dualgpsbackend.file.persistence;

import com.dualgpsbackend.file.domain.FileAsset;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FileAssetRepository extends JpaRepository<FileAsset, UUID> {

    Optional<FileAsset> findByIdAndOwner_Email(UUID id, String ownerEmail);

    List<FileAsset> findAllByOwner_Email(String ownerEmail);

    List<FileAsset> findAllByOwner_EmailAndTerrainTrueOrderByCreatedAtDesc(String ownerEmail);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<FileAsset> findByIdAndOwner_EmailAndTerrainTrue(UUID id, String ownerEmail);
}

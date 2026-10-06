package com.dualgpsbackend.file.persistence;

import com.dualgpsbackend.file.domain.FileAsset;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FileAssetRepository extends JpaRepository<FileAsset, UUID> {

    Optional<FileAsset> findByIdAndOwner_Email(UUID id, String ownerEmail);

    List<FileAsset> findAllByOwner_Email(String ownerEmail);
}

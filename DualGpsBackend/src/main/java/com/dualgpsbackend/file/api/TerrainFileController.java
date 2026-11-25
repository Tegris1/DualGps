package com.dualgpsbackend.file.api;

import com.dualgpsbackend.file.application.TerrainFileService;
import com.dualgpsbackend.file.application.UploadFileCommandDTO;
import com.dualgpsbackend.file.application.UploadedFileDTO;
import com.dualgpsbackend.file.domain.FilePurpose;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/terrain-files")
@RequiredArgsConstructor
public class TerrainFileController {
    private final TerrainFileService terrainFiles;

    @GetMapping
    public List<UploadedFileDTO> list(Authentication auth) {
        return terrainFiles.list(auth.getName());
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public UploadedFileDTO add(@RequestPart("file") MultipartFile file, Authentication auth) throws IOException {
        try (InputStream content = file.getInputStream()) {
            return terrainFiles.add(command(file, auth, content));
        }
    }

    @PutMapping(path = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public UploadedFileDTO replace(@PathVariable UUID id, @RequestPart("file") MultipartFile file, Authentication auth)
            throws IOException {
        try (InputStream content = file.getInputStream()) {
            return terrainFiles.replace(id, command(file, auth, content));
        }
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id, Authentication auth) {
        terrainFiles.delete(id, auth.getName());
    }

    private UploadFileCommandDTO command(MultipartFile file, Authentication auth, InputStream content) {
        return new UploadFileCommandDTO(auth.getName(), file.getOriginalFilename(), "model/gltf-binary",
                file.getSize(), FilePurpose.DOCUMENT, content);
    }
}

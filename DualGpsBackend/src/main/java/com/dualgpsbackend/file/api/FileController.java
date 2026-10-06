package com.dualgpsbackend.file.api;

import com.dualgpsbackend.file.application.FileService;
import com.dualgpsbackend.file.application.UploadFileCommand;
import com.dualgpsbackend.file.domain.FilePurpose;
import jakarta.validation.Valid;
import lombok.AllArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import javax.print.attribute.standard.Media;
import java.io.IOException;
import java.net.URI;
import java.util.UUID;

@RestController
@AllArgsConstructor
@RequestMapping("/api")
public class FileController {
    private final FileService fileService;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> upload(
            @RequestPart("file") MultipartFile file,
            @RequestParam FilePurpose purpose,
            Authentication auth
            )throws IOException {

        UploadFileCommand command = new UploadFileCommand(
                auth.getName(),
                file.getOriginalFilename(),
                file.getContentType(),
                file.getSize(),
                purpose,
                file.getInputStream()
        );

        FileResponse response = fileService.upload(command);

        URI location = ServletUriComponentsBuilder
                .fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(response.id)
                .toUri();

        return ResponseEntity.created(location).body(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getMetadata(@Valid @PathVariable UUID id, Authentication auth){
        URI downloadUrl = fileService.create();
    }
}

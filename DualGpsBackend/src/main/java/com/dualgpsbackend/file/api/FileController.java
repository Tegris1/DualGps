package com.dualgpsbackend.file.api;

import com.dualgpsbackend.file.application.FileDownload;
import com.dualgpsbackend.file.application.FileService;
import com.dualgpsbackend.file.application.UploadFileCommand;
import com.dualgpsbackend.file.application.UploadedFile;
import com.dualgpsbackend.file.domain.FilePurpose;
import jakarta.validation.Valid;
import lombok.AllArgsConstructor;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import javax.print.DocFlavor;
import javax.print.attribute.standard.Media;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

@RestController
@AllArgsConstructor
@RequestMapping("/api/files")
public class FileController {
    private final FileService fileService;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<UploadedFile> upload(
            @RequestPart("file") MultipartFile file,
            @RequestParam FilePurpose purpose,
            Authentication auth
            )throws IOException {

        try(InputStream content = file.getInputStream()) {
            UploadFileCommand command = new UploadFileCommand(
                    auth.getName(),
                    file.getOriginalFilename(),
                    file.getContentType(),
                    file.getSize(),
                    purpose,
                    content
            );

            UploadedFile response = fileService.upload(command);

            URI location = ServletUriComponentsBuilder
                    .fromCurrentRequest()
                    .path("/{id}")
                    .buildAndExpand(response.id())
                    .toUri();

            return ResponseEntity.created(location).body(response);
        }
    }

    @GetMapping("/{id}/download")
    public ResponseEntity<Resource> download(
            @PathVariable UUID id,
            Authentication authentication){
        String email = authentication.getName();
        FileDownload file = fileService.download(id,email);

        String filename = file.originalFilename()
                .replace('\\', '/')
                .replace("\r", "")
                .replace("\n", "");

        filename = filename.substring(filename.lastIndexOf('/') + 1);

        if (filename.isBlank()) {
            filename = id + ".bin";
        }

        ContentDisposition disposition = ContentDisposition.attachment()
                .filename(filename, StandardCharsets.UTF_8).build();

        return ResponseEntity.ok().contentType(MediaType.APPLICATION_OCTET_STREAM)
                .contentLength(file.size())
                .cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .body(new InputStreamResource(file.content()::openStream));
    }



    /*@GetMapping("/{id}")
    public ResponseEntity<?> getMetadata(@Valid @PathVariable UUID id, Authentication auth){
        URI downloadUrl = fileService.upload();
    }*/
}

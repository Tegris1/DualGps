package com.dualgpsbackend.file.application;

import com.dualgpsbackend.file.api.FileResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

@Service
public class FileService {
    public FileResponse upload(UploadFileCommand command){
        return new FileResponse(1);
    }
}

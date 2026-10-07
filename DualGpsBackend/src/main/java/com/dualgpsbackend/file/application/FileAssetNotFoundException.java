package com.dualgpsbackend.file.application;

public class FileAssetNotFoundException extends RuntimeException {
    public FileAssetNotFoundException( ) {
        super("File not found");
    }
}

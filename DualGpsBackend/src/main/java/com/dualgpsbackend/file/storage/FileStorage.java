package com.dualgpsbackend.file.storage;

import java.io.IOException;
import java.io.InputStream;

public interface FileStorage {

    void upload(String storageKey, InputStream content) throws IOException;

    InputStream download (String storageKey) throws IOException;

    void delete(String storageKey) throws IOException;
}

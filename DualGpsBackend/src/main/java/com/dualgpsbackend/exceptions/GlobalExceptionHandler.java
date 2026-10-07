package com.dualgpsbackend.exceptions;

import com.dualgpsbackend.file.application.FileAssetNotFoundException;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String ,String>> handleExceptions(MethodArgumentNotValidException ex){
        log.debug("Request validation failed: invalidFieldCount={}", ex.getBindingResult().getFieldErrorCount());
        Map<String ,String> e = new HashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(
                (error)->{e.put(error.getField(),error.getDefaultMessage());}
        );

        return new ResponseEntity<>(e,HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(UserAlreadyExistsException.class)
    public ResponseEntity<Map<String ,String>> handleExceptions(UserAlreadyExistsException ex){
        log.debug("Registration rejected: user already exists");
        Map<String ,String> e = new HashMap<>();
        e.put("error", ex.getMessage());
        return new ResponseEntity<>(e,HttpStatus.CONFLICT);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleExceptions(IllegalArgumentException ex) {
        log.debug("Request rejected: invalid argument");
        Map<String, String> e = new HashMap<>();
        e.put("message", ex.getMessage());
        return new ResponseEntity<>(e, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler({IOException.class, DataAccessException.class})
    public ResponseEntity<Map<String, String>> handleInfrastructureFailure(
            Exception exception,
            HttpServletRequest request
    ) {
        log.error("Request failed: method={}, path={}",
                request.getMethod(), request.getRequestURI(), exception);

        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("message", "An internal error occurred"));
    }

    @ExceptionHandler(FileAssetNotFoundException.class)
    public ResponseEntity<Map<String, String>> handleFileNotFound(
            FileAssetNotFoundException exception
    ) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("message", "File not found"));
    }
}

package com.dualgpsbackend.exceptions;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String ,String>> handleExceptions(MethodArgumentNotValidException ex){
        Map<String ,String> e = new HashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(
                (error)->{e.put(error.getField(),error.getDefaultMessage());}
        );

        return new ResponseEntity<>(e,HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(UserAlreadyExistsException.class)
    public ResponseEntity<Map<String ,String>> handleExceptions(UserAlreadyExistsException ex){
        Map<String ,String> e = new HashMap<>();
        e.put("error", ex.getMessage());
        return new ResponseEntity<>(e,HttpStatus.CONFLICT);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleExceptions(IllegalArgumentException ex) {
        Map<String, String> e = new HashMap<>();
        e.put("message", ex.getMessage());
        return new ResponseEntity<>(e, HttpStatus.BAD_REQUEST);
    }
}

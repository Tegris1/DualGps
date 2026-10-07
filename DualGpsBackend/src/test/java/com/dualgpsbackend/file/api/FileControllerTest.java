package com.dualgpsbackend.file.api;

import com.dualgpsbackend.config.WebSecurityConfig;
import com.dualgpsbackend.file.application.FileService;
import com.dualgpsbackend.file.application.UploadFileCommand;
import com.dualgpsbackend.file.application.UploadedFile;
import com.dualgpsbackend.file.domain.FilePurpose;
import com.dualgpsbackend.model.Role;
import com.dualgpsbackend.security.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.UUID;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(FileController.class)
@Import({WebSecurityConfig.class, JwtUtil.class})
class FileControllerTest {

    private static final String OWNER_EMAIL = "owner@example.com";
    private static final byte[] CONTENT = "GPS sample".getBytes(StandardCharsets.UTF_8);

    @Autowired
    private WebApplicationContext applicationContext;

    private MockMvc mvc;

    @Autowired
    private JwtUtil jwtUtil;

    @MockitoBean
    private FileService fileService;

    @MockitoBean
    private UserDetailsService userDetailsService;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(applicationContext)
                .apply(springSecurity())
                .build();
    }

    @ParameterizedTest
    @EnumSource(FilePurpose.class)
    void uploadUsesTheAuthenticatedOwnerAndReturnsCreatedMetadata(FilePurpose purpose) throws Exception {
        UUID fileId = UUID.randomUUID();
        Instant createdAt = Instant.parse("2026-10-07T12:00:00Z");
        when(fileService.upload(any(UploadFileCommand.class))).thenAnswer(invocation -> {
            UploadFileCommand command = invocation.getArgument(0);
            assertThat(command.content().readAllBytes()).isEqualTo(CONTENT);
            return new UploadedFile(fileId, "sample.txt", "text/plain", CONTENT.length, purpose, createdAt);
        });

        mvc.perform(authenticatedUpload(file())
                        .param("purpose", purpose.name())
                        .param("ownerEmail", "someone-else@example.com"))
                .andExpect(status().isCreated())
                .andExpect(header().string(HttpHeaders.LOCATION, "http://localhost/api/files/" + fileId))
                .andExpect(jsonPath("$.id").value(fileId.toString()))
                .andExpect(jsonPath("$.originalFilename").value("sample.txt"))
                .andExpect(jsonPath("$.contentType").value("text/plain"))
                .andExpect(jsonPath("$.size").value(CONTENT.length))
                .andExpect(jsonPath("$.purpose").value(purpose.name()))
                .andExpect(jsonPath("$.createdAt").exists())
                .andExpect(jsonPath("$.storageKey").doesNotExist())
                .andExpect(jsonPath("$.owner").doesNotExist());

        ArgumentCaptor<UploadFileCommand> commandCaptor = ArgumentCaptor.forClass(UploadFileCommand.class);
        verify(fileService).upload(commandCaptor.capture());
        UploadFileCommand command = commandCaptor.getValue();
        assertThat(command.ownerEmail()).isEqualTo(OWNER_EMAIL);
        assertThat(command.originalFilename()).isEqualTo("sample.txt");
        assertThat(command.contentType()).isEqualTo("text/plain");
        assertThat(command.size()).isEqualTo(CONTENT.length);
        assertThat(command.purpose()).isEqualTo(purpose);
    }

    @Test
    void rejectsRequestsWithoutAuthentication() throws Exception {
        mvc.perform(multipart("/api/files").file(file()).param("purpose", "DOCUMENT"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(fileService);
    }

    @Test
    void rejectsInvalidBearerTokens() throws Exception {
        mvc.perform(multipart("/api/files").file(file()).param("purpose", "DOCUMENT")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer invalid-token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(fileService);
    }

    @Test
    void rejectsMissingFilePart() throws Exception {
        mvc.perform(authenticatedRequest().param("purpose", "DOCUMENT"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(fileService);
    }

    @Test
    void rejectsMissingPurpose() throws Exception {
        mvc.perform(authenticatedUpload(file()))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(fileService);
    }

    @Test
    void rejectsUnknownPurpose() throws Exception {
        mvc.perform(authenticatedUpload(file()).param("purpose", "INVALID"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(fileService);
    }

    @Test
    void validationFailureReturnsBadRequestAndClosesTheInputStream() throws Exception {
        InputStream input = mock(InputStream.class);
        when(fileService.upload(any(UploadFileCommand.class)))
                .thenThrow(new IllegalArgumentException("File must be nonempty"));

        mvc.perform(authenticatedUpload(fileWithInputStream(input)).param("purpose", "DOCUMENT"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("File must be nonempty"));

        verify(input).close();
    }

    @Test
    void successfulUploadClosesTheInputStream() throws Exception {
        InputStream input = mock(InputStream.class);
        when(fileService.upload(any(UploadFileCommand.class))).thenReturn(new UploadedFile(
                UUID.randomUUID(), "sample.txt", "text/plain", CONTENT.length, FilePurpose.DOCUMENT, Instant.now()
        ));

        mvc.perform(authenticatedUpload(fileWithInputStream(input)).param("purpose", "DOCUMENT"))
                .andExpect(status().isCreated());

        verify(input).close();
    }

    @ParameterizedTest
    @MethodSource("infrastructureFailures")
    void infrastructureFailureReturnsGenericErrorAndClosesTheInputStream(Exception failure) throws Exception {
        InputStream input = mock(InputStream.class);
        when(fileService.upload(any(UploadFileCommand.class))).thenThrow(failure);

        mvc.perform(authenticatedUpload(fileWithInputStream(input)).param("purpose", "DOCUMENT"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.message").value("An internal error occurred"))
                .andExpect(content().string(not(containsString("Sensitive"))));

        verify(input).close();
    }

    private MockMultipartHttpServletRequestBuilder authenticatedRequest() {
        when(userDetailsService.loadUserByUsername(OWNER_EMAIL)).thenReturn(
                User.withUsername(OWNER_EMAIL).password("unused").roles("ADMIN").build()
        );
        String token = jwtUtil.generateToken(OWNER_EMAIL, Role.ADMIN);
        MockMultipartHttpServletRequestBuilder request = multipart("/api/files");
        request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
        return request;
    }

    private MockMultipartHttpServletRequestBuilder authenticatedUpload(MockMultipartFile file) {
        return authenticatedRequest().file(file);
    }

    private MockMultipartFile file() {
        return new MockMultipartFile("file", "sample.txt", "text/plain", CONTENT);
    }

    private MockMultipartFile fileWithInputStream(InputStream input) {
        return new MockMultipartFile("file", "sample.txt", "text/plain", CONTENT) {
            @Override
            public InputStream getInputStream() {
                return input;
            }
        };
    }

    private static Stream<Arguments> infrastructureFailures() {
        return Stream.of(
                Arguments.of(new IOException("Sensitive storage details")),
                Arguments.of(new DataIntegrityViolationException("Sensitive database details"))
        );
    }
}

package com.dualgpsbackend.file.api;

import com.dualgpsbackend.security.config.WebSecurityConfig;
import com.dualgpsbackend.file.application.FileAssetNotFoundException;
import com.dualgpsbackend.file.application.FileDownloadDTO;
import com.dualgpsbackend.file.application.FileService;
import com.dualgpsbackend.user.domain.Role;
import com.dualgpsbackend.security.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(FileController.class)
@Import({WebSecurityConfig.class, JwtUtil.class})
class FileDownloadControllerTest {

    private static final String OWNER_EMAIL = "owner@example.com";
    private static final UUID FILE_ID = UUID.fromString("a310f9ce-bb5b-4f39-b8a9-a3186051d240");
    private static final byte[] CONTENT = "GPS sample".getBytes(StandardCharsets.UTF_8);

    @Autowired
    private WebApplicationContext applicationContext;

    @Autowired
    private JwtUtil jwtUtil;

    @MockitoBean
    private FileService fileService;

    @MockitoBean
    private UserDetailsService userDetailsService;

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(applicationContext)
                .apply(springSecurity())
                .build();
    }

    @Test
    void downloadReturnsBytesAndHeadersAndClosesTheStream() throws Exception {
        InputStream input = spy(new ByteArrayInputStream(CONTENT));
        FileDownloadDTO.ContentSource source = mock(FileDownloadDTO.ContentSource.class);
        when(source.openStream()).thenReturn(input);
        when(fileService.download(FILE_ID, OWNER_EMAIL))
                .thenReturn(new FileDownloadDTO("sample.txt", CONTENT.length, source));

        mvc.perform(authenticatedRequest(FILE_ID.toString()).param("ownerEmail", "someone-else@example.com"))
                .andExpect(status().isOk())
                .andExpect(content().bytes(CONTENT))
                .andExpect(content().contentType(MediaType.APPLICATION_OCTET_STREAM))
                .andExpect(header().string(HttpHeaders.CONTENT_LENGTH, String.valueOf(CONTENT.length)))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(result -> {
                    ContentDisposition disposition = ContentDisposition.parse(
                            result.getResponse().getHeader(HttpHeaders.CONTENT_DISPOSITION));
                    assertThat(disposition.getType()).isEqualTo("attachment");
                    assertThat(disposition.getFilename()).isEqualTo("sample.txt");
                });

        verify(fileService).download(FILE_ID, OWNER_EMAIL);
        verify(source).openStream();
        verify(input).close();
    }

    @ParameterizedTest
    @CsvSource({"/private/sample.txt,sample.txt", "C:\\private\\sample.txt,sample.txt",
            "zażółć.txt,zażółć.txt", "'',a310f9ce-bb5b-4f39-b8a9-a3186051d240.bin",
            "folder/,a310f9ce-bb5b-4f39-b8a9-a3186051d240.bin"})
    void downloadUsesASafeFilename(String originalFilename, String expectedFilename) throws Exception {
        when(fileService.download(FILE_ID, OWNER_EMAIL)).thenReturn(new FileDownloadDTO(
                originalFilename, CONTENT.length, () -> new ByteArrayInputStream(CONTENT)));

        mvc.perform(authenticatedRequest(FILE_ID.toString()))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(ContentDisposition.parse(
                        result.getResponse().getHeader(HttpHeaders.CONTENT_DISPOSITION)).getFilename())
                        .isEqualTo(expectedFilename));
    }

    @Test
    void stripsNewlinesFromTheDownloadFilename() throws Exception {
        when(fileService.download(FILE_ID, OWNER_EMAIL)).thenReturn(new FileDownloadDTO(
                "sample\r\n.txt", CONTENT.length, () -> new ByteArrayInputStream(CONTENT)));

        mvc.perform(authenticatedRequest(FILE_ID.toString()))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(ContentDisposition.parse(
                        result.getResponse().getHeader(HttpHeaders.CONTENT_DISPOSITION)).getFilename())
                        .isEqualTo("sample.txt"));
    }

    @Test
    void rejectsDownloadWithoutAuthentication() throws Exception {
        mvc.perform(get("/api/files/{id}/download", FILE_ID))
                .andExpect(status().isForbidden());

        verifyNoInteractions(fileService);
    }

    @Test
    void rejectsDownloadWithAnInvalidToken() throws Exception {
        mvc.perform(get("/api/files/{id}/download", FILE_ID)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer invalid-token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(fileService);
    }

    @Test
    void rejectsMalformedFileIdsBeforeCallingTheService() throws Exception {
        mvc.perform(authenticatedRequest("not-a-uuid"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(fileService);
    }

    @Test
    void missingOrInaccessibleFileReturnsTheGenericNotFoundResponse() throws Exception {
        when(fileService.download(FILE_ID, OWNER_EMAIL)).thenThrow(new FileAssetNotFoundException());

        mvc.perform(authenticatedRequest(FILE_ID.toString()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("File not found"));

        verify(fileService).download(FILE_ID, OWNER_EMAIL);
    }

    @Test
    void failureToOpenStorageReturnsAGenericServerError() throws Exception {
        FileDownloadDTO.ContentSource source = mock(FileDownloadDTO.ContentSource.class);
        when(source.openStream()).thenThrow(new IOException("Sensitive storage path"));
        when(fileService.download(FILE_ID, OWNER_EMAIL))
                .thenReturn(new FileDownloadDTO("sample.txt", CONTENT.length, source));

        mvc.perform(authenticatedRequest(FILE_ID.toString()))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.message").value("An internal error occurred"))
                .andExpect(content().string(not(containsString("Sensitive"))));

        verify(source).openStream();
    }

    private MockHttpServletRequestBuilder authenticatedRequest(String fileId) {
        when(userDetailsService.loadUserByUsername(OWNER_EMAIL)).thenReturn(
                User.withUsername(OWNER_EMAIL).password("unused").roles("ADMIN").build());
        String token = jwtUtil.generateToken(OWNER_EMAIL, Role.ADMIN);
        return get("/api/files/{id}/download", fileId)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
    }
}

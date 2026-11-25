package com.dualgpsbackend.file.api;

import com.dualgpsbackend.file.application.FileService;
import com.dualgpsbackend.file.application.TerrainFileService;
import com.dualgpsbackend.file.application.UploadFileCommandDTO;
import com.dualgpsbackend.file.application.UploadedFileDTO;
import com.dualgpsbackend.file.domain.FilePurpose;
import com.dualgpsbackend.security.JwtUtil;
import com.dualgpsbackend.security.config.WebSecurityConfig;
import com.dualgpsbackend.user.domain.Role;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest({TerrainFileController.class, FileController.class})
@Import({WebSecurityConfig.class, JwtUtil.class})
class TerrainFileControllerTest {
    private static final String PATH = "/api/terrain-files";
    private static final String EMAIL = "architect@example.com";
    private static final UUID ID = UUID.randomUUID();
    private static final MockMultipartFile MODEL =
            new MockMultipartFile("file", "site.glb", "model/gltf-binary", new byte[] {1, 2, 3});

    @Autowired private WebApplicationContext context;
    @Autowired private JwtUtil jwt;
    @MockitoBean private UserDetailsService users;
    @MockitoBean private TerrainFileService terrainFiles;
    @MockitoBean private FileService files;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    @Test
    void architectCanListAddReplaceAndDeleteTheirFiles() throws Exception {
        String auth = bearer(Role.ARCHITECT);
        UploadedFileDTO result = new UploadedFileDTO(ID, "site.glb", "model/gltf-binary", 3,
                FilePurpose.DOCUMENT, Instant.now());
        when(terrainFiles.list(EMAIL)).thenReturn(List.of(result));
        when(terrainFiles.add(any())).thenAnswer(invocation -> {
            UploadFileCommandDTO command = invocation.getArgument(0);
            assertThat(command.ownerEmail()).isEqualTo(EMAIL);
            assertThat(command.content().readAllBytes()).isEqualTo(MODEL.getBytes());
            return result;
        });
        when(terrainFiles.replace(eq(ID), any())).thenAnswer(invocation -> {
            UploadFileCommandDTO command = invocation.getArgument(1);
            assertThat(command.ownerEmail()).isEqualTo(EMAIL);
            return result;
        });

        mvc.perform(get(PATH).header(HttpHeaders.AUTHORIZATION, auth))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(ID.toString()));
        mvc.perform(multipart(PATH).file(MODEL).param("ownerEmail", "other@example.com")
                        .header(HttpHeaders.AUTHORIZATION, auth))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.originalFilename").value("site.glb"));
        mvc.perform(multipart(HttpMethod.PUT, PATH + "/{id}", ID).file(MODEL)
                        .header(HttpHeaders.AUTHORIZATION, auth))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(ID.toString()));
        mvc.perform(delete(PATH + "/{id}", ID).header(HttpHeaders.AUTHORIZATION, auth))
                .andExpect(status().isNoContent());
        verify(terrainFiles).delete(ID, EMAIL);
    }

    @ParameterizedTest
    @EnumSource(value = Role.class, names = {"OPERATOR", "ADMIN"})
    void otherRolesCannotAccessTerrainManagement(Role role) throws Exception {
        String auth = bearer(role);
        mvc.perform(get(PATH).header(HttpHeaders.AUTHORIZATION, auth)).andExpect(status().isForbidden());
        mvc.perform(multipart(PATH).file(MODEL).header(HttpHeaders.AUTHORIZATION, auth))
                .andExpect(status().isForbidden());
        mvc.perform(multipart(HttpMethod.PUT, PATH + "/{id}", ID).file(MODEL)
                        .header(HttpHeaders.AUTHORIZATION, auth)).andExpect(status().isForbidden());
        mvc.perform(delete(PATH + "/{id}", ID).header(HttpHeaders.AUTHORIZATION, auth))
                .andExpect(status().isForbidden());
        verifyNoInteractions(terrainFiles);
    }

    @Test
    void rejectsAnonymousTerrainAccessAndArchitectAccessToTheGeneralFilesApi() throws Exception {
        mvc.perform(get(PATH)).andExpect(status().isForbidden());
        mvc.perform(get("/api/files/{id}/download", ID).header(HttpHeaders.AUTHORIZATION, bearer(Role.ARCHITECT)))
                .andExpect(status().isForbidden());
        verifyNoInteractions(terrainFiles, files);
    }

    private String bearer(Role role) {
        when(users.loadUserByUsername(EMAIL)).thenReturn(
                User.withUsername(EMAIL).password("unused").roles(role.name()).build());
        return "Bearer " + jwt.generateToken(EMAIL, role);
    }
}

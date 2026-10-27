package com.dualgpsbackend.user.application;

import com.dualgpsbackend.security.JwtUtil;
import com.dualgpsbackend.user.domain.Role;
import com.dualgpsbackend.user.domain.User;
import com.dualgpsbackend.user.persistence.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    private static final Long USER_ID = 42L;
    private static final String EMAIL = "operator@example.com";

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder encoder;

    @Mock
    private JwtUtil jwtUtil;

    @Mock
    private UserMapper userMapper;

    @InjectMocks
    private UserService userService;

    private User user;
    private UserDTO details;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setId(USER_ID);
        user.setUsername("operator");
        user.setEmail(EMAIL);
        user.setPassword("encoded-password");
        user.setRole(Role.OPERATOR);

        details = new UserDTO();
        details.setUsername("updated-name");
        details.setEmail("updated@example.com");
        details.setPassword("updated-password");
    }

    @Test
    void promotesUserToArchitectAndReturnsThePersistedUser() {
        User persisted = new User();
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));
        when(userRepository.save(user)).thenReturn(persisted);

        User result = userService.makeArchitect(USER_ID);

        assertThat(user.getRole()).isEqualTo(Role.ARCHITECT);
        assertThat(result).isSameAs(persisted);
        verify(userRepository).save(user);
        verifyNoInteractions(userMapper, encoder, jwtUtil);
    }

    @ParameterizedTest
    @EnumSource(Role.class)
    void updatesAnyRoleWithoutChangingIdentityOrCredentials(Role role) {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));
        when(userRepository.save(user)).thenReturn(user);

        User result = userService.updateUserRole(USER_ID, role);

        assertThat(result).isSameAs(user);
        assertThat(user.getRole()).isEqualTo(role);
        assertThat(user.getId()).isEqualTo(USER_ID);
        assertThat(user.getUsername()).isEqualTo("operator");
        assertThat(user.getEmail()).isEqualTo(EMAIL);
        assertThat(user.getPassword()).isEqualTo("encoded-password");
        verify(userRepository).save(user);
        verifyNoInteractions(userMapper, encoder, jwtUtil);
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void rejectsRoleChangesForAnUnknownUser(boolean architectShortcut) {
        when(userRepository.findById(USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> {
            if (architectShortcut) userService.makeArchitect(USER_ID);
            else userService.updateUserRole(USER_ID, Role.ADMIN);
        }).isInstanceOf(UsernameNotFoundException.class);

        verify(userRepository, never()).save(any(User.class));
        verifyNoInteractions(userMapper, encoder, jwtUtil);
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void updatesDetailsForTheResolvedUserAndReturnsThePersistedResult(boolean lookupByEmail) {
        stubUserLookup(lookupByEmail, Optional.of(user));
        User mapped = new User();
        User persisted = new User();
        when(userMapper.updateUser(details, user)).thenReturn(mapped);
        when(userRepository.save(mapped)).thenReturn(persisted);

        User result = updateDetails(lookupByEmail);

        assertThat(result).isSameAs(persisted);
        verify(userMapper).updateUser(details, user);
        verify(userRepository).save(mapped);
        verify(userRepository, never()).save(user);
        verifyNoInteractions(encoder, jwtUtil);
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void rejectsDetailsUpdatesForAnUnknownUserBeforeMappingOrSaving(boolean lookupByEmail) {
        stubUserLookup(lookupByEmail, Optional.empty());

        assertThatThrownBy(() -> updateDetails(lookupByEmail))
                .isInstanceOf(UsernameNotFoundException.class);

        verify(userRepository, never()).save(any(User.class));
        verifyNoInteractions(userMapper, encoder, jwtUtil);
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void preservesMappingFailuresWithoutSaving(boolean lookupByEmail) {
        stubUserLookup(lookupByEmail, Optional.of(user));
        IllegalArgumentException failure = new IllegalArgumentException("Mapping failed");
        when(userMapper.updateUser(details, user)).thenThrow(failure);

        assertThatThrownBy(() -> updateDetails(lookupByEmail)).isSameAs(failure);

        verify(userRepository, never()).save(any(User.class));
    }

    private void stubUserLookup(boolean lookupByEmail, Optional<User> result) {
        if (lookupByEmail) when(userRepository.findByEmail(EMAIL)).thenReturn(result);
        else when(userRepository.findById(USER_ID)).thenReturn(result);
    }

    private User updateDetails(boolean lookupByEmail) {
        return lookupByEmail
                ? userService.updateUserDetails(details, EMAIL)
                : userService.updateUserDetails(details, USER_ID);
    }
}

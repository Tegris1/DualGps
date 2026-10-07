package com.dualgpsbackend.user.application;

import com.dualgpsbackend.user.domain.Role;
import com.dualgpsbackend.user.domain.User;
import com.dualgpsbackend.user.persistence.UserRepository;
import com.dualgpsbackend.security.JwtUtil;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jspecify.annotations.NullMarked;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;


import java.util.Collections;
import java.util.List;

@Slf4j
@NullMarked
@Service
@AllArgsConstructor
public class UserService implements UserDetailsService {
    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() ->  new UsernameNotFoundException("Nie znaleziono Uzytkownika " +  email));
        return new org.springframework.security.core.userdetails.User(
                user.getEmail(),
                user.getPassword(),
                Collections.singletonList(new SimpleGrantedAuthority("ROLE_" + getUserRole(user).name()))
        );
    }

    private final UserRepository userRepository;
    private final PasswordEncoder encoder;
    private final JwtUtil jwtUtil;
    private final UserMapper userMapper;

    public User register(UserDTO dto) {
        if(userRepository.findByEmail(dto.getEmail()).isPresent()){
            throw new UserAlreadyExistsException("Email already registered");
        }
        User user = new User();
        user.setUsername(dto.getUsername());
        user.setEmail(dto.getEmail());
        user.setPassword(encoder.encode(dto.getPassword()));
        user.setRole(Role.OPERATOR);


        User saved = userRepository.save(user);
        log.info("User registered: userId={}", saved.getId());
        return saved;
    }

    public String login(LoginDTO dto) {
        User user = userRepository.findByEmail(dto.getEmail())
                .orElseThrow(() -> new UsernameNotFoundException("Nie znaleziono użytkownika"));

        if (!encoder.matches(dto.getPassword(), user.getPassword())) {
            throw new BadCredentialsException("Nieprawidłowe dane logowania");
        }

        String token = jwtUtil.generateToken(user.getEmail(), getUserRole(user));
        log.info("User login completed: userId={}", user.getId());
        return token;
    }

    public User makeArchitect(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new UsernameNotFoundException("Nie znaleziono uĹĽytkownika"));
        Role previousRole = getUserRole(user);
        user.setRole(Role.ARCHITECT);
        User saved = userRepository.save(user);
        log.info("User role updated: userId={}, previousRole={}, role={}",
                saved.getId(), previousRole, saved.getRole());
        return saved;
    }

    public List<User> findAll() {
        return userRepository.findAll();
    }

    public List<User> findByRole(Role role) {
        return userRepository.findAllByRoleOrderByUsername(role);
    }

    public User updateUserRole(Long id, Role role) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new UsernameNotFoundException("Nie znaleziono uĹĽytkownika"));
        Role previousRole = getUserRole(user);
        user.setRole(role);
        User saved = userRepository.save(user);
        log.info("User role updated: userId={}, previousRole={}, role={}",
                saved.getId(), previousRole, saved.getRole());
        return saved;
    }

    public User updateUserDetails(UserDTO dto, String email) {
        User oldUser = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("Nie znaleziono użytkownika"));
        User newUser = userMapper.updateUser(dto, oldUser);
        User saved = userRepository.save(newUser);
        log.debug("User details updated: userId={}", saved.getId());
        return saved;
    }

    public User updateUserDetails(UserDTO dto, Long id) {
        User oldUser = userRepository.findById(id)
                .orElseThrow(() -> new UsernameNotFoundException("Nie znaleziono użytkownika"));
        User newUser = userMapper.updateUser(dto, oldUser);
        User saved = userRepository.save(newUser);
        log.debug("User details updated: userId={}", saved.getId());
        return saved;
    }

    private Role getUserRole(User user) {
        return user.getRole() == null ? Role.OPERATOR : user.getRole();
    }
}

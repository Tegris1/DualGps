package com.dualgpsbackend.user.persistence;

import com.dualgpsbackend.user.domain.Role;
import com.dualgpsbackend.user.domain.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;


@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    List<User> findAllByRoleOrderByUsername(Role role);
}

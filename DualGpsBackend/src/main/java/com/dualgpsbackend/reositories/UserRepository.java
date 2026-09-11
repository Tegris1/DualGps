package com.dualgpsbackend.reositories;

import com.dualgpsbackend.model.Role;
import com.dualgpsbackend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;


@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    List<User> findAllByRoleOrderByUsername(Role role);
}

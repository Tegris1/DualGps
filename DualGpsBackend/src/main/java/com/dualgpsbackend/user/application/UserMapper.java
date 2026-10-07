package com.dualgpsbackend.user.application;

import com.dualgpsbackend.user.domain.User;
import org.mapstruct.Mapper;
import org.mapstruct.MappingTarget;

@Mapper(componentModel = "spring")
public interface UserMapper {
    User toEntity(UserDTO dto);
    UserDTO toDto(User user);
    User updateUser(UserDTO dto, @MappingTarget User user);
}

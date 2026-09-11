package com.dualgpsbackend.mappers;

import com.dualgpsbackend.dtos.UserDto;
import com.dualgpsbackend.model.User;
import org.mapstruct.Mapper;
import org.mapstruct.MappingTarget;

@Mapper(componentModel = "spring")
public interface UserMapper {
    User toEntity(UserDto dto);
    UserDto toDto(User user);
    User updateUser(UserDto dto, @MappingTarget User user);
}

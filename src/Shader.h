#pragma once

#include "Includes.h"

#include <map>
#include <string>


class Shader {
public:
    GLuint id;
    const char* name;

    Shader(GLuint shaderType, const char* path);
    ~Shader();
};

class Program {
public:
    GLint id;
    const char* vertname;
    const char* fragname;

    std::map<std::string, GLuint>  uniforms;

    Program(const char* fragpath, const char* vertpath);
    ~Program();

    void bind();
    void reload();

    GLuint getUniformLocation(std::string name);

    void setUniform(std::string name, float f);
    void setUniform(std::string name, glm::vec2 vec);
    void setUniform(std::string name, glm::vec3 vec);

    void setUniform(std::string name, glm::mat4x4 mat);
    void setUniform(std::string name, glm::mat3x3 mat);

    void setUniform(std::string name, int i);
};
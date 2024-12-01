#include "Shader.h"
#include <iostream>

Shader::Shader(GLuint shaderType, const char* path) {
    name = path;
    id = 0;
    char* content = nullptr;

    FILE* file;
    fopen_s(&file, path, "rt");

    if (file) {
        fseek(file, 0, SEEK_END);
        size_t count = ftell(file);
        rewind(file);

        if (count > 0) {
            content = static_cast<char*>(malloc(sizeof(char) * (count + 1)));
            if (content) {
                count = fread(content, sizeof(char), count, file);
                content[count] = '\0';
            }
        }

        fclose(file);
    }
    else {
        std::cerr << "Error : " << path << " not found\n";
        return;
    }

    id = glCreateShader(shaderType);
    glShaderSource(id, 1, &content, nullptr);
    glCompileShader(id);

    free(content);

    GLint success;
    char* infoLog = (char*)malloc(2048 * sizeof(char));

    glGetShaderiv(id, GL_COMPILE_STATUS, &success);
    if (!success) {
        glGetShaderInfoLog(id, 2048, nullptr, infoLog);
        std::cerr << "Shader compilation error :\n" << infoLog << std::endl;
    }
    free(infoLog);

    std::cout << "Shader " << name << " created\n";
}

Shader::~Shader() {
    glDeleteShader(id);
    std::cout << "Shader " << name << " destroyed\n";
}

Program::Program(const char* fragpath, const char* vertpath) : uniforms() {
    vertname = vertpath;
    fragname = fragpath;
    Shader vertShader(GL_VERTEX_SHADER, vertpath);
    Shader fragShader(GL_FRAGMENT_SHADER, fragpath);

    id = glCreateProgram();

    glAttachShader(id, vertShader.id);
    glAttachShader(id, fragShader.id);

    glLinkProgram(id);

    std::cout << "Program created\n";
}

Program::~Program() {
    glDeleteProgram(id);
    std::cout << "Program destroyed\n";
}

void Program::bind() {
    glUseProgram(id);
}

void Program::reload() {
    Shader vertShader(GL_VERTEX_SHADER, vertname);
    Shader fragShader(GL_FRAGMENT_SHADER, fragname);

    if (vertShader.id && fragShader.id) {

        glDeleteProgram(id);

        id = glCreateProgram();

        glAttachShader(id, vertShader.id);
        glAttachShader(id, fragShader.id);

        glLinkProgram(id);
    }
    ;
}

GLuint Program::getUniformLocation(std::string name) {

    auto it = uniforms.find(name);
    if (it == uniforms.end()) {
        GLuint loc = glGetUniformLocation(id, name.c_str());
        uniforms[name] = loc;
    }
    return uniforms[name];
}

void Program::setUniform(std::string name, float f) {
    GLuint loc = getUniformLocation(name);
    glUniform1f(loc, f);
}

void Program::setUniform(std::string name, glm::vec2 vec) {
    GLuint loc = getUniformLocation(name);
    glUniform2f(loc, vec.x, vec.y);
}

void Program::setUniform(std::string name, glm::vec3 vec) {
    GLuint loc = getUniformLocation(name);
    glUniform3f(loc, vec.x, vec.y, vec.z);
}

void Program::setUniform(std::string name, glm::mat4x4 mat) {
    GLuint loc = getUniformLocation(name);
    glUniformMatrix4fv(loc, 1, GL_FALSE, glm::value_ptr(mat));
}
void Program::setUniform(std::string name, glm::mat3x3 mat) {
    GLuint loc = getUniformLocation(name);
    glUniformMatrix3fv(loc, 1, GL_FALSE, glm::value_ptr(mat));
}

void Program::setUniform(std::string name, int i) {
    GLuint loc = getUniformLocation(name);
    glUniform1i(loc, i);
}

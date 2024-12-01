#pragma once

#include "Shader.h"

typedef class Camera Camera;
class Camera {
private:
    glm::mat4x4 view;
    glm::mat4x4 lastView;
    glm::vec3 up;
    glm::vec3 right;
    glm::vec3 world_up;
    float rotation_x;
    float rotation_y;
    float speed;
    float last_x;
    float last_y;
    bool first_mouse;
public:
    glm::mat4x4 projection;
    int speed_mod;

    Camera(float aspect, glm::vec3 pos);

    void setUniforms(Program& prog);

    void updateInput(GLFWwindow* window, float delta_time);
    void mouseCallback(GLFWwindow* window, float position_x, float position_y);

    glm::vec3 getPos() const;

    glm::vec3 position;
    glm::vec3 lastPosition;
    glm::vec3 velocity;
    glm::vec3 front;
};
#include <chrono>
#include <iostream>

#include "Camera.h"
#include "Framebuffer.h"

int width = 800;
int height = 800;

void APIENTRY gl_debug_callback(GLenum source, GLenum type, GLuint id,
    GLenum severity, GLsizei length,
    const GLchar* msg, const void* data) {
    char* _source;
    char* _type;
    char* _severity;

    switch (source) {
    case GL_DEBUG_SOURCE_API:
        _source = (char*)"API";
        break;

    case GL_DEBUG_SOURCE_WINDOW_SYSTEM:
        _source = (char*)"WINDOW SYSTEM";
        break;

    case GL_DEBUG_SOURCE_SHADER_COMPILER:
        _source = (char*)"SHADER COMPILER";
        break;

    case GL_DEBUG_SOURCE_THIRD_PARTY:
        _source = (char*)"THIRD PARTY";
        break;

    case GL_DEBUG_SOURCE_APPLICATION:
        _source = (char*)"APPLICATION";
        break;

    case GL_DEBUG_SOURCE_OTHER:
        _source = (char*)"UNKNOWN";
        break;

    default:
        _source = (char*)"UNKNOWN";
        break;
    }

    switch (type) {
    case GL_DEBUG_TYPE_ERROR:
        _type = (char*)"ERROR";
        break;

    case GL_DEBUG_TYPE_DEPRECATED_BEHAVIOR:
        _type = (char*)"DEPRECATED BEHAVIOR";
        break;

    case GL_DEBUG_TYPE_UNDEFINED_BEHAVIOR:
        _type = (char*)"UDEFINED BEHAVIOR";
        break;

    case GL_DEBUG_TYPE_PORTABILITY:
        _type = (char*)"PORTABILITY";
        break;

    case GL_DEBUG_TYPE_PERFORMANCE:
        _type = (char*)"PERFORMANCE";
        break;

    case GL_DEBUG_TYPE_OTHER:
        _type = (char*)"OTHER";
        break;

    case GL_DEBUG_TYPE_MARKER:
        _type = (char*)"MARKER";
        break;

    default:
        _type = (char*)"UNKNOWN";
        break;
    }

    switch (severity) {
    case GL_DEBUG_SEVERITY_HIGH:
        _severity = (char*)"HIGH";
        break;

    case GL_DEBUG_SEVERITY_MEDIUM:
        _severity = (char*)"MEDIUM";
        break;

    case GL_DEBUG_SEVERITY_LOW:
        _severity = (char*)"LOW";
        //	return;
        break;

    case GL_DEBUG_SEVERITY_NOTIFICATION:
        _severity = (char*)"NOTIFICATION";
        return;
        break;

    default:
        _severity = (char*)"UNKNOWN";
        break;
    }

    printf("%d: %s of %s severity, raised from %s: %s\n", id, _type, _severity,
        _source, msg);
}

Camera* camera_ptr = 0;
bool b_paused = false;

void mousePosCallback(GLFWwindow* window, const double position_x,
    const double position_y) {
    if (camera_ptr && !b_paused)
        camera_ptr->mouseCallback(window, static_cast<float>(position_x),
            static_cast<float>(position_y));
}
void windowResizeCallback(GLFWwindow* window, const int width_,
    const int height_) {
    glViewport(0, 0, width_, height_);
    width = width_;
    height = height_;
    if (camera_ptr)
        camera_ptr->projection = glm::perspective(
            glm::radians<float>(80), float(width) / float(height), 0.01f, 1200.0f);
}

bool enter_unpressed = true;
bool escape_unpressed = true;

void updateInput(GLFWwindow* window, Program& prog, float dt) {
    if (camera_ptr && !b_paused)
        camera_ptr->updateInput(window, dt);
    if (glfwGetKey(window, GLFW_KEY_ENTER) == GLFW_PRESS) {
        if (enter_unpressed) {
            prog.reload();
            enter_unpressed = false;
        }
    }
    else {
        enter_unpressed = true;
    }

    if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS) {
        if (escape_unpressed) {
            if (b_paused) {
                glfwSetCursorPos(window, 200, 200);
            }
            b_paused = !b_paused;

            escape_unpressed = false;
        }
    }
    else {
        escape_unpressed = true;
    }
}

int main() {
    if (!glfwInit()) {
        std::cerr << "ERROR: could not start GLFW3\n";
        return 1;
    }

    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 4);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);

    glfwWindowHint(GLFW_OPENGL_DEBUG_CONTEXT, 1);

    float lastTime = 0;
    float count = 0;
    float medDelta = 0;
    float deltaTime = 0;
    float currentTime;
    char title[31] = "Test with buffers - 000000 FPS";

    GLFWwindow* window = glfwCreateWindow(width, height, title, NULL, NULL);
    if (!window) {
        std::cerr << "ERROR: could not open window with GLFW3\n";
        glfwTerminate();
        return 1;
    }
    glfwMakeContextCurrent(window);

    // Init glad
    if (!gladLoadGLLoader((GLADloadproc)glfwGetProcAddress)) {
        std::cerr << "Failed to initialize GLAD" << std::endl;
        return -1;
    }

    const GLubyte* renderer = glGetString(GL_RENDERER);
    const GLubyte* version = glGetString(GL_VERSION);
    printf("Renderer: %s\n", renderer);
    printf("OpenGL version supported %s\n\n", version);

    glEnable(GL_DEBUG_OUTPUT_SYNCHRONOUS);
    glDebugMessageCallback(gl_debug_callback, nullptr);

    glfwSetCursorPosCallback(window, mousePosCallback);
    glfwSetWindowSizeCallback(window, windowResizeCallback);

    Program raytracingProgram("../src/raytracing.frag", "../src/raytracing.vert");
    Program quadProgram("../src/quad.frag", "../src/quad.vert");

    Camera camera(float(width) / float(height), glm::vec3(0, -3, -5));
    camera_ptr = &camera;

    float vertices[] = { 1.0f, 1.0f, -1.0f, 1.0f,  -1.0f, -1.0f,
                        1.0f, 1.0f, -1.0f, -1.0f, 1.0f,  -1.0f };

    GLuint vao, vbo;
    glGenVertexArrays(1, &vao);
    glGenBuffers(1, &vbo);

    glBindVertexArray(vao);

    glBindBuffer(GL_ARRAY_BUFFER, vbo);
    glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);

    glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 2 * sizeof(float), (void*)0);
    glEnableVertexAttribArray(0);

    Framebuffer fb1(width, height);
    Framebuffer fb2(width, height);

    glBindFramebuffer(GL_FRAMEBUFFER, 0);

    // glfwSwapInterval(0);

    int frame = 0;

    while (!glfwWindowShouldClose(window)) {
        glfwPollEvents();

        // Update dt

        currentTime = (float)glfwGetTime();
        deltaTime = currentTime - lastTime;
        // if (deltaTime < 1.0f / 60.0f) continue;
        medDelta += deltaTime;
        if (medDelta < 1)
            count++;
        else {
            sprintf_s(title, 31, "Test with buffers - %d FPS",
                (int)(1.0f / medDelta * (count + 1)) + 1);
            glfwSetWindowTitle(window, title);
            count = 0;
            medDelta = 0;
        }
        lastTime = currentTime;

        updateInput(window, raytracingProgram, deltaTime);

        // First pass

        glBindVertexArray(vao);
        raytracingProgram.bind();
        camera.setUniforms(raytracingProgram);
        raytracingProgram.setUniform("u_Time", float(glfwGetTime()));
        raytracingProgram.setUniform("u_Resolution", glm::vec2(width, height));
        raytracingProgram.setUniform(
            "spacePressed", glfwGetKey(window, GLFW_KEY_R) == GLFW_PRESS ? 1 : 0);
        raytracingProgram.setUniform("doReset", camera.doReset() ? 1 : 0);

        Framebuffer* currentFbo = (frame % 2 == 0) ? &fb1 : &fb2;
        Framebuffer* lastFbo = (frame % 2 == 1) ? &fb1 : &fb2;

        currentFbo->bind();

        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, lastFbo->renderTexture);
        glActiveTexture(GL_TEXTURE1);
        glBindTexture(GL_TEXTURE_2D, lastFbo->positionsTexture);

        raytracingProgram.setUniform("lastFrameColors", 0);
        raytracingProgram.setUniform("lastFramePositions", 1);

        glClear(GL_COLOR_BUFFER_BIT);
        glDrawArrays(GL_TRIANGLES, 0, 6);

        // Second pass

        glBindFramebuffer(GL_FRAMEBUFFER, 0);

        glClear(GL_COLOR_BUFFER_BIT);
        glViewport(0, 0, width, height);

        glBindVertexArray(vao);
        quadProgram.bind();

        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, currentFbo->renderTexture);
        glActiveTexture(GL_TEXTURE1);
        glBindTexture(GL_TEXTURE_2D, currentFbo->positionsTexture);

        quadProgram.setUniform("screenTexture", 0);

        glDrawArrays(GL_TRIANGLES, 0, 6);

        glfwSwapBuffers(window);

        frame++;
    }

    glDeleteVertexArrays(1, &vao);
    glDeleteBuffers(1, &vbo);

    glfwTerminate();
    return 0;
}
#pragma once

#include "Includes.h"

class Framebuffer {
public:
	GLuint fbo, texture;
	int width, height;

	Framebuffer(int width, int height);
	~Framebuffer();

	void bind();
};
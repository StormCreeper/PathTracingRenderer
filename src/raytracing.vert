#version 430

layout (location = 0) in vec2 aVertexPos;

out vec2 fragPos;

void main() {
	gl_Position = vec4(aVertexPos, 0.0, 1.0);
	fragPos = aVertexPos.xy;
}
#version 430

#define STEPS 10
#define SAMPLES 256.0f

#define EPSILON 1e-4

#define PI 3.141592653589793238462643383279

in vec2 fragPos;

layout(location = 0) out vec4 color;
layout(location = 1) out vec3 positions;

uniform sampler2D lastFrameColors;
uniform sampler2D lastFramePositions;

uniform mat4x4 u_InverseView;
uniform mat4x4 u_InverseProjection;

uniform mat4x4 u_PreviousProjection;
uniform mat4x4 u_PreviousView;

uniform vec2 u_Resolution;
uniform float u_Time;

uniform int spacePressed;
uniform int doReset;

vec3 sunDir = normalize(vec3(0.4, -0.5, 0));
vec3 sunColor = vec3(1, 0.8, 0.7) * 20;
vec3 skyColor = vec3(0.7, 0.8, 1.0) * 0.5;

float tseed = u_Time;
uint rngState =
uint(uint(gl_FragCoord.x) * uint(1973) + uint(gl_FragCoord.y) * uint(9277) +
    uint(tseed * 100) * uint(26699)) |
    uint(1);

uint wang_hash(inout uint seed) {
    seed = uint(seed ^ uint(61)) ^ uint(seed >> uint(16));
    seed *= uint(9);
    seed = seed ^ (seed >> 4);
    seed *= uint(0x27d4eb2d);
    seed = seed ^ (seed >> 15);
    return seed;
}
float RandomFloat01(inout uint state) {
    return float(wang_hash(state)) / 4294967296.0;
}

vec3 RandomUnitVector(inout uint state) {
    float z = RandomFloat01(state) * 2.0f - 1.0f;
    float a = RandomFloat01(state) * 2 * PI;
    float r = sqrt(1.0f - z * z);
    float x = r * cos(a);
    float y = r * sin(a);
    return vec3(x, y, z);
}

float ray_sphere_intersection(vec3 p, vec3 d, float r) {
    float a = dot(d, d);
    float b = 2.0f * dot(p, d);
    float c = dot(p, p) - r * r;
    float discr = b * b - 4 * a * c;
    if (discr < 0)
        return -1;
    else {
        float sqrtD = sqrt(discr);
        float t1 = (-b - sqrtD) / (2.0f * a);
        float t2 = (-b + sqrtD) / (2.0f * a);
        if (t1 < 0)
            return t2;
        return t1;
    }
}

float ray_triangle_intersection(vec3 origin, vec3 direction, vec3 v0, vec3 v1, vec3 v2) {
    vec3 edge1, edge2, h, s, q;
    float a, f, u, v;
    edge1 = v1 - v0;
    edge2 = v2 - v0;
    h = cross(direction, edge2);
    a = dot(edge1, h);
    if (a > -EPSILON && a < EPSILON)
        return -1;

    f = 1.0f / a;
    s = origin - v0;
    u = f * dot(s, h);
    if (u < 0.0 || u > 1.0)
        return -1;
    q = cross(s, edge1);
    v = f * dot(direction, q);
    if (v < 0.0 || u + v > 1.0)
        return -1;

    float t = f * dot(edge2, q);
    if (t > EPSILON) {
        return t;
    }
    else
        return -1;
}

float ray_plane_intersection(vec3 origin, vec3 direction, vec3 porigin,
    vec3 normal) {
    float denom = dot(normal, direction);
    if (denom < 1e-6) {
        vec3 p0l0 = porigin - origin;
        float t = dot(p0l0, normal) / denom;
        if (t > 0) {
            vec3 new_pos = origin + t * direction;
            // if(length(new_pos - porigin) > 8) return -1;
            return t;
        }
    }
    return -1;
}

struct Material {
    vec3 albedo;
    vec3 specular;
    vec3 emissive;
    float roughness;
    float specularChance;
    float refractionChance;
    float ior;
};

struct hitObject {
    bool hit;
    float dist;
    vec3 normal;
    vec3 light;
    Material mat;
    bool fromInside;
    int type;
};

struct Sphere {
    vec3 center;
    float radius;
    Material mat;
};
struct Triangle {
    vec3 v1;
    vec3 v2;
    vec3 v3;
    vec3 normal;
    Material mat;
};

Material createMat(vec3 albedo, vec3 specular, vec3 emissive, float roughness, float specularChance, float refractionChance, float ior) {
    Material mat;

    mat.albedo = albedo;
    mat.specular = specular;
    mat.emissive = emissive;
    mat.roughness = roughness;
    mat.specularChance = specularChance;
    mat.refractionChance = refractionChance;
    mat.ior = ior;

    return mat;
}

Sphere createSphere(vec3 center, float radius, Material mat) {
    Sphere s;
    s.center = center;
    s.radius = radius;
    s.mat = mat;
    return s;
}

Triangle createTriangle(vec3 v1, vec3 v2, vec3 v3, Material mat) {
    Triangle t;
    t.v1 = v1;
    t.v2 = v2;
    t.v3 = v3;
    t.normal = normalize(cross(v3 - v1, v2 - v1));
    t.mat = mat;
    return t;
}

int numS = 7;

float timei = 3.3;
Sphere SceneS[] = Sphere[](
    createSphere(vec3(4, -6, -2), 0.8, 
        createMat(vec3(0), vec3(0), vec3(25), 0, 0, 0, 0)),
    createSphere(vec3(-4, -6, -2), 0.8,
        createMat(vec3(0), vec3(0), vec3(25), 0, 0, 0, 0)),
    createSphere(vec3(0, -6, 4), 0.8,
        createMat(vec3(0), vec3(0), vec3(25), 0, 0, 0, 0)),
    createSphere(vec3(0, -1, 0), 1,
        createMat(vec3(1.0, 1.0, 1.0), vec3(1.0, 1.0, 1.0), vec3(0), 0.0, 0.1, 0.9, 1.5)),
    createSphere(vec3(0, -1, 2.5), 1,
        createMat(vec3(1.0, 0.2, 0.2), vec3(1.0, 0.1, 0.8), vec3(0), 0.0, 0.1, 0.9, 1.5)),
    createSphere(vec3(-2.5, -1.1, 0), 1,
        createMat(vec3(0.2, 0.2, 1.0), vec3(1.0, 1.0, 0.8), vec3(0), 0.7, 1.0, 0.0, 1.5)),
    createSphere(vec3(0, -1.2, -2.5), 1,
        createMat(vec3(0.2, 1.0, 0.2), vec3(1.0, 1.0, 1.0), vec3(0), 0.0, 0.5, 0.0, 1.5)));

uniform int numT = 0;

uniform Triangle SceneT[1];

vec3 getSphereNormal(vec3 pos, vec3 sphere) {
    return normalize(pos - sphere.xyz);
}

hitObject sendRay(vec3 origin, vec3 direction) {
    hitObject obj;
    obj.hit = false;
    obj.dist = 1e20;
    obj.normal = vec3(0, 0, 0);
    obj.mat = createMat(vec3(0), vec3(0), vec3(0), 0, 0, 0, 0);
    obj.fromInside = false;
    obj.type = 0;

    float d1 =
        ray_plane_intersection(origin, direction, vec3(0, 0, 0), vec3(0, -1, 0));
    if (d1 >= 0) {
        obj.hit = true;
        obj.dist = d1;
        obj.normal = vec3(0, -1, 0);
        obj.mat = createMat(vec3(1.0, 1.0, 1.0), vec3(1.0, 1.0, 1.0), vec3(0), 0.1, 0.0, 0.0, 1.0);
    }
    for (int i = 0; i < numS; i++) {
        Sphere s = SceneS[i];
        float d = ray_sphere_intersection(origin - s.center, direction, s.radius);
        if (d >= 0 && d < obj.dist) {
            obj.hit = true;
            obj.dist = d;
            vec3 nnorm = getSphereNormal(origin + d * direction, s.center);
            obj.normal = nnorm;
            if (dot(nnorm, direction) > 0) {
                obj.fromInside = true;
                obj.normal = -nnorm;
            }
            obj.mat = s.mat;
        }
    }
    for (int i = 0; i < numT; i++) {
        Triangle t = SceneT[i];
        float d = ray_triangle_intersection(origin, direction, t.v1, t.v2, t.v3);
        if (d >= 0 && d < obj.dist) {
            obj.hit = true;
            obj.dist = d;
            vec3 nnorm = t.normal;
            obj.normal = nnorm;
            if (dot(nnorm, direction) > 0) {
                obj.normal = -nnorm;
            }
            obj.mat = t.mat;
        }
    }

    return obj;
}

float FresnelReflectAmount(float n1, float n2, vec3 normal, vec3 incident,
    float f0, float f90) {
    // Schlick aproximation
    float r0 = (n1 - n2) / (n1 + n2);
    r0 *= r0;
    float cosX = -dot(normal, incident);
    if (n1 > n2) {
        float n = n1 / n2;
        float sinT2 = n * n * (1.0 - cosX * cosX);
        // Total internal reflection
        if (sinT2 > 1.0)
            return f90;
        cosX = sqrt(1.0 - sinT2);
    }
    float x = 1.0 - cosX;
    float ret = r0 + (1.0 - r0) * x * x * x * x * x;

    // adjust reflect multiplier for object reflectivity
    return mix(f0, f90, ret);
}

vec3 traceRay(vec3 origin, vec3 direction) {
    vec3 energy = vec3(1, 1, 1);
    hitObject hit = sendRay(origin, direction);
    if (hit.hit)
        positions.xyz = origin + direction * hit.dist;
    for (int i = 0; i < STEPS; i++) {
        if (hit.hit) {
            if (length(hit.mat.emissive) != 0) {
                return hit.mat.emissive * energy;
            }
            else {
                origin += direction * hit.dist;
                vec3 norm = hit.normal;
                origin += norm * EPSILON;
                vec3 diffuse = normalize(norm + RandomUnitVector(rngState));

                float specularChance = hit.mat.specularChance;
                float refractionChance = hit.mat.refractionChance;

                // float rayProbability = 1.0f;
                if (specularChance > 0.0f) {
                    specularChance = FresnelReflectAmount(
                        hit.fromInside ? hit.mat.ior : 1.0, !hit.fromInside ? hit.mat.ior : 1.0,
                        direction, norm, hit.mat.specularChance, 1.0f);

                    float chanceMultiplier =
                        (1.0f - specularChance) / (1.0f - hit.mat.specularChance);
                    refractionChance *= chanceMultiplier;
                }

                float doSpecular = 0.0f;
                float doRefraction = 0.0f;
                float raySelectRoll = RandomFloat01(rngState);
                if (specularChance > 0.0f && raySelectRoll < specularChance) {
                    doSpecular = 1.0f;
                }
                else if (refractionChance > 0.0f &&
                    raySelectRoll < specularChance + refractionChance) {
                    doRefraction = 1.0f;
                }

                if (doSpecular > 0) {
                    vec3 specular = reflect(direction, norm);
                    direction =
                        normalize(mix(specular, diffuse, hit.mat.roughness * hit.mat.roughness));
                    energy *= hit.mat.specular;
                }
                else if (doRefraction > 0) {
                    vec3 n = hit.normal;
                    origin -= norm * 2 * EPSILON;

                    vec3 refracted = refract(direction, n, 1 / hit.mat.ior);
                    direction =
                        normalize(mix(refracted, diffuse, hit.mat.roughness * hit.mat.roughness));
                    energy *= hit.mat.specular;
                }
                else {
                    direction = diffuse;
                    energy *= hit.mat.albedo;
                }
            }
        }
        else {
            float sun = pow(max(dot(sunDir, normalize(direction)), 0), 512) * 5 * 0;
            return (skyColor * 0.5 + sun * sunColor) * energy;
            // return energy * 0;
            vec3 skyCol = skyColor;
            skyCol *= skyCol * 1.5;
            return skyCol * 2 * energy;
        }
        if (dot(energy, energy) < 0.1)
            return vec3(0);
        if (i < STEPS - 1)
            hit = sendRay(origin, direction);
    }
    return energy * 0;
}

vec2 Reprojection(vec3 WorldPos) {
    vec4 ProjectedPosition =
        u_PreviousProjection * u_PreviousView * vec4(WorldPos, 1.0f);
    ProjectedPosition.xyz /= ProjectedPosition.w;
    ProjectedPosition.xy = ProjectedPosition.xy * 0.5f + 0.5f;
    ProjectedPosition.y = 1 - ProjectedPosition.y;
    return ProjectedPosition.xy;
}

bool reproj = false;

void main() {

    vec2 uv = gl_FragCoord.xy / u_Resolution.xy;
    vec2 ScreenSpace = (gl_FragCoord.xy + (reproj ? 0.0 : 1.0) * vec2(RandomFloat01(rngState),
        RandomFloat01(rngState))) /
        u_Resolution.xy;
    ScreenSpace.y = 1 - ScreenSpace.y;
    vec4 Clip = vec4(ScreenSpace.xy * 2.0f - 1.0f, -1.0, 1.0);
    vec4 Eye = vec4(vec2(u_InverseProjection * Clip), -1.0, 0.0);
    vec3 RayDirection = vec3(u_InverseView * Eye);
    vec3 RayOrigin = u_InverseView[3].xyz;
    RayDirection = normalize(RayDirection);

    int i = 0;

    for (; i < SAMPLES; i++) {
        color.rgb += traceRay(RayOrigin, RayDirection);
    }
    color /= i;

    // Clamp
    color.xyz = vec3(max(0., min(1., color.r)), max(0., min(1., color.g)), max(0., min(1., color.b)));

    if (spacePressed == 0 && (doReset == 0 || reproj)) {

        if(reproj) {
            vec3 currentPos = positions; // texture(lastFramePositions,
            // ScreenSpace).xyz;
            // currentPos.y = 1- currentPos.y;
            vec2 reproUV = Reprojection(currentPos);
            if (reproUV.x > 0 && reproUV.y > 0 && reproUV.x < 1 && reproUV.y < 1) {
                vec3 lastPos = texture(lastFramePositions, reproUV).xyz;
                if (length(lastPos - currentPos) < 0.1) {
                    vec4 lastColor = texture(lastFrameColors, reproUV).rgba;
                    float blend = 1;
                    if (lastColor.a != 0)
                        blend = 1.0f / (1.0f + 1.0f / lastColor.a);
                    color.rgb = vec3(max(0., min(1., color.r)), max(0., min(1., color.g)),
                        max(0., min(1., color.b)));
                    color.rgb = mix(color.rgb, lastColor.rgb, 1 - blend);
                    color.a = blend;
                }
                else {
                    color.a = 0;
                }
            }
            else {
                color.a = 0;
            }
        } else {
            vec4 lastColor = texture(lastFrameColors, gl_FragCoord.xy / u_Resolution.xy).rgba;

            float blend = max(0.001, (lastColor.a == 0.0f || (spacePressed == 1)) ? 1.0f
                : 1.0f / (1.0f + 1.0f / lastColor.a)); color.rgb = mix(lastColor.rgb,
                color.rgb, blend);

            color.a = blend;
        }
    }
}
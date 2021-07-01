#version 430

#define STEPS 5
#define SAMPLES 5.0f

#define EPSILON 1e-4

#define PI 3.141592653589793238462643383279

in vec2 fragPos;

layout(location = 0) out vec4 color;

uniform sampler2D screenTexture;
uniform mat4x4 invView;
uniform mat4x4 invProj;
uniform vec2 iResolution;
uniform float iTime;
uniform vec3 viewPos;

uniform int spacePressed;

vec3 sunDir = normalize(vec3(0.4, -0.5, 0));
vec3 sunColor = vec3(1, 0.8, 0.7) * 20;
vec3 skyColor = vec3(0.7, 0.8, 1.0) * 0.5;

float tseed = iTime;
uint rngState = uint(uint(gl_FragCoord.x) * uint(1973) + uint(gl_FragCoord.y) * uint(9277) + uint(tseed * 100) * uint(26699)) | uint(1);

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
    float c = dot(p,p) - r*r;
    float discr = b*b - 4*a*c;
    if(discr < 0) return -1;
    else {
    	float sqrtD = sqrt(discr);
		float t1 = (-b - sqrtD) / (2.0f*a);
		float t2 = (-b + sqrtD) / (2.0f*a);
		if(t1 < 0) return t2;
		return t1;
    }
}

float ray_triangle_intersection(vec3 origin, vec3 direction, vec3 v0, vec3 v1, vec3 v2) {
    vec3 edge1, edge2, h, s, q;
    float a,f,u,v;
    edge1 = v1 - v0;
    edge2 = v2 - v0;
    h = cross(direction, edge2);
    a = dot(edge1, h);
    if (a > -EPSILON && a < EPSILON)
        return -1;

    f = 1.0f/a;
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

float ray_plane_intersection(vec3 origin, vec3 direction, vec3 porigin, vec3 normal) {
	float denom = dot(normal, direction);
	if(denom < 1e-6) {
		vec3 p0l0 = porigin - origin;
		float t = dot(p0l0, normal) / denom;
		if(t > 0) {
			vec3 new_pos = origin + t * direction;
			if(length(new_pos - porigin) > 8) return -1;
			return t;
		}
	}
	return -1;
}

struct hitObject {
	bool hit;
    float dist;
    vec3 normal;
    vec3 light;
    float roughness;
    vec3 albedo;
    vec3 specular;
	float specularChance;
	float refractionChance;
	float ior;
	bool fromInside;
	int type;
};

struct Sphere {
	vec3 center;
	float radius;
	vec3 albedo;
	vec3 specular;
	vec3 emissive;
	float roughness;
	float specularChance;
	float refractionChance;
	float ior;
};
struct Triangle {
	vec3 v1;
	vec3 v2;
	vec3 v3;
	vec3 normal;
	vec3 albedo;
	vec3 specular;
	vec3 emissive;
	float roughness;
	float specularChance;
	float refractionChance;
	float ior;
};

Sphere createSphere(vec3 center, float radius, vec3 albedo, vec3 specular, vec3 emissive, float roughness, float specularChance, float refractionChance, float ior) {
	Sphere s;
	s.center = center;
	s.radius = radius;
	s.albedo = albedo;
	s.specular = specular;
	s.emissive = emissive;
	s.roughness = roughness;
	s.specularChance = specularChance;
	s.refractionChance = refractionChance;
	s.ior = ior;
	return s;
}

Triangle createTriangle(vec3 v1, vec3 v2, vec3 v3, vec3 albedo, vec3 specular, vec3 emissive, float roughness, float specularChance, float refractionChance, float ior) {
	Triangle t;
	t.v1 = v1;
	t.v2 = v2;
	t.v3 = v3;
	t.normal = normalize(cross(v3-v1, v2-v1));
	t.albedo = albedo;
	t.specular = specular;
	t.emissive = emissive;
	t.roughness = roughness;
	t.specularChance = specularChance;
	t.refractionChance = refractionChance;
	t.ior = 1/ior;
	return t;
}

int numS = 7;

float timei = 3.3;
Sphere SceneS[] = Sphere[] (
	createSphere(vec3(  2, -7, 0), 0.8, vec3(1.0, 1.0, 1.0), vec3(1.0, 1.0, 1.0), vec3(30), 0.2, 0.1, 0.9, 1.5),
	createSphere(vec3(  -2, -7, 0), 0.8, vec3(1.0, 1.0, 1.0), vec3(1.0, 1.0, 1.0), vec3(30), 0.2, 0.1, 0.9, 1.5),
	createSphere(vec3(  0, -7, 2), 0.8, vec3(1.0, 1.0, 1.0), vec3(1.0, 1.0, 1.0), vec3(30), 0.2, 0.1, 0.9, 1.5),
	createSphere(vec3( 0, -3 + 2 * sin(timei), 0), 1, vec3(1.0, 1.0, 1.0), vec3(1.0, 1.0, 0.8), vec3(0), 0.0, 0.1, 0.9, 1.5),
	createSphere(vec3( 3*cos( timei + PI / 2    ), -3, 3*sin( timei + PI / 2    )), 1, vec3(1.0, 1.0, 1.0), vec3(0.1, 1.0, 0.8), vec3(0), 0.0, 0.1, 0.9, 1.5),
	createSphere(vec3( 3*cos( timei + PI        ), -3, 3*sin( timei + PI        )), 1, vec3(1.0, 1.0, 1.0), vec3(1.0, 1.0, 0.8), vec3(0), 0.7, 1.0, 0.0, 1.5),
	createSphere(vec3( 3*cos( timei + PI * 3 / 2), -3, 3*sin( timei + PI * 3 / 2)), 1, vec3(1.0, 0.5, 1.0), vec3(1.0, 1.0, 1.0), vec3(0), 0.0, 0.5, 0.0, 1.5),
	createSphere(vec3( 5*cos(-timei             ), -6, 3*sin(-timei             )), 1, vec3(1.0, 0.1, 1.0), vec3(1.0, 1.0, 1.0), vec3(8), 0.0, 0.5, 0.0, 1.5),
	createSphere(vec3( 5*cos(-timei + PI / 2    ), -6, 3*sin(-timei + PI / 2    )), 1, vec3(1.0, 1.0, 1.0), vec3(1.0, 1.0, 0.8), vec3(4), 0.0, 0.1, 0.9, 1.5),
	createSphere(vec3( 5*cos(-timei + PI        ), -6, 3*sin(-timei + PI        )), 1, vec3(1.0, 1.0, 1.0), vec3(1.0, 1.0, 0.8), vec3(4), 0.0, 0.1, 0.9, 1.5),
	createSphere(vec3( 5*cos(-timei + PI * 3 / 2), -6, 3*sin(-timei + PI * 3 / 2)), 1, vec3(1.0, 1.0, 1.0), vec3(1.0, 1.0, 0.8), vec3(4), 0.0, 0.1, 0.9, 1.5)
);

uniform int numT = 70;

uniform Triangle SceneT[70];


vec3 getSphereNormal(vec3 pos, vec3 sphere) {
	return normalize(pos - sphere.xyz);
}

hitObject sendRay(vec3 origin, vec3 direction) {
	hitObject obj;
	obj.hit = false;
	obj.dist = 1e20;
	obj.normal = vec3(0, 0, 0);
	obj.albedo = vec3(0, 0, 0);
	obj.specular = vec3(0, 0, 0);
	obj.light = vec3(0, 0, 0);
	obj.roughness = 0;
	obj.ior = 1;
	obj.fromInside = false;
	obj.type = 0;

	float d1 = ray_plane_intersection(origin, direction, vec3(0, 0, 0),vec3(0, -1, 0));
	if(d1 >= 0) {
		obj.hit = true;
		obj.dist = d1;
		obj.normal = vec3(0, -1, 0);
		obj.roughness = 0.1;
		obj.albedo = vec3(1.0, 1.0, 1.0);
		obj.specular = vec3(1, 1.0, 1.0);
		obj.specularChance = 0.0;
		obj.refractionChance = 0.0;
		obj.ior = 1;
	}
	for(int i=0; i<numS; i++) {
		Sphere s = SceneS[i];
        float d = ray_sphere_intersection(origin - s.center, direction, s.radius);
        if(d >= 0 && d < obj.dist) {
			obj.hit = true;
			obj.dist = d;
			vec3 nnorm = getSphereNormal(origin + d * direction, s.center);
			obj.normal = nnorm;
			if(dot(nnorm, direction) > 0) {
				obj.fromInside = true;
				obj.normal = -nnorm;
			}
			obj.roughness = s.roughness;
			obj.specular = s.specular;
			obj.albedo = s.albedo;
			obj.light = s.emissive;
			obj.specularChance = s.specularChance;
			obj.refractionChance = s.refractionChance;
			obj.ior = s.ior;
        }
	}
	for(int i=0; i<numT; i++) {
		Triangle t = SceneT[i];
        float d = ray_triangle_intersection(origin, direction, t.v1, t.v2, t.v3);
        if(d >= 0 && d < obj.dist) {
			obj.hit = true;
			obj.dist = d;
			vec3 nnorm = t.normal;
			obj.normal = nnorm;
			if(dot(nnorm, direction) > 0) {
				obj.normal = -nnorm;
			}
			obj.roughness = t.roughness;
			obj.specular = t.specular;
			obj.albedo = t.albedo;
			obj.light = t.emissive;
			obj.specularChance = t.specularChance;
			obj.refractionChance = t.refractionChance;
			obj.ior = t.ior;
        }
	}

	return obj;
}

float FresnelReflectAmount(float n1, float n2, vec3 normal, vec3 incident, float f0, float f90) {
        // Schlick aproximation
        float r0 = (n1-n2) / (n1+n2);
        r0 *= r0;
        float cosX = -dot(normal, incident);
        if (n1 > n2) {
            float n = n1/n2;
            float sinT2 = n*n*(1.0-cosX*cosX);
            // Total internal reflection
            if (sinT2 > 1.0)
                return f90;
            cosX = sqrt(1.0-sinT2);
        }
        float x = 1.0-cosX;
        float ret = r0+(1.0-r0)*x*x*x*x*x;
 
        // adjust reflect multiplier for object reflectivity
        return mix(f0, f90, ret);
}

vec3 traceRay(vec3 origin, vec3 direction) {
	vec3 energy = vec3(1, 1, 1);
	hitObject hit = sendRay(origin, direction);
	for(int i=0; i<STEPS; i++) {
		if(RandomFloat01(rngState) < 0.0) {
			float dist = 0;
			if(hit.hit) {
				dist = RandomFloat01(rngState) * hit.dist;
			} else {
				dist = RandomFloat01(rngState) * 20;
			}
			origin -= direction * RandomFloat01(rngState) * dist;
			energy *= 0.9;
			direction = normalize(RandomUnitVector(rngState));
		} else {
			if(hit.hit) {
				if(length(hit.light) != 0) {
					return hit.light * energy;
				} else {
					origin += direction * hit.dist;
					if(hit.type == 0) {
						
						vec3 norm = hit.normal;
						origin += norm * EPSILON;
						/*float rn = RandomFloat01(rngState);
						bool spec = rn < hit.specularChance;
						bool refr = rn > hit.specularChance && rn < hit.specularChance + hit.refractionChance;*/
						vec3 diffuse = normalize(norm + RandomUnitVector(rngState));

						float specularChance = hit.specularChance;
		    			float refractionChance = hit.refractionChance;

						//float rayProbability = 1.0f;
					    if (specularChance > 0.0f) {
					        specularChance = FresnelReflectAmount(
					            hit.fromInside ? hit.ior : 1.0,
					            !hit.fromInside ? hit.ior : 1.0,
					            direction, norm, hit.specularChance, 1.0f);
					         
					        float chanceMultiplier = (1.0f - specularChance) / (1.0f - hit.specularChance);
					        refractionChance *= chanceMultiplier;
					    }

					    float doSpecular = 0.0f;
					    float doRefraction = 0.0f;
					    float raySelectRoll = RandomFloat01(rngState);
					    if (specularChance > 0.0f && raySelectRoll < specularChance) {
					        doSpecular = 1.0f;
					        //rayProbability = specularChance;
					    } else if (refractionChance > 0.0f && raySelectRoll < specularChance + refractionChance) {
					        doRefraction = 1.0f;
					        //rayProbability = refractionChance;
					    } else {
					        //rayProbability = 1.0f - (specularChance + refractionChance);
					    }

						if(doSpecular > 0) {
							vec3 specular = reflect(direction, norm);
							direction = normalize(mix(specular, diffuse, hit.roughness*hit.roughness));
							energy *= hit.specular;
						} else if(doRefraction > 0) {
							vec3 n = hit.normal;
							origin -= norm * 2*EPSILON;

							vec3 refracted = refract(direction, n, 1/hit.ior);
							direction = normalize(mix(refracted, diffuse, hit.roughness*hit.roughness));
							energy *= hit.specular;
						} else {
							direction = diffuse;
							energy *= hit.albedo;
						}
						/*rayProbability = max(rayProbability, 0.001f);
						energy /= rayProbability;
						{
							float p = max(energy.r, max(energy.g, energy.b));
							if (RandomFloat01(rngState) > p)
								break;
							energy *= 1.0f / p;
						}*/
					} else {
						direction = normalize(mix(RandomUnitVector(rngState), direction, 0.2));
						energy *= vec3(0.7, 1.0, 0.8);
					}
				}
			} else {
				float sun = pow(max(dot(sunDir, normalize(direction)), 0), 64);
				return 0*(skyColor + sun * sunColor) * energy;
				//return energy * 0;
				vec3 skyCol = skyColor;
				skyCol *= skyCol * 1.5;
				return skyCol * 2 * energy;
			}
		}
		if(dot(energy,energy) < 0.1) return vec3(0);
		if(i < STEPS-1) hit = sendRay(origin, direction);
	}
	return energy * 0;
}

void main() {
    
	vec2 ScreenSpace = gl_FragCoord.xy / iResolution.xy;
	ScreenSpace.y = 1-ScreenSpace.y;
	vec4 Clip = vec4(ScreenSpace.xy * 2.0f - 1.0f, -1.0, 1.0);
	vec4 Eye = vec4(vec2(invProj * Clip), -1.0, 0.0);
	vec3 RayDirection = vec3(invView * Eye);
	vec3 RayOrigin = invView[3].xyz;
	RayDirection = normalize(RayDirection);

    int i = 0;
		
    for(; i<SAMPLES; i++) {
    	color.rgb += traceRay(RayOrigin, RayDirection);
    }
	color /= i;

    vec4 lastColor = texture(screenTexture, gl_FragCoord.xy / iResolution.xy).rgba;
    
    float blend = max(0.001, (lastColor.a == 0.0f || (spacePressed == 1)) ? 1.0f : 1.0f / (1.0f + 1.0f / lastColor.a));
    color.rgb = mix(lastColor.rgb, color.rgb, blend);
    
    color.a = blend;
}
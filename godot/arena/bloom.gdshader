shader_type canvas_item;
// BLOOM / HDR GLOW pasca-proses (padanan WorldEnvironment->Glow di Godot 2D):
// bright-pass + blur 12 tap pada screen texture, ditempel aditif — proyektil
// neon & bioluminesensi menyala tanpa blur canvas manual.
uniform sampler2D src : filter_linear;
uniform float threshold = 0.62;
uniform float amount = 0.0;
uniform vec2 texel = vec2(0.00078125, 0.00138889);

void fragment() {
	vec3 base = texture(src, UV).rgb;
	vec3 acc = vec3(0.0);
	float wsum = 0.0;
	for (int i = 0; i < 12; i++) {
		float ang = float(i) * 0.5235988;           // 12 tap melingkar
		vec2 off = vec2(cos(ang), sin(ang)) * texel * 6.0;
		vec3 s = texture(src, UV + off).rgb;
		float l = dot(s, vec3(0.299, 0.587, 0.114));
		float w = max(0.0, l - threshold);
		acc += s * w; wsum += w;
	}
	acc /= max(wsum, 1e-4);
	vec3 glow = max(vec3(0.0), acc - threshold * 0.35) * amount;
	COLOR = vec4(base + glow, 1.0);
}

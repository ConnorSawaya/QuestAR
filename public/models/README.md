# Models

Place your 3D model here:

```text
public/models/animal.glb
```

The WebXR scene loads `/models/animal.glb` with Three.js `GLTFLoader`.

If this file is missing, the main AR scene creates a small low-poly fallback animal with Three.js geometry so the demo still runs.

Use optimized mobile-friendly models when possible:

- Prefer `.glb`.
- Keep file size small.
- Use compressed textures.
- Keep polygon count reasonable for phones.

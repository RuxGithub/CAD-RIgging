import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export function loadModel({ url, dracoPath = './node_modules/three/examples/jsm/libs/draco/' }) {
  return new Promise((resolve, reject) => {
    if (!url) {
      reject(new Error('No model URL provided'));
      return;
    }

    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(dracoPath);
    dracoLoader.setDecoderConfig({ type: 'wasm' });
    loader.setDRACOLoader(dracoLoader);

    loader.load(
      url,
      (gltf) => resolve(gltf),
      undefined,
      (err) => reject(err),
    );
  });
}


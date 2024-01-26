import * as THREE from 'three';
//import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import * as SCENES from '../Scenes.js';

let timeoutId;

export async function boot(engine) {

    /*
    const pmremGenerator = new THREE.PMREMGenerator( engine.renderer );
    const hdriLoader = new RGBELoader();
    hdriLoader.load(`./frames/assets/hdris/stuttgart_hillside_1k.hdr`, function (texture) {
        const envMap = pmremGenerator.fromEquirectangular(texture).texture;
        texture.dispose();
        scene.environment = envMap
    });
    */

    let scene = await new THREE.Scene();
    scene.name = `boot`;
    scene.transitionIn = `radialFadeIn`;
    scene.transitionOut = `radialFadeOut`;

    let logo, cyan, magenta, mixer;

    [
        logo,
        cyan,
        magenta
    ] = [
        await engine.loadGlb(
            './frames/assets/eclectic-logo.glb',
            async function(gltf) {
                await gltf.scene.traverse(async function(child) {
                    child.frustumCulled = false;
                    if(child.isMesh) {
                        //console.log(child.name);
                        //if(child.name.includes("karisa-happy-halloween")) happyHalloweenTicker = child;
                        //if(child.name.includes("look-at-how-cute-we-are")) lookAtUsTicker = child;
                    }
                });
                gltf.scene.animations = await gltf.animations;
            }
        ),
        await new THREE.PointLight('rgb(0, 240, 240)', 50.1),
        await new THREE.PointLight('rgb(240, 0, 240)', 50.1)
    ];
    mixer = await new THREE.AnimationMixer(logo);
    await cyan.position.set(9, 0, 3);
    await magenta.position.set(-9, 0, 3);

    logo.animations.forEach(function(clip) {
        mixer.clipAction(clip).play();
    });

    await scene.add(logo, cyan, magenta);

    await engine.camera.position.set(logo.position.x, logo.position.y, logo.position.z + 9);
    await engine.camera.lookAt(logo.position.x, logo.position.y, logo.position.z);

    scene.update = function() {
        if(mixer) mixer.update(0.03);
    }
    
    scene.cleanup = async function() {
        //The implementation of timeouts is unpredictable, so we will clear the timeout created earlier using its id to prevent possible errors.
        clearTimeout(timeoutId);
        await scene.traverse(async function(obj) {
            if(obj instanceof THREE.Mesh) {
                await obj.geometry.dispose();
                await obj.material.dispose();
                await scene.remove(obj);
            }
        });
    }

    //Store the id so that it can be cleared later.
    timeoutId = setTimeout(async function() {
        await engine.renderScene(SCENES.romanticDinner);
    }, 7000);

    return(scene);
}
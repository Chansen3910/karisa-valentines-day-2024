import * as THREE from 'three';
import * as SCENES from '../Scenes.js';
import ControlsManager from '../ControlsManager.js';

let timeoutId;

export async function boot(engine) {

    let scene = await new THREE.Scene();
    scene.name = `boot`;
    scene.transitionIn = `radialFadeIn`;
    scene.transitionOut = `radialFadeOut`;

    let logo, cyan, magenta, mixer;
    let controls = new ControlsManager(engine);

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



    controls.setUpdateOnPressed(function() {
        if(controls.keyStates.has(`Escape`)) {
            engine.renderScene(SCENES.enter);
        }
        if(controls.keyStates.has(` `)) {
            engine.renderScene(SCENES.romanticDinner);
        }
        if(controls.keyStates.has(`Enter`)) {
            engine.renderScene(SCENES.romanticDinner);
        }
    });



    scene.update = function() {
        controls?.update();

        if(mixer) mixer.update(0.03);
    }
    
    scene.cleanup = async function() {
        clearTimeout(timeoutId);

        controls.flush();
        controls.destroy();

        await scene.traverse(async function(obj) {
            if(obj instanceof THREE.Mesh) {
                await obj.geometry.dispose();
                await obj.material.dispose();
                await scene.remove(obj);
            }
        });
    }

    timeoutId = setTimeout(async function() {
        await engine.renderScene(SCENES.romanticDinner);
    }, 7000);

    return(scene);
}
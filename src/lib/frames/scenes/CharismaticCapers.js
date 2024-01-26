import * as THREE from 'three';
import * as SCENES from '../Scenes.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import ControlsManager from '../ControlsManager.js';
import { ClassicChaseCamera } from '../ClassicChaseCamera.js';

let audio;
let startPosition = {
    position: {
        x: 0,
        y: 0,
        z: 0
    },
    rotation: {
        x: 0,
        y: 0,
        z: 0
    }
};

export async function charismaticCapers(engine) {

    const pmremGenerator = new THREE.PMREMGenerator( engine.renderer );
    const hdriLoader = new RGBELoader();
    hdriLoader.load(`./frames/assets/hdris/autumn_forest_04_1k.hdr`, function(texture) {
        const envMap = pmremGenerator.fromEquirectangular(texture).texture;
        texture.dispose();
        scene.environment = envMap;
    });



    let scene = await new THREE.Scene();
    scene.name = `Charismatic Capers`;
    scene.transitionIn = `fadeIn`;
    scene.transitionOut = `fadeOut`;
    scene.background = new THREE.Color(`rgb(255, 180, 255)`);



    let controls = new ControlsManager(engine);
    let karisa;
    let map;
    let mixer;
    let chaser;

    karisa = await engine.loadGlb(
        './frames/assets/karisa-archer.glb',
        async function(gltf) {
            await gltf.scene.traverse(async function(child) {
                child.frustumCulled = false;
                if(child.isLight) {
                    child.castShadow = true;
                }
                if(child.isMesh) {
                    //console.log(child.name);
                    //if(child.name.includes("karisa-happy-halloween")) happyHalloweenTicker = child;
                    //if(child.name.includes("look-at-how-cute-we-are")) lookAtUsTicker = child;
                }
            });
            gltf.scene.animations = await gltf.animations;
        }
    );
    map = await engine.loadGlb(
        './frames/assets/charismatic-capers-map.glb',
        async function(gltf) {
            await gltf.scene.traverse(async function(child) {
                child.frustumCulled = false;
                if(child.isLight) {
                    child.castShadow = true;
                }
                if(child.isMesh) {
                    //console.log(child.name);
                    //if(child.name.includes("karisa-happy-halloween")) happyHalloweenTicker = child;
                    //if(child.name.includes("look-at-how-cute-we-are")) lookAtUsTicker = child;
                }
            });
            gltf.scene.animations = await gltf.animations;
        }
    );
    await scene.add(karisa, map);
    await karisa.position.set(startPosition.position.x, startPosition.position.y, startPosition.position.z);
    await karisa.position.set(0, 1.3, 0);

    chaser = new ClassicChaseCamera(engine.camera, karisa);



    mixer = await new THREE.AnimationMixer(karisa);
    karisa.animations.forEach(function(clip) {
        mixer.clipAction(clip).play();
    });

    //await engine.camera.position.set(karisa.position.x, karisa.position.y + 5, karisa.position.z + 5);
    //await engine.camera.lookAt(karisa.position.x, karisa.position.y + 3, karisa.position.z);



    /*
    "Feathered Fantasy I: Karisa's Charismatic Capers"

    "Feathered Fantasy: Bow of Whimsy"
    "Valentine Voyage: Turkey Trails"
    "Lovebird Lanes: Cupid's Carnival"
    "Quirky Quiver: Heart's Delight"
    "Arrow Arcade: Cozy Cupid Capers"
    "Turkey Tidings: Love's Play"
    "Whimsical Wings: Heartbeat Hoopla"
    "Valentine's Vista: Bow Bliss"
    "Heartfelt Heights: Turkey Triumph"
    "Cherished Chase: Amour Afloat"
    */



    controls.setUpdateOnPressed(function() {
        if(controls.keyStates.has(`Escape`)) {
            engine.renderScene(SCENES.enter);
        }
        if(controls.keyStates.has(`w`)) {
            karisa.translateZ(0.6);
        }
        if(controls.keyStates.has(`s`)) {
            karisa.translateZ(-0.4);
        }
        if(controls.keyStates.has(`Shift`)) {
            //karisa.translateY(-0.8);
            console.log(karisa.position);
        }
        if(controls.keyStates.has(` `)) {
            //karisa.translateY(0.8);
        }
        if(controls.keyStates.has(`a`)) {
            if(!controls.keyStates.has(`w`)) {
                karisa.translateZ(0.06);
                karisa.rotation.y += (0.2);
            }
            if(controls.keyStates.has(`w`)) {
                karisa.rotation.y += (0.15);
            }
            if(controls.keyStates.has(`Shift`)) {
                //karisa.translateY(-0.8);
            }
            if(controls.keyStates.has(` `)) {
                //karisa.translateY(0.8);
            }
        }
        if(controls.keyStates.has(`d`)) {
            if(!controls.keyStates.has(`w`)) {
                karisa.translateZ(0.06);
                karisa.rotation.y += (-0.2);
            }
            if(controls.keyStates.has(`w`)) {
                karisa.rotation.y += (-0.15);
            }
            if(controls.keyStates.has(`Shift`)) {
                //karisa.translateY(-0.8);
            }
            if(controls.keyStates.has(` `)) {
                //karisa.translateY(0.8);
            }
        }

        if(karisa.position.z > 239) karisa.position.z = 239;
        if(karisa.position.z < -239) karisa.position.z = -239;
        if(karisa.position.x > 239) karisa.position.x = 239;
        if(karisa.position.x < -239) karisa.position.x = -239;
    });



    scene.onBeginRender = function() {
        audio.play();
        //engine.uiElement.appendChild(mainDiv);
    }

    scene.update = function() {

        //Animation
        if(mixer) mixer.update(0.05);

        //Controls
        controls?.update();

        //Chase camera update
        chaser?.update();

    }

    scene.cleanup = async function() {
        //Stop audio
        if(!audio.paused) {
            audio.pause();
            audio.currentTime = 0;
        }

        //Flush controls
        controls.flush();
        controls.destroy();

        //Destroy UI template
        let element;
        while(element = engine.uiElement.firstChild) {
            engine.uiElement.removeChild(element);
        }

        //Clear meshes and materials.
        await scene.traverse(async function(obj) {
            if(obj instanceof THREE.Mesh) {
                await obj.geometry.dispose();
                await obj.material.dispose();
                await scene.remove(obj);
            }
        });
    }

    audio = await new Audio(`./frames/assets/Harvest-Moon-Hero-of-Leaf-Valley-Spring.mp3`);
    audio.onended = async function() {
        //await engine.renderScene(SCENES.boot);
        audio.play();
    };

    return(scene);
}

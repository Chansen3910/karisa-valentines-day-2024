import * as THREE from 'three';
import * as SCENES from '../Scenes.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import ControlsManager from '../ControlsManager.js';
import { ClassicChaseCamera } from '../ClassicChaseCamera.js';
import { FastIndex } from '../FastIndex.js';

let audio;
let meshes = {
    water: [],
    waterfall: []
};



export async function charismaticCapers(engine) {

    let active = true;
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
    let subject;
    let map;
    let collisionMesh;
    let ball;
    let mixer;
    let chaser;

    subject = await engine.loadGlb(
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
                    if(
                        (child.name == `water-1`) ||
                        (child.name == `water-2`) ||
                        (child.name == `water-3`)
                    ) {
                        meshes.water.push(child);
                    }else if(
                        (child.name == `waterfall-1`) ||
                        (child.name == `waterfall-2`) ||
                        (child.name == `river`)
                    ) {
                        meshes.waterfall.push(child);
                    }
                    //if(child.name.includes("karisa-happy-halloween")) happyHalloweenTicker = child;
                    //if(child.name.includes("look-at-how-cute-we-are")) lookAtUsTicker = child;
                }
            });
            gltf.scene.animations = await gltf.animations;
        }
    );
    collisionMesh = await engine.loadGlb(
        './frames/assets/charismatic-capers-collision-mesh.glb',
        async function(gltf) {
            await gltf.scene.traverse(async function(child) {
                child.frustumCulled = false;
            });
            gltf.scene.animations = await gltf.animations;
        }
    );
    ball = await engine.loadGlb(
        './frames/assets/ball.glb',
        async function(gltf) {
            await gltf.scene.traverse(async function(child) {
            });
            gltf.scene.animations = await gltf.animations;
        }
    );
    await scene.add(subject, map, ball);

    chaser = new ClassicChaseCamera(engine.camera, subject);



    mixer = await new THREE.AnimationMixer(subject);
    subject.animations.forEach(function(clip) {
        mixer.clipAction(clip).play();
    });

    /*
    "Feathered Fantasy I: Karisa's Charismatic Capers"

    "Feathered Fantasy: Bow of Whimsy"
    "Valentine Voyage: Turkey Trails"
    "Lovebird Lanes: Cupid's Carnival"
    "Quirky Quiver: Heart's Delight"
    "Arrow Arcade: Karisa Cupid Capers"
    "Turkey Tidings: Love's Play"
    "Whimsical Wings: Heartbeat Hoopla"
    "Valentine's Vista: Bow Bliss"
    "Heartfelt Heights: Turkey Triumph"
    "Cherished Chase: Amour Afloat"
    */

    controls.setOnWheelUp(function(e) {
        chaser.wheel(e.wheelDelta);
    });
    controls.setOnWheelDown(function(e) {
        chaser.wheel(e.wheelDelta);
    });

    controls.setUpdateOnPressed(function() {
        if(active) {
            //escape
            if(controls.keyStates.has(`27`)) {
                active = false;
                engine.renderScene(SCENES.enter);
            }
            //w
            if(controls.keyStates.has(`87`)) {
                subject.translateZ(0.6);
            }
            //s
            if(controls.keyStates.has(`83`)) {
                subject.translateZ(-0.4);
            }
            //shift
            if(controls.keyStates.has(`16`)) {
                subject.translateY(-0.8);
                //console.log(subject.position);
            }
            //space
            if(controls.keyStates.has(`32`)) {
                subject.translateY(0.8);
            }
            //a
            if(controls.keyStates.has(`65`)) {
                //w
                if(!controls.keyStates.has(`87`)) {
                    subject.translateZ(0.06);
                    subject.rotation.y += (0.2);
                }
                //w
                if(controls.keyStates.has(`87`)) {
                    subject.rotation.y += (0.15);
                }
                //shift
                if(controls.keyStates.has(`16`)) {
                    //subject.translateY(-0.8);
                }
                //space
                if(controls.keyStates.has(`32`)) {
                    //subject.translateY(0.8);
                }
            }
            //d
            if(controls.keyStates.has(`68`)) {
                //w
                if(!controls.keyStates.has(`87`)) {
                    subject.translateZ(0.06);
                    subject.rotation.y += (-0.2);
                }
                //w
                if(controls.keyStates.has(`87`)) {
                    subject.rotation.y += (-0.15);
                }
                //shift
                if(controls.keyStates.has(`16`)) {
                    //subject.translateY(-0.8);
                }
                //space
                if(controls.keyStates.has(`32`)) {
                    //subject.translateY(0.8);
                }
            }
        }

        if(subject.position.z > 239) subject.position.z = 239;
        if(subject.position.z < -239) subject.position.z = -239;
        if(subject.position.x > 239) subject.position.x = 239;
        if(subject.position.x < -239) subject.position.x = -239;
    });



    scene.onBeginRender = function() {
        audio.play();
        //engine.uiElement.appendChild(mainDiv);
    }



    let fast = new FastIndex(collisionMesh);
    await fast.populate();

    scene.update = function() {
        //UV animations
        meshes.water.forEach(function(value, index, array) {
            value.material.map.offset.y += 0.001;
            value.material.map.offset.x += 0.002;
        });
        meshes.waterfall.forEach(function(value, index, array) {
            value.material.map.offset.y -= 0.01;
        });

        //Animation
        mixer?.update(0.05);

        
        let previous = new THREE.Vector3(
            subject.position.x,
            subject.position.y,
            subject.position.z
        );

        //Controls set new player position
        controls?.update();

        fast.floor(previous, subject, ball);

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
        audio.currentTime = 11;
        audio.play();
    };

    return(scene);
}

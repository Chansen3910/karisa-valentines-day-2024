import * as THREE from 'three';
import * as SCENES from '../Scenes.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import ControlsManager from '../ControlsManager.js';

let audio;
let completePlayback = false;

export async function romanticDinner(engine) {

    const pmremGenerator = new THREE.PMREMGenerator( engine.renderer );
    const hdriLoader = new RGBELoader();
    hdriLoader.load(`./frames/assets/hdris/satara_night_4k.hdr`, function(texture) {
        const envMap = pmremGenerator.fromEquirectangular(texture).texture;
        texture.dispose();
        scene.environment = envMap;
    });



    let scene = await new THREE.Scene();
    scene.name = `Romantic Dinner`;
    scene.transitionIn = `fadeIn`;
    scene.transitionOut = `fadeOut`;



    let controls = new ControlsManager(engine);
    let romanticDinner;
    let candles = [];
    let mixer;

    const listener = await new THREE.AudioListener();
    await scene.add(listener);

    romanticDinner = await engine.loadGlb(
        './frames/assets/romantic-dinner.glb',
        async function(gltf) {
            await gltf.scene.traverse(async function(child) {
                child.frustumCulled = false;
                if(child.isLight && child.name.includes("candle")) {
                    child.castShadow = true;
                    candles.push(child);
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
    await scene.add(romanticDinner);



    mixer = await new THREE.AnimationMixer(romanticDinner);
    romanticDinner.animations.forEach(function(clip) {
        mixer.clipAction(clip).play();
    });

    await engine.camera.position.set(romanticDinner.position.x, romanticDinner.position.y + 5, romanticDinner.position.z + 5);
    await engine.camera.lookAt(romanticDinner.position.x, romanticDinner.position.y + 3, romanticDinner.position.z);



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

    let mainDiv = document.createElement('div');
    mainDiv.className = 'w-100 h-100 col evenly unselectable';

    let titleDiv = document.createElement(`div`);
    titleDiv.className = `w-100 col center unselectable`;
    let titleA = document.createElement('h1');
    titleA.textContent = `Feathered Fantasy I:`;
    titleA.style.fontSize = `50px`;
    let titleB = document.createElement('h2');
    titleB.textContent = `Karisa's Charismatic Capers`;
    titleB.style.fontSize = `30px`;
    titleDiv.appendChild(titleA);
    titleDiv.appendChild(titleB);

    let pressStartDiv = document.createElement('div');
    pressStartDiv.className = `w-100 col center`;
    let pressStart = document.createElement('span');
    pressStart.className = `unselectable finger`;
    pressStart.style.fontSize = `20px`;
    pressStart.textContent = `PRESS START`;
    pressStart.onclick = function() {
        engine.renderScene(SCENES.enter);
    }
    pressStartDiv.appendChild(pressStart);

    mainDiv.appendChild(titleDiv);
    mainDiv.appendChild(pressStartDiv);



    controls.setOnWheelUp(function(e) {
        engine.camera.position.z -= 0.2;
    });
    controls.setOnWheelDown(function(e) {
        engine.camera.position.z += 0.2;
    });



    scene.onBeginRender = function() {
        audio.play();
        engine.uiElement.appendChild(mainDiv);
    }

    let time = 0;
    scene.update = function() {

        //Candle light intensity modulation.
        candles[0].intensity = Math.sin(time) * 0.2 + 0.3;
        candles[1].intensity = Math.sin(time + (Math.PI)) * 0.2 + 0.3;
        time += Math.PI / 15;

        //Rotation of scene
        romanticDinner.rotation.y -= 0.01;

        //Animation
        if(mixer) mixer.update(0.05);

        //Look at the center of the scene.
        engine.camera.lookAt(romanticDinner.position.x, romanticDinner.position.y + 3, romanticDinner.position.z);
    }
    
    scene.cleanup = async function() {
        //Stop audio
        if(!audio.paused) {
            audio.pause();
            audio.currentTime = 0;
        }

        //Flush controls
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

    audio = await new Audio(`./frames/assets/Animal-Crossing-Title-Theme.mp3`);
    audio.onended = async function() {
        await engine.renderScene(SCENES.boot);
    };

    return(scene);
}

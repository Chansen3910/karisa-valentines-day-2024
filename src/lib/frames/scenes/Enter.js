import * as THREE from 'three';
import * as SCENES from '../Scenes.js';

export async function enter(engine) {

    let scene = await new THREE.Scene();
    scene.background = await new THREE.Color('rgb(0, 0, 0)');
    scene.name = `enter`;
    scene.transitionIn = `fadeIn`;
    scene.transitionOut = `fadeOut`;

    let logo, mixer;

    let mainDiv = document.createElement('div');
    mainDiv.className = 'col center unselectable';

    let innerDiv = document.createElement('div');
    innerDiv.style.paddingLeft = '20px';
    innerDiv.style.paddingRight = '20px';
    innerDiv.style.borderRadius = '12px';
    innerDiv.style.backgroundColor = 'rgba(12, 12, 36, 0.7)';
    innerDiv.className = 'col center between';

    let heading = document.createElement('h2');
    heading.style.margin = '12px';
    heading.textContent = 'Audio Advisory';

    let paragraph = document.createElement('p');
    paragraph.style.fontStyle = 'italic';
    paragraph.style.width = '300px';
    paragraph.style.wordWrap = 'break-word';
    paragraph.style.textAlign = 'center';
    paragraph.innerHTML = 'This scene requires audio to play.<br /><br />Please ensure that you have control of your audio device before continuing.';

    let button = document.createElement('input');
    button.type = 'button';
    button.style.padding = '3px 7px 3px 7px';
    button.style.margin = '20px';
    button.style.minWidth = '70px';
    button.style.textAlign = 'center';
    button.style.fontWeight = 'bold';
    button.className = 'col center finger';
    button.value = 'Enable audio';
    button.onclick = function() {
        engine.renderScene(SCENES.charismaticCapers);
    }

    innerDiv.appendChild(heading);
    innerDiv.appendChild(paragraph);
    innerDiv.appendChild(button);

    mainDiv.appendChild(innerDiv);

    [
        logo,
    ] = [
        await engine.loadGlb('./frames/assets/KKVDC.glb'),
    ];
    mixer = await new THREE.AnimationMixer(logo);

    logo.animations.forEach(function(clip) {
        mixer.clipAction(clip).play();
    });

    await scene.add(logo);

    await engine.camera.position.set(logo.position.x, logo.position.y, logo.position.z + 3);
    await engine.camera.lookAt(logo.position.x, logo.position.y, logo.position.z);

    scene.onBeginRender = function() {
        engine.uiElement.appendChild(document.createElement('div'));
        engine.uiElement.appendChild(mainDiv);
        engine.uiElement.appendChild(document.createElement('div'));
    }

    let i = 0;
    scene.update = function() {
        i += 0.01;
        if(i > 3.14) i = 0;
        if(mixer) mixer.update(0.03);
        if(logo) logo.rotation.y = i * 2;
        scene.background = new THREE.Color(`hsl(267, 100%, ${ (Math.sin(i) / Math.sin(1)) * 100 }%)`);
        //if(((i >> 0) % 2) == 0) logo.rotation.z = 0.5 * (Math.sin((2 - i) * 24));
        //else logo.rotation.z = 0;
        engine.camera.position.z = 2 - (Math.sin(i * 2) * 1.5);
    }
    
    scene.cleanup = async function() {
        let element;
        while(element = engine.uiElement.firstChild) {
            engine.uiElement.removeChild(element);
        }
        await scene.traverse(async function(obj) {
            if(obj instanceof THREE.Mesh) {
                await obj.geometry.dispose();
                await obj.material.dispose();
                await scene.remove(obj);
            }
        });
    }

    return(scene);
}
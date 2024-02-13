<script>
    import * as THREE from 'three';
    import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

    import '$lib/global.css';
    import { onMount } from "svelte";

    let ctrElement;
    let ctrHeight;
    let ctrWidth;

    let windowWidth;
    let windowHeight;
    let mouseX = 0;
    let mouseY = 0;

    let viewerElement;
    let renderer;
    let camera;
    let scene;
    let loader = new THREE.GLTFLoader();
    let logo;

    onMount(function() {
        ctrElement = document.getElementById(`container`);
        onResize({});

        renderer = new THREE.WebGLRenderer({
            alpha: false,
            antialias: true,
            gammaInput: true,
            gammaOutput: true
        });
        viewerElement.appendChild(renderer.domElement);
        renderer.setSize(viewerElement.clientWidth, viewerElement.clientHeight);
        camera = new THREE.PerspectiveCamera(45, viewerElement.clientWidth / viewerElement.clientHeight, 0.01, 1000);
        scene = new THREE.Scene();
        romanticDinner = loadGlb(
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
        ).then(function() {
            scene.add(romanticDinner);
            
        });
    });

    async function loadGlb(url, processCallback = function(){}) {
        return new Promise(async function(resolve, reject) {
            //remember: 'that' is now referencing the class instance here. 'this' is redefined in the promise function execution scope and will return undefined.
            await loader.load(url, async function(gltf) {
                await processCallback(gltf);
                resolve(await gltf.scene);
            }, undefined, async function(error) {
                console.error(error);
                reject(error);
            });
        });
    }

    function onResize(e) {
        ctrHeight = ctrElement.offsetHeight;
        ctrWidth = ctrElement.offsetWidth;

        if(renderer) renderer.setSize(viewerElement.offsetWidth, viewerElement.offsetHeight);
        if(camera) {
            camera.aspect = viewerElement.offsetWidth / viewerElement.offsetHeight;
            camera.updateProjectionMatrix();
        }
    }

    function onMouseMove(e) {
        mouseX = e.clientX;
        mouseY = e.clientY;
    }
</script>

<svelte:options customElement="sc-cmp" />
<svelte:window
    bind:innerWidth={ windowWidth }
    bind:innerHeight={ windowHeight }
    on:resize={ onResize }
    on:mousemove={ onMouseMove }/>

<div bind:this={ viewerElement } style="display:flex;flex-direction:column;align-items:center;border:1px solid white;width:{ ctrWidth * 0.7 }px;aspect-ratio:4/3;">
    <span>height: { ctrHeight }px</span>
    <span>width: { ctrWidth }px</span>
    <span>mouse position: ({ mouseX }, { mouseY })</span>
    <span>mouse percentage: ({ ((mouseX / windowWidth) - 0.50) * 2 }, { ((mouseY / windowHeight) - 0.50) * 2 })</span>
</div>

<style>
    

    #viewer {
    }
</style>

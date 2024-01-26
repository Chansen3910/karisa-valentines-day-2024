<script>
    import { onDestroy, onMount, tick } from 'svelte';
    import * as RDR from './Renderer.js';
    import * as TNS from './Transitioner.js';
    import * as UI from './UserInterface.js';

    export let vh;
    export let vw;
    let screenHeight;
    let screenWidth;
    //export let aspectRatio = `4/3`;
    //export let supportedAspectRatios = `4/3`;
    export let scene = `enter`;

    let container, screen, filter, ui;
    let sceneManager;

    onMount(function() {
        //Obtain references of required elements.
        screen = document.getElementById(`screen`);
        filter = document.getElementById(`filter`);
        ui = document.getElementById(`ui`);
        container = document.getElementById(`container`);

        //Initialize a SceneManager instance and play the stored scene of the given string index.
        sceneManager = new RDR.SceneManager(container, screen, ui, filter);

        onResize();

        sceneManager.play(scene);
    });

    onDestroy(function() {
        sceneManager.destroy();
    });

    async function onResize(e) {
        await tick();
        let newHeight;
        let newWidth;

        if((vw / vh) >= 1) {
            //LANDSCAPE
            sceneManager.portraitMode = false;
            newHeight = vh;
            newWidth = (vh * 1.25);
            if(newWidth >= vw) {
                newWidth = vw;
                newHeight = (vw * 0.75);
            }
        }else {
            //PORTRAIT
            sceneManager.portraitMode = true;
            newHeight = (vw * 1.25);
            newWidth = vw;
            if(newHeight >= vh) {
                newHeight = vh;
                newWidth = (vh * .75);
            }
        }

        container.style.height = `${ newHeight - 12 }px`;
        container.style.width = `${ newWidth - 12 }px`;
        await tick();

        await sceneManager.onWindowResize(e);
        await tick();
    }

    const onDeviceOrientation = async function(e) {
        console.log(`${e.alpha} : ${e.beta} : ${e.gamma}`);
    }
</script>

<svelte:window
    bind:innerHeight={ vh }
    bind:innerWidth={ vw }
    on:resize={ onResize } />

<div id="container" class="col center">
    <div tabindex="-1" id="screen" class="col center" bind:offsetHeight={ screenHeight } bind:offsetWidth={ screenWidth }>

        <div id="ui" class="h-100 col center between"></div>

        <div id="filter" class="col center"></div>
    </div>
</div>

<style>
    * {
        outline: none;
        border: none;
    }
    #container {
        background-color: rgba(0, 0, 0, 0.0);

        box-sizing: border-box;
    }

    #screen {
        position: relative;
    }

    #ui {
        width: 100%;
        height: 100%;

        pointer-events: all;
        position: absolute;
        z-index: 1;
    }

    #filter {
        width: 100%;
        height: 100%;

        background-color: rgba(0, 0, 0, 0.0);

        pointer-events: none;

        position: absolute;
        z-index: 2;
    }
</style>



<!--
/*
let setCurrentAspectRatio = function() {
    if(width || height) {
        //if height or width is provided, use first valid aspect ratio, default 4/3.
        
    }else {
        let vh = window.innerHeight;
        let vw = window.innerWidth;
        let viewportAspectRatio = vw / vh;
        console.log(`Viewport aspect ratio: `, viewportAspectRatio);
        
        //set to the minimal bound of the viewport for the given aspect ratio.
        if(vh < vw) {
            //constrained by viewport height
        }else {
            //constrained by viewport width
        }
        screen.style.width = `100%`;
    }
};

let calculateSupportedAspectRatios = function() {
    //Calculate all provided supported aspect ratios.
    supportedAspectRatios = (supportedAspectRatios.split(" "));
    supportedAspectRatios.forEach(function(value, index, array) {
        let str = value.replace(/[,]+/g, " ").trim();
        if(str.includes("/")) {
            let coefficients = str.split("/");
            array[index] = coefficients[0] / coefficients[1];
        }else if(!isNaN(str) && (((Number)(str)) > 0.0)) {
            array[index] = (Number)(str);
        }else {
            array.splice(index, 1);
        }
    });

    //Set the current aspect ratio.
}
*/
-->

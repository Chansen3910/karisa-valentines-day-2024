//this module catches io events for controls across all scenes in an F3 application.
//each scene implements per-key functions, which are flushed when the scene ends.

/*
    The use case for this class as opposed to handling controls in each respective scene is to implement them programmatically in such a way
    that the controls have access to the appropriate contexts and prevent destroying a scene while it is running. The renderer also uses these 
    methods to enable and disable controls automatically at just the right time, as well as keep the eventlisteners managed efficiently.

    NOTE: All of the individual actions are located in the keyUps and keyDowns objects
*/

//This class is instantiated as a member of Renderer.
//The controls are set and cleaned per scene, allowing controls class constructor methods to be passed in as well as dynamic switching between controls.
export default class ControlsManager {

    engine;

    //The callback references attached to eventlisteners must be stored at the time they are attached so they can be properly matched and removed at the end of the scene.
    #mouseUpCallbackReference;
    #mouseDownCallbackReference;
    #mouseMoveCallbackReference;
    #mouseOutCallbackReference;
    #touchCallbackReference;
    #wheelCallbackReference;
    #keyDownCallbackReference;
    #keyUpCallbackReference;

    //The individual keyup and keydown functions are stored in json to save performance with O(1) bracket notation key value retrieval.
    keyDowns = {};
    keyUps = {};

    //The keyStates Set should only be used to coalesce the states of keys. This is to keep event actions consistent and prevent the
    //idiosyncrasies and any possible inconsistent event loop implementations across browsers.
    keyStates = new Set();

    constructor(engine) {
        this.engine = engine;

        //add option, mousemove, drag, drop, etc
        this.engine.screenElement.addEventListener('mouseup', this.#mouseUpCallbackReference = this.onMouseUp.bind(this), false);
        this.engine.screenElement.addEventListener('mousedown', this.#mouseDownCallbackReference = this.onMouseDown.bind(this), false);
        this.engine.screenElement.addEventListener('mousemove', this.#mouseMoveCallbackReference = this.onMouseMove.bind(this), false);
        this.engine.screenElement.addEventListener('mouseout', this.#mouseOutCallbackReference = this.onMouseOut.bind(this), false);
        this.engine.screenElement.addEventListener('touch', this.#touchCallbackReference = this.onTouch.bind(this), false);
        this.engine.screenElement.addEventListener('wheel', this.#wheelCallbackReference = this.onMouseWheel.bind(this), { passive: true });
        this.engine.screenElement.addEventListener('keydown', this.#keyDownCallbackReference = this.onKeyDown.bind(this), false);
        this.engine.screenElement.addEventListener('keyup', this.#keyUpCallbackReference = this.onKeyUp.bind(this), false);
    }

    nullishKey(e) {
        //console.log(`NULLISH KEY ${e.key} (key does not appear in this context's set)`);
    }

    //this function flushes all the exported functions called by controls.
    flush() {
        //Set these functions to the default of accepting and returning the event parameter.
        this.setOnMouseUp((e) => e);
        this.setOnMouseDown((e) => e);
        this.setOnMouseMove((e) => e);
        this.setOnMouseOut((e) => e);
        this.setOnWheelUp((e) => e);
        this.setOnWheelDown((e) => e);
        this.setUpdateOnPressed((e) => e);
        //Empty the keyUps and keyDowns objects.
        this.keyUps = {};
        this.keyDowns = {};
    }

    //These functions are the setter hooks for implementing per-scene controls dynamically.
    //THESE functions actually implement the ACTIONS of the keys. NOT THE KEYSTATES SET.
    setOnMouseUp(fxn) {
        this.mouseUp = fxn;
    }
    setOnMouseDown(fxn) {
        this.mouseDown = fxn;
    }
    setOnMouseMove(fxn) {
        this.mouseMove = fxn;
    }
    setOnMouseOut(fxn) {
        this.mouseOut = fxn;
    }
    setOnTouch(fxn) {
        this.onTouch = fxn;
    }
    setOnWheelUp(fxn) {
        this.wheelUp = fxn;
    }
    setOnWheelDown(fxn) {
        this.wheelDown = fxn;
    }
    setUpdateOnPressed(fxn) {
        this.updateOnPressed = fxn;
    }
    setKeyUp(key, fxn) {
        this.keyUps[`${key}`] = fxn;
    }
    setKeyUps(object) {
        this.keyUps = object;
    }
    setKeyDown(key, fxn) {
        this.keyDowns[`${key}`] = fxn;
    }
    setKeyDowns(object) {
        this.keyDowns = object;
    }
    //updateOnPressed is unique in that it allows you to, for example, set cascading controls at the cost of some performance.
    //Such a use case as this given example is for character movement. Each key becomes hierarchal and certain keys may cancel the action or combine actions.
    updateOnPressed() {}

    //the following functions are overridden in each scene using exported setter functions.
    mouseUp(e) {}
    mouseDown(e) {}
    mouseMove(e) {}
    mouseOut(e) {}
    touch(e) {}
    wheelUp(e) {}
    wheelDown(e) {}
    
    //These functions may seem needless at first glance, but they exist to refine the handling of events in an efficient and optimizable way.
    //We also gain the ability to set "parent" events, coalesce specific event types, or preventDefaults / etc if we please.
    //We are separating the actions that individuals keys may take from the events themselves.
    //This is essentially an event callback proxy.
    onMouseUp(e) {
        if(!this.engine.isActive()) return;
        this.mouseUp(e);
    }
    onMouseDown(e) {
        if(!this.engine.isActive()) return;
        this.mouseDown(e);
    }
    onMouseMove(e) {
        if(!this.engine.isActive()) return;
        this.mouseMove(e);
    }
    onMouseOut(e) {
        if(!this.engine.isActive()) return;
        this.mouseOut(e);
    }
    onTouch(e) {
        if(!this.engine.isActive()) return;
        this.touch(e);
    }
    onMouseWheel(e) {
        if(!this.engine.isActive()) return;
        (e.deltaY < 0)? (this.wheelUp(e)): (this.wheelDown(e));
    }
    onKeyUp(e) {
        //If the key is currently pressed down (present in the keyStates set), remove it from the set (indicating that it is no longer pressed).
        if(this.keyStates.has(`${e.key}`)) this.keyStates.delete(`${e.key}`);
        
        //If there is a callback set to handle this particular keyUp event (on this key), call it; otherwise, defer the action to the nullishKey function of this context.
        if(this.engine.isActive()) (this.keyUps[`${e.key}`] ?? this.nullishKey)(e);
    }
    onKeyDown(e) {
        //If the key is not present in the keyStates set (indicating that it is not pressed), add it to the set (indicating that it is being pressed).
        if(!this.keyStates.has(`${e.key}`)) this.keyStates.add(`${e.key}`);
        
        //If there is a callback set to handle this particular keyDown event (on this key), call it; otherwise, defer the action to the nullishKey function of this context.
        if(this.engine.isActive()) (this.keyDowns[`${e.key}`] ?? this.nullishKey)(e);
    }
    update() {
        if(!this.engine.isActive()) return;
        this.updateOnPressed();
    }
    destroy() {
        this.engine.screenElement.removeEventListener('mouseup', this.#mouseUpCallbackReference);
        this.engine.screenElement.removeEventListener('mousedown', this.#mouseDownCallbackReference);
        this.engine.screenElement.removeEventListener('mousemove', this.#mouseMoveCallbackReference);
        this.engine.screenElement.removeEventListener('mouseout', this.#mouseOutCallbackReference);
        this.engine.screenElement.removeEventListener('touch', this.#touchCallbackReference);
        this.engine.screenElement.removeEventListener('wheel', this.#wheelCallbackReference);
        this.engine.screenElement.removeEventListener('keydown', this.#keyDownCallbackReference);
        this.engine.screenElement.removeEventListener('keyup', this.#keyUpCallbackReference);
    }
};
import { followBehind } from './Character.js';

export class ClassicChaseCamera {
    constructor(camera, player) {
        this.camera = camera;
        this.player = player;

        //distance the camera will float back from the player.
        this.distance = 7;
        this.update = this.update.bind(this);
        this.wheel = this.wheel.bind(this);
    }
    update() {
        //the constant here is the height the camera will float
        this.camera.position.y = this.player.position.y + 4;
        this.camera.lookAt(
            this.player.position.x,
            this.player.position.y + 2.5,
            this.player.position.z
        );
        //the constant here is the distance back the camera will fly in to float position
        followBehind(this.player, this.camera, this.distance, 7);
    }
    wheel(delta) {
        this.distance -= delta/100;
        if(this.distance > 12) this.distance = 12;
        else if(this.distance < -12) this.distance = -12;
        //this.camera.position.y += delta/2.5;
    }
}
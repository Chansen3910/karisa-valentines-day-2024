export function radiusFollow(leader, follower, r) {
    if ((vec2Distance(leader.position, follower.position)) > r) {
        let vDiff = vec3Subtract(follower.position, leader.position);
        let norm = vec2Distance(leader.position, follower.position);
        follower.position.set(leader.position.x + ((vDiff.x * r) / norm), follower.position.y, leader.position.z + ((vDiff.z * r) / norm));
    }
}
export function followBehind(leader, follower, distance, stepRate) {
    follower.position.x -= (follower.position.x - (-(distance * Math.sin(leader.rotation.y)) + leader.position.x))/stepRate;
    follower.position.z -= (follower.position.z - (-(distance * Math.cos(leader.rotation.y)) + leader.position.z))/stepRate;
}

export function vec3Distance(pos1, pos2) {
    return(Math.sqrt((Math.pow((pos2.x - pos1.x),2) + Math.pow((pos2.y - pos1.y), 2) + Math.pow((pos2.z - pos1.z), 2))));
}

export function vec2Distance(pos1, pos2) {
    return(Math.sqrt((Math.pow((pos2.x - pos1.x), 2)) + (Math.pow((pos2.z - pos1.z), 2))));
}

export function vec3Subtract(vec3Minuend, vec3Subtrahend) {
    let result = ({x: (vec3Minuend.x - vec3Subtrahend.x), y: (vec3Minuend.y - vec3Subtrahend.y), z: (vec3Minuend.z - vec3Subtrahend.z)});
    return(result);
}
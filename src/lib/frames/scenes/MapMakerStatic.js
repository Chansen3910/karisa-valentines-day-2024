import * as THREE from 'three';
import * as SCENES from '../Scenes.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
//import { FastIndex } from '../FastIndex.js';

let fast;
let meshes = {};



export async function mapMakerStatic(engine) {

    const pmremGenerator = new THREE.PMREMGenerator( engine.renderer );
    const hdriLoader = new RGBELoader();
    hdriLoader.load(`./frames/assets/hdris/autumn_forest_04_1k.hdr`, function(texture) {
        const envMap = pmremGenerator.fromEquirectangular(texture).texture;
        texture.dispose();
        scene.environment = envMap;
    });



    let scene = await new THREE.Scene();
    scene.name = `Map Maker Static`;
    scene.transitionIn = `fadeIn`;
    scene.transitionOut = `fadeOut`;
    scene.background = new THREE.Color(`rgb(255, 180, 255)`);



    let map;

    map = await engine.loadGlb(
        './frames/assets/charismatic-capers-map.glb',
        async function(gltf) {
            await gltf.scene.traverse(async function(child) {
                child.frustumCulled = false;
                if(child.isLight) {
                    child.castShadow = true;
                }
                if(child.isMesh) {
                    if(child.name == `water`) meshes.water = child;
                    //if(child.name.includes("karisa-happy-halloween")) happyHalloweenTicker = child;
                    //if(child.name.includes("look-at-how-cute-we-are")) lookAtUsTicker = child;
                }
            });
            gltf.scene.animations = await gltf.animations;
        }
    );

    scene.add(map);
    engine.camera.position.set(
        map.position.x + 10,
        map.position.y + 3,
        map.position.z + 10
    );
    engine.camera.lookAt(map.position);

    //Generate the FastIndex object.
    fast = new FastIndex(map, 0.1);
    await fast.populate();

    //Convert the FastIndex into a concise js module.
    //The pertinent objects are converted to string literals of javascript instantiations.
    let classDeclarations = await getClassDeclarations();
    let trisObjectDeclaration = await getTrisObjectDeclaration();
    let worldObjectDeclaration = await getWorldObjectDeclaration();

    //Download the file.
    downloadJavascriptFile(`frames-static-generated`, classDeclarations + "\n\n" + trisObjectDeclaration + "\n\n" + worldObjectDeclaration);

    //Show stats in ui, press enter to play boot scene.

    scene.update = function() {
        //
    }

    scene.cleanup = async function() {

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

    return(scene);
}










const FLOOR_THRESHOLD = 0.9; // Threshold for upward-facing normals
const WALL_THRESHOLD = 0.7; // Threshold for mostly side-facing normals
const CEILING_THRESHOLD = -0.9; // Threshold for downward-facing normals

//a Vector3 is a point in 3D space composed of three double precision components.
class Vector3 {

    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    equals(v) {
        return(((this.x == v.x) && (this.y == v.y) && (this.z == v.z)));
    }

    add(v) {
        return new Vector3(this.x + v.x, this.y + v.y, this.z + v.z);
    }

    sub(v) {
        return new Vector3(
            this.x - v.x,
            this.y - v.y,
            this.z - v.z
        );
    }

    dot(v) {
        return(this.x * v.x + this.y * v.y + this.z * v.z);
    }

    cross(v) {
        return new Vector3(
            this.y * v.z - this.z * v.y,
            this.z * v.x - this.x * v.z,
            this.x * v.y - this.y * v.x
        );
    }

    length() {
        return(Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z));
    }

    normalize() {
        const len = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
        return(new Vector3(
            this.x / len,
            this.y / len,
            this.z / len
        ));
    }

    scale(scalar) {
        return(new Vector3(this.x * scalar, this.y * scalar, this.z * scalar));
    }

    toString() {
        return(`[${ this.x }, ${ this.y }, ${ this.z }]`);
    }
};

class Line {
    constructor(start, end) {
        this.start = start;
        this.end = end;
    }
};

//a face is a triangle composed of three Vector3 coordinates and a centroid coordinate.
class Face {
    constructor(vA, vB, vC) {
        this.vA = vA;
        this.vB = vB;
        this.vC = vC;
        this.centroid = new Vector3(
            ((vA.x + vB.x + vC.x) / 3),
            ((vA.y + vB.y + vC.y) / 3),
            ((vA.z + vB.z + vC.z) / 3)
        );
    }
};

export class FastIndex {

    constructor(model, accuracy = 1) {
        //the static model loaded by three.js GLTFLoader
        this.model = model;
        this.step = accuracy;

        //the incrementors used to assign unique ids to categorized triangles
        this.TRI_INC = 0;

        //all unique triangles
        this.triangles = {};
        //all unique floor triangles
        this.floors = {};
        //all unique wall triangles
        this.walls = {};
        //all unique ceiling triangles
        this.ceilings = {};

        //the amalgamation of all triangles of all categories in a particular location radius
        //keys are the spatial indices
        //value of each index is an object of "floors", "walls", and "ceilings" properties
        //each property contains an array of all triangles of the associated category which exist in or near the spatial index of the key
        this.world = {};
    }

    getSpatialKey(x, y, z) {
        return(`${ Math.floor(new Number(x)) },${ Math.floor(new Number(y)) }`);
    }

    tris(spatialKey) {
        return(this.world[spatialKey] ?? { walls: [], floors: [], ceilings: [] });
    }

    populate() {
        return(new Promise(function(resolve, reject) {
            if(this.model == undefined) reject(false);

            //console.log(`Traversing model: `, this.model);
            //Traverse the scene to access each mesh
            this.model.traverse((child) => {
                //console.log(`Got child: `, child);
                if(child.isMesh) {
                    //Access the geometry of the mesh
                    const geometry = child.geometry;

                    //Access vertices, normals, and faces of the geometry
                    const vertices = geometry.attributes.position.array;
                    const normals = geometry.attributes.normal.array;
                    const indices = geometry.index.array;

                    //Extract triangle data and categorize by normal orientation
                    //console.log(`Iterating ${ indices.length } indices of child ${ child.name }...`);
                    for(let i = 0; i < indices.length; i += 3) {
                        const index1 = indices[i];
                        const index2 = indices[i + 1];
                        const index3 = indices[i + 2];

                        //Get vertices from indices
                        const vertex1 = new THREE.Vector3().fromArray(vertices, index1 * 3);
                        const vertex2 = new THREE.Vector3().fromArray(vertices, index2 * 3);
                        const vertex3 = new THREE.Vector3().fromArray(vertices, index3 * 3);

                        //Get normals from indices
                        const normal1 = new THREE.Vector3().fromArray(normals, index1 * 3);
                        const normal2 = new THREE.Vector3().fromArray(normals, index2 * 3);
                        const normal3 = new THREE.Vector3().fromArray(normals, index3 * 3);

                        //Structure the data into a Face / Triangle object
                        let face = new Face(
                            new Vector3(vertex1.x, vertex1.y, vertex1.z),
                            new Vector3(vertex2.x, vertex2.y, vertex2.z),
                            new Vector3(vertex3.x, vertex3.y, vertex3.z)
                        );
                        //console.log(`Created new face object: `, face);

                        //Generate a unique key for this triangle.
                        let key = `TRI-${ this.TRI_INC++ }`;
                        //console.log(`Generated unique face key: `, key);



                        face.name = key;



                        //THIS IS WHAT IS USED IN THE FINAL STATIC MAP.
                        this.triangles[key] = face;



                        //Get list of all unique associated spatial indices.
                        let linearSpatialSet = this.getLinearSpatialSet(face, this.step);
                        //console.log(`Got linearSpatialSet for "${ key }": `, linearSpatialSet);

                        //console.log(`Adding references to linearSpatialSet...`);
                        for(let i = 0; i < linearSpatialSet.length; i++) {
                            //If the property doesn't exist, initialize it.
                            let spatialKey = `${ linearSpatialSet[i].x },${ linearSpatialSet[i].z }`;
                            //console.log(`Generated spatial key: `, spatialKey);
                            if(!(spatialKey in this.world)) {
                                //console.log(`Spatial key did not exist... Initialized to empty Sets...`);
                                this.world[spatialKey] = {
                                    floors: [],
                                    walls: [],
                                    ceilings: []
                                };
                            }



                            //console.log(`Ready for categorization by normal y-component...`);
                            if(
                                normal1.y > FLOOR_THRESHOLD &&
                                normal2.y > FLOOR_THRESHOLD &&
                                normal3.y > FLOOR_THRESHOLD
                            ) {
                                //console.log(`Categorized as FLOOR. Pushed to floors object, which is referenced in spatial index object property "floors" at "${ spatialKey }".`);
                                this.floors[key] = (face);//Floor triangle
                                //Push the tri reference. We stored them in objects because the references are smaller than storing the actual tris.
                                this.world[spatialKey].floors.push(this.floors[key]);
                            }else if(
                                Math.abs(normal1.y) < WALL_THRESHOLD &&
                                Math.abs(normal2.y) < WALL_THRESHOLD &&
                                Math.abs(normal3.y) < WALL_THRESHOLD
                            ) {
                                //console.log(`Categorized as WALL. Pushed to walls object, which is referenced in spatial index object property "walls" at "${ spatialKey }".`);
                                this.walls[key] = (face);//Wall triangle
                                //Push the tri reference. We stored them in objects because the references are smaller than storing the actual tris.
                                this.world[spatialKey].walls.push(this.walls[key]);
                            }else if(
                                normal1.y < CEILING_THRESHOLD &&
                                normal2.y < CEILING_THRESHOLD &&
                                normal3.y < CEILING_THRESHOLD
                            ) {
                                //console.log(`Categorized as CEILING. Pushed to ceilings object, which is referenced in spatial index object property "ceilings" at "${ spatialKey }".`);
                                this.ceilings[key] = (face);//Ceiling triangle
                                //Push the tri reference. We stored them in objects because the references are smaller than storing the actual tris.
                                this.world[spatialKey].ceilings.push(this.ceilings[key]);
                            }else {
                                console.log(`LOGICAL FAILURE: NO NORMAL CATEGORIZATION`);
                            }
    
                            //console.log(`Proceeding to next spatial index...`);
                        }

                        //console.log(`All associated spatial indices have been updated for this face.`);
                    }
                    //console.log(`Processing complete for child.`);
                }
            });

            //Log classified triangles
            console.log(`Floors: ${ Object.keys(this.floors).length }`, this.floors);
            console.log(`Walls: ${ Object.keys(this.walls).length }`, this.walls);
            console.log(`Ceilings: ${ Object.keys(this.ceilings).length }`, this.ceilings);
            console.log(`World: `, this.world);
            resolve(true);
        }.bind(this)));
    }

    //takes in two Vector3 positions and returns the scalar distance between them.
    distance3D(vA, vB) {
        let v = (vB.x - vA.x) * (vB.x - vA.x);
        let h = (vB.y - vA.y) * (vB.y - vA.y);
        let d = (vB.z - vA.z) * (vB.z - vA.z);
        return(Math.sqrt(v + h + d));
    }

    //takes in a Vector3 and returns the spatial index.
    getSpatialIndex(v) {
        return({
            x: Math.floor(v.x),
            y: Math.floor(v.y),
            z: Math.floor(v.z)
        });
    }

    /*
        @Param startVector3 - The starting point of a 3D line.
        @Param endVector3 - The ending point of a 3D line.
        @Param step - The total magnitude of each step.
        @Param index - The number of steps to take to find the return value.
        
        returns a double-precision positional Vector3 that is found at magnitude
        (step * index) along the line from the startVector3 to the endVector3.
    */
    getLinearDoublePrecisionStep(startVector3, endVector3, step, index) {
        let d = (step / this.distance3D(startVector3, endVector3));
        
        let [ x0, y0, z0 ] = [ startVector3.x, startVector3.y, startVector3.z ];
        let [ a, b, c ] = [ (endVector3.x - startVector3.x), (endVector3.y - startVector3.y), (endVector3.z - startVector3.z) ];
        let [ x, y, z ] = [ ((a * (index * d)) + x0), ((b * (index * d)) + y0), ((c * (index * d)) + z0) ];
        
        //if ((the length of the line) <= (the distance from startVector3 to the final step vector)) set the step vector equal to endVector3.
        if(this.distance3D(startVector3, endVector3) <= this.distance3D(startVector3, new Vector3(x, y, z))) [ x, y, z ] = [ endVector3.x, endVector3.y, endVector3.z ];

        return(new Vector3(x, y, z));
    }

    /*
        @Param startA - The starting point of the first line, which terminates at point endC.
        @Param startB - The starting point of the second line, which terminates at point endC.
        @Param endC - The terminal point of both lines represented as starting from startA and startB.
        @Param step - The magnitude of steps; the distance between lines.

        returns the set of lines generated from points found (step) distance apart along given
        lines (startA) to (startC) and (startB) to (startC). Note that the shorter line of those
        two derived input lines will act as a pivot once it reaches t = 1. This is so that the
        accuracy of the step is retained given arbitrary faces/triangles.
    */
    getLinearDoublePrecisionSet(startA, startB, endC, step) {
        //console.log(`GET_LINEAR_DOUBLE_PRECISION SET START`);
        let res = [];

        //get collections of lines by fusing the points returned from simultaneously stepping along AC and BC.
        for(let t = 0;; t++) {

            //pivot is automatic:
            //getLinearDoublePrecisionStep does not return double precision vector3 values beyond the normalized line magnitude 1.
            //if the value t = 1 is exceeded on either line, the function returns the ending vector.
            res.push(new Line(
                this.getLinearDoublePrecisionStep(startA, endC, step, t),
                this.getLinearDoublePrecisionStep(startB, endC, step, t)
            ));

            //break when the step vectors taken from both lines are equal.
            //this means they have both exceeded the value t = 1 (of parametric equations per line).
            //they will become equal because when the value t = 1 is exceeded because getLinearDoublePrecisionStep will break and return the end vector.
            //this means the last line will always have length 0, vA and vB == terminal vertex.
            if(res[t].start.equals(res[t].end)) break;
        }

        //console.log(`GET_LINEAR_DOUBLE_PRECISION SET START`);
        return(res);
    }

    /*
        @Param face - An arbitrary triangle as defined in the above Triangle class.
        @Param step - The distance between each generated step line AND the total distance between each sample (for spatial indices) taken along each line.

        returns an array of all unique spatial indices that the triangle interacts with to the accuracy of the step value.
            NOTE: A smaller step takes exponentially longer to compute, but will be more accurate. A good point of diminishing
            returns is probably something like step = 0.05.
    */
    getLinearSpatialSet(face, step) {
        //console.warn(`GET_LINEAR_SPATIAL_SET START.`);

        //Store all collected spatial indices in a Set, convert to array later...
        let res = new Set();

        //get an array of lines to run fixed-length parameteric step samples on.
        let lines = this.getLinearDoublePrecisionSet(face.vA, face.vB, face.vC, step);
        //console.log(`Got lines: `, lines);



        let vertices = this.generateVertices(lines, step);
        //console.log(`Got vertices: `, vertices);



        vertices.forEach(function(value) {
            res.add(JSON.stringify({
                x: (Math.floor(value.x)),
                y: (Math.floor(value.y)),
                z: (Math.floor(value.z))
            }));
        });



        //convert the set to an array and parse the previously stringified spatial indices.
        //console.info(`Converting spatial set "res" Set to Array: `, res);
        res = Array.from(res);
        for(let i = 0; i < res.length; i++) {
            res[i] = JSON.parse(res[i]);
        }
        //console.log(res);

        //for(let i = 0; i < res.length; i++) res[i] = JSON.parse(res[i]);

        //console.warn(`GET_LINEAR_SPATIAL_SET END.`);
        return(res);
    }

    generateVertices(lines, step) {
        const vertices = [];
    
        lines.forEach(line => {
            const { start, end } = line;
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const dz = end.z - start.z;
            const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
            const unitX = dx / length;
            const unitY = dy / length;
            const unitZ = dz / length;
    
            let currentX = start.x;
            let currentY = start.y;
            let currentZ = start.z;
    
            // Step along the line until we reach the end point
            for(let i = 0; i < length; i += step) {
                vertices.push({ x: currentX, y: currentY, z: currentZ });
                currentX += unitX * step;
                currentY += unitY * step;
                currentZ += unitZ * step;
            }
    
            // Add the end point to ensure it's included in the vertices
            vertices.push({ x: end.x, y: end.y, z: end.z });
        });
    
        return vertices;
    }
}











function isValidFilename(filename) {
    //file name too long or too short
    //whitespace, more than one period
    //non-unicode, non-english, special chars
    switch(true) {
        case(filename.length < 1):
        case(filename.length > 20):
        case(filename.includes(` `)):
        case(filename.includes(`.`)):
        //case(!filename.match(regex)):
            alert(`Filename invalid!\nFilenames must be of length 1-20 and consist of non-special, alphabetical English characters of the unicode character set.\nYou do not need to put a file extension.`);
            return(false);
        default: return(true);
    }
}

function downloadJavascriptFile(filename, content) {
    //Create a resource download link element with the filename and URIencoded file content.
    let f = document.createElement(`a`);
    f.setAttribute(`href`, `data:text/javascript;charset=utf-8,${ encodeURIComponent(content) }`);
    f.setAttribute(`download`, `${ filename }.js`);

    //Append the element to the document body.
    document.body.appendChild(f);

    //send a click event to prompt the download.
    f.click();

    //Remove the element from the document body.
    document.body.removeChild(f);
}

function getClassDeclarations() {
    return(`
/**
 * This file was generated automatically by F3.js Map Maker v0.1
 * 
 * It contains exports for a pre-computed static index of geometric data from a previously loaded .glb file
 * named INPUT_FILENAME on DATETIME_GENERATED.
 * 
 * Usage:
 * 
 *  let subject = { *your subject, EG. an actor with a position attribute representing position in 3d space* };
 *  
 *  //The relevant world object key is generated from your subject's position.
 *  //Math.floor must be used if your map geometry is arbitrary, as many other common truncation techniques
 *  //(such as bitwise right shift by 0) do not round down to negative integers.
 *  let key = "" + Math.floor(subject.position.x) + "," + Math.floor(subject.position.z) + "";
 *  
 *  //Returns categorized faces found at (above and below) the location of the subject position vector, ready 
 *  //for physics computations.
 *  let spatialIndex = world[key];
 *  console.log( spatialIndex );//Prints an object like { floors: [ ...Face ], walls[ ...Face ], ceilings[ ...Face ] }
 * 
 *  //The faces are categorized by the y-component of their normals to further eliminate redundant checks and make
 *  //physics computations easier and more concise.
 *  //The categories provided by Map Maker v0.1 are floors (triangles mostly facing up), walls (triangles mostly
 *  //facing to the side), and ceilings (triangles mostly facing down).
 *  //For more information about the y-component threshold values, see the source code in f3/scenes/MapMakerStatic.js
 */
export class Vector3 {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }    
    equals(v) {
        return(((this.x == v.x) && (this.y == v.y) && (this.z == v.z)));
    }
    add(v) {
        return new Vector3(this.x + v.x, this.y + v.y, this.z + v.z);
    }
    sub(v) {
        return new Vector3(
            this.x - v.x,
            this.y - v.y,
            this.z - v.z
        );
    }
    dot(v) {
        return(this.x * v.x + this.y * v.y + this.z * v.z);
    }
    cross(v) {
        return new Vector3(
            this.y * v.z - this.z * v.y,
            this.z * v.x - this.x * v.z,
            this.x * v.y - this.y * v.x
        );
    }
    length() {
        return(Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z));
    }
    normalize() {
        const len = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
        return(new Vector3(
            this.x / len,
            this.y / len,
            this.z / len
        ));
    }
    scale(scalar) {
        return(new Vector3(this.x * scalar, this.y * scalar, this.z * scalar));
    }
    toString() {
        return(\`{ \${ this.x }, \${ this.y }, \${ this.z } }\`);
    }
};

export class Face {
    constructor(vA, vB, vC) {
        this.vA = vA;
        this.vB = vB;
        this.vC = vC;
        this.centroid = new Vector3(
            ((vA.x + vB.x + vC.x) / 3),
            ((vA.y + vB.y + vC.y) / 3),
            ((vA.z + vB.z + vC.z) / 3)
        );
    }
};
    `);
}

function getTrisObjectDeclaration() {
    let declaration = `export let tris = {`;

    console.log(fast);
    //Iterate through all of the tris and add them to the file.
    let triangles = Object.keys(fast.triangles);
    for(let i = 0; i < triangles.length; i++) {
        let k = triangles[i];
        declaration += `\n\t"${ k }": new Face(new Vector3(${ fast.triangles[k].vA.x }, ${ fast.triangles[k].vA.y }, ${ fast.triangles[k].vA.z }), new Vector3(${ fast.triangles[k].vB.x }, ${ fast.triangles[k].vB.y }, ${ fast.triangles[k].vB.z }), new Vector3(${ fast.triangles[k].vC.x }, ${ fast.triangles[k].vC.y }, ${ fast.triangles[k].vC.z }))` + ((i == triangles.length - 1)? (``): (`, `));
    }

    declaration += `\n};`;
    return(declaration);
}

function getWorldObjectDeclaration() {
    let declaration = `export let world = {`;

    //Iterate through each collection for every key that exists and add to the file.
    let keys = Object.keys(fast.world);
    for(let i = 0 ; i < keys.length; i++) {
        declaration += `\n\t"${ keys[i] }": { floors: [`;
        for(let j = 0; j < fast.world[keys[i]].floors.length; j++) {
            declaration += ` tris["${ fast.world[keys[i]].floors[j].name }"]` + ((j == fast.world[keys[i]].floors.length - 1)? (` `): (`, `));
        }
        declaration += `], walls: [`;
        for(let j = 0; j < fast.world[keys[i]].walls.length; j++) {
            declaration += ` tris["${ fast.world[keys[i]].walls[j].name }"]` + ((j == fast.world[keys[i]].walls.length - 1)? (` `): (`, `));
        }
        declaration += `], ceilings: [`;
        for(let j = 0; j < fast.world[keys[i]].ceilings.length; j++) {
            declaration += ` tris["${ fast.world[keys[i]].ceilings[j].name }"]` + ((j == fast.world[keys[i]].ceilings.length - 1)? (` `): (`, `));
        }
        declaration += `] }` + ((i == keys.length - 1)? (``): (`,`));
    }

    declaration += `\n};`;
    return(declaration);
}

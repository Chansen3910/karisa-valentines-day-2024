import * as THREE from 'three';

/*
    The data structures used to design this system have been considered heavily and are very deliberate.
    If you have obtained this code and wish to modify it for your use case, please read the following.

    The FastIndex class is meant to be used to categorize and index static geometries of a given scene loaded
    using the three.js GLTFLoader.

    1. The model is first split into triangles with calculated normals based on the winding order of the
    vertex buffer indices. The triangles are given a unique auto-incremented id so that they may be
    idiomatically passed by reference into the collections mentioned in the next few steps. You must be
    certain that your GLB is valid (with all transforms applied, visually cross-checked with multiple glb
    viewers) before attempting to use this class for static indexing.

    2. The y-component of the normals are used to categorize these triangles into "floors", "walls", and
    "ceilings". These categories simplify the most common physics calculations at runtime.
    
    3. The faces are then rigorously parametrically "scanned" to a fixed-length supplied "step" value, representing
    the density of 3-dimensional parametric samples. The "scan" determines all the spatial indices which a given triangle
    intersects. If the step value is decreased, the samples become more dense, and the computation becomes more intensive.
    
    4. The reference of the given triangle is stored at all of the calculated indices in the "world" collection, which makes
    their retrieval extremely fast at runtime. Note that the spatial index keys are easily generated from coordinates of
    any actor which is meant to interact with the static index.
        For example:

        let key = getSpatialIndexKey( player.position );

        console.log( world[key] );
        //prints the spatial index object ( "{ floors: [...], walls: [...], ceilings: [...] }"" )



    For clarity, the collections are as follows:
    floors:
        The collection of all unique triangles categorized as "floors".
    walls:
        The collection of all unique triangles categorized as "walls".
    ceilings:
        The collection of all unique triangles categorized as "ceilings".
    world:
        The collection of objects representing spatial indices containing objects of collections of references
        of the aforementioned categories. For example:
            world[`0,0,0`] = {
                floors: [
                    floors[`TRI-0`],
                    floors[`TRI-4`]
                ],
                walls: [
                    walls[`TRI-3`]
                ],
                ceilings: [
                    ceilings[`TRI-2`]
                ]
            };
        *** A very important observation to make is that all of these collections are javascript objects. This is
        necessary so that the collections may be sparsely populated, but also for the purpose of more easily
        representing and referencing arbitrary spatial indices, especially negative numbers. If the spatial
        index were a 3D Array, the additional step of calculating the offset of the geometries would be required
        after the geometric calculations and indexing, and ,moreover, depending on the end use case of the index,
        the lookup process may require unnecessary offset computation at runtime (which is antithetical to the spirit
        and purpose of this class). ***
*/

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
                                //console.log(`LOGICAL FAILURE: NO NORMAL CATEGORIZATION`);
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

    floor(previous, subject, ball = false, stairStepHeight = 2) {
        //Obtain the static index for this position.
        //console.log(subject.position);
        let spatialKey = `${ Math.floor(subject.position.x) },${ Math.floor(subject.position.z) }`;
        //console.log(`spatialKey: ${ spatialKey }`);
        //let tris = this.tris(spatialKey);
        let tris = this.tris(spatialKey);
        //console.log(`this.tris(spatialKey):`, this.tris(spatialKey));

        //Find the first intersection.
        let falling = true;
        for(let i = 0; i < tris.floors.length; i++) {

            //console.log(`RAY: (${ subject.position.x }, ${ subject.position.y + 0.5 }, ${ subject.position.z }) >> (${ subject.position.x }, ${ subject.position.y - 0.5 }, ${ subject.position.z })`);
            //console.log(`TRIANGLE: { a: (${ tris.floors[i].vA.toString() }), b: (${ tris.floors[i].vB.toString() }), c: (${ tris.floors[i].vC.toString() })`);

            /*
            let intersection = this.mollerTrumboreIntersect(
                new Vector3(
                    subject.position.x,
                    subject.position.y + (0.5),
                    subject.position.z
                ),
                new Vector3(
                    subject.position.x,
                    subject.position.y - (0.5),
                    subject.position.z
                ),
                new Vector3(
                    tris.floors[i].vA.x,
                    tris.floors[i].vA.y,
                    tris.floors[i].vA.z
                ),
                new Vector3(
                    tris.floors[i].vB.x,
                    tris.floors[i].vB.y,
                    tris.floors[i].vB.z
                ),
                new Vector3(
                    tris.floors[i].vC.x,
                    tris.floors[i].vC.y,
                    tris.floors[i].vC.z
                )
            );
            */
            let intersection = this.interpolateHeight(
                new Vector3(
                    subject.position.x,
                    subject.position.y,
                    subject.position.z
                ),
                tris.floors[i]
            );

            if(intersection && (Math.abs(intersection - subject.position.y) < stairStepHeight)) {
                falling = false;
                //console.log(`INTERSECTION: (${ intersection.x }, ${ intersection.y }, ${ intersection.z })`);

                subject.position.y = intersection;
                ball.position.x = subject.position.x;
                ball.position.y = subject.position.y;
                ball.position.z = subject.position.z;

            }
        }
        if(falling) {
            //No floor was intersected.
            subject.position.x = previous.x;
            subject.position.y = previous.y;
            subject.position.z = previous.z;
        }
    }

    interpolateHeight(point, triangle) {
        const { vA, vB, vC } = triangle;

        //Calculate the areas of the triangles formed by the point and the three vertices
        const areaTotal = 0.5 * (-vB.z * vC.x + vA.z * (-vB.x + vC.x) + vA.x * (vB.z - vC.z) + vB.x * vC.z);
        const area0 = 0.5 * (-vB.z * vC.x + point.z * (-vB.x + vC.x) + point.x * (vB.z - vC.z) + vB.x * vC.z);
        const area1 = 0.5 * (-point.z * vC.x + vA.z * (-point.x + vC.x) + vA.x * (point.z - vC.z) + point.x * vC.z);
        const area2 = 0.5 * (-vB.z * point.x + vA.z * (-vB.x + point.x) + vA.x * (vB.z - point.z) + vB.x * point.z);

        //Calculate the barycentric coordinates
        const s = area0 / areaTotal;
        const t = area1 / areaTotal;
        const u = area2 / areaTotal;

        //Check if the point is inside the triangle
        if(s >= 0 && t >= 0 && u >= 0 && s + t <= 1) {
            //Interpolate the height using the barycentric coordinates
            return(s * vA.y + t * vB.y + u * vC.y);
        }else {
            //console.log(`point ${ point.toString() } is not in triangle ${ triangle.vA.toString() }, ${ triangle.vB.toString() }, ${ triangle.vC.toString() }`);
            //Point is not inside the triangle
            return(false);
        }
    }

    /*
    isPointInsideTriangle(point, triangle) {
        const { vA, vB, vC } = triangle;

        //Compute vectors
        const v0 = { x: vC.x - vA.x, z: vC.z - vA.z };
        const v1 = { x: vB.x - vA.x, z: vB.z - vA.z };
        const v2 = { x: point.x - vA.x, z: point.z - vA.z };

        //Compute dot products
        const dot00 = v0.x * v0.x + v0.z * v0.z;
        const dot01 = v0.x * v1.x + v0.z * v1.z;
        const dot02 = v0.x * v2.x + v0.z * v2.z;
        const dot11 = v1.x * v1.x + v1.z * v1.z;
        const dot12 = v1.x * v2.x + v1.z * v2.z;

        //Compute barycentric coordinates
        const invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
        const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
        const v = (dot00 * dot12 - dot01 * dot02) * invDenom;

        //Check if point is inside triangle
        return(u >= 0 && v >= 0 && u + v <= 1);
    }
    */

    mollerTrumboreIntersect(rayStart, rayEnd, v0, v1, v2) {
        let edge1 = v1.sub(v0);
        let edge2 = v2.sub(v0);
        let ray_cross_e2 = rayEnd.cross(edge2);
        let det = edge1.dot(ray_cross_e2);
        if(det == 0) return(false);
        let inv_det = 1.0 / det;
        let s = rayStart.sub(v0);
        //let u = inv_det * s.dot(ray_cross_e2);
        //if(u < 0 || u > 1) return(false);
        let s_cross_e1 = s.cross(edge1);
        //let v = inv_det * rayEnd.dot(s_cross_e1);
        //if(v < 0 || u + v > 1) return(false);

        let t = inv_det * edge2.dot(s_cross_e1);
        if(t <= 0) return(false);
        return(this.getPositionAlongLine(rayStart, rayEnd, (t / 2)));
    }

    getPositionAlongLine(startPoint, endPoint, distance) {
        //Clone the objects, as they are passed by reference.
        let start = new Vector3(startPoint.x, startPoint.y, startPoint.z);
        let end = new Vector3(endPoint.x, endPoint.y, endPoint.z);

        //Calculate the direction vector of the line
        let direction = end.sub(start).normalize();

        //Calculate the position along the line using the parametric equation of a line
        return(start.add(direction.scale(distance)));
    }

};

/*
    getBarycentricCoordinates(rayStart, rayEnd, v0, v1, v2) {
        const EPSILON = 0.00000000000000001;
        let t = 0;
        let u = 0;
        let v = 0;
        //find vectors for two edges sharing vert0
		let edge1 = v1.sub(v0);
		let edge2 = v2.sub(v0);

		//begin calculating determinant - also used to calculate u parameter
		let pvec = rayEnd.cross(edge2);

		//if determinant is near zero, ray lies in plane of triangle
		let det = edge1.dot(pvec);

		if(det <= 0) return(false);

		//calculate distance from vert0 to ray origin
		let tvec = rayStart.sub(v0);

		//calculate U parameter and test bounds
		u = tvec.dot(pvec);
		if(u < 0.0 || u > det) return(false);

		//prepare to test V parameter
		let qvec = tvec.cross(edge1);

		//calculate V parameter and test bounds
		v = rayEnd.dot(qvec);
		if(v < 0.0 || u + v > det) return(false);

        //calculate t, scale parameters, ray intersects triangle
		t = edge2.dot(qvec);
		let inv_det = 1.0 / det;
		t *= inv_det;
		u *= inv_det;
		v *= inv_det;

        if(det > -EPSILON && det < EPSILON) return(false);
		
        inv_det = 1.0 / det;

		//calculate distances from vert0 to ray origin
		tvec = rayStart.sub(v0);

		//calculate U parameter and test bounds
		u = tvec.dot(pvec) * inv_det;
		if(u < 0.0 || u > 1.0) return(false);

		//prepare to test V parameter
		qvec = tvec.cross(edge1);

		//calculate V parameter and test bounds
		v = rayEnd.dot(qvec) * inv_det;
		if(v < 0.0 || u + v > 1.0) return(false);

		t = edge2.dot(qvec) * inv_det;

        //convert from barycentric to cartesian
        let x = t * v0.x + u * v1.x + v * v2.x;
        let y = t * v0.y + u * v1.y + v * v2.y;
        let z = t * v0.z + u * v1.z + v * v2.z;
		return({ t, u, v });
    }
//*/
/*
    mollerTrumboreIntersect(rayStart, rayEnd, v0, v2, v1) {
        //console.log(rayEnd);
        //rayEnd = rayEnd.normalize();
        //console.log(rayEnd);

        //Return false if no collision.
        const e1 = v1.sub(v0);
        const e2 = v2.sub(v0);
        const rayDirection = rayEnd.sub(rayStart);
        const h = rayDirection.cross(e2);
        const a = e1.dot(h);
        if(a === 0) return(false);
        const f = 1 / a;
        const s = rayStart.sub(v0);
        const u = f * s.dot(h);
        if(u < 0 || u > 1) return(false);
        const q = s.cross(e1);
        const v = f * rayDirection.dot(q);
        if(v < 0 || u + v > 1) return(false);
        const t0 = f * e2.dot(q);
        if(t0 <= 0) return(false);

        //Get the point of intersection.
        let edge1 = v1.sub(v0);
        let edge2 = v2.sub(v0);
        let pvec = rayEnd.cross(edge2);
        let det = edge1.dot(pvec);
        let tvec = rayStart.sub(v0);
        let qvec = tvec.cross(edge1);
        let t = (edge2.dot(qvec)) / det;
        let out = new Vector3(0, 0, 0);
        out.x = (rayStart.x + t0 * rayEnd.x);
        out.y = (rayStart.y + t0 * rayEnd.y);
        out.z = (rayStart.z + t0 * rayEnd.z);
        return out;
    }
//*/

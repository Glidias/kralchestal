/**
 * 
 * @param {number} index 
 * @param {number} base 
 * @return {number}
 */
export function halton (index, base) {
    let fraction = 1;
    let result = 0;
    while (index > 0) {
      fraction /= base;
      result += fraction * (index % base);
      index = Math.floor(index / base); // floor division
    }
    return result;
  }

/**
 * 
 * @param {number} n 
 * @return {number}
 */
function r (n) {
    return 0.618033988749894848 * n % 1;
}
/**
 * 
 * @param {number} n 
 * @param {{x:number, y:number}}
 * @return {{x:number, y:number}}
 */
export function r2(n, result) {
    result.x = (0.5+0.7548776662466927600500267982588*n) %1; 
    result.y = (0.5+0.56984029099805326591218186327522*n) %1;
    return result;
}

/**
 * 
 * @param {number} n 
 * @param {{x:number, y:number, z:number}}
 * @return {{x:number, y:number, z:number}}
 */
export function r3(n, result) {
    result.x = (0.5+0.7548776662466927600500267982588*n) %1; 
    result.y = (0.5+0.56984029099805326591218186327522*n) %1;
    result.z = (0.5+0.4301597090019467340894854059891*n) %1
}


/**
 * 
 * @param {number} n 
 * @return {number}
 */
export function rx(n){
  return (n * 0.754877669 % 1)
}

/**
 * 
 * @param {number} n 
 * @return {number}
 */
export function ry(n){
  return  (n * 0.569840296 % 1)
}

/**
 * 
 * @param {number} n 
 * @return {number}
 */
export function r2x(n){
    return (0.5 + n * 0.754877669 % 1)
  }
  
  /**
   * 
   * @param {number} n 
   * @return {number}
   */
  export function r2y(n){
    return  (0.5 + n * 0.569840296 % 1)
  }

/**
 * 
 * @param {{x:number, y:number, z:number}} A
 * @param {{x:number, y:number, z:number}} B
 * @param {{x:number, y:number, z:number}} C
 * @param {number} p First random factor
 * @param {number} q Second random factor
 * @param {{x:number, y:number, z:number}} result
 * @return {{x:number, y:number, z:number}} The result
 */
function pointOnTriangle(A, B, C, p, q, result) {
    let v = Math.sqrt(q);
    let a = 1 - v;
    let b = (1 - p) * v;
    let c = p * v;
    result.x = a*A.x + b*B.x + c*C.x;
    result.y = a*A.y + b*B.y + c*C.y;
    result.z = a*A.z + b*B.z + c*C.z;
    return result;
}

/**
 * 
 * @param {{x:number, y:number, z:number}} A 
 * @param {{x:number, y:number, z:number}} B 
 * @param {{x:number, y:number, z:number}} C 
 * @param {number} p First random factor
 * @param {number} q Second random factor
 * @param {{x:number, y:number, z:number}} result 
 * @return {{x:number, y:number, z:number}} The result
 */
export function pointOnTriangleParallelRoot(A, B, C, p, q, result) {
    let v = Math.sqrt(q);
    let a = 1 - v;
    let b = (1 - p) * v;
    result.x = A.x + (B.x - A.x)* a + (C.x - A.x) * b;
    result.y = A.y + (B.y - A.y) *a + (C.y - A.y) *b;
    result.z = A.z + (B.z- A.z) *a + (C.z - A.z) *b;
}



/**
 * 
 * @param {{x:number, y:number, z:number}} A 
 * @param {{x:number, y:number, z:number}} B 
 * @param {{x:number, y:number, z:number}} C 
 * @param {number} p First random factor
 * @param {number} q Second random factor
 * @param {{x:number, y:number, z:number}} result 
 * @return {{x:number, y:number, z:number}} The result
 */
export function pointOnTriangleParallelFlip(A, B, C, p, q, result) {
    if (p + q > 1) {
        p = 1 - p
        q = 1 - q
    }
    result.x =  A.x + (B.x - A.x)* q + (C.x - A.x) * p;
    result.y = A.y + (B.y - A.y) *q + (C.y - A.y) *p;
    result.z = A.z + (B.z- A.z) *q + (C.z - A.z) *p;
}


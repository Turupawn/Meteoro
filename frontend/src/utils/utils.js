import Web3 from 'web3';

const PRINT_LEVELS = ['profile', 'error']; //['debug', 'profile', 'error'];

export function generateRandomBytes32() {
    return Web3.utils.randomHex(32);
}

export function calculateCards(secret, houseRandomness) {
    const secretBig = BigInt(secret);
    const houseRandomnessBig = BigInt(houseRandomness);
    const xorResult = secretBig ^ houseRandomnessBig;
    const playerCard = Number((xorResult >> 128n) % 13n) + 2;
    const houseCard = Number((xorResult & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFn) % 13n) + 2;
    let winner;
    if (playerCard > houseCard) {
        winner = 'Player';
    } else {
        winner = 'House';
    }
    return { playerCard, houseCard, winner };
}

export function printLog(levels, ...args) {
    if (!Array.isArray(levels)) levels = [levels];
    const shouldPrint = levels.some(level => PRINT_LEVELS.includes(level));
    if (!shouldPrint) return;
    if (levels.includes('error')) {
        console.error(...args);
    } else {
        console.log(...args);
    }
}

export function applyPerspective(fixedPointAX, fixedPointAY, fixedPointBX, fixedPointBY, calculatedPointX) {
    let m = (fixedPointBY - fixedPointAY) / (fixedPointBX - fixedPointAX);
    return m * (calculatedPointX - fixedPointAX) + fixedPointAY;
}

export function applyPerspectiveToQuadImageToRight(quadImage, perspectiveX, perspectiveY) {
    quadImage.topCenter.y = applyPerspective(quadImage.topLeft.x, quadImage.topLeft.y, perspectiveX, perspectiveY, quadImage.topCenter.x);
    quadImage.topRight.y = applyPerspective(quadImage.topLeft.x, quadImage.topLeft.y, perspectiveX, perspectiveY, quadImage.topRight.x);
    quadImage.center.y = applyPerspective(quadImage.centerLeft.x, quadImage.centerLeft.y, perspectiveX, perspectiveY, quadImage.center.x);
    quadImage.centerRight.y = applyPerspective(quadImage.centerLeft.x, quadImage.centerLeft.y, perspectiveX, perspectiveY, quadImage.centerRight.x);
    quadImage.bottomCenter.y = applyPerspective(quadImage.bottomLeft.x, quadImage.bottomLeft.y, perspectiveX, perspectiveY, quadImage.bottomCenter.x);
    quadImage.bottomRight.y = applyPerspective(quadImage.bottomLeft.x, quadImage.bottomLeft.y, perspectiveX, perspectiveY, quadImage.bottomRight.x);
}


export function applyPerspectiveToQuadImageToLeft(quadImage, perspectiveX, perspectiveY) {
    quadImage.topCenter.y = applyPerspective(quadImage.topRight.x, quadImage.topRight.y, perspectiveX, perspectiveY, quadImage.topCenter.x);
    quadImage.topLeft.y = applyPerspective(quadImage.topRight.x, quadImage.topRight.y, perspectiveX, perspectiveY, quadImage.topLeft.x);
    quadImage.center.y = applyPerspective(quadImage.centerRight.x, quadImage.centerRight.y, perspectiveX, perspectiveY, quadImage.center.x);
    quadImage.centerLeft.y = applyPerspective(quadImage.centerRight.x, quadImage.centerRight.y, perspectiveX, perspectiveY, quadImage.centerLeft.x);
    quadImage.bottomCenter.y = applyPerspective(quadImage.bottomRight.x, quadImage.bottomRight.y, perspectiveX, perspectiveY, quadImage.bottomCenter.x);
    quadImage.bottomLeft.y = applyPerspective(quadImage.bottomRight.x, quadImage.bottomRight.y, perspectiveX, perspectiveY, quadImage.bottomLeft.x);
}

export function applyPerspectiveToQuadImageToDown(quadImage, perspectiveX, perspectiveY) {
    quadImage.centerLeft.x = applyPerspective(quadImage.topLeft.y, quadImage.topLeft.x, perspectiveY, perspectiveX, quadImage.centerLeft.y);
    quadImage.bottomLeft.x = applyPerspective(quadImage.topLeft.y, quadImage.topLeft.x, perspectiveY, perspectiveX, quadImage.bottomLeft.y);
    quadImage.center.x = applyPerspective(quadImage.topCenter.y, quadImage.topCenter.x, perspectiveY, perspectiveX, quadImage.center.y);
    quadImage.bottomCenter.x = applyPerspective(quadImage.topCenter.y, quadImage.topCenter.x, perspectiveY, perspectiveX, quadImage.bottomCenter.y);
    quadImage.centerRight.x = applyPerspective(quadImage.topRight.y, quadImage.topRight.x, perspectiveY, perspectiveX, quadImage.centerRight.y);
    quadImage.bottomRight.x = applyPerspective(quadImage.topRight.y, quadImage.topRight.x, perspectiveY, perspectiveX, quadImage.bottomRight.y);
}

export function isLandscape() {
    return window.innerWidth > window.innerHeight;
}